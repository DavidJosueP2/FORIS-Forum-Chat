import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomBytes } from 'node:crypto'
import type { ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'

function sonnerStyles(): Plugin {
  return {
    name: 'foris-sonner-styles',
    config: () => ({ optimizeDeps: { exclude: ['sonner'] } }),
    transform: {
      filter: { id: /\/sonner\/dist\/index\.mjs(?:\?|$)/u },
      handler(source) {
        // Sonner 2 inyecta CSS sin nonce. Carga la hoja que exporta el mismo paquete.
        return source.replace(/^__insertCSS\([^\r\n]*\);?$/mu, 'import "sonner/dist/styles.css";')
      },
    },
  }
}

function developmentSecurity(storageOrigin: string): Plugin {
  const noncePlaceholder = 'FORIS_CSP_NONCE_PLACEHOLDER'
  const responseContext = new AsyncLocalStorage<ServerResponse>()

  return {
    name: 'foris-development-security',
    apply: 'serve',
    config: () => ({ html: { cspNonce: noncePlaceholder } }),
    configureServer(server) {
      const storageSource = storageOrigin ? ` ${storageOrigin}` : ''
      const hmrSource = `ws://127.0.0.1:${server.config.server.port}`
      const contentSecurityPolicy = (nonce?: string) => {
        const nonceSource = nonce ? ` 'nonce-${nonce}'` : ''
        return [
          "default-src 'none'",
          "base-uri 'none'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "object-src 'none'",
          `script-src 'self'${nonceSource}`,
          `style-src 'self'${nonceSource}`,
          `connect-src 'self' ${hmrSource}${storageSource}`,
          `img-src 'self' blob:${storageSource}`,
          "font-src 'self'",
          "media-src 'self' blob:",
        ].join('; ')
      }

      const policy = contentSecurityPolicy()
      server.middlewares.use((_request, response, next) => {
        response.setHeader('X-Content-Type-Options', 'nosniff')
        response.setHeader('X-Frame-Options', 'DENY')
        response.setHeader('Content-Security-Policy', policy)
        responseContext.run(response, next)
      })

      const transformIndexHtml = server.transformIndexHtml.bind(server)
      server.transformIndexHtml = async (...args) => {
        const html = await transformIndexHtml(...args)
        const response = responseContext.getStore()
        if (!response) return html

        // Vite ya insertó el marcador en el HTML y en el meta que utiliza HMR para el CSS.
        const nonce = randomBytes(18).toString('base64')
        response.setHeader('Content-Security-Policy', contentSecurityPolicy(nonce))
        return html.replaceAll(noncePlaceholder, nonce)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const env = loadEnv(mode, root, ['APP_', 'PORT', 'STORAGE_DRIVER', 'S3_ENDPOINT', 'S3_PROVIDER', 'S3_REGION'])
  const apiPort = process.env.PORT || env.PORT || env.APP_PORT || '3000'
  const storageEndpoint = env.STORAGE_DRIVER === 's3'
    ? env.S3_ENDPOINT || (env.S3_PROVIDER && env.S3_PROVIDER !== 'r2' ? `https://s3.${env.S3_REGION || 'us-east-1'}.amazonaws.com` : '')
    : ''
  const storageOrigin = storageEndpoint ? new URL(storageEndpoint).origin : ''
  return {
    envDir: root,
    plugins: [react(), tailwindcss(), sonnerStyles(), developmentSecurity(storageOrigin)],
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
