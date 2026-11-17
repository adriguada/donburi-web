import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted Shippori Mincho (latin subset only: the menu is in Spanish).
import '@fontsource/shippori-mincho/latin-400.css'
import '@fontsource/shippori-mincho/latin-600.css'
import '@fontsource/shippori-mincho/latin-700.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
