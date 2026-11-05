# Perfil de desarrollo local

Los comandos de desarrollo seleccionan NODE_ENV=development para la API y Vite. Este perfil usa la API local, PostgreSQL local y almacenamiento de imágenes en disco, sin necesitar R2.

## Archivos y prioridad

La API y Vite leen la configuración de la raíz del repositorio, desde cualquier directorio de trabajo. La prioridad, de mayor a menor, es:

1. Variables del proceso.
2. .env.development.local.
3. .env.development.
4. .env.local.
5. .env.

.env.development se versiona y solo contiene valores públicos: el nombre del perfil, hosts locales de API y PostgreSQL y STORAGE_DRIVER=local con STORAGE_LOCAL_ROOT=.data/uploads. Los puertos, nombres de base de datos y credenciales actuales continúan en el .env privado. El archivo de ejemplo conserva la plantilla de esos valores.

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

Las imágenes se guardan en .data/uploads, resuelta desde la raíz del repositorio aunque se inicie la API desde apps/api. La carpeta se crea al guardar el primer archivo y está excluida de Git y Docker. No se publica como carpeta estática: las lecturas usan permisos temporales y las subidas requieren sesión. PostgreSQL guarda los metadatos; respalda la base y esa carpeta juntas si necesitas conservar las imágenes locales.

No hace falta cambiar npm run dev, npm run dev:api ni npm run dev:web. Mantén PostgreSQL y AUTH_SECRET configurados como hasta ahora. Al iniciar la API se aplicará la migración 005 de medios mediante el mecanismo habitual; durante esta entrega no se ha ejecutado. Las claves S3 presentes en el .env base no se utilizan mientras este perfil seleccione local.

Para ajustes personales usa .env.development.local. Producción requiere STORAGE_DRIVER=s3 y sus credenciales en el entorno del servidor. No uses disco efímero de un despliegue para conservar imágenes. La configuración de R2, límites, CORS y operación se describe en [media.md](media.md).

Los archivos modificados se revisaron con ESLint y controles estáticos. No se iniciaron servicios, Docker, compilaciones, typecheck ni pruebas durante esta entrega.
