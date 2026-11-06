# Autores, comunidades y Siguiendo

El inicio ofrece «Para ti» y «Siguiendo». Para ti conserva las publicaciones accesibles en orden cronológico y la exploración existente; su nombre no implica un algoritmo de recomendaciones personalizado. Siguiendo reúne las publicaciones de autores o comunidades que la cuenta sigue, con los mismos permisos de lectura y filtros.

## Interfaz y estado

`/?vista=siguiendo` selecciona Siguiendo; omitir ese parámetro vuelve a Para ti. Búsqueda, temática, etiquetas y autor siguen combinándose con el flujo elegido. Un invitado ve una invitación a entrar, sin solicitar su flujo privado; el acceso conserva exactamente `/?vista=siguiendo` como destino permitido en cliente y API, incluidos registro, OTP y Google.

Seguir está disponible junto al autor en el inicio y el detalle, y para las comunidades del contexto lateral. No se ofrece seguirse a uno mismo. El control conserva un área de 44px, nombre accesible, estado `aria-pressed`, progreso y error junto a la acción. En móvil puede mostrar solo el icono con el mismo nombre accesible; no depende de la columna lateral.

Los enlaces de personas abren `/personas/:userId` desde las publicaciones, los comentarios no eliminados, el contexto de autor, el creador de una comunidad y los mensajes de chat asociados a una cuenta por el servidor. Los mensajes invitados conservan su nombre como texto. El filtro `/?autor=UUID` y el parámetro `author` de la API siguen disponibles para enlaces anteriores.

El perfil público reúne foto disponible, nombre, biografía, mes y año de incorporación, Seguir y Compartir. El perfil propio sustituye Seguir por Editar perfil hacia `/profile`; esa página conserva la configuración privada y ofrece Ver mi perfil público. Los botones Publicaciones y Comunidades públicas muestran recuentos reales y selección accesible; `?vista=comunidades` selecciona la segunda vista. El acceso desde Seguir conserva ruta y consulta, admitidas en cliente y API, también al continuar con OTP o Google.

Los cambios se separan por la cuenta que los originó. Solo sus controles consumen el evento de seguimiento; cambiar de cuenta o cerrar sesión retira el estado anterior. Una confirmación vuelve a consultar Siguiendo, también al dejar de seguir. Si la actualización retira una fila que contenía el foco, este pasa al encabezado del flujo; los demás controles mantienen su foco. Carga, vacío, error y reintento proceden de respuestas reales, sin publicaciones de ejemplo.

## Contrato HTTP y privacidad

| Método | Ruta | Contrato |
| --- | --- | --- |
| GET | `/api/posts?feed=following` | Sesión vigente; devuelve 401 a invitados. Conserva filtros y paginación del foro. |
| GET | `/api/authors/:id` | UUID de persona; sesión opcional y disponibilidad condicionada al contexto de lectura descrito abajo. |
| GET | `/api/authors/:id/posts` | Publicaciones públicas de esa persona; admite `limit` y `before`. |
| GET | `/api/authors/:id/communities` | Comunidades públicas a las que pertenece, incluidas las creadas; admite `limit` y `before`. |
| PUT | `/api/authors/:id/follow` | UUID de autor y sesión verificada; recibe `{ "following": true }` o `false`. |
| PUT | `/api/communities/:id/follow` | ID de comunidad y sesión verificada; recibe el mismo cuerpo. |
| GET | `/api/communities?scope=following` | Comunidades seguidas por la cuenta, limitadas por su acceso vigente. |

Las escrituras devuelven `{ "isFollowing": boolean }`, validan campos, origen y JSON, aplican el límite de escrituras del foro y usan un parser de 8 KiB. La sesión se vuelve a comprobar dentro de la transacción mediante `ForumAccess.member`. Repetir el estado es idempotente. Seguirse a uno mismo devuelve 400.

La ficha de autor devuelve `id`, `displayName`, `bio`, `avatarId` opcional, `isFollowing`, `createdAt`, `publicPostCount` y `publicCommunityCount`; no expone correo ni datos privados de cuenta. Está disponible para la propia cuenta o si la persona tiene una publicación legible, un comentario no eliminado sobre una publicación legible, pertenencia a una comunidad legible o un mensaje del chat vinculado a su cuenta mediante `messages.user_id`. Un `senderId` invitado no acredita esa vinculación. Un UUID mal formado devuelve 400; una persona desconocida o sin ese contexto accesible devuelve 404, también en sus listados. La sesión opcional se verifica mediante el servicio existente.

