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

La entrada inicia Nest mediante `bootstrap().catch(...)`, sin `await` en el nivel superior del módulo, como en el [ejemplo de NestJS en Vercel](https://vercel.com/docs/frameworks/backend/nestjs). El archivo `index.mjs` importa la API de forma dinámica y registra la fase `entrypoint` antes de cargar sus dependencias. Después aparecen las fases `nest` y `listen`. Los errores se registran como `foris_startup_failed`, con su fase y código, sin imprimir variables de entorno.

## Aplicar el cambio

1. Sube los cambios al repositorio y despliega ese nuevo commit. Si haces un Redeploy, desmarca **Use existing Build Cache**.
2. En los logs de compilación de `api`, comprueba que se ejecute `build:vercel` y que termine correctamente.
3. Abre `/api/health` en el dominio del despliegue. La respuesta esperada es HTTP 200 con `{"status":"ok"}`; esta ruta también comprueba la conexión a la base de datos.

Mantén las variables de producción en Vercel, en el entorno correspondiente al despliegue. Esta API lee `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` y `PGSSL=1` para PostgreSQL con TLS; no usa `DATABASE_URL`. `APP_URL` debe ser el origen HTTPS de Foris para la autenticación. No subas archivos `.env` al repositorio.

La corrección se revisó de forma estática. El nuevo despliegue y su respuesta de health quedan pendientes de comprobar en Vercel.

## Chat: rechazo `ORIGIN_REJECTED` al enviar mensajes

El filtro de `POST /api/messages` comparaba el `Origin` del navegador con `request.protocol` y `Host` recibidos por Nest. Detrás del proxy, la conexión interna puede ser HTTP o tener un host distinto del dominio público HTTPS. El filtro rechazaba el envío antes de distinguir entre invitado y cuenta, aunque la sesión fuera válida. El diagnóstico anterior sugería revisar `APP_URL`, pero ese filtro todavía no la consultaba.

Ahora el chat compara el origen con `config.auth.origin`, normalizado desde `APP_URL`, igual que autenticación y foro. La autorización no depende de `Host`, `X-Forwarded-Host` ni `X-Forwarded-Proto`. No requiere cambiar `TRUST_PROXY` para resolver este error. Se conserva el comportamiento de clientes sin `Origin` y la exigencia de JSON; los orígenes presentes ajenos a `APP_URL` siguen recibiendo HTTP 403.

Para aplicar la corrección, publica el commit corregido y verifica en el entorno correspondiente de Vercel que `APP_URL` sea exactamente el origen visible en el navegador (protocolo HTTPS y dominio, sin `/chat`, `/api`, query ni fragmento). Un dominio personalizado, un alias y una URL de preview son orígenes diferentes: abre el que coincide con `APP_URL`. No se aceptan comodines `*.vercel.app`. Cambiar variables exige un nuevo despliegue; este arreglo no modifica configuración remota.

Después del despliegue, envía manualmente un mensaje de invitado y otro con sesión, y confirma la respuesta 201 de `/api/messages`. Un reintento del mismo envío debe devolver 200 sin duplicar el mensaje. Las fuentes de regresión cubren HTTPS público con conexión interna HTTP, ambos modos de identidad, reintentos y rechazo de orígenes falsificados. Se prepararon sin ejecutar pruebas, servidores, compilación ni typecheck.

Referencias: [Express detrás de proxies](https://expressjs.com/en/guide/behind-proxies.html) explica cómo el proxy afecta las propiedades de la solicitud; [cabeceras de Vercel](https://vercel.com/docs/headers/request-headers) documenta `Host` y `X-Forwarded-*`.

## Inspección del 6 de noviembre de 2026

El despliegue de producción `dpl_8rQQcHtXQd5f2pdMXFA5UmTt9D6e`, commit `0d122c94e169344edd1da334bc50a21d21d48929`, figura como `READY`. La consulta de `/api/health/` devolvió HTTP 500 con `INTERNAL_FUNCTION_INVOCATION_FAILED`; el identificador de la petición fue `iad1:iad1::b86kr-1794003023224-a3f66ea0acb2` (22:11:23 UTC). El MCP no devolvió logs de ejecución ni una traza para ese despliegue y esa petición.

Los logs ESM encontrados en la consulta general corresponden al despliegue anterior `dpl_CMs6DAa3Nbp5JQizosnEkARXaEmf`. No confirman la causa del fallo actual. El cambio de arranque y los registros de fases deben validarse en un nuevo despliegue; no se ha publicado desde esta revisión.
