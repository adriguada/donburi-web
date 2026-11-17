import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { cloudflare } from "@cloudflare/vite-plugin";

// The Selenium suite sets E2E_PERSIST_DIR so it runs against its own local D1 state
// instead of the one used by `npm run dev`.
const persistDir = process.env.E2E_PERSIST_DIR;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare(persistDir ? { persistState: { path: persistDir } } : {})],
})
