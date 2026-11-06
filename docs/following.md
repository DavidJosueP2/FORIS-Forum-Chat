# Autores, comunidades y Siguiendo

El inicio ofrece «Para ti» y «Siguiendo». Para ti conserva las publicaciones accesibles en orden cronológico y la exploración existente; su nombre no implica un algoritmo de recomendaciones personalizado. Siguiendo reúne las publicaciones de autores seguidos y de comunidades a las que pertenece la cuenta, con los mismos permisos de lectura y filtros.

## Interfaz y estado

`/?vista=siguiendo` selecciona Siguiendo; omitir ese parámetro vuelve a Para ti. Búsqueda, temática, etiquetas y autor siguen combinándose con el flujo elegido. Un invitado ve una invitación a entrar, sin solicitar su flujo privado; el acceso conserva exactamente `/?vista=siguiendo` como destino permitido en cliente y API, incluidos registro, OTP y Google.

Seguir está disponible junto al autor en el inicio y el detalle. Las comunidades del contexto lateral, del perfil público y del detalle no tienen controles de seguimiento; la pertenencia las incorpora a Siguiendo. No se ofrece seguirse a uno mismo. El control conserva un área de 44px, nombre accesible, estado `aria-pressed`, progreso y error junto a la acción. En móvil puede mostrar solo el icono con el mismo nombre accesible; no depende de la columna lateral.

Los enlaces de personas abren `/personas/:userId` desde las publicaciones, los comentarios no eliminados, el contexto de autor, el creador de una comunidad y los mensajes de chat asociados a una cuenta por el servidor. Los mensajes invitados conservan su nombre como texto. El filtro `/?autor=UUID` y el parámetro `author` de la API siguen disponibles para enlaces anteriores.

El perfil público reúne foto disponible, nombre, biografía, mes y año de incorporación, Seguir y Compartir. El perfil propio sustituye Seguir por Editar perfil hacia `/profile`; esa página conserva la configuración privada y ofrece Ver mi perfil público. Los botones Publicaciones y Comunidades muestran recuentos reales y selección accesible; `?vista=comunidades` selecciona la segunda vista. Sus vacíos dicen «No hay publicaciones para mostrar» y «No hay comunidades para mostrar», sin afirmar ausencia de actividad privada. El acceso desde Seguir conserva ruta y consulta, admitidas en cliente y API, también al continuar con OTP o Google.

Los cambios se separan por la cuenta que los originó. Solo sus controles consumen el evento de seguimiento; cambiar de cuenta o cerrar sesión retira el estado anterior. Una confirmación vuelve a consultar Siguiendo, también al dejar de seguir. Si la actualización retira una fila que contenía el foco, este pasa al encabezado del flujo; los demás controles mantienen su foco. Carga, vacío, error y reintento proceden de respuestas reales, sin publicaciones de ejemplo.

## Contrato HTTP y privacidad

| Método | Ruta | Contrato |
| --- | --- | --- |
| GET | `/api/posts?feed=following` | Sesión vigente; devuelve 401 a invitados. Conserva filtros y paginación del foro. |
| GET | `/api/authors/:id` | UUID de persona; sesión opcional y disponibilidad condicionada al contexto de lectura descrito abajo. |
| GET | `/api/authors/:id/posts` | Publicaciones públicas de esa persona; admite `limit` y `before`. |
| GET | `/api/authors/:id/communities` | Comunidades públicas a las que pertenece, incluidas las creadas; admite `limit` y `before`. |
| PUT | `/api/authors/:id/follow` | UUID de autor y sesión verificada; recibe `{ "following": true }` o `false`. |

La ruta retirada `PUT /api/communities/:id/follow` responde 404. El directorio admite únicamente `scope=all|mine|favorites`; `scope=following` devuelve 400. El DTO de comunidad ya no incluye `isFollowing`.

