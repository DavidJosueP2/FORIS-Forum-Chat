# Foros y chat global

Foris organiza publicaciones mediante un catálogo jerárquico de temáticas y etiquetas múltiples. Una publicación tiene UUID propio, título, texto, imágenes opcionales y respuestas; puede pertenecer a una comunidad. Sus miembros pueden publicar y responder dentro de ella. Las comunidades, favoritas y avisos se describen en [communities.md](communities.md).

Esta etapa cambia únicamente la lógica y los contratos. El inicio conserva sus cinco filtros y su diseño; el formulario actual sigue enviando topicId. El lienzo de creación, el editor enriquecido y los selectores visuales de temáticas y etiquetas quedan para la siguiente etapa, por elección del usuario.

| Acción | Invitado | Cuenta verificada con sesión vigente |
| --- | --- | --- |
| Leer publicaciones y respuestas públicas | Sí | Sí |
| Leer contenido de una comunidad privada | No | Solo miembros |
| Buscar y filtrar publicaciones | Solo contenido público | Contenido público y privado accesible |
| Crear una publicación | No | Sí |
| Responder una publicación | No | Sí |
| Leer y escribir en el chat global | Sí | Sí |

El chat global se conserva con su historial y sus eventos en tiempo real. Sus permisos son independientes de los del foro.

## Rutas de la interfaz

| Ruta | Contenido |
| --- | --- |
| / | Índice de publicaciones, búsqueda y filtros |
| /?topico=general | Publicaciones del tópico elegido |
| /?autor=UUID | Publicaciones de un perfil; el perfil propio ofrece «Mis publicaciones» |
| /publicar | Formulario de publicación o acceso a una cuenta |
| /publicar?topico=proyectos | Formulario con ese tópico preseleccionado si no existe un borrador |
| /publicaciones/:postId | Publicación y respuestas; postId es un UUID |
| /chat | Chat global; invitados pueden escribir |
| /login | Acceso, registro, verificación y recuperación |
| /profile | Perfil y métodos de acceso |

Los enlaces para participar conservan un destino next al pasar por el acceso. El acceso nativo, la verificación de correo y Google regresan al formulario o publicación de origen. Solo se aceptan rutas internas conocidas; el servidor guarda el destino de Google en su flujo OAuth, sin cambiar el callback configurado.

## API

| Método | Ruta | Acceso |
| --- | --- | --- |
| GET | /api/topics | Público |
| GET | /api/taxonomy/categories | Público; catálogo completo |
| GET | /api/taxonomy/categories/:id | Público; temática por UUID |
| GET | /api/taxonomy/tags | Etiquetas iniciales y etiquetas de contenido accesible |
| GET | /api/posts | Público |
| GET | /api/posts/:id | Público |
| GET | /api/posts/:id/replies | Público |
| POST | /api/posts | Sesión verificada |
| POST | /api/posts/:id/replies | Sesión verificada |
| GET / POST | /api/messages | Chat global, conserva acceso invitado |
| GET | /api/events | Eventos del chat global |

GET /api/posts admite topic (raíz por slug, compatibilidad), category (UUID, incluye descendientes), tag (UUID de una etiqueta), author, community, search, before y limit. Los filtros se combinan con AND y se aplican después de comprobar acceso en SQL. La búsqueda compara texto literal sin interpretar % o _ como comodines. Las páginas se ordenan por created_at e id descendentes; before es un cursor opaco base64url con versión, fecha y UUID. El cliente debe reenviar nextCursor sin interpretarlo. Las fechas de publicaciones usan TIMESTAMPTZ(3) para conservar exactamente la precisión de milisegundos del cursor. El UUID solo desempata fechas iguales: su orden no representa antigüedad.

GET de respuestas conserva before numérico y orden de ID descendente. En ambos casos el límite predeterminado es 20, el máximo 50 y la respuesta usa items, hasMore y nextCursor. Los IDs de publicaciones son UUID; los de respuestas, comunidades y avisos siguen siendo BIGINT representados como cadenas. Las referencias a publicaciones en respuestas, medios y notificaciones también son UUID.

Crear publicación recibe title (1–160 caracteres), body (1–10000), requestId UUID, categoryId opcional o nulo, tags opcional, communityId opcional y mediaIds opcional (UUID únicos; hasta tres por defecto). El servidor genera el UUID de la publicación: requestId es independiente y sirve para reconocer reintentos. Sin categoryId ni topicId se permite publicar sin clasificación; category es null y la proyección temporal topic devuelve General. No se guarda una categoría ficticia para ese caso.

Solo admite imágenes READY del autor, sin asociarlas a otra publicación. Publicación, etiquetas, asociación de imágenes y avisos se confirman en una sola transacción. Crear respuesta recibe body (1–5000) y requestId UUID. El servidor normaliza CRLF, Unicode NFC y espacios exteriores, rechaza campos desconocidos y asigna al autor desde la sesión. Nunca acepta un autor ni una condición de miembro enviados por el cliente. En publicaciones de comunidad también exige pertenecer a ella.

## Temáticas y etiquetas

El catálogo se define en apps/api/src/database/seeds/forum-catalog.ts. Sus raíces son General, Tecnología, Aprendizaje, Creatividad y Proyectos, con ramas y subramas de sociedad, aficiones, desarrollo, datos, ciencias, diseño, artes y colaboración, entre otras. Por ejemplo: Tecnología → Desarrollo de software → Desarrollo web → Frontend. Cada nodo devuelve id UUID, slug local a su rama, nombre, descripción, parentId, rootId, depth, path de UUID desde la raíz y position entre hermanos. Se puede clasificar en cualquier nivel y filtrar incluyendo todos sus descendientes. La API es de lectura; los usuarios no crean ni mueven nodos del catálogo.

