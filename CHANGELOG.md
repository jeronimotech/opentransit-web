# Changelog

All notable changes to opentransit-web. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.8.0] - 2026-09-07
### Added
- **"Cerca de mí"** mode on `/{city}/live` (`?near=me`): follow-me camera that yields to any manual pan or zoom and offers "Volver a mi ubicación"; 300 m / 600 m / 1 km radius drawn as a soft circle and remembered per city with the component filter; nearby buses listed by distance with an approaching/away arrow derived from bearing (omitted when the feed carries none); tapping a row highlights that bus and opens its detail; empty state with a one-tap widen; a denied-geolocation path that lets you pick a point on the map.
- The vehicle stream accepts server-side filters and can pause while the tab is hidden: the mode subscribes to the bbox enclosing the radius, so a radius change re-subscribes instead of filtering a city-wide firehose, and leaving the page or backgrounding the tab closes the connection.

### Fixed
- The bbox grid used for that subscription derived its longitude step from the *unsnapped* latitude, so the grid slid as a user walked north and every GPS fix opened a new subscription. The longitude grid now hangs off the snapped latitude.
- Distances under 5 m rendered as "a 0 m", which reads as broken rather than as "it is right here"; they now say "a menos de 10 m".

## [1.7.0] - 2026-09-06
### Added
- **Casa ⇄ Trabajo card** on the home sheet: next viable departure with countdown, route chips and arrival; direction inferred from the city clock and invertible; "Ruta con desvío · Replanear" when an active alert touches the plan.
- **"Cuándo salir"** panel over the results (`GET /plan/forecast`): departures across the window as a timeline, recommended option highlighted, service gaps called out between rows, last departure flagged, and re-plan on pick.
- **Line page timeline**: live buses placed on the stop list (matched by the stop they are heading to, else snapped within 700 m) and a per-stop "GO rápido" hand-off to the mobile app with a web fallback.
- **Shared ETA page** `/{city}/eta/{token}`: map, live ETA, status and staleness, `noindex`, graceful expired/revoked/not-found states; "Compartir viaje" in the itinerary detail creates the link and keeps the write key in that tab.
- Favourite routes show their active alerts inline.

### Fixed
- The home sheet's expanded content (commute card, recents, notices, services) was gated on the *phone* sheet position, so it never appeared on desktop where the panel is always tall.
- The share link now always points at the web page; the API returns its own absolute URL, which would have sent readers to raw JSON.

## [1.5.0] - 2026-09-06
### Added
- Lote 1 (Citymapper-inspired UX): "Sal en X min / Sal ahora / Ya salió" countdown on result cards (15-s ticks, departed options sink, "Actualizar" chip), results grouped by scenario (Más rápido · Menos caminata · Menos transbordos · Más barato · En bici · Taxi / app) with a secondary "Ordenar" menu, live next-3 departure chips inside each boarding step that re-time the itinerary client-side ("Re-temporizado"), Citymapper-style stop rows (big right-aligned minutes with live blip, "y en 13, 23 min"), contextual empty states and a slim top offline/stale bar.
- First-party analytics client (`src/lib/analytics/`): local queue, batched flushes, coarse coordinates (3 decimals) before enqueue, per-tab session id, 30-day rotating cohort id, opt-out (default OFF under Do Not Track / Global Privacy Control); every contract event instrumented; settings block with "Compartir estadísticas anónimas de uso" and "Borrar mis estadísticas".
- Admin tab **Analítica**: date range, KPI tiles with deltas, origins/destinations/searches cell heat map with top O-D arcs (k ≥ 5), hour×weekday heatmap, modes, top routes/stops/searches/providers, funnel, platforms/versions, CSV export per dataset, table view for every chart.
- Semantic colour tokens (live, walk, disruption, severe) and a validated data-viz palette (light + dark).

## [Unreleased]

## [1.4.0] — 2026-09-05 — Taxi and ride apps (on-demand)
- "Taxi / app" planner chip (`?taxi=1` → `onDemand=true`), on-demand itineraries with price bands or "Precio en la app", "Taxi → Bus" combos, cheapest sorting by estimate.
- Itinerary detail: dashed car leg on the map, provider picker with "Pedir" hand-off (platform-aware, store/web fallback), tariff source and surcharge chips.
- Stop page "Llegar en taxi / app" action; landing highlight when enabled.
- Admin › Movilidad: taxi tariff editor with calculator preview, providers editor (templates with placeholder help, masked client id, "Probar enlace"), policy.
- Provider-agnostic: names, colours, links and tariffs come from `city.mobility`; nothing brand-specific in code or i18n.

## [1.3.0] — 2026-09-04 — City landing page
- White-label public page at `/{city}/landing` driven by the city's `landing` config: hero, store badges, highlights, screenshots, live stats, partners, open data, FAQ, contact, footer, SEO and JSON-LD.
- Single-city deployments can serve it at `/` (`NEXT_PUBLIC_DEFAULT_CITY` + `NEXT_PUBLIC_ROOT_LANDING=1`).
- Admin **Página** tab with per-section forms, validation, override badges and an unsaved-draft preview.
- `sitemap.xml`, `railway.json`, open-source hygiene files.

## [1.2.0] — 2026-09-04 — Shared bikes (GBFS)
- "Bici pública" mode, rental legs with pick-up/drop-off cards, station layer with availability, nearest station on the home strip, admin **Movilidad** tab. Providers are per-city configuration.

## [1.1.1] — 2026-09-04 — Admin panel and map-first redesign
- Token-gated `/admin` to edit fares, remote config, links, services and brand per city, with history.
- Map-first home (peeking sheet, layers popover), zoom-aware fleet and network layers, planner with one time control, stop page with the board above the fold, route colour and headsign clean-up.

## [1.1.0] — 2026-09-04 — Features from the reference apps
- Home hub, Ubica tu bus, arrival board, freshness labels, ETA-tinted live markers, service hours, estimated fares, sorting chips, component taxonomy, typed favorites and recents, alert carousel, remote config, QR codes, follow-along, POI layer, accessibility block, PQRS links.

## [1.0.0] — 2026-09-04 — First release
- Planner, itinerary detail, stops, routes, live fleet, alerts, favorites, PWA, es/en, dark mode, mock mode.