Los dos listados y los recuentos son exclusivamente públicos, incluso para el propietario del perfil o miembros de sus comunidades privadas. La ruta de publicaciones fija el autor y la condición pública en el servidor: otros filtros de consulta no los sustituyen. Conserva el orden cronológico y el cursor opaco por fecha y UUID del foro. Las comunidades se ordenan por ID descendente con cursor numérico; ambas respuestas usan `items`, `hasMore` y `nextCursor`, con 20 elementos por defecto y máximo 50. La lista de comunidades no publica favoritas, avisos ni seguimientos de la persona. Sus campos de pertenencia, preferencias y seguimiento corresponden al visitante; las etiquetas Creador o Miembro de la interfaz describen a la persona visitada.

Las tres lecturas usan `Cache-Control: no-store` y el límite existente de 240 consultas por IP y minuto. Las publicaciones incluyen el seguimiento propio en `author.isFollowing` y las comunidades en `isFollowing`.

El filtro SQL combina `readablePost AND (autor seguido OR comunidad seguida)` antes de paginar. Seguir a un autor no permite leer sus publicaciones privadas. Se conserva el cursor por fecha y UUID existente; las comprobaciones `EXISTS` evitan duplicar una publicación cuando coinciden autor y comunidad.

Seguir una comunidad privada exige pertenecer a ella y poder leerla. Dejar de seguir elimina únicamente la relación propia y se admite aunque ya no se tenga acceso al recurso, sin revelar su contenido. La misma retirada propia se permite para un autor que haya dejado de ser visible.

## Pertenencia y persistencia

Seguir una comunidad no incorpora a ella. Dejar de seguir tampoco la abandona ni cambia favoritas o avisos. Crear una comunidad, unirse o aceptar una invitación activa el seguimiento al crear una membresía nueva; repetir una membresía existente respeta una decisión posterior de dejar de seguir. Salir elimina el seguimiento de esa comunidad y mantiene las reglas existentes de favoritas, avisos y privacidad.

La migración registrada `011-following.ts` crea `author_follows` y `community_follows`, con claves primarias compuestas que evitan relaciones repetidas y referencias con borrado en cascada. Impide el seguimiento de uno mismo y añade el seguimiento de las membresías existentes. No convierte favoritas ni preferencias de avisos en seguimientos.

Para activar esta entrega, el usuario debe reiniciar la API: el mecanismo habitual de arranque aplicará la migración 11 pendiente. El asistente no reinició la API ni ejecutó la migración.

## Presentación y alcance

Inicio y detalle comparten un contenedor de hasta 1200px, columna principal y contexto de 248px separados por 32px. Bajo 1280px queda una columna de hasta 960px y se oculta el contexto; bajo 768px se usan 16px laterales. En el inicio, el contexto muestra hasta cuatro comunidades reales con foto disponible, nombre, miembros, seguimiento y accesos a explorar o crear. En el detalle reúne autor y biografía disponible, comunidad y clasificación real. No introduce rankings ni métricas inventadas.

Las publicaciones mantienen títulos Fraunces, extractos de hasta 70ch y acciones de 44px. Cada artículo usa 16px de relleno vertical, sin margen extra entre filas; un separador funcional de 1px con `secondary` distingue su final e inicio. La fecha permanece junto al autor, una clasificación vacía no reserva espacio y la barra de acciones usa `card`. Artículo y comentarios conservan lectura compacta, con divisores entre comentarios principales y sin nuevas tarjetas.

El perfil público reutiliza el shell, las fuentes, los colores y `DiscoveryFeed` existentes. Su cabecera es compacta, sin portada ni métricas inventadas. Comparte el máximo de 1200px y la columna lateral de 248px con separación de 32px; esta muestra hasta tres comunidades públicas desde 1280px. La vista Comunidades públicas permite cargar páginas de veinte elementos también cuando se oculta el contexto. En móvil la foto y el título se reducen y las acciones pasan a otra fila. Cambiar de vista conserva el foco del botón activado.

La presentación vive en `features/forum/following`, `components/context-rail.tsx`, `components/content-layout.css`, `discovery`, `reading` y `features/account/pages/public-profile-page.tsx`. El contrato se implementa en `forum-follow.controller.ts`, `forum-follow.repository.ts` y las consultas del foro y comunidades. Los perfiles públicos no añaden una migración; la 011 pendiente corresponde al seguimiento anterior.

La revisión final concluyó SHIP dentro del alcance estático, con ESLint y revisión de SQL, CSS e imports. Se añadieron fuentes de prueba para el flujo, permisos, seguimiento y registro de migración, sin ejecutarlas. No se realizaron compilación, typecheck, pruebas, servidores, Docker, migraciones ni renderizados de navegador por indicación del usuario; la comprobación visual y en ejecución sigue pendiente.

La extensión de perfiles cuenta con revisión estática de ESLint, análisis de sintaxis del CSS y SQL e imports locales. Las fuentes de prueba añadidas contemplan privacidad incluso al ver el perfil propio, paginación, comentaristas sin publicaciones, membresías públicas, participantes registrados del chat, atribución de invitados y destinos de acceso permitidos. No se ejecutaron; esta evidencia no valida el comportamiento visual ni en ejecución.
