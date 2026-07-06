import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

const disableHmr = process.env.VITE_DISABLE_HMR === 'true'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
    // На сервере (оффлайн/Docker) отключаем HMR и watch — иначе polling
    // даёт ложные изменения файлов и страница периодически перезагружается.
    watch: disableHmr
      ? null
      : {
          usePolling: true,
          interval: 1000,
        },
    hmr: disableHmr
      ? false
      : {
          host: process.env.VITE_HMR_HOST || 'localhost',
          port: 5173,
          clientPort: 5173,
        },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
  },
})
