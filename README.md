# opentransit-web

Web client of **opentransit**, an open-source, multi-city, multimodal trip planner.
Any city with a GTFS feed can run it with its own data and branding; Bogotá is the first tenant.

This repo is the browser UI only. It talks to [`opentransit-api`](../opentransit-api) and shares nothing
else with [`opentransit-mobile`](../opentransit-mobile) (Flutter) besides the API contract.

<p>
  <img src="docs/screenshots/hub-mobile.png" alt="Map-first home on a phone: full-bleed map, search pill, sheet peeking with three actions and nearby stops" width="150">
  <img src="docs/screenshots/hub-expanded-mobile.png" alt="Home with the sheet pulled up: Casa/Trabajo, recent trips, notices" width="150">
  <img src="docs/screenshots/hub-zoom-mobile.png" alt="Street zoom: live buses appear with bearing ticks" width="150">
  <img src="docs/screenshots/stop-mobile.png" alt="Stop page: arrival board above the fold, map strip with Ver en mapa" width="150">
  <img src="docs/screenshots/next-mobile.png" alt="Ubica tu bus on mobile" width="150">
</p>
<p>
  <img src="docs/screenshots/hub-desktop.png" alt="Desktop home: side panel with search, three actions and nearby stops next to a full map" width="640">
</p>
<p>
  <img src="docs/screenshots/next-desktop.png" alt="Ubica tu bus: station, route, next buses with live/scheduled labels and ETA-tinted markers" width="640">
</p>

The shots above use mock data (`pnpm screenshots`). `docs/screenshots/*-live-api.png` are taken against a running
`opentransit-api` with the live Bogotá GTFS + GTFS-Realtime feeds.

### Design rules (v1.1.1 "map first")

The map is the product. Every screen with a map gives it ≥ 65 % of a phone viewport by default; sheets peek
(24 %), can be dragged to 55 % or 92 %, and never duplicate what the nav already offers. Details in
[`UX-AUDIT.md`](../UX-AUDIT.md):

- **Home**: full-bleed map, floating search pill, one *Capas* layers popover (live buses, services, network) and a locate button. The sheet peeks with three actions (Planear viaje · Ubica tu bus · Buscar ruta) and a "Cerca de ti" rail of the nearest stops with their next two arrivals.
- **Live fleet by zoom**: hidden below zoom 14 (unless a route/stop is in focus), small translucent dots at 14–16, full dots with a bearing tick at ≥ 16; component colours are desaturated 20 % on the map.
- **Planner form**: one time control (`Ahora ▾` → Salir a las / Llegar antes de + picker), one mode row that fits (Bus · Cable · Bici · A pie), advanced toggles under *Más opciones*, CTA pinned at the bottom.
- **Stop page**: header → arrival board → routes collapsed → accessibility as one muted line; phones get a map strip with *Ver en mapa*.
- **Route chips**: feed colours blended 35 % toward the component colour and clamped to ≥ 4.5:1 contrast; neon `#FF0000`-style feed colours fall back to the component colour. Headsigns render as `A → B`.
- 44 px touch targets, `prefers-reduced-motion` respected for marker motion, freshness/ETA text announced via `aria-live`.

## What it does

| Route | Screen |
|---|---|
| `/` | City picker (auto-redirects when the API serves one city) |
| `/{city}` | **Home hub** ("Hola, ¿qué quieres consultar?"): tiles for every module, Casa/Trabajo shortcuts, "mensajes de interés" carousel (severity-sorted, dismissible, capped impressions), nearby stations card, recent trips, agency services |
| `/{city}?view=plan` | **Planner**: origin/destination with nearby-first autocomplete, "use my location", pick on map, depart/arrive time, mode chips, accessible trips, "Llegar en bici a la estación", sorting chips (más rápido · menos transbordos · menos caminata · más económico · salida más próxima), itinerary cards with **Tarifa estimada**, itinerary detail with leg timeline, walk directions, live/scheduled badges, service-hours warnings, alerts, **Iniciar viaje** follow-along; live buses on the itinerary's routes, interpolated between frames |
| `/{city}/next` | **Ubica tu bus**: station → route → next buses, each row labeled En vivo / Por programación / Estimado, buses on the map tinted by ETA bucket (≤5 / ≤10 / ≤15 min) |
| `/{city}/stops/{stopId}` | **Arrival board** grouped by route ("Siguiente en 5 min · luego 10, 15 y 20"), freshness label, ETA-tinted buses heading here, routes, honest accessibility block ("dato no verificado" when the feed value is a blanket default), platforms, nearby stops, QR code, PQRS link, favorite star |
| `/{city}/routes` | Route finder by code or name, filtered by component, with service hours |
| `/{city}/routes/{routeId}` | Route patterns on the map, stop list, live vehicles, service window ("Fuera de horario · próximo 04:00"), alerts, QR code, favorite star |
| `/{city}/live` | Whole fleet in real time (SSE stream with deltas, interpolated motion), filter by component or route, `?stop=` tints buses by ETA to that stop, click a bus for details |
| `/{city}/favorites` | Casa, Trabajo and custom places, favorite stops with their next departures, favorite routes with service hours, recent trips — all local to the browser |
| `/{city}/alerts` | Service alerts, most severe first, with the agency's official PQRS channel |
| `/about` | Project, stack, data attribution |

