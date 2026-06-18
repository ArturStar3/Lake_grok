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
    // Default = 'localhost' (works when opening http://localhost:5173 on the same machine).
    // For LAN/IP access (http://<your-windows-ip>:5173) override in docker-compose:
    //   VITE_HMR_HOST: <your-ip>   or try host.docker.internal .
    // server.host: '0.0.0.0' ensures the dev server accepts connections on all interfaces.
    hmr: {
      host: process.env.VITE_HMR_HOST || 'localhost',
      port: 5173,
      clientPort: 5173,
    },
  },
})
