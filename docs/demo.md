# Datos de demo local

La demo prepara 12 perfiles ficticios, 20 comunidades y 20 publicaciones. Incluye votos, membresías, respuestas anidadas y una comunidad privada. Las publicaciones combinan fotos con textos breves y preguntas que dan pie a hilos.

## Preparar el entorno

Ejecuta los comandos desde la raíz del repositorio. Usan la base de PostgreSQL que ya selecciona el perfil local de Foris en `PGDATABASE` y su carpeta `STORAGE_LOCAL_ROOT`. El comando muestra el destino antes de operar. Se admite PostgreSQL de loopback con `PGSSL=0` y `STORAGE_DRIVER=local`.

`AUTH_SECRET` se usa para abrir las imágenes desde el navegador. Si aún falta, `npm run setup:auth` puede generarlo. Para iniciar sesión con `ana@foris-demo.test`, configura `FORIS_DEMO_PASSWORD` en privado antes de poblar la demo. La contraseña se guarda como hash y debe tener entre 15 y 128 caracteres. Los demás perfiles son autores ficticios sin contraseña. Crear los perfiles demo prescinde del registro por correo y del proveedor OAuth.

Las cargas aplican las migraciones pendientes y añaden sus datos a los existentes. La demo registra una marca vinculada a la carpeta de medios para reconocer una carga ya completada. Para confirmar un borrado, detén primero la API y cierra las demás conexiones a esa base.

## Comandos

```powershell
npm run db:migrate
npm run db:seed:catalogs
npm run db:seed:demo -- --dry-run
npm run db:seed:demo
npm run db:reset
```

- `db:migrate` aplica las migraciones pendientes a la base local configurada.
- `db:seed:catalogs` carga categorías y etiquetas oficiales de forma repetible. `--dry-run` muestra sus recuentos antes de conectar.
- `db:seed:demo` carga catálogos y contenido. `--dry-run` valida los documentos y los WebP y muestra el tamaño final sin conexión a PostgreSQL. Una carga ya confirmada conserva el contenido existente. Si se interrumpe la carga, los identificadores deterministas permiten reutilizar únicamente los objetos locales con bytes idénticos.
- `db:reset` muestra el inventario de datos e imágenes. Para aplicar el borrado completo de los datos de Foris, añade `-- --confirm=<nombre exacto de PGDATABASE>`. Reinicia las secuencias y limpia las imágenes y originales registrados en esa base. Conserva el esquema, el historial de migraciones y las filas de infraestructura necesarias para volver a poblarla.

El reset comprueba el perfil de medios y las rutas registradas. Si la carpeta es compartida, verifica primero qué bases utilizan esos objetos. Los archivos sin registro quedan fuera del inventario. Si falla la limpieza, revierte el borrado SQL y permite repetirlo. Los archivos que ya se hayan eliminado necesitan una copia de seguridad o una nueva carga de la demo para recuperarse.

## Editar el contenido y sus imágenes

Edita [fixtures.js](../scripts/demo/fixtures.js) para cambiar nombres, textos, fechas relativas o conversaciones. `author` identifica al perfil por su clave y `photos` enumera las imágenes de una publicación. Cada comunidad usa su propia portada `portada-<key>.webp`.

El paquete [assets](../scripts/demo/assets/) contiene fotos WebP de Wikimedia Commons y avatares vectoriales originales rasterizados para la demo. Cada publicación y cada comunidad tiene archivos visuales propios. [credits.json](../scripts/demo/assets/credits.json) registra título, autor, fuente, licencia y conversión. Las publicaciones incluyen los créditos de sus fotos y su portada. Las conversiones mantienen las licencias indicadas en el registro de cada imagen. [Reutilización de archivos de Wikimedia Commons](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)

La carga toma las imágenes del repositorio, comprueba que sus fuentes y archivos sean distintos y las guarda mediante el adaptador local de Foris. Las cuotas de bytes se actualizan con los archivos que se almacenan. El modo local excluye destinos S3 y entornos de despliegue.