GET /api/topics proyecta las raíces como los cinco tópicos anteriores. El topicId del formulario actual selecciona una raíz. Si se envía junto con categoryId, ambos deben pertenecer a la misma rama; un categoryId explícitamente nulo junto con topicId produce 400. La clasificación real vive únicamente en forum_posts.category_id, sin una segunda tabla de tópicos que pueda desincronizarse.

tags recibe hasta ocho nombres por publicación, de 1 a 32 caracteres cada uno. Se normalizan con NFKC, espacios simples y minúsculas, se deduplican y se ordenan. Se permiten letras Unicode, números, espacios y puntuación de nombres como c++, c# y node.js; se rechazan controles y marcado. Las etiquetas son transversales a temáticas y comunidades y se crean al publicar, bajo los mismos permisos y límites de frecuencia. La relación muchos a muchos evita etiquetas repetidas. Las respuestas de publicación incluyen category y tags con UUID y nombre.

GET /api/taxonomy/tags admite search y limit (20 por defecto, máximo 30). Devuelve las etiquetas iniciales o las utilizadas en publicaciones que el visitante puede leer. Una etiqueta exclusiva de una comunidad privada no aparece para invitados, terceros ni exmiembros. No se publican contadores globales de uso. Las sugerencias usan no-store para evitar reutilizar una respuesta privada entre sesiones.

Ejemplo del contrato preparado para el futuro editor:

```json
{
  "title": "Una idea que estoy construyendo",
  "body": "El contenido de la publicación sigue siendo texto en esta etapa.",
  "requestId": "b67fcd00-02b4-48c5-9271-00633f4ef389",
  "tags": ["feedback", "typescript"]
}
```

Para clasificarla se añade categoryId obtenido del catálogo; para publicar dentro de una comunidad se añade su communityId. Ambos son opcionales e independientes.

Las escrituras requieren JSON y el origen exacto de APP_URL. Se verifica la sesión de nuevo dentro de la transacción, bajo bloqueo del usuario; las respuestas también bloquean su publicación para actualizar el contador. Cada cuenta puede crear hasta 10 publicaciones y 60 respuestas por hora. El límite adicional por IP es de 60 solicitudes de escritura en diez minutos.

Los reintentos con el mismo autor y requestId devuelven el recurso guardado (200; la creación inicial devuelve 201). Reutilizar el identificador con contenido, clasificación, etiquetas, comunidad o medios diferentes produce 409. Variar el orden, mayúsculas o duplicados de las mismas etiquetas no cambia la solicitud normalizada. El contador solo aumenta al insertar una respuesta nueva.

## Borradores y lectura

Los borradores del foro usan sessionStorage, separados por cuenta y, para respuestas, por publicación. Se conservan ante errores y se limpian al confirmar el envío. El chat conserva su almacenamiento independiente. Se informa si el navegador impide guardar el borrador. Salir de la pestaña o borrar los datos del navegador puede eliminarlo.

El texto se renderiza como texto de React, sin HTML ni Markdown ejecutable. Las respuestas se muestran de más recientes a anteriores y se cargan bajo petición; no hay presencia, sondeo ni SSE en el foro.

El formulario permite seleccionar, previsualizar, subir, reintentar y retirar imágenes. No permite publicar mientras quedan archivos sin confirmar. El borrador guarda IDs de medios, nunca los binarios ni URLs temporales. Al restaurarlo se comprueba su disponibilidad. El índice muestra la primera imagen y el detalle todas; cada lectura solicita un permiso temporal renovable. El propietario puede eliminar una imagen desde el detalle. La lista de IDs original de creación se conserva para reconocer un reintento aun después de retirar una imagen. No existe todavía edición de título/cuerpo ni incorporación de nuevas imágenes a una publicación ya creada. El flujo completo se documenta en [media.md](media.md).

## Base de datos y validación

Como el usuario eliminó su base local para redefinir este modelo, se actualizaron las migraciones iniciales 003, 004 y 005. La 003 crea forum_categories, forum_tags, forum_post_tags, forum_posts y forum_replies, carga el catálogo y añade return_to a auth_google_flows. La 004 y la 005 usan referencias UUID a publicaciones. Se aplican por el mecanismo existente al iniciar la API sobre una base nueva.

Estos archivos no convierten una base que ya tenga registrada la antigua migración 003: el ejecutor no repite versiones aplicadas. No se borró ni reinició ninguna base durante este trabajo. Un entorno con datos previos necesitaría una migración de conversión separada antes de actualizar.

Se prepararon casos para permisos, sesiones revocadas o no verificadas, autoría, reintentos, contadores, UUID, paginación con fechas iguales, jerarquía, normalización de etiquetas y privacidad de sugerencias. Se ajustó el adaptador de pruebas en memoria para cardinality de UUID[]. Por instrucción del usuario no se han ejecutado pruebas, compilaciones, comprobaciones del compilador, migraciones ni servidores. La comprobación con PostgreSQL real, en ejecución y en navegador queda pendiente; ESLint es únicamente análisis estático.


## Contenido privado

La lectura de comunidades privadas requiere una sesión verificada y pertenecer a la comunidad. El filtro se aplica en SQL antes de paginar, tanto en el índice general como al buscar, filtrar por autor o comunidad y consultar por ID. También protege respuestas, metadatos de medios y nuevos permisos temporales de lectura, incluso si la imagen fue subida por un exmiembro. Los recursos inaccesibles responden 404. Las vistas del índice y detalle se desmontan al cambiar de cuenta o cerrar sesión para retirar datos privados de la interfaz. Los permisos temporales ya emitidos conservan su caducidad; no se promete revocación instantánea de URLs o datos previamente recibidos por un cliente.
