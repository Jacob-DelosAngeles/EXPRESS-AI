import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: base must be './' (not '/') so that asset paths are relative.
  // Electron loads index.html via file:// — absolute paths like /assets/main.js
  // resolve to file:///C:/assets/main.js (doesn't exist) causing a blank screen.
  base: './',
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
