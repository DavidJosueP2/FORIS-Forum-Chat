# Perfil de desarrollo local

Los comandos de desarrollo seleccionan NODE_ENV=development para la API y Vite. Este perfil usa la API local y PostgreSQL local; no configura servicios de almacenamiento ni carga archivos.

## Archivos y prioridad

La API y Vite leen la configuración de la raíz del repositorio, desde cualquier directorio de trabajo. La prioridad, de mayor a menor, es:

1. Variables del proceso.
2. .env.development.local.
3. .env.development.
4. .env.local.
5. .env.

.env.development se versiona y solo contiene valores públicos: el nombre del perfil y los hosts locales de API y PostgreSQL. Los puertos, nombres de base de datos y credenciales actuales continúan en el .env privado. El archivo de ejemplo conserva la plantilla de esos valores.

.env.development.local es opcional y permanece excluido de Git. Permite ajustes personales, por ejemplo:

```dotenv
APP_PORT=3000
APP_URL=http://127.0.0.1:5173
PGHOST=127.0.0.1
PGPORT=5433
```

Los valores predeterminados de la aplicación son API 3000, frontend 5173 y PostgreSQL 5433. PGPASSWORD se sigue obteniendo del entorno privado. No se sustituyen contraseñas, AUTH_SECRET ni credenciales de Google o SMTP.

NODE_ENV se selecciona desde el proceso; los comandos de desarrollo lo establecen explícitamente. Sin una selección externa, la API usa development. También reconoce test y production para seleccionar los archivos correspondientes si existen; esta tarea solo añade el perfil development. El Dockerfile existente sigue indicando production.

## Comandos

```sh
npm run dev
```

Inicia API y frontend con el perfil de desarrollo. También están disponibles:

```sh
npm run dev:api
npm run dev:web
```

Cada uno inicia únicamente el servicio indicado. Vite usa los mismos archivos del perfil para resolver el puerto del proxy /api, incluyendo PORT y APP_PORT. Las credenciales del servidor no se exponen al navegador: las variables VITE_ se consideran públicas.

PostgreSQL conserva su configuración local existente. Este perfil no inicia Docker, crea bases de datos ni aplica migraciones por su cuenta. Al iniciar la API, se mantiene su mecanismo habitual de migraciones. Los cambios de configuración requieren reiniciar el servicio afectado.

Si PostgreSQL corre con Compose, PGPORT debe coincidir con el puerto publicado por ese contenedor. Compose conserva su lectura habitual del .env; los ajustes personales de la API no modifican el contenedor.

## Alcance y comprobación

Solo se prepararon la selección del entorno, su carga y los comandos de desarrollo. No se añadió lógica de imágenes, carpetas de archivos, adaptadores, SDK de S3, conexiones a R2 ni configuración de Neon.

Los archivos modificados se revisaron con ESLint y controles estáticos. No se iniciaron servicios, Docker, compilaciones, typecheck ni pruebas durante esta entrega.