Las escrituras de seguimiento de autor devuelven `{ "isFollowing": boolean }`, validan campos, origen y JSON, aplican el límite de escrituras del foro y usan un parser de 8 KiB. La sesión se vuelve a comprobar dentro de la transacción mediante `ForumAccess.member`. Repetir el estado es idempotente. Seguirse a uno mismo devuelve 400.

La ficha de autor devuelve `id`, `displayName`, `bio`, `avatarId` opcional, `isFollowing`, `createdAt`, `publicPostCount` y `publicCommunityCount`; no expone correo ni datos privados de cuenta. Está disponible para la propia cuenta o si la persona tiene una publicación legible, un comentario no eliminado sobre una publicación legible, pertenencia a una comunidad legible o un mensaje del chat vinculado a su cuenta mediante `messages.user_id`. Un `senderId` invitado no acredita esa vinculación. Un UUID mal formado devuelve 400; una persona desconocida o sin ese contexto accesible devuelve 404, también en sus listados. La sesión opcional se verifica mediante el servicio existente.

Los dos listados y los recuentos son exclusivamente públicos, incluso para el propietario del perfil o miembros de sus comunidades privadas. La ruta de publicaciones fija el autor y la condición pública en el servidor: otros filtros de consulta no los sustituyen. Conserva el orden cronológico y el cursor opaco por fecha y UUID del foro. Las comunidades se ordenan por ID descendente con cursor numérico; ambas respuestas usan `items`, `hasMore` y `nextCursor`, con 20 elementos por defecto y máximo 50. La lista de comunidades no publica favoritas ni avisos de la persona. Sus campos de pertenencia y preferencias corresponden al visitante; las etiquetas Creador o Miembro de la interfaz describen a la persona visitada.

Las tres lecturas usan `Cache-Control: no-store` y el límite existente de 240 consultas por IP y minuto. Las publicaciones incluyen el seguimiento propio del autor en `author.isFollowing`; las comunidades no exponen un seguimiento separado.

El filtro SQL combina `readablePost AND (autor seguido OR pertenencia a la comunidad)` antes de paginar, usando `author_follows` y `community_memberships`. Seguir a un autor no permite leer sus publicaciones privadas. Se conserva el cursor por fecha y UUID existente; las comprobaciones `EXISTS` evitan duplicar una publicación cuando coinciden autor y comunidad.

La pertenencia a una comunidad privada conserva su permiso de lectura; seguir a uno de sus autores no lo sustituye. Dejar de seguir a un autor elimina únicamente la relación propia y se admite aunque haya dejado de ser visible, sin revelar su contenido.

## Pertenencia y persistencia

Crear una comunidad, unirse o aceptar una invitación crea o conserva la membresía que incluye sus publicaciones en Siguiendo. No hay una segunda relación de seguimiento de comunidades. Guardar una favorita no incorpora a la comunidad ni a ese flujo; silenciar avisos tampoco cambia la pertenencia ni Siguiendo. Los miembros ordinarios pueden salir: se retira esa vía de inclusión, se conserva la favorita y se detienen los avisos futuros. Aún pueden aparecer publicaciones públicas de esa comunidad si su autor sigue estando seguido. Las privadas dejan de ser legibles al salir. El creador no puede abandonar su comunidad: se conserva el conflicto 409 existente, sin transferencia de propiedad en esta etapa.

La migración histórica `011-following.ts`, conservada sin cambios, crea `author_follows` y `community_follows`, con claves primarias compuestas que evitan relaciones repetidas y referencias con borrado en cascada. Impide el seguimiento de uno mismo y añade el seguimiento de las membresías existentes. No convierte favoritas ni preferencias de avisos en seguimientos.

La migración `012-community-membership-feed.ts`, registrada después de la 011, elimina únicamente `community_follows` mediante `DROP TABLE` sin `CASCADE`. Conserva comunidades, membresías, preferencias y `author_follows`; los antiguos seguimientos de no miembros no se convierten en membresías. La inclusión en Siguiendo pasa a consultar directamente las membresías vigentes.

