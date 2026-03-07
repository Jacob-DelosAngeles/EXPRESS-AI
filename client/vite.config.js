import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // base path strategy:
  //  - Electron desktop: must be './' so that asset paths are relative.
  //    Electron loads index.html via file:// — absolute paths like /assets/main.js
  //    resolve to file:///C:/assets/main.js (doesn't exist) causing a blank screen.
  //  - Vercel web: must be '/' so that asset paths are absolute.
  //    Relative paths like ./assets/main.js resolve incorrectly on deep routes
  //    (e.g. /login/factor-one) causing a MIME-type error and a white screen.
  //  Set ELECTRON_BUILD=true in the desktop build pipeline to use the Electron base.
  base: process.env.ELECTRON_BUILD === 'true' ? './' : '/',
  server: {
    proxy: {
      // Proxy API requests to the Python backend
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
