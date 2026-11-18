# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Digital menu (carta) web app for the Donburi Ramen Bar: a public mobile-first menu reached by QR code (`/`), plus an `/admin/` panel to manage sections and dishes. `requirements.md` and all user-facing UI/API text are in Spanish; `README.md` and code are in English (the README documents architecture, infrastructure, tests, local development and deployment — keep it in sync).

`requirements.md` is the source of truth for the spec. Implement only what `requirements.md` specifies and ask the user before adding anything beyond it (especially auth-related work). The language switcher (CL1.4) is intentionally not implemented yet.

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
npm run cf-typegen        # regenerate worker-configuration.d.ts after editing wrangler.jsonc (--env-file=/dev/null keeps .dev.vars out of the production Env type)
```

Deployed as a single Worker, `donburi-web`, at https://donburi-web.donburi-ramen.workers.dev (`npm run deploy`; the user deploys, not Claude). Admin protection is a Cloudflare Access self-hosted application (team `donburi-ramen.cloudflareaccess.com`) on that workers.dev hostname with paths `admin`, `api/section` and `api/dish` in one application; its team domain and AUD are in `wrangler.jsonc` `vars`, and the Worker verifies the Access JWT itself as well (this also covers preview URLs, which bypass the Access application). The Access policy allows only the project's own email, and the same email is in the `ADMIN_EMAILS` secret (don't write it into the repo). Do not enable the Worker-level Access toggle: it would put the public menu behind the login.

Local dev needs `.dev.vars` with `DEV_AUTH_BYPASS=true` (copy `.dev.vars.example`); without it, admin routes return 500 because Access is not configured.

## Architecture

Single Cloudflare Worker (`wrangler.jsonc`, `main: worker/index.ts`) serving the Vite-built SPA as static assets plus the JSON API. `run_worker_first` routes `/api/*` and `/admin*` through the Worker; everything else is served straight from assets with SPA fallback. The Worker serves `/admin` via `env.ASSETS.fetch` only after auth passes.

- `worker/index.ts`: router and HTTP mapping. `GET /api/menu` is public; `POST /api/section|dish`, `PUT|DELETE /api/section|dish/:id` and `PUT /api/section/order` (AD1.1.4 reorder; body `{ sectionIds }` must list every section exactly once, else 409 `ORDER_CONFLICT`) require admin auth. Errors are `{ error: ApiErrorCode, message }` with Spanish messages that the admin UI shows as-is.
- `worker/auth.ts`: Cloudflare Access JWT verification with `jose` (header `Cf-Access-Jwt-Assertion`, falling back to the `CF_Authorization` cookie; checks issuer `https://<ACCESS_TEAM_DOMAIN>` and audience `ACCESS_AUD`). Second barrier: the token's `email` must also be in `ADMIN_EMAILS` (comma-separated, case-insensitive; a Cloudflare **secret** set with `wrangler secret put ADMIN_EMAILS`, deliberately not in `wrangler.jsonc`), otherwise 403 `FORBIDDEN`; tokens without an email are rejected. Fails closed (500 `AUTH_NOT_CONFIGURED`) when `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` or `ADMIN_EMAILS` is empty. `DEV_AUTH_BYPASS` is for local use only.
- `worker/db.ts`: D1 queries. Uniqueness (section title globally, dish name per section, both case-insensitive) is enforced by `UNIQUE ... COLLATE NOCASE` constraints and mapped to 409. Prices are stored as `price_cents` but exposed in the API as euros. Dish `spiciness` is an integer 0–`MAX_SPICINESS` (3, in `shared/types.ts`) = number of hot peppers shown; it replaced the old boolean `isSpicy` in migration 0003. Sections have an optional `title_ja` (API `titleJa`, migration 0004; blank → null) shown under the title. Sections are ordered by the `"order"` column (migration 0002; `order` is a SQL reserved word, so always quote it); new sections go last.
- `worker/validation.ts`: request body parsing.
- `shared/types.ts`: API types imported by both `worker/` and `src/`.
- `src/`: no router library; `App.tsx` picks `MenuPage` or `AdminPage` from `window.location.pathname`. Admin components reload the whole menu after every change. Section reordering uses `@dnd-kit` (pointer + keyboard sensors) in `AdminPage`, saving optimistically and reverting on error. Restaurant contact details live in `src/config.ts`; logo and seigaiha background are in `src/assets/`. Warm light theme only (no dark mode): espresso ink (`--ink: #2b1f19`) on a parchment seigaiha background (`--paper: #efe3d3`; the pattern colours are hard-coded in `seigaiha.svg`, keep them in sync with `--paper`), Shippori Mincho self-hosted via `@fontsource`, imported in `main.tsx`: weight 400 is the full unicode-range-sliced set (latin + Japanese slices, so Japanese titles render in Mincho and only the needed slices download); 600/700 are latin only, so keep Japanese text at weight 400. Menu section headings are a 3-column grid (−/+ icon, centred titles, spacer) so the titles are centred on screen. On the menu, the logo header is sticky and hidden while scrolling down / shown on scroll up via `src/hooks/useShowOnScrollUp.ts`; the header is a centred `--header-size` frame (`src/assets/logo-marco.svg`, open at the top) holding `Logo variant="light"` (`donburi-logo-light.svg`, kanji in the light paper colour); the rest of the header strip is transparent with `pointer-events: none`. The hook also reports `atTop`: when the header reappears mid-page it is compact (`.menu-header-compact`: `--header-compact-size` frame, 120px / 96px on phones, with `Logo compact` = `donburi-logo-light-compact.svg`, the same logo with its viewBox cropped above the "DONBURI RAMEN" lettering); at the very top it is full size again. `.menu-header` always keeps the full `--header-size` height so shrinking the frame never shifts the page; the compact rules use a double class so they beat the phone media query. Between header and menu, `src/components/Hero.tsx` fills the rest of the first screen (`min-height: calc(100svh - var(--header-size))`; `--header-size` is 240px, 170px on phones) with `src/assets/gato-donburi.svg` (white background removed, ink recoloured, viewBox cropped to the drawing) and a bouncing "Carta" chevron link to `#carta` (the `<main>`), smooth-scrolled via JS — don't add global `scroll-behavior: smooth`, it makes Selenium clicks land mid-scroll. The footer is a full-width terracotta band (`src/assets/header-fondo.svg`, stretched with `background-size: 100% 100%`) rendered outside `.page`. The admin page keeps the default red-kanji logo on the light background. The page pattern is a viewport-fixed `body::before`. Section collapse animates via a `grid-template-rows` transition on `.section-content` (content stays mounted; collapsed = `inert` + `visibility: hidden`). Phones (`max-width: 599px`) get smaller type (16px base, 20px section titles, 14px descriptions) and a 170px logo frame via media queries at the end of `index.css`/`App.css`. Footer WhatsApp/Instagram links are icon-only (`aria-label`s). Edit/delete controls are icon buttons (pencil/trash) whose accessible names are `aria-label`s (e.g. "Editar plato").

TypeScript project references: `tsconfig.app.json` (src + shared), `tsconfig.worker.json` (worker + shared + test/worker, typed with the generated `Env` and `@cloudflare/vitest-plugin/types`), `tsconfig.test.json` (test/client, test/e2e), `tsconfig.node.json` (vite.config.ts).

## Tests

All three suites are Vitest projects in `vitest.config.ts`. Name tests after the requirement IDs they cover (e.g. CL1.2.4, AD1.1.3.1, PIA5).
- **worker** (`test/worker/`): runs in workerd via `@cloudflare/vitest-plugin` (the renamed `vitest-pool-workers`). `setup.ts` applies migrations and clears the tables before each test. `helpers.call()` invokes the Worker's fetch handler directly and accepts `envOverrides` to test auth.
- **client** (`test/client/`): React Testing Library in jsdom, with `fetch` stubbed by `fetch-mock.ts` (routes keyed by `"METHOD /path"`).
- **e2e** (`test/e2e/`): selenium-webdriver with headless Chromium. `global-setup.ts` applies migrations to `.wrangler/e2e-state` and runs `vite` on port 5317 with `E2E_PERSIST_DIR` (read in `vite.config.ts`), `CLOUDFLARE_INCLUDE_PROCESS_ENV=true` and `DEV_AUTH_BYPASS=true`. Tests seed and reset data through the API. Each test case maps to PIC1–3 / PIA1–8 in `requirements.md`, plus a real pointer drag test for section reordering (AD1.1.4.1).
