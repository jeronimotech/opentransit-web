"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { ItineraryCard } from "@/components/itinerary/ItineraryCard";
import { ArrivalBoard } from "@/components/stops/ArrivalBoard";
import { AlertCard } from "@/components/alerts/AlertCard";
import { FareTag } from "@/components/ui/FareTag";
import { RouteChip } from "@/components/ui/RouteChip";
import { Icon } from "@/components/ui/primitives";
import { faresOf, componentsOf } from "@/lib/city-config";
import type {
  Alert, BoardResponse, ChatCard as Card, City, GeocodeResult, Itinerary,
  NearbyRentalStation, NearbyStop, NextResponse, RentalStation, RouteRef, Stop, StopDetail, Vehicle,
} from "@/lib/api/types";

/**
 * A tool result, rendered with the same components the screens use — so an answer
 * is tappable and leads into the real app rather than being a dead end.
 *
 * The kinds here are the ones the API actually emits (see the assistant's tools:
 * place, itineraries, fares, board, next, alerts, vehicles, bikeStations, stops,
 * routes). The singular spellings are accepted too because an older server may
 * still send them. An unknown kind is skipped silently: a newer server may send
 * cards this build cannot draw, and the prose beside them still stands on its own.
 */
export function ChatCardView({ card, city }: { card: Card; city: City }) {
  const { t } = useI18n();
  const router = useRouter();
  const base = `/${city.id}`;

  /** Both spellings of every payload: `{itineraries: [...]}` and a bare itinerary. */
  const itinerariesOf = (payload: unknown): Itinerary[] => {
    const p = payload as { itineraries?: Itinerary[] } | Itinerary | null;
    if (!p) return [];
    if (Array.isArray((p as { itineraries?: Itinerary[] }).itineraries)) return (p as { itineraries: Itinerary[] }).itineraries;
    return (p as Itinerary).legs?.length ? [p as Itinerary] : [];
  };

  const planHref = (it: Itinerary, index: number) => {
    const first = it.legs[0], last = it.legs[it.legs.length - 1];
    return `${base}?from=${first.from.lat},${first.from.lon}&to=${last.to.lat},${last.to.lon}&selected=${index}`;
  };

  switch (card.kind) {
    // ── trips ────────────────────────────────────────────────────────────────
    case "itineraries":
    case "fares":
    case "itinerary":
    case "fare": {
      // `fares` and `fare` are the same trip shape; the difference is only that the
      // question was about cost, and the itinerary card already shows the fare.
      const its = itinerariesOf(card.payload);
      if (its.length) {
        return (
          <div data-testid="card-itinerary" className="flex flex-col gap-2">
            {its.slice(0, 2).map((it, i) => (
              <ItineraryCard
                key={it.id ?? i}
                itinerary={it}
                tz={city.timezone}
                selected={false}
                index={i}
                fares={faresOf(city)}
                onSelect={() => router.push(planHref(it, i))}
              />
            ))}
            {its.length > 2 ? (
              <Link href={planHref(its[0], 0)} className="text-xs font-semibold text-signal hover:underline">
                {t.assistant.moreOptions(its.length - 2)}
              </Link>
            ) : null}
          </div>
        );
      }
      // A bare fare object, which is what an older server sent for `fare`.
      const f = card.payload as { amount?: number } | null;
      if (typeof f?.amount !== "number") return null;
      return (
        <div data-testid="card-fare">
          <FareTag fare={card.payload as Parameters<typeof FareTag>[0]["fare"]} size="md" />
        </div>
      );
    }

    // ── departures ───────────────────────────────────────────────────────────
    case "board": {
      const b = card.payload as BoardResponse | null;
      if (!b?.rows) return null;
      return (
        <div data-testid="card-board">
          <ArrivalBoard board={b} city={city.id} />
          <Link href={`${base}/stops/${encodeURIComponent(b.stop.id)}`} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-signal hover:underline">
            {t.assistant.openStop} <Icon.Chevron width={12} height={12} />
          </Link>
        </div>
      );
    }
    case "next": {
      const n = card.payload as NextResponse | null;
      if (!n?.next?.length) return null;
      return (
        <div data-testid="card-next" className="rounded-card border border-line bg-paper-2 p-3">
          <div className="mb-2 flex items-center gap-2">
            <RouteChip route={n.route} size="md" />
            <span className="truncate text-sm font-semibold">{n.stop.name}</span>
          </div>
          <ul className="flex flex-wrap gap-2">
            {n.next.map((x, i) => (
              <li key={`${x.tripId ?? i}-${x.time}`} className="inline-flex items-center gap-1 rounded-md bg-paper-3 px-2 py-1 text-sm font-bold tabular-nums">
                {t.stop.inMin(x.minutes)}
                {x.source === "live" ? <span className="h-1.5 w-1.5 rounded-full bg-moss" aria-hidden /> : null}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    // ── alerts ───────────────────────────────────────────────────────────────
    case "alerts": {
      const raw = card.payload as { alerts?: Alert[] } | Alert[] | null;
      const list = Array.isArray(raw) ? raw : (raw?.alerts ?? []);
      if (!list.length) return null;
      return (
        <div data-testid="card-alerts" className="flex flex-col gap-2">
          {list.slice(0, 3).map((a) => (
            <AlertCard key={a.id} alert={a} tz={city.timezone} city={city.id} links={city.links} />
          ))}
        </div>
      );
    }

    // ── places and stops ─────────────────────────────────────────────────────
    case "place": {
      const p = card.payload as GeocodeResult | null;
      if (!p?.name) return null;
      const href = p.stopId ? `${base}/stops/${encodeURIComponent(p.stopId)}` : `${base}?lat=${p.lat}&lon=${p.lon}&zoom=16`;
      return (
        <Link href={href} data-testid="card-place" className="flex items-center gap-2 rounded-card border border-line bg-paper-2 p-3 hover:border-ink">
          <Icon.Pin className="shrink-0 text-signal" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{p.name}</span>
            {p.label ? <span className="block truncate text-xs text-ink-3">{p.label}</span> : null}
          </span>
          <Icon.Chevron width={14} height={14} className="text-ink-3" />
        </Link>
      );
    }
    case "stop": {
      const s = card.payload as StopDetail | null;
      if (!s?.id) return null;
      return <StopRow city={city} stop={s} testid="card-stop" />;
    }
    case "stops": {
      const list = (card.payload as { stops?: NearbyStop[] } | null)?.stops ?? [];
      if (!list.length) return null;
      return (
        <div data-testid="card-stops" className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{t.assistant.stopsNear}</p>
          {list.slice(0, 5).map((s) => (
            <StopRow key={s.id} city={city} stop={s} />
          ))}
        </div>
      );
    }

    // ── routes ───────────────────────────────────────────────────────────────
    case "route": {
      const r = card.payload as RouteRef | null;
      if (!r?.id) return null;
      return <RouteRow city={city} route={r} testid="card-route" />;
    }
    case "routes": {
      const list = (card.payload as { routes?: RouteRef[] } | null)?.routes ?? [];
      if (!list.length) return null;
      return (
        <div data-testid="card-routes" className="flex flex-col gap-1.5">
          {list.slice(0, 5).map((r) => (
            <RouteRow key={r.id} city={city} route={r} />
          ))}
        </div>
      );
    }

    // ── live vehicles and shared bikes ───────────────────────────────────────
    case "vehicles": {
      const list = (card.payload as { vehicles?: (Vehicle & { metres?: number })[] } | null)?.vehicles ?? [];
      if (!list.length) return null;
      const palette = componentsOf(city);
      return (
        <div data-testid="card-vehicles" className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{t.assistant.busesNear}</p>
          {list.slice(0, 5).map((v) => {
            const colour = palette.find((c) => c.id === v.component)?.color ?? undefined;
            return (
              <Link
                key={v.id}
                href={`${base}/live?vehicle=${encodeURIComponent(v.id)}`}
                className="flex items-center gap-2 rounded-card border border-line bg-paper-2 px-3 py-2 hover:border-ink"
              >
                <span className="rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ background: colour ?? "var(--ink)" }}>
                  {v.routeShortName ?? "—"}
                </span>
                {typeof v.metres === "number" ? (
                  <span className="text-sm text-ink-2 tabular-nums">{t.assistant.metresAway(v.metres)}</span>
                ) : null}
                <Icon.Chevron width={14} height={14} className="ml-auto text-ink-3" />
              </Link>
            );
          })}
        </div>
      );
    }
    case "bikeStations":
    case "rental": {
      const raw = card.payload as { stations?: NearbyRentalStation[] } | RentalStation | null;
      const list = Array.isArray((raw as { stations?: NearbyRentalStation[] })?.stations)
        ? (raw as { stations: NearbyRentalStation[] }).stations
        : raw && (raw as RentalStation).id
          ? [raw as NearbyRentalStation]
          : [];
      if (!list.length) return null;
      return (
        <div data-testid="card-bike-stations" className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{t.assistant.bikesNear}</p>
          {list.slice(0, 5).map((s) => (
            <Link
              key={s.id}
              href={`${base}?lat=${s.lat}&lon=${s.lon}&zoom=16&layer=rental`}
              className="flex items-center gap-2 rounded-card border border-line bg-paper-2 px-3 py-2 hover:border-ink"
            >
              <Icon.Bike className="shrink-0 text-signal" width={16} height={16} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{s.name}</span>
                <span className="block text-xs text-ink-3 tabular-nums">
                  {t.assistant.bikesAt(s.vehiclesAvailable ?? 0, s.docksAvailable ?? 0)}
                  {typeof s.distanceMeters === "number" ? ` · ${t.assistant.metresAway(s.distanceMeters)}` : ""}
                </span>
              </span>
              <Icon.Chevron width={14} height={14} className="text-ink-3" />
            </Link>
          ))}
        </div>
      );
    }

    default:
      return null;
  }
}

function StopRow({ city, stop, testid }: { city: City; stop: NearbyStop | Stop | StopDetail; testid?: string }) {
  const near = (stop as NearbyStop).distanceMeters;
  const { t } = useI18n();
  return (
    <Link
      href={`/${city.id}/stops/${encodeURIComponent(stop.id)}`}
      data-testid={testid}
      className="flex items-center gap-2 rounded-card border border-line bg-paper-2 p-3 hover:border-ink"
      aria-label={`${t.assistant.openStop}: ${stop.name}`}
    >
      <Icon.Pin className="shrink-0 text-signal" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{stop.name}</span>
        <span className="block text-xs text-ink-3">
          {stop.code ?? ""}
          {typeof near === "number" ? `${stop.code ? " · " : ""}${t.assistant.metresAway(near)}` : ""}
        </span>
      </span>
      <Icon.Chevron width={14} height={14} className="text-ink-3" />
    </Link>
  );
}

function RouteRow({ city, route, testid }: { city: City; route: RouteRef; testid?: string }) {
  const { t } = useI18n();
  return (
    <Link
      href={`/${city.id}/routes/${encodeURIComponent(route.id)}`}
      data-testid={testid}
      className="flex items-center gap-2 rounded-card border border-line bg-paper-2 p-2.5 hover:border-ink"
      aria-label={`${t.assistant.openRoute}: ${route.shortName ?? route.id}`}
    >
      <RouteChip route={route} size="md" />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{route.longName}</span>
      <Icon.Chevron width={14} height={14} className="shrink-0 text-ink-3" />
    </Link>
  );
}
