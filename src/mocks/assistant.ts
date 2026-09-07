/**
 * Mock assistant for NEXT_PUBLIC_MOCK=1.
 *
 * It answers by calling the same mock endpoints the real tools call, so a card
 * in mock mode has the same shape as a card in production. The prose is canned;
 * the data under it is not.
 */
import { mockRequest } from "./handlers";
import type { AssistantHealth, ChatEvent, ChatRequest } from "@/lib/api/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Places the mock understands, so "al Portal Sur" resolves without a geocoder. */
const PLACES: Record<string, { lat: number; lon: number; name: string }> = {
  "portal sur": { lat: 4.5978, lon: -74.1616, name: "Portal Sur" },
  "portal norte": { lat: 4.7546, lon: -74.0459, name: "Portal Norte" },
  "calle 100": { lat: 4.6841, lon: -74.0517, name: "Calle 100" },
  "parque de la 93": { lat: 4.6766, lon: -74.0483, name: "Parque de la 93" },
  "chico": { lat: 4.6845, lon: -74.053, name: "Chicó Norte" },
};

function findPlace(q: string): { lat: number; lon: number; name: string } | null {
  const n = norm(q);
  for (const [k, v] of Object.entries(PLACES)) if (n.includes(k)) return v;
  return null;
}

type Emit = (ev: ChatEvent) => void;

/** Types out prose a few characters at a time, so the UI's streaming path is exercised. */
async function say(text: string, emit: Emit, signal: AbortSignal) {
  for (const word of text.split(/(\s+)/)) {
    if (signal.aborted) return;
    emit({ type: "token", text: word });
    await sleep(18);
  }
}

