import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted Shippori Mincho. Weight 400 includes the Japanese glyphs (used by
// the Japanese section titles) split into unicode-range slices, so the browser
// only downloads the slices for the characters actually shown. 600/700 are latin only.
import '@fontsource/shippori-mincho/400.css'
import '@fontsource/shippori-mincho/latin-600.css'
import '@fontsource/shippori-mincho/latin-700.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
