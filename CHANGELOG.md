# Changelog

All notable changes to opentransit-web. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
