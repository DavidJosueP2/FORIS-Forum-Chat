# Imágenes y almacenamiento

Foris admite imágenes opcionales en nuevas publicaciones: JPEG, PNG y WebP; hasta tres imágenes de 5 MiB cada una por defecto. Las respuestas y el chat conservan su flujo de texto. El propietario puede retirar imágenes del detalle. La edición de título/cuerpo, añadir imágenes a una publicación ya creada, documentos, audio y vídeo no forman parte de esta entrega.

## Arquitectura y archivos principales

| Ubicación | Responsabilidad |
| --- | --- |
| apps/api/src/config/media-config.ts | Selección de adaptador, límites y validación del entorno |
| apps/api/src/modules/media/storage.port.ts | Puerto independiente del proveedor y validación de claves físicas |
| apps/api/src/modules/media/adapters/ | Adaptadores de disco y S3 compatible; SDK oficial de AWS solo aquí |
| apps/api/src/modules/media/media.service.ts | Autorización, confirmación, permisos temporales, borrado y recolector |
| apps/api/src/modules/media/media.repository.ts | Metadatos, propiedad, transacciones, reservas, eventos y métricas |
| apps/api/src/modules/media/image-validator.ts | Decodificación y recodificación real con Sharp |
| apps/api/src/database/migrations/005-create-media.ts | Tablas e índices; snapshot de IDs para reintentos de publicación |
| packages/contracts/src/media.d.ts | Contratos públicos sin claves físicas ni credenciales |
| apps/web/src/features/media/ | Selección, progreso, reintentos, eliminación y lectura renovable |

Se conserva el monolito modular Nest y PostgreSQL mediante pg, sin introducir ORM ni servicio paralelo. ForumModule utiliza MediaRepository para asociar imágenes dentro de su transacción; no importa el SDK. Los binarios quedan fuera de PostgreSQL. La migración 005 se aplicará mediante el mecanismo habitual al iniciar la API; no se ha ejecutado durante esta entrega.

## Desarrollo local

El perfil versionado .env.development selecciona:

```dotenv
STORAGE_DRIVER=local
STORAGE_LOCAL_ROOT=.data/uploads
```

Los comandos habituales npm run dev, npm run dev:api y npm run dev:web se conservan. Se necesita PostgreSQL local y AUTH_SECRET configurados como para las cuentas. No hacen falta credenciales R2 para este perfil. La raíz de almacenamiento se resuelve desde el repositorio, también al iniciar desde apps/api. Se crea al guardar el primer archivo y se excluye de Git y Docker.

El navegador hace PUT al endpoint local de la API con sesión y ticket HMAC temporal; el resto del flujo es el mismo que con S3. La lectura también usa ticket temporal, nunca una carpeta estática pública. La clave depende de AUTH_SECRET: rotarlo invalida tickets existentes, sin alterar los archivos.

Los ajustes personales se escriben en .env.development.local. La prioridad del entorno se detalla en [development.md](development.md). Aunque el .env base contenga credenciales R2, STORAGE_DRIVER=local del perfil de desarrollo impide seleccionarlas. Una variable del proceso o .env.development.local puede cambiar esa selección expresamente.

La carpeta y su base de datos deben conservarse juntas para mantener las imágenes locales. Este adaptador se rechaza en producción; el disco efímero de un servidor no se utiliza como almacenamiento persistente.

## Producción con R2

Configura estas variables privadas en el entorno del backend, sin prefijo VITE_:

```dotenv
NODE_ENV=production
STORAGE_DRIVER=s3
S3_PROVIDER=r2
S3_REGION=auto
S3_BUCKET=foris-media
S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
```

Completa los valores desde las credenciales existentes, sin sustituir secretos reales por los ejemplos. El endpoint es el origen HTTPS de la API S3, sin nombre de bucket, rutas ni parámetros. Mantén el bucket privado, clase Standard, sin r2.dev. El token de objetos debe estar limitado a lectura/escritura en ese bucket. Las claves nunca viajan al frontend. APP_URL debe coincidir exactamente con el origen público del frontend; conserva el proxy /api al backend.