Every map has a **Servicios** toggle (bike parking, toilets, ATMs, health points, libraries from `/pois`).
Component taxonomy (Troncal, Alimentador, Dual, Zonal, Cable…) with its icons and colors comes from `city.components`.
Remote config from `/v1/cities/{city}` drives poll intervals, feature flags (modules disappear from the nav and the hub),
and a maintenance banner. Deep links (`/{city}/stops/{id}`, `/{city}/routes/{id}`, `/{city}/plan…`) are the canonical
URLs printed in the QR codes; the mobile app claims them as App Links.

Where these ideas come from: the v1.1 feature plan in `../ROADMAP-v1.1.md` (TransMi App and Maas by Vettica, analysed in `../REFERENCE-APPS.md`).

Planner state lives in the URL (`?from=lat,lon&fromName=…&to=…&time=…&arriveBy=1&modes=…&wheelchair=1&bike=1&it=0&view=plan`),
so every plan is a shareable link. Spanish by default, English with one click. Light/dark theme. PWA manifest.

Nothing city-specific is hardcoded: name, colors, timezone, modes, feature flags and attribution come from the
`City` object the API returns. Bogotá only exists in the mock fixtures.

## Quickstart

```bash
pnpm install
cp .env.example .env.local

pnpm dev:mock     # realistic Bogotá fixtures, no backend needed → http://localhost:3000
pnpm dev          # against NEXT_PUBLIC_API_URL (default http://localhost:8001)
# if 3000 is taken: pnpm dev:mock -p 3100
```

`pnpm build && pnpm start` for production, or `docker build -t opentransit-web .`
(pass `--build-arg NEXT_PUBLIC_API_URL=https://api.example.org`).

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8001` | Base URL of opentransit-api, no trailing slash |
| `NEXT_PUBLIC_MOCK` | `0` | `1` serves fixtures from `src/mocks/` instead of calling the API |
| `NEXT_PUBLIC_ADMIN_ENABLED` | `1` | `0` removes the `/admin` operator section (404) from a deployment |

Both are inlined at build time (they are `NEXT_PUBLIC_*`), so the Docker image bakes them in.

## Mock mode

`NEXT_PUBLIC_MOCK=1` swaps the fetch layer for `src/mocks/handlers.ts`, which answers every contract endpoint with
Bogotá-shaped data: 60 stops along the real Autopista Norte / Av. Caracas / NQS corridors, 12 routes, three
itineraries Portal Norte → Portal Sur (direct, one transfer, zonal + trunk) with estimated fares, 220 vehicles that
move along their shapes every 4 s through the same SSE consumer the real stream uses, departures, the v1.1 arrival
board and "next buses" endpoints, station POIs, service windows, accessibility flags, remote config and three alerts.
It's what CI builds against and what `pnpm screenshots` uses (`BASE_URL=http://localhost:3100 pnpm screenshots`).

## Shared bikes (GBFS, v1.2)