export async function mockChatStream(body: ChatRequest, emit: Emit, signal: AbortSignal): Promise<void> {
  const last = [...body.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const q = norm(last);
  await sleep(280);
  if (signal.aborted) return;

  // deterministic error states, so the screenshots and the tests can reach them
  if (q.includes("presupuesto") || q.includes("budget")) {
    emit({ type: "error", code: "ASSISTANT_BUDGET", message: "El presupuesto diario del asistente se agotó." });
    return;
  }
  if (q.includes("caido") || q.includes("upstream") || q.includes("provider down")) {
    emit({ type: "error", code: "ASSISTANT_UPSTREAM", message: "El proveedor no respondió." });
    return;
  }

  // 1 · how do I get to X → plan_trip
  if (q.includes("como llego") || q.includes("how do i get") || q.includes("llegar a") || q.includes("ir a")) {
    const to = findPlace(q) ?? PLACES["portal sur"];
    const from = body.context?.lat != null && body.context?.lon != null ? { lat: body.context.lat, lon: body.context.lon, name: "tu ubicación" } : PLACES["portal norte"];
    emit({ type: "tool", name: "find_place", args: { query: to.name } });
    await sleep(300);
    if (signal.aborted) return;
    emit({
      type: "card",
      kind: "place",
      payload: { id: `place:${to.name}`, name: to.name, label: "Estación", lat: to.lat, lon: to.lon, type: "station", stopId: null, component: "trunk", source: "gtfs", distanceMeters: null },
    });
    emit({ type: "tool", name: "plan_trip", args: { to: to.name } });
    await sleep(700);
    if (signal.aborted) return;
    const plan = await mockRequest<{ itineraries: unknown[] }>("/v1/cities/bogota/plan", {
      fromLat: from.lat, fromLon: from.lon, toLat: to.lat, toLon: to.lon, numItineraries: 3,
    });
    // Exactly what the API emits: kind "itineraries", payload {from, to, itineraries}.
    if (plan.itineraries.length) {
      emit({
        type: "card",
        kind: "itineraries",
        payload: { from: { name: from.name, lat: from.lat, lon: from.lon }, to: { name: to.name, lat: to.lat, lon: to.lon }, itineraries: plan.itineraries.slice(0, 3) },
      });
    }
    await say(`La mejor opción hasta ${to.name} sale desde ${from.name}. Toca la tarjeta para verla en el mapa y arrancar el viaje.`, emit, signal);
    emit({ type: "done", usage: { inputTokens: 1840, outputTokens: 96 }, costUsd: 0.0042 });
    return;
  }

  // 2 · when does route X pass / next buses → next_departures
  if (q.includes("a que hora") || q.includes("pasa el") || q.includes("proximo") || q.includes("what time")) {
    emit({ type: "tool", name: "next_departures", args: { stop: "Portal Norte" } });
    await sleep(600);
    if (signal.aborted) return;
    // Portal Norte in the mock dataset; the id has to exist or the tool 404s
    const board = await mockRequest<unknown>("/v1/cities/bogota/stops/bogota:7001/board", { perRoute: 2 });
    emit({ type: "card", kind: "board", payload: board });
    await say("Estas son las próximas salidas en Portal Norte. Las que tienen punto verde vienen en vivo; el resto son horario programado.", emit, signal);
    emit({ type: "done", usage: { inputTokens: 1620, outputTokens: 74 }, costUsd: 0.0031 });
    return;
  }

  // 3 · disruptions → service_alerts
  if (q.includes("desvio") || q.includes("alerta") || q.includes("novedad") || q.includes("disrupt")) {
    emit({ type: "tool", name: "service_alerts" });
    await sleep(520);
    if (signal.aborted) return;
    const al = await mockRequest<{ alerts: unknown[] }>("/v1/cities/bogota/alerts", { active: true });
    emit({ type: "card", kind: "alerts", payload: { alerts: al.alerts.slice(0, 2) } });
    await say("Hay novedades activas hoy. Toca una para ver a qué rutas afecta.", emit, signal);
    emit({ type: "done", usage: { inputTokens: 1410, outputTokens: 52 }, costUsd: 0.0024 });
    return;
  }

  // 4 · fare
  if (q.includes("cuanto") || q.includes("tarifa") || q.includes("cuesta") || q.includes("cost")) {
    emit({ type: "tool", name: "fare_estimate" });
    await sleep(450);
    if (signal.aborted) return;
    const priced = await mockRequest<{ itineraries: unknown[] }>("/v1/cities/bogota/plan", {
      fromLat: PLACES["portal norte"].lat, fromLon: PLACES["portal norte"].lon,
      toLat: PLACES["portal sur"].lat, toLon: PLACES["portal sur"].lon, numItineraries: 3, onDemand: true,
    });
    // The API answers a cost question with kind "fares" and {itineraries}.
    emit({ type: "card", kind: "fares", payload: { itineraries: priced.itineraries.slice(0, 3) } });
    await say("Un pasaje cuesta 3.200 pesos, y el transbordo dentro de la ventana no cobra de nuevo. Es un valor estimado con la tarifa configurada para la ciudad.", emit, signal);
    emit({ type: "done", usage: { inputTokens: 1180, outputTokens: 61 }, costUsd: 0.0019 });
    return;
  }

  // 5 · bikes nearby → bikeStations
  if (q.includes("bici") || q.includes("bike")) {
    emit({ type: "tool", name: "bike_stations" });
    await sleep(480);
    if (signal.aborted) return;
    const near = await mockRequest<{ rental?: unknown[] }>("/v1/cities/bogota/stops/nearby", {
      lat: PLACES["calle 100"].lat, lon: PLACES["calle 100"].lon, radius: 600, include: "rental",
    });
    const stations = (near.rental ?? []).slice(0, 4);
    if (stations.length) emit({ type: "card", kind: "bikeStations", payload: { stations } });
    await say("Estas son las estaciones de bici más cercanas, con las bicis y los puestos libres que reporta el operador.", emit, signal);
    emit({ type: "done", usage: { inputTokens: 1240, outputTokens: 48 }, costUsd: 0.0021 });
    return;
  }

  // 6 · stops nearby → stops
  if (q.includes("parada") && (q.includes("cerca") || q.includes("near"))) {
    emit({ type: "tool", name: "nearby_stops" });
    await sleep(430);
    if (signal.aborted) return;
    const near = await mockRequest<{ stops?: unknown[] }>("/v1/cities/bogota/stops/nearby", {
      lat: PLACES["calle 100"].lat, lon: PLACES["calle 100"].lon, radius: 500,
    });
    const stops = (near.stops ?? []).slice(0, 5);
    if (stops.length) emit({ type: "card", kind: "stops", payload: { stops } });
    await say("Estas son las paradas más cercanas. Toca una para ver sus próximas salidas.", emit, signal);
    emit({ type: "done", usage: { inputTokens: 1190, outputTokens: 41 }, costUsd: 0.0018 });
    return;
  }

  // 7 · a route by name → routes
  if (q.includes("ruta") || q.includes("route")) {
    emit({ type: "tool", name: "route_info" });
    await sleep(400);
    if (signal.aborted) return;
    const found = await mockRequest<{ routes?: unknown[] }>("/v1/cities/bogota/routes", { q: "G12" });
    const routes = (found.routes ?? []).slice(0, 3);
    if (routes.length) emit({ type: "card", kind: "routes", payload: { routes } });
    await say("Esto es lo que sé de esa ruta. Toca para ver su recorrido y sus buses en vivo.", emit, signal);
    emit({ type: "done", usage: { inputTokens: 1150, outputTokens: 39 }, costUsd: 0.0017 });
    return;
  }

  // 8 · buses around me → vehicles
  if (q.includes("buses cerca") || q.includes("buses around") || q.includes("cerca de mi")) {
    emit({ type: "tool", name: "vehicles_near" });
    await sleep(460);
    if (signal.aborted) return;
    const live = await mockRequest<{ vehicles?: { lat: number; lon: number }[] }>("/v1/cities/bogota/vehicles", {});
    const vehicles = (live.vehicles ?? []).slice(0, 5).map((v, i) => ({ ...v, metres: 120 + i * 90 }));
    if (vehicles.length) emit({ type: "card", kind: "vehicles", payload: { vehicles } });
    await say("Estos son los buses que tengo cerca de ti ahora mismo.", emit, signal);
    emit({ type: "done", usage: { inputTokens: 1310, outputTokens: 37 }, costUsd: 0.0019 });
    return;
  }

  // 9 · nothing matched: say so, do not invent
  await say("No tengo una herramienta que responda eso. Puedo planear un viaje, decirte las próximas salidas de una parada, o contarte si hay desvíos hoy.", emit, signal);
  emit({ type: "done", usage: { inputTokens: 980, outputTokens: 44 }, costUsd: 0.0012 });
}

export function mockAssistantHealth(): AssistantHealth {
  return { enabled: true, provider: "anthropic", model: "claude-opus-5", spentUsd: 0.34, hasKey: true, dailyBudgetUsd: 5, calls: 42, errors: 0 };
}
