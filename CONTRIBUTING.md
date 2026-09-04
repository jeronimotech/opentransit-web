# Contributing to opentransit-web

Thanks for helping build an open trip planner. This repo is the web client only;
the API lives in `opentransit-api` and the Flutter app in `opentransit-mobile`.

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev:mock        # UI work without a backend
pnpm dev             # against NEXT_PUBLIC_API_URL
```

## Before opening a PR

```bash
pnpm lint && pnpm typecheck && pnpm build
```

CI runs the same three commands. Screenshots in `docs/screenshots/` are regenerated with
`pnpm screenshots` (needs `pnpm dev:mock` running on port 3000).

## Ground rules

- **The API contract is the boundary.** Types in `src/lib/api/types.ts` mirror `docs/CONTRACT.md`
  in the API repo. If you need a field the API doesn't return, open an issue there first;
  don't invent it on the client.
- **Nothing city-specific in components.** City name, colors, timezone, modes and feature flags
  come from the `City` object. Bogotá exists only in `src/mocks/`.
- **No API keys.** Basemap is OpenFreeMap; geocoding goes through the API.
- **UI copy lives in `src/lib/i18n/dict.ts`**, in Spanish and English. Add both.
- **Accessibility is not optional**: keyboard focus, `aria-*` on interactive widgets, contrast.
- Keep the visual system: route codes use `RouteChip`, itineraries use `RouteStrip`, colors come
  from tokens in `globals.css`.

## Adding a page

Pages under `src/app/[city]/` get the city from `useCityCtx()` and render inside `SplitLayout`
(map + panel). Map overlays are small components in `src/components/map/layers.tsx` that use
`useMap()` and re-add themselves when the basemap style reloads.

## Commit style

Short imperative subject, body explains *why*. One logical change per commit.