Para activar esta entrega, el usuario debe reiniciar la API: el mecanismo habitual de arranque aplicará las migraciones pendientes hasta la 12. Este ajuste no requiere reiniciar la base ni configurar Google. El asistente no reinició la API ni ejecutó migraciones.

## Presentación y alcance

Inicio y detalle comparten un contenedor de hasta 1200px, columna principal y contexto de 248px separados por 32px. Bajo 1280px queda una columna de hasta 960px y se oculta el contexto; bajo 768px se usan 16px laterales. En el inicio, el contexto muestra hasta cuatro comunidades reales con foto disponible, nombre, miembros y accesos a explorar o crear. En el detalle reúne autor y biografía disponible, comunidad y clasificación real. No introduce rankings ni métricas inventadas.

Las publicaciones mantienen títulos Fraunces, extractos de hasta 70ch y acciones de 44px. Cada artículo usa 16px de relleno vertical, sin margen extra entre filas; un separador funcional de 1px con `secondary` distingue su final e inicio. La fecha permanece junto al autor, una clasificación vacía no reserva espacio y la barra de acciones usa `card`. Artículo y comentarios conservan lectura compacta, con divisores entre comentarios principales y sin nuevas tarjetas.

El perfil público reutiliza el shell, las fuentes, los colores y `DiscoveryFeed` existentes. Su cabecera es compacta, sin portada ni métricas inventadas. Comparte el máximo de 1200px y la columna lateral de 248px con separación de 32px; esta muestra hasta tres comunidades públicas desde 1280px. La vista Comunidades permite cargar páginas de veinte elementos también cuando se oculta el contexto. En móvil la foto y el título se reducen y las acciones pasan a otra fila. Cambiar de vista conserva el foco del botón activado.

La presentación vive en `features/forum/following`, `components/context-rail.tsx`, `components/content-layout.css`, `discovery`, `reading` y `features/account/pages/public-profile-page.tsx`. El contrato se implementa en `forum-follow.controller.ts`, `forum-follow.repository.ts` y las consultas del foro y comunidades. Los perfiles públicos no añaden una migración; la 011 corresponde al seguimiento anterior y la 012 retira su relación independiente con comunidades.

La revisión final concluyó SHIP dentro del alcance estático, con ESLint y revisión de SQL, CSS e imports. Se añadieron fuentes de prueba para el flujo, permisos, seguimiento y registro de migración, sin ejecutarlas. No se realizaron compilación, typecheck, pruebas, servidores, Docker, migraciones ni renderizados de navegador por indicación del usuario; la comprobación visual y en ejecución sigue pendiente.

La extensión de perfiles cuenta con revisión estática de ESLint, análisis de sintaxis del CSS y SQL e imports locales. Las fuentes de prueba añadidas contemplan privacidad incluso al ver el perfil propio, paginación, comentaristas sin publicaciones, membresías públicas, participantes registrados del chat, atribución de invitados y destinos de acceso permitidos. No se ejecutaron; esta evidencia no valida el comportamiento visual ni en ejecución.

La extensión de pertenencia conserva las fuentes de prueba para la unión de autores seguidos y membresías sin duplicados, salida, privacidad, favoritas y avisos, ausencia de isFollowing en comunidades, endpoint retirado (404), scope retirado (400) y conservación de datos al aplicar la migración 12 sin incorporar no miembros. Se actualizaron esas fuentes y se revisaron estáticamente; no se ejecutaron.

El ajuste de textos y navegación recibió SHIP en revisión estática, con los dos vacíos del perfil corregidos. ESLint sobre los TSX modificados, PostCSS sobre las dos hojas de estilo, `git diff --check` y una pasada del detector Impeccable terminaron sin hallazgos. No se realizaron capturas ni comprobaciones visuales o en ejecución; esos límites se mantienen.
