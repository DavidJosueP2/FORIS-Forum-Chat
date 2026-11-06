# Lectura y participación

El detalle `/publicaciones/:postId` presenta el artículo y los comentarios en una lectura compacta: título Fraunces de 24–30px, avatar de 28px, metadatos próximos, acciones y menús de puntos suspensivos. La marca turquesa AU identifica al autor de la publicación dentro del hilo; no representa verificación de identidad. La composición se sostiene con espacio y tipografía, sin portada, tarjetas repetidas ni bordes decorativos. El inicio y el lienzo conservan su presentación.

## Votos, comentarios y anclado

- Publicaciones y comentarios admiten voto positivo, negativo y retirada. `PUT` fija el estado absoluto `-1`, `0` o `1`; repetirlo conserva el resultado. La clave primaria por recurso y cuenta impide votos duplicados. `votes` devuelve `score` y el `value` de la cuenta actual; la interfaz confirma el resultado del servidor y permite deshacer pulsando de nuevo la opción seleccionada.
- Los comentarios principales tienen `parentId: null` y `depth: 0`. Las respuestas pertenecen a un padre de la misma publicación y admiten hasta `depth: 5`; no se puede responder a un comentario eliminado ni profundizar más. Cada rama se carga explícitamente, con 20 elementos por defecto y 50 como máximo.
- El autor de la publicación puede anclar un único comentario principal no eliminado, propio o ajeno. Anclar otro sustituye al anterior. Se muestra primero y el resto conserva orden de ID descendente; los votos no alteran ese orden.
- Cada autor puede editar o eliminar sus comentarios. Editar envía la revisión de partida; un cambio incompatible devuelve `409 REPLY_VERSION_CONFLICT`. Un texto ya coincidente no crea una revisión nueva. Eliminar también exige revisión y deja un marcador: borra el cuerpo almacenado, retira los votos y el anclado y oculta la identidad pública, conservando la relación de autor interna y las respuestas.

El `replyCount` de la publicación cuenta todos los comentarios no eliminados, también los de ramas profundas. El `replyCount` de un comentario cuenta sus hijos directos, incluidos los marcadores eliminados necesarios para recorrer el hilo. Crear o eliminar actualiza el total de la publicación en la misma transacción; los reintentos no lo duplican.

## API

Las rutas son relativas a `/api`; `id` es el UUID de la publicación y `replyId` un BIGINT representado como cadena.

| Método | Ruta | Entrada y resultado |
| --- | --- | --- |
| PUT | `/posts/:id/vote` | `{ value: -1 \| 0 \| 1 }`; devuelve `ForumVotes` |
| GET | `/posts/:id/replies` | `parentId`, `before`, `limit` opcionales; devuelve `{ items, hasMore, nextCursor }` |
| POST | `/posts/:id/replies` | `{ body, requestId, parentId? }`; devuelve `{ reply, replyCount, created }` |
| GET | `/posts/:id/replies/:replyId` | Devuelve el comentario accesible, independientemente de su página o profundidad |
| PATCH | `/posts/:id/replies/:replyId` | `{ body, revision }`; devuelve `{ reply, replyCount }` |
| DELETE | `/posts/:id/replies/:replyId` | Cuerpo JSON `{ revision }`; devuelve `{ reply, replyCount }` |
| PUT | `/posts/:id/replies/:replyId/vote` | `{ value: -1 \| 0 \| 1 }`; devuelve `ForumVotes` |
| PUT | `/posts/:id/replies/:replyId/pin` | `{ pinned: boolean }`; devuelve el comentario |

`body` admite de 1 a 5000 caracteres tras normalizar CRLF, Unicode NFC y espacios exteriores. `requestId` es un UUID independiente del ID del comentario. El reintento con la misma cuenta, publicación, padre y texto normalizado devuelve el comentario existente con `200` y `created: false`; la creación inicial devuelve `201`. Reutilizarlo con otra solicitud produce `409 REQUEST_CONFLICT`, incluso después de editar o eliminar el comentario original.

El cursor `before` es el ID del último comentario recibido y debe reenviarse en la misma publicación y rama; un cursor de otro padre se rechaza. La consulta conserva el orden anclado/ID y el acceso se comprueba antes de paginar. Los contratos públicos están en `packages/contracts/src/forum.d.ts`; las rutas en `apps/api/src/modules/forum/forum.controller.ts` y las operaciones en `forum-discussion.repository.ts`.

