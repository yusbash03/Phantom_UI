# PHANTOM web app

The browser front end of **PHANTOM**, an AI-assisted incident intelligence and response coordination platform. It
serves the public reporting form (no account needed) and the operations app for Administrators, Incident Coordinators
and Responders. The API, requirements and design live in the companion repository **Phantom_API**.

> PHANTOM recommends; people decide. AI output is always shown as an advisory recommendation, apart from the values a
> coordinator approves. It is not certified or approved for real emergency use.

## What's here

| Area | Screens |
|---|---|
| Public | Report an incident (text, location, optional coordinates, photos, an in-browser voice note) and check a report's status |
| Coordinator | Dashboard, incident list and detail (AI recommendation, duplicates, assignments, weather, history), operations map, responders, reports |
| Responder | My assignments (acknowledge, progress, complete) and own availability |
| Administrator | Users and roles, responders, audit log, settings |
| Everyone signed in | Live updates (SignalR), notifications, account |

Honesty is built into the UI:
- locations show how they were obtained;
- AI, simulated, recorded-fixture and demo data are labelled;
- failures and empty states say what happened instead of showing nothing.

## Stack

React 19, TypeScript and Vite. TanStack Query, react-router and an `openapi-fetch` client typed from the API contract.
shadcn/ui on Radix with Tailwind. Mapbox GL (lazy-loaded) and `@microsoft/signalr`. Tests: Vitest, MSW, Playwright
and axe-core.

## Getting started

Prerequisites: Node.js (with npm) and the API running locally. See the Phantom_API README; by default it runs at
`http://localhost:5080`.

```bash
npm ci
cp .env.example .env.local     # then set VITE_MAPBOX_PUBLIC_TOKEN (a URL-restricted public token) for the map
npm run dev                    # http://localhost:5173 (proxies /api and /hubs to the API)
```

| Variable | Used by | Notes |
|---|---|---|
| `PHANTOM_API_URL` | Vite dev and preview proxy | Default `http://localhost:5080` |
| `VITE_MAPBOX_PUBLIC_TOKEN` | the map | Public `pk.` token restricted to your site's URLs. Without it, the map explains that it is unavailable. |
| `VITE_HUB_URL` | live updates (production) | e.g. `https://<api-host>/hubs/operations`; the default is the same-origin `/hubs/operations`. |

The access token is kept in memory only. The refresh token is an HttpOnly cookie on `/api/v1/auth`, which stays
first-party because `/api` is proxied (Vite in development, a Vercel rewrite in production).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `preview` | Dev server, production build, and the build served with the **same security headers as Vercel** |
| `npm run typecheck` / `lint` | `tsc -b` / `oxlint --deny-warnings` |
| `npm test` | Vitest (component and unit tests with MSW) |
| `npm run test:e2e` | Playwright against the real API and database (see below) |
| `npm run api:generate` | Regenerates `src/api/generated/schema.ts` from `../../backend/Phantom_API/contracts/openapi.json` |

## End-to-end tests

```bash
export PHANTOM_DEMO_PASSWORD=...   # the API's Seed:DemoUserPassword
npm run test:e2e
```

Playwright starts the API and the dev server unless they are already running, on desktop and Pixel 7 projects. The
API is started with the **labelled recorded fixtures** for AI and weather, so no live model or weather calls are made.
The suite covers:
- the full demonstration scenario;
- every role's main flows;
- live updates;
- accessibility (axe-core; WCAG 2.1 A/AA serious and critical) and phone-width layout on every main screen.

To run it under the production Content-Security-Policy, run `npm run build && npx vite preview` first; Playwright
reuses that server.

## Deployment

Vercel: `vercel.json` defines the `/api` rewrite to the API, the SPA fallback, and the CSP and security headers. If the
API host is not `phantom-api.onrender.com`, update it in both the rewrite and the CSP. Full steps are in
Phantom_API `docs/deployment.md`.

## Licence

[MIT](LICENSE)
