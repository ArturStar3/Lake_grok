import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Windows + Docker bind mount: inotify в контейнере не видит правки на хосте
    watch: {
      usePolling: true,
      interval: 1000,
    },
    // HMR host is configurable via VITE_HMR_HOST env (important for Docker + access by machine IP).
    // - In Docker on Windows: set VITE_HMR_HOST=host.docker.internal so that when you open
    //   the page by http://<your-windows-ip>:5173 the HMR WebSocket still works
    //   (Docker Desktop resolves host.docker.internal back to the Windows host).
    // - Default (no env) = 'localhost' for ordinary `npm run dev` or simple cases.
    // server.host: '0.0.0.0' ensures the dev server accepts connections on all interfaces.
    hmr: {
      host: process.env.VITE_HMR_HOST || 'localhost',
      port: 5173,
      clientPort: 5173,
    },
  },
})
