# Despliegue con Vercel Services

El proyecto de Vercel debe apuntar a la raíz del repositorio, donde está `vercel.json`. Este archivo define los servicios `web` (Vite) y `api` (NestJS). Las peticiones `/api/*` llegan a Nest conservando ese prefijo; el resto llega al frontend. Referencia: [Vercel Services](https://vercel.com/kb/guide/vercel-services).

## Salida de la API

El servicio ejecuta `npm run build:vercel` desde `apps/api`. Primero compila Nest con su configuración habitual de TypeScript, incluyendo los metadatos de los decoradores. Después `scripts/package-vercel-api.ts` prepara esta salida:

```text
apps/api/dist/vercel/
  index.mjs
  package.json
  apps/api/
    package.json
    dist/
      main.js
      ...
```

Vercel usa `dist/vercel` como `outputDirectory`. La entrada `.mjs` identifica explícitamente el módulo ESM; el manifiesto de la API conserva `type: module` junto al código compilado y permite resolver `@messages/api/package.json`. Se mantiene la estructura `apps/api` porque la configuración obtiene desde ese manifiesto la raíz del proyecto. Los comandos de desarrollo local no cambian.

Esta salida evita depender de que Services conserve el contexto ESM al trasladar directamente `dist/main.js` a la raíz de la función. El error recibido fue `SyntaxError: Cannot use import statement outside a module` en `/var/task/main.js`, anterior al arranque de Nest y a cualquier conexión con PostgreSQL. Hay un [reporte del mismo problema en Vercel](https://github.com/vercel/vercel/issues/17651).

## Aplicar el cambio

1. Sube los cambios al repositorio y despliega ese nuevo commit. Si haces un Redeploy, desmarca **Use existing Build Cache**.
2. En los logs de compilación de `api`, comprueba que se ejecute `build:vercel` y que termine correctamente.
3. Abre `/api/health` en el dominio del despliegue. La respuesta esperada es HTTP 200 con `{"status":"ok"}`; esta ruta también comprueba la conexión a la base de datos.

Mantén las variables de producción en Vercel, en el entorno correspondiente al despliegue. Esta API lee `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` y `PGSSL=1` para PostgreSQL con TLS; no usa `DATABASE_URL`. `APP_URL` debe ser el origen HTTPS de Foris para la autenticación. No subas archivos `.env` al repositorio.

La corrección se revisó de forma estática. El nuevo despliegue y su respuesta de health quedan pendientes de comprobar en Vercel.
