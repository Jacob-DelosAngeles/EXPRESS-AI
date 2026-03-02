import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.jsx'

// ── Desktop Mode Detection ──────────────────────────────────
// When running inside Electron, window.expressAI is set by preload.js.
// In desktop mode, we skip Clerk entirely (no cloud auth needed).
const IS_DESKTOP = !!(window.expressAI?.isDesktop);

// Get Clerk publishable key from environment (only required in web mode)
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!IS_DESKTOP && !PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key. Add VITE_CLERK_PUBLISHABLE_KEY to your .env file.')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {IS_DESKTOP ? (
      // Desktop Mode: No Clerk, no cloud auth
      <App />
    ) : (
      // Web Mode: Full Clerk authentication (unchanged)
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/login">
        <App />
      </ClerkProvider>
    )}
  </StrictMode>,
)
