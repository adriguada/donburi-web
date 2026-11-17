# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Digital menu (carta) web app for the Donburi Ramen Bar: a public mobile-first menu reached by QR code (`/`), plus an `/admin/` panel to manage sections and dishes. Project docs (`README.md`, `requirements.md`) and all user-facing UI/API text are in Spanish.

`requirements.md` is the source of truth for the spec; `README.md` summarizes it. Implement only what `requirements.md` specifies and ask the user before adding anything beyond it (especially auth-related work). The language switcher (CL1.4) is intentionally not implemented yet.

## Commands

```bash
npm run dev               # Vite + Worker in workerd via @cloudflare/vite-plugin (HMR for both)
npm run db:migrate:local  # apply migrations/ to the local D1 (.wrangler/state)
npm run build             # tsc -b (all tsconfig projects, including tests) + vite build
npm run lint              # oxlint
npm test                  # worker + client Vitest projects
npm run test:e2e          # Selenium suite (starts its own dev server)
npx vitest run test/worker/api.test.ts          # single file
npx vitest run --project client -t "collapse"   # by test name
npm run cf-typegen        # regenerate worker-configuration.d.ts after editing wrangler.jsonc
```

Local dev needs `.dev.vars` with `DEV_AUTH_BYPASS=true` (copy `.dev.vars.example`); without it, admin routes return 500 because Access is not configured. Do not deploy: the user has no Cloudflare account yet (`database_id` and `ACCESS_*` vars in `wrangler.jsonc` are placeholders).

## Architecture

Single Cloudflare Worker (`wrangler.jsonc`, `main: worker/index.ts`) serving the Vite-built SPA as static assets plus the JSON API. `run_worker_first` routes `/api/*` and `/admin*` through the Worker; everything else is served straight from assets with SPA fallback. The Worker serves `/admin` via `env.ASSETS.fetch` only after auth passes.

- `worker/index.ts`: router and HTTP mapping. `GET /api/menu` is public; `POST /api/section|dish`, `PUT|DELETE /api/section|dish/:id` and `PUT /api/section/order` (AD1.2 reorder; body `{ sectionIds }` must list every section exactly once, else 409 `ORDER_CONFLICT`) require admin auth. Errors are `{ error: ApiErrorCode, message }` with Spanish messages that the admin UI shows as-is.
- `worker/auth.ts`: Cloudflare Access JWT verification with `jose` (header `Cf-Access-Jwt-Assertion`, falling back to the `CF_Authorization` cookie; checks issuer `https://<ACCESS_TEAM_DOMAIN>` and audience `ACCESS_AUD`). Fails closed when the vars are empty. `DEV_AUTH_BYPASS` is for local use only.
- `worker/db.ts`: D1 queries. Uniqueness (section title globally, dish name per section, both case-insensitive) is enforced by `UNIQUE ... COLLATE NOCASE` constraints and mapped to 409. Prices are stored as `price_cents` but exposed in the API as euros. Sections are ordered by the `"order"` column (migration 0002; `order` is a SQL reserved word, so always quote it); new sections go last.
- `worker/validation.ts`: request body parsing.
- `shared/types.ts`: API types imported by both `worker/` and `src/`.
- `src/`: no router library; `App.tsx` picks `MenuPage` or `AdminPage` from `window.location.pathname`. Admin components reload the whole menu after every change. Section reordering uses `@dnd-kit` (pointer + keyboard sensors) in `AdminPage`, saving optimistically and reverting on error. Restaurant contact details live in `src/config.ts`; logo and seigaiha background are in `src/assets/`. Light theme only (no dark mode): dark ink on the light seigaiha background, Shippori Mincho self-hosted via `@fontsource` (latin subset, imported in `main.tsx`). On the menu, the logo header is sticky and hidden while scrolling down / shown on scroll up via `src/hooks/useShowOnScrollUp.ts`; the page pattern is drawn by a viewport-fixed `body::before` and repeated on the full-width header so they line up. Footer WhatsApp/Instagram links are icon-only (`aria-label`s). Edit/delete controls are icon buttons (pencil/trash) whose accessible names are `aria-label`s (e.g. "Editar plato").

TypeScript project references: `tsconfig.app.json` (src + shared), `tsconfig.worker.json` (worker + shared + test/worker, typed with the generated `Env` and `@cloudflare/vitest-plugin/types`), `tsconfig.test.json` (test/client, test/e2e), `tsconfig.node.json` (vite.config.ts).

## Tests

All three suites are Vitest projects in `vitest.config.ts`. Name tests after the requirement IDs they cover (e.g. CL1.2.4, AD1.1.3.1, PIA5).
- **worker** (`test/worker/`): runs in workerd via `@cloudflare/vitest-plugin` (the renamed `vitest-pool-workers`). `setup.ts` applies migrations and clears the tables before each test. `helpers.call()` invokes the Worker's fetch handler directly and accepts `envOverrides` to test auth.
- **client** (`test/client/`): React Testing Library in jsdom, with `fetch` stubbed by `fetch-mock.ts` (routes keyed by `"METHOD /path"`).
- **e2e** (`test/e2e/`): selenium-webdriver with headless Chromium. `global-setup.ts` applies migrations to `.wrangler/e2e-state` and runs `vite` on port 5317 with `E2E_PERSIST_DIR` (read in `vite.config.ts`), `CLOUDFLARE_INCLUDE_PROCESS_ENV=true` and `DEV_AUTH_BYPASS=true`. Tests seed and reset data through the API. Each test case maps to PIC1–3 / PIA1–8 in `requirements.md`, plus a real pointer drag test for section reordering (AD1.2.1).