## Permisos y consistencia

La lectura pública admite invitados. Leer contenido privado exige sesión verificada y pertenencia; una publicación o comentario privado inaccesible responde `404`, también al intentar escribir. Participar en una publicación de comunidad pública exige pertenencia vigente y un no miembro recibe `403`.

Todas las mutaciones exigen el origen exacto configurado para Foris, JSON y límite de frecuencia: 60 solicitudes de escritura por IP en diez minutos. Crear conserva además el límite de 60 comentarios por cuenta y hora. La sesión verificada se revalida dentro de la transacción y se mantiene el orden de bloqueo usuario → comunidad → publicación. Editar y eliminar exigen autoría del comentario; anclar exige autoría de la publicación. Ni el autor ni la pertenencia se aceptan del cliente.

Los votos se guardan mediante inserción o actualización por clave primaria; `value: 0` elimina el voto. Las escrituras del hilo se serializan con el bloqueo de la publicación, incluidos anclado y contadores. La migración añade una referencia compuesta que impide padres de otra publicación y un índice único que permite un solo anclado por publicación.

## Borradores, enlaces y foco

Los borradores usan `sessionStorage` de la pestaña, separados por cuenta: comentario principal por publicación, respuesta por publicación y padre, edición por comentario con la revisión de partida. Un fallo conserva el texto; el fallo del almacenamiento se comunica junto al formulario. Guardar limpia el borrador correspondiente. Cancelar la edición conserva el borrador para retomarlo.

Ante un conflicto de edición se mantiene el texto y se ofrece abrir la versión publicada en otra pestaña o cargarla. Cargar exige confirmar el descarte, vuelve a consultar el servidor y solo limpia el borrador al obtener la versión publicada. No se sobrescribe automáticamente una revisión ajena. El cierre de edición, guardado, carga o diálogo de eliminación devuelve el foco al artículo del comentario, sin efectos de foco dependientes del texto escrito.

Compartir intenta la función nativa del dispositivo; cuando no existe usa el portapapeles. Si la operación falla, ofrece un campo de enlace seleccionable para copia manual; cancelar el diálogo nativo no muestra un error. El enlace de comentario usa `/publicaciones/:postId?comentario=ID`: consulta el nodo directamente aunque sea profundo o quede fuera de la primera página, muestra sus respuestas y ofrece «Todos los comentarios» y «Ver comentario anterior» cuando tiene padre. Las comprobaciones de acceso son las mismas que en el hilo completo.

## Base de datos y validación

`apps/api/src/database/migrations/010-forum-discussion.ts` es la migración aditiva 10, registrada en `run-migrations.ts`. Añade padre, profundidad, revisión, edición, eliminación lógica, hash de solicitud y anclado a los comentarios, además de las tablas de votos por publicación y comentario. Forma parte de la secuencia válida para una base nueva sobre el esquema vigente; no convierte esquemas históricos distintos. `DatabaseService` aplica las migraciones pendientes al iniciar manualmente la API. El asistente no ejecutó esta migración ni modificó datos.

La revisión de la entrega fue exclusivamente estática: ESLint de los archivos modificados, análisis sintáctico de la migración 010 y consultas de votos, análisis de CSS y resolución de 40 importaciones relativas. El análisis automático de consultas de cursor fue parcial porque el parser no admite `IS NOT DISTINCT FROM`; esa parte se revisó manualmente. El detector estático de lectura no produjo hallazgos principales; sus avisos tipográficos corresponden a la densidad local de AU y comentarios, sin ampliar la escala global.

Se ampliaron las fuentes de integración para votos, idempotencia, padres de otra publicación, profundidad, permisos y sesiones, revisiones, eliminación, anclado, paginación y privacidad; `migrations.test.ts` espera diez migraciones. Esas pruebas no se ejecutaron. Por indicación del usuario no se ejecutaron compilaciones, comprobaciones de tipos, servidores, Docker, migraciones ni navegador. La aplicación real sobre PostgreSQL y la validación visual y de interacción siguen pendientes; la aprobación estática no acredita esas comprobaciones.
