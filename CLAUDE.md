# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Digital menu (carta) web app for the Donburi Ramen Bar: a public mobile-first menu reached by QR code, plus an `/admin/` panel to manage sections and dishes. Project docs (`README.md`, `requirements.md`) are written in Spanish.

The repo is currently the `create-cloudflare` React + Vite + Worker scaffold; `src/App.tsx` and `worker/index.ts` are still template placeholders. The roadmap is in `README.md`.

## Commands

```bash
npm run dev          # Vite dev server; runs the Worker in workerd via @cloudflare/vite-plugin (HMR for both)
npm run build        # tsc -b (all three tsconfig projects) + vite build
npm run lint         # oxlint (config: .oxlintrc.json)
npm run preview      # build + vite preview
npm run deploy       # build + wrangler deploy
npm run cf-typegen   # regenerate worker-configuration.d.ts after changing bindings in wrangler.jsonc
```

Planned D1 migration commands (DB name `donburi-db`, not yet configured in `wrangler.jsonc`):
`npx wrangler d1 migrations apply donburi-db --local` / `--remote`.

No test runner is set up yet. `requirements.md` calls for local tests of the Workers + D1 storage and the React client, plus Selenium integration tests (cases PIC1–3, PIA1–8).

## Architecture

Single Cloudflare Worker deployment (`wrangler.jsonc`, `main: worker/index.ts`):
- **Static assets**: the Vite-built React SPA, served with `not_found_handling: "single-page-application"` so client routes like `/admin/` fall back to `index.html`.
- **API**: `worker/index.ts` handles `/api/*`. Anything else not matched by assets returns 404.
- **Storage**: Cloudflare D1 (to be added as a binding). Text/numeric data only — no image storage.
- **Admin auth**: Cloudflare Access (not implemented in app code).

TypeScript is split into three project references: `tsconfig.app.json` (`src/`, browser), `tsconfig.node.json` (Vite config), `tsconfig.worker.json` (`worker/`, typed with the generated `worker-configuration.d.ts` `Env`). Keep worker code out of `src/` and vice versa.

### Planned API (from requirements.md)
- `GET /api/menu` — full menu as JSON
- `POST /api/dish`, `PUT /api/dish/:id`, `DELETE /api/dish/:id`
- `POST /api/section`, `PUT /api/section/:id`, `DELETE /api/section/:id`

### Domain rules (from requirements.md)
- **Section**: `id`, `title`. Titles must be unique across the menu. Deleting a section requires confirmation and cascades to its dishes.
- **Dish**: `id`, `section_id`, `name`, `description` (optional), `price`, `isSpicy`. Names must be unique within a section; a rejected duplicate must leave the menu unchanged.
- Public menu: logo, collapsible sections, chili icon on spicy dishes, "Work In Progress..." shown for an empty section and centered for an empty menu, footer with address / Instagram / phone / WhatsApp link, language switcher at the top (ES, EN, DE, FR, PT).

`requirements.md` is the source of truth for the spec; `README.md` summarizes it.