En AWS S3 u otro proveedor compatible se selecciona el mismo driver y se cambian proveedor, región, endpoint, bucket y credenciales. Se exige compatibilidad con PUT condicional If-None-Match, HEAD, GET, DELETE y firmas S3; cada proveedor requiere comprobación de integración antes de producción.

### CORS del bucket

En R2 → foris-media → Settings → CORS policy, configura los orígenes que realmente vayas a usar. Ejemplo para desarrollo explícito contra R2:

```json
[
  {
    "AllowedOrigins": ["http://127.0.0.1:5173", "http://localhost:5173"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Para producción reemplaza AllowedOrigins por el dominio exacto de Foris, por ejemplo https://foris.example. Evita comodines y dominios de previews que no controles. Puedes mantener orígenes locales si realmente pruebas contra ese bucket; el perfil local no necesita CORS de R2.

El cliente envía Content-Type exactamente como fue firmado. El identificador de medios se firma como metadato en la URL y no añade encabezado de navegador. Si se amplían los encabezados enviados, actualiza esta política y la firma juntas. CORS permite al navegador utilizar una URL prefirmada; el acceso al objeto sigue dependiendo de esa URL temporal. Referencia: [CORS de R2](https://developers.cloudflare.com/r2/buckets/cors/) y [URLs prefirmadas](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

### Respaldo de limpieza

Configura una regla de ciclo de vida para **el prefijo foris/staging/** que elimine objetos después de un día. No apliques esta caducidad al prefijo foris/images/, que contiene las imágenes confirmadas. La regla complementa al recolector y permite eliminar un PUT iniciado antes de caducar su firma pero terminado mucho más tarde, incluso si la API está apagada. La eliminación por ciclo de vida es asíncrona y no constituye un corte inmediato. Referencia: [ciclos de vida de R2](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).

## Flujo y permisos

1. Una cuenta verificada solicita autorización con nombre, MIME, tamaño y requestId UUID. Se valida la sesión de nuevo dentro de la transacción y se reservan cuotas antes de emitir la URL.
2. El servidor genera claves UUID independientes para staging y versión final. Repetir requestId con el mismo archivo devuelve la autorización existente; cambiar sus datos produce conflicto.
3. El navegador realiza PUT directo a R2, o a la API en local, con progreso real. El permiso dura hasta cinco minutos.
4. La confirmación reclama un lease de verificación. HEAD verifica existencia, tamaño y tipo; GET está limitado en bytes. Se comprueban firma del formato, decodificación completa, dimensiones y número de páginas. Se rechazan SVG, archivos dañados, MIME falso y animaciones/múltiples páginas.
5. Sharp recodifica la imagen, aplica orientación y elimina metadatos. La versión normalizada se guarda con creación condicional: no puede ser sustituida por otro PUT del usuario ni sobrescribirse con contenido diferente.
6. Solo READY permite asociar la imagen. La publicación exige propiedad y membresía si corresponde a una comunidad. La relación, la publicación y sus avisos se guardan juntos.
7. La respuesta pública incluye IDs y metadatos, sin claves ni enlaces persistidos. Para mostrar una imagen se solicita una URL de lectura temporal y se renueva antes de caducar.
8. El propietario puede solicitar borrado. Se oculta inmediatamente; si falla el proveedor queda DELETING y se reintenta. La cuota usada solo se libera después de completar el borrado físico.

Una imagen no asociada solo es consultable por su propietario. Las publicaciones y comunidades actuales son abiertas, por lo que cualquiera que pueda leerlas puede solicitar sus imágenes READY. Si se incorporan comunidades privadas habrá que extender esta autorización. Una URL de lectura ya emitida es un permiso al portador hasta su caducidad o eliminación del objeto; no es una sesión revocable instantáneamente. Los enlaces no se guardan en borradores ni en la base, y las respuestas indican no-store y no-referrer.

Los estados principales son PENDING, VERIFYING, READY, REJECTED, DELETING y DELETED; EXPIRED está reservado en el modelo. Un fallo transitorio de verificación devuelve a PENDING para reintentar. Los inválidos quedan REJECTED sin acceso público. El recolector elimina subidas caducadas y READY sin publicación después del plazo de huérfanos. Un lease vencido permite recuperar trabajo interrumpido. Los borradores pueden perder una imagen tras ese plazo y piden retirarla o seleccionarla otra vez.

## Variables y cuotas

| Variable | Predeterminado | Uso |
| --- | --- | --- |
| MEDIA_MAX_IMAGE_BYTES | 5242880 | 5 MiB; configurable entre 1 KiB y 20 MiB |
| MEDIA_MAX_IMAGES_PER_POST | 3 | De 1 a 12 imágenes |
| MEDIA_MAX_IMAGE_PIXELS | 16000000 | Decodificación máxima; además cada dimensión se limita a 8192 |
| MEDIA_GLOBAL_STORAGE_BYTES | 8589934592 | Umbral global de 8 GiB |
| MEDIA_USER_STORAGE_BYTES | 104857600 | Cuota por cuenta de 100 MiB |
| MEDIA_UPLOAD_TTL_SECONDS | 300 | Autorización PUT; de 30 a 300 segundos |
| MEDIA_READ_TTL_SECONDS | 300 | Permiso GET; de 30 a 300 segundos |
| MEDIA_ORPHAN_TTL_HOURS | 24 | READY sin publicación; de 1 a 168 horas |
| MEDIA_CLEANUP_INTERVAL_SECONDS | 60 | Intervalo del recolector; de 10 a 3600 segundos |
| MEDIA_UPLOADS_PER_HOUR | 30 | Autorizaciones nuevas por cuenta; de 1 a 1000 |

Se bloquea primero la fila global y después la de usuario, con transacciones PostgreSQL. Cada autorización reserva dos veces el máximo por imagen, para original y versión normalizada; no confía en el tamaño declarado. Al confirmar, la versión normalizada pasa a bytes usados y se mantiene una reserva para staging. Esta reserva se libera tras caducar la URL, un margen de un minuto y completar la limpieza. Por eso una cuota puede permanecer ocupada brevemente aun después de quitar un archivo. Se vuelven a comprobar restos de staging cada hora durante el primer día.

La cuota global incluye todo el almacenamiento gestionado por la base, también registros de otros perfiles; es una reserva preventiva conservadora. No representa otros archivos o buckets de la cuenta del proveedor. Hay límites adicionales por IP: 60 escrituras cada quince minutos y 600 lecturas por minuto. La emisión de permisos está incluida. Estos límites por IP viven en cada proceso; para un despliegue con muchas réplicas se necesita un limitador compartido. Las reservas y el límite por cuenta viven en PostgreSQL y sí se comparten entre procesos.

Las URLs PUT no permiten imponer un techo de tamaño estricto al tráfico directo ni son de un solo uso. La confirmación rechaza y limpia los excesos; las reservas, los plazos y los límites reducen el riesgo pero no impiden todo consumo externo o abusivo. Los reintentos, renovaciones, lecturas, operaciones directas al bucket y archivos tardíos también consumen recursos. **No se garantiza gasto cero ni un límite estricto de facturación.**

R2 publica para Standard una capa gratuita mensual de 10 GB-mes, un millón de operaciones Clase A y diez millones Clase B, con salida a Internet gratuita. Es distinta de las cuotas preventivas internas y debe verificarse en la cuenta del proveedor. Referencia: [precios de R2](https://developers.cloudflare.com/r2/pricing/). Los valores internos se expresan en bytes binarios; no equivalen exactamente a las unidades comerciales de facturación.

## API

| Método y ruta | Acceso y resultado |
| --- | --- |
| GET /api/media/options | Público; tipos y límites de selección |
| GET /api/media/usage | Sesión; usado, reservado y límite del propietario |
| POST /api/media/uploads | Sesión verificada; autorización y URL PUT |
| POST /api/media/:id/complete | Propietario; verificación o confirmación idempotente |
| GET /api/media/:id | Propietario o imagen READY de publicación abierta |
| GET /api/media/:id/read-url | Mismos permisos; URL y fecha de caducidad |
| DELETE /api/media/:id | Propietario; DELETED o DELETING recuperable |
| PUT /api/media/:id/local-upload | Solo local; sesión, origen y ticket de subida |
| GET /api/media/:id/local-content | Solo local; ticket de lectura |

Las escrituras JSON requieren Origin igual a APP_URL. uploads recibe originalName, mime, bytes y requestId. complete y DELETE reciben un objeto JSON vacío. POST /api/posts acepta mediaIds; no recibe claves S3 ni URLs del cliente.

## Operación y evolución

media_events guarda autorizaciones y transiciones durante treinta días. media_metrics agrega operaciones por día durante noventa días: permisos, lecturas, escrituras, borrados y errores de limpieza. Se registran intentos de operación de la aplicación, no un contador exacto facturable del SDK: sus reintentos internos, PUT del navegador y uso externo no están todos incluidos. No se registran secretos ni URLs firmadas en logs de medios. No hay un panel administrativo de métricas en esta etapa.

El recolector trabaja en lotes de diez con FOR UPDATE SKIP LOCKED y leases, de modo que varias instancias no reclamen el mismo trabajo. Necesita al menos un proceso Nest persistente. En una plataforma que suspenda funciones sin tráfico, hay que mover esa tarea a un worker o programación externa; el temporizador interno no garantiza limpieza periódica allí. La regla del proveedor solo respalda staging, no sustituye todas las transiciones y cuotas de la base.

Cada medio conserva un storage_profile derivado de la raíz local o del proveedor, endpoint, región y bucket. Si estos cambian, se rechaza el acceso y borrado desde la configuración nueva, evitando actuar sobre un destino equivocado. Rotar las credenciales del mismo destino conserva el perfil. Para migrar imágenes existentes: suspende escrituras, respalda datos, copia los objetos conservando claves, valida contenido/recuentos y actualiza deliberadamente perfil/proveedor en los metadatos dentro de una migración controlada. Cambiar variables por sí solo no mueve archivos. El sistema selecciona un destino activo; no resuelve simultáneamente varios buckets antiguos.

## Comprobación de esta entrega

Se prepararon fuentes de pruebas unitarias e integración para configuración, tipos/tamaño, tickets, validación real, almacenamiento local inmutable, S3 simulado, permisos, asociación, reintentos, cuotas, eliminación y contenido inválido. El caso opcional media-postgres.test.ts cubre reservas concurrentes entre cuentas y recolectores simultáneos con PostgreSQL real.

Ese caso está desactivado salvo que se defina FORIS_MEDIA_TEST_DATABASE_URL para una base dedicada llamada foris_media_test en localhost/127.0.0.1/[::1]. Crea y elimina únicamente un esquema aleatorio propio y su directorio temporal; nunca usa la base configurada en .env. El resto utiliza pg-mem y almacenamiento temporal, sin demostrar los bloqueos reales de PostgreSQL. El SDK se simula y las firmas de prueba usan credenciales ficticias locales, sin tocar R2.

Por decisión expresa del usuario se mantuvo **solo revisión estática**: ESLint, inspección de fuentes, contratos, dependencias, imports y CSS. No se ejecutaron pruebas, compilaciones, typecheck, migraciones, servidores, Docker ni operaciones contra el bucket real. Permanecen pendientes la validación en ejecución de las pruebas preparadas y la prueba manual navegador → R2 → confirmación → publicación → lectura → eliminación, con CORS y credenciales reales configurados por el usuario.
