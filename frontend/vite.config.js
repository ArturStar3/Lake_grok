import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // HMR и polling только при явном VITE_ENABLE_HMR=true (локальная разработка).
  // В Docker/offline без этого флага — иначе ложные события watch перезагружают страницу.
  const enableHmr = env.VITE_ENABLE_HMR === 'true'

  return {
    plugins: [react({ fastRefresh: enableHmr })],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            leaflet: ['leaflet', 'react-leaflet'],
            vendor: ['react', 'react-dom', 'axios'],
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      watch: enableHmr
        ? {
            usePolling: Boolean(env.CHOKIDAR_USEPOLLING === 'true'),
            interval: 1000,
          }
        : null,
      hmr: enableHmr
        ? {
            host: env.VITE_HMR_HOST || 'localhost',
            port: 5173,
            clientPort: 5173,
          }
        : false,
    },
    preview: {
      host: '0.0.0.0',
      port: 5173,
    },
  }
})