Any city can plug in one or more bike-share networks through `city.mobility.bikeShare[]`
(each with its `gbfs.json`, the router's network id, a colour and app links). Nothing about a
provider is hardcoded: labels, colours and hand-off links come from the city config, and the
UI handles N networks (Bogotá ships with one, Tembici, configured in the API's `cities/bogota.yaml`).

- **Planner**: a "Bici pública" chip in the network colour adds `BIKE_RENTAL` to the plan
  (`?rental=1` in the URL). With transit it becomes access/egress; alone it is a direct bike trip.
- **Results & detail**: rental legs draw as a dashed line in the network colour, cards carry a
  network chip, and the detail shows pick-up ("Toma una bici en … · 6 bicis disponibles") and
  drop-off ("Deja la bici en … · 4 puestos libres") cards with freshness, the price line and an
  "Abrir {red}" hand-off. The fare breakdown lists rental entries next to transit ones.
- **Map**: "Bicis públicas" in *Capas* (on by default; hidden below zoom 14, counts from 15) draws
  each station as a ring with the number of available bikes; tapping opens a card with bikes,
  e-bikes, docks, "actualizado hace N s", *Cómo llegar* and the network's app.
- **Home**: the nearest station joins the "Cerca de ti" rail.
- **Admin → Movilidad**: add / remove / reorder networks, edit their feed and links, and
  *Probar feed* to see what the API currently reads from each `gbfs.json`.

Screenshots: `docs/screenshots/bike-{planner,results,itinerary,map}-{desktop,mobile}.png`,
`bike-admin-desktop.png` (mock) and the same with `-live-api` against the Bogotá API.
Regenerate with `pnpm screenshots:bike` (env `SUFFIX=live-api TOKEN=… BASE_URL=…`).

## Admin (operators)

`/admin` lets an operator change a city **without redeploying**: fares (the estimated fare every itinerary shows),
remote config (polling cadence, visible modules, minimum app version, maintenance mode), agency links, the service
tiles on the home screen and the primary colour. It is not linked from the public navigation.

- **Auth**: paste the API's `ADMIN_TOKEN`. The token is validated with `GET /v1/admin/me` and kept in
  `sessionStorage` only (never in the URL, never in `localStorage`), so closing the tab forgets it. "Salir" clears it.
- **Tabs**: Tarifas (landing) · Configuración · Enlaces · Servicios · Marca · Historial. Each tab edits one section of
  `GET/PUT /v1/admin/cities/{city}/config`; a section can be reset to the YAML values ("Restablecer a YAML" sends
  `null`), and "Restablecer todo" is `DELETE`. Badges mark what is overridden versus what comes from `cities/*.yaml`.
- **Tarifas** validates inline with the API's rules and shows a live preview ("un viaje con 1 transbordo dentro de
  110 min = $3.200 · con 3 transbordos = $6.400") computed with the same rule the planner uses (`src/lib/fare.ts`
  and `src/lib/admin/fare-preview.ts`). Fares are always published as *estimated*.
- **Maintenance** needs a confirmation step; **Servicios** rows can be added, removed and reordered;
  **Historial** lists every revision with who/when/note and the keys that changed (diffed on effective values).
- Mock mode has a full in-memory admin (token `demo`), used by `pnpm screenshots:admin`.

Security notes: serve the admin over **HTTPS only** (the token travels in a header), rotate `ADMIN_TOKEN` when someone
leaves, and set `NEXT_PUBLIC_ADMIN_ENABLED=0` on public deployments that don't need it (the API still enforces the
token either way). Screenshots: `docs/screenshots/admin-*.png`.

## How it talks to the API

- `src/lib/api/types.ts` mirrors the contract 1:1 (`docs/API.md` in the API repo). Treat it as read-only.
- `src/lib/api/client.ts` is the only place that knows about URLs; `hooks.ts` wraps it in React Query.
- `src/lib/api/stream.ts` consumes `/vehicles/stream`: first event is a full frame, then deltas
  (`updated` + `removed`) merged into a `Map`; reconnects with backoff; polls `/vehicles` if `EventSource` is missing.
- Errors arrive as `ApiRequestError` with the contract's `code`; the planner shows a dedicated state for `5xx`
  (router down) versus an empty result.

Known behaviour of the Bogotá feed the UI accounts for: fares are always `null` (shown as "not published"),
`realtime` is only true for the imminent arrival, `wheelchair` data is unreliable (flag shows "no data" when unknown).

## Map

MapLibre GL JS with OpenFreeMap vector tiles (`liberty` light, `dark` dark). No API key.
MapLibre ≥ 6 loads its worker relative to `import.meta.url`, which bundlers break, so
`scripts/copy-maplibre-worker.mjs` copies the worker into `public/vendor/maplibre/` on install/dev/build
and `MapView` calls `setWorkerUrl()`. Overlays are small components in `src/components/map/layers.tsx` that
re-add their sources when the basemap style reloads (theme switch).

## i18n

`src/lib/i18n/dict.ts` holds every UI string in `es` and `en`. Add both when you add copy.
`useI18n()` gives `t`, `lang`, `setLang`. The choice is remembered in `localStorage`.

## Scripts

| Command | What |
|---|---|
| `pnpm dev` / `pnpm dev:mock` | dev server (real API / fixtures) |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` | what CI runs (`test` = vitest unit tests for colour blending, headsign cleanup, marker zoom rules, admin fare preview/validation/diff) |
| `pnpm screenshots` | regenerate `docs/screenshots/` from a running `dev:mock` (needs `npx playwright install chromium`) |
| `pnpm screenshots:admin` | admin flow screenshots (login → validation error → save → history); `TOKEN=… SUFFIX=live-api RESET=1` for the real API |
| `pnpm screenshots:bike` | shared-bike screenshots (planner chip, rental results/detail, station layer + card, admin Movilidad); `SUFFIX=live-api TOKEN=…` for the real API |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). MIT licensed.

Data: each city's transit agency (Bogotá: TRANSMILENIO S.A., GTFS). Map: © OpenMapTiles © OpenStreetMap contributors, tiles by OpenFreeMap.
