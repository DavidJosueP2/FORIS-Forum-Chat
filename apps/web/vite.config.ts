import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const env = loadEnv(mode, root, 'APP_')
  const apiPort = process.env.PORT || env.APP_PORT || '3000'
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          // Conserva Host y Origin para la validación de origen de la API.
          changeOrigin: false,
        },
      },
    },
  }
})
