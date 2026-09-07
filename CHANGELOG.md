# Changelog

All notable changes to opentransit-web. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.9.2] - 2026-09-07
### Fixed
- **The admin panel validated the override instead of the configuration it produces, and blocked the operator.** An override is a patch: Bogotá's is `{config: {assistant: {enabled: true}}}`, meaning "turn the assistant on and keep everything else from the YAML". The panel read it as if it were the whole section, so the Asistente tab showed a city with no provider and no key, refused to save with "Corrige los campos marcados antes de guardar", and would have written those blanks over the YAML on the next save. `effectiveSection` now merges the patch onto the YAML the way the server does (`deep_merge` in `admin_config.py`): nested objects merge key by key, lists and scalars replace, and a field the patch omits — or carries as null, which is what the admin endpoint writes for a masked secret — is inherited. The fix is in the shared draft layer, so every tab gets it; a test per tab pins a partial override that used to fail.
- The Asistente tab read the stored key from the raw override too, so `keyIsNew` compared against nothing.

### Changed
- The live screenshot run blanks the API key field before capturing the admin tab. The panel's mask keeps the key's last characters on purpose, which is right in front of an operator and wrong in a PNG that ships in a public repo.

### Notes
- Verified against the live API: the Asistente tab for Bogotá opens with DeepSeek and the masked key, saves a limit change twice without touching the key, and the assistant keeps answering with `hasKey: true` afterwards.
- The cross-repo contract tests now pin the expected kinds and health fields and assert them on every run; the comparison against `opentransit-api`'s source is a second test that skips when the neighbouring repo is absent, so a clone of this repo alone — and CI — stays green.

## [1.9.1] - 2026-09-07
### Fixed
- **The assistant rendered most answers as bare prose.** `ChatCard` switched on `alerts, board, fare, itinerary, next, route, stop`, while the API emits `alerts, bikeStations, board, fares, itineraries, next, place, routes, stops, vehicles`. Seven of the ten kinds fell through, so a trip, a fare, a route, a stop, a place, a vehicle or a bike station arrived with no card at all. Every kind now renders with the screen's own component and links into the real screen; the singular spellings an older server used are still accepted. The `itineraries` payload is read as `{from, to, itineraries}` (it was read as a single itinerary), and a plan with more than two options offers "N opciones más".
- **The screenshots and the tests agreed with the bug**: the mocks emitted the singular kinds the renderer expected, so the captures looked right. The mocks now emit exactly what the API emits, and `assistant.test.ts` derives the kind list from the API's own `app/assistant/tools.py`, so a rename there fails the web suite instead of silently degrading an answer. The mock's bike branch also read `rentalStations` from a nearby response that answers with `rental`, which is why no station card appeared once the kind was right.
- **The admin "Probar" result crashed the page against the live API** with `Cannot read properties of undefined (reading 'toFixed')`: the health payload calls today's spend `spentUsd`, while the client read `spendTodayUsd` — a name only the mock ever produced. Both spellings are now accepted, a payload with neither renders without the badge instead of taking the tab down, and the field list is checked against `app/routers/chat.py`.
- The screenshot script no longer writes an `assistant-error-*` file when no error state occurred, and reports an answer that carried no card as a failure.

### Privacy
- **The position sent with a question is coarsened to ~110 m** (three decimals, `coarsen()`) before it leaves the browser. It was sent at full precision while the notice promised otherwise and while the mobile client rounded. The notice now states the rounding in both locales, so the wording matches the code.

### Added
- **"Nueva conversación"** in the chat header: clears the thread, brings the suggestions back and starts a **new session id**, because the server counts replies per session and reusing the id would carry the spent quota into the new conversation. It confirms before wiping an existing thread and is disabled when there is nothing to clear.
- `assistant-bikes-*` and `assistant-new-*` screenshots, in mock and live mode.

### Notes
- Verified against the live API (Bogotá, DeepSeek): "¿Cómo llego del Parque de la 93 al Portal Sur?" → `place, place, itineraries`; "¿Cuánto cuesta un taxi al aeropuerto?" → `place, place, fares`; "¿Qué buses pasan por Portal Norte?" → `place, board`; "¿Hay bicis cerca de la Calle 100?" → `place, place, bikeStations`. Each rendered its card in the sheet.
- The live API has no budget trigger, so no live `assistant-error-*` capture exists. The mock keeps that state.
- Still open: in live mode the Asistente tab shows "Corrige los campos marcados antes de guardar", because Bogotá's override is a partial patch (`{enabled: true, apiKey: null}`) and the form validates it as if it were the whole block. That is the admin draft layer, shared by every tab, not the chat.

## [1.9.0] - 2026-09-07
### Added
- **Conversational assistant, phase 1 (text)** (`CONTRACT-assistant.md`): a "Pregúntame" sheet reachable from the home action row and from the search bar, streaming `POST /v1/cities/{city}/chat` over SSE. Prose arrives token by token; every `card` frame is rendered with the screen's own component (itinerary card, arrival board, alert list, fare tag, route chip) so an answer is tappable and leads into the real screen. "Pensando…" names the tool that is running. Suggested prompts on first open, and a one-time notice per session naming the external provider the questions go to.
- **Admin tab "Asistente"**: enable, provider (Anthropic · OpenAI · DeepSeek · Gemini), model with the provider's default as the placeholder, masked API key, base URL, limits (replies per session, tool calls per reply, daily budget, rate limit), an optional note for the system prompt, a conversation-logging toggle behind a privacy warning, and "Probar", which sends one fixed question and reports the answer, its cost and today's spend.
- `pnpm screenshots:assistant` (`docs/screenshots/assistant-*`, mock and `-live-api`).

### Privacy
- Chat text never enters analytics. The only event emitted is `assistant_query` with `{toolsUsed, latencyMs, ok}`: no text, no coordinates. A failed reply emits `error` with its code and nothing else.
- The API key is masked on read like the on-demand credentials and never reaches a browser. Mock mode now enforces the same boundary: the public city is reduced to `{enabled, provider, providerName, model}`, the admin store masks the key in both `effective` and `yaml`, and an echoed mask on save keeps the stored key instead of overwriting it with bullets.

### Changed
- `validateConfig` now also validates `config.assistant`, so the rules that stop an operator enabling the assistant with no key — or with an out-of-range limit — hold on save, not only in the form.
- The entry point is hidden when the city has the assistant off **and** when the browser is offline (`src/lib/use-online.ts`), since every answer comes from the API.

### Notes
- The live API exposes the endpoint and refuses with `ASSISTANT_DISABLED`, but Bogotá has **no provider key configured** (`apiKey: null`), so the live run captures the admin tab and the correctly hidden entry point only. No live answer was staged.
- Provider default models pinned on 2026-09-07: Anthropic `claude-opus-5` (from the contract), OpenAI `gpt-5`, DeepSeek `deepseek-chat`, Gemini `gemini-2.5-flash`. The model field stays free text so an operator can move on without waiting for a release.

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
