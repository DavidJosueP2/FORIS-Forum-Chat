# Foros y chat global

El inicio de Foris se llama Foros y muestra publicaciones organizadas en los tópicos General, Tecnología, Aprendizaje, Creatividad y Proyectos. Cada publicación tiene título, texto, imágenes opcionales y respuestas. También puede pertenecer a una comunidad; sus miembros pueden publicar y responder dentro de ella. Las comunidades, favoritas y avisos se describen en [communities.md](communities.md).

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
| /publicaciones/:postId | Publicación y respuestas |
| /chat | Chat global; invitados pueden escribir |
| /login | Acceso, registro, verificación y recuperación |
| /profile | Perfil y métodos de acceso |

Los enlaces para participar conservan un destino next al pasar por el acceso. El acceso nativo, la verificación de correo y Google regresan al formulario o publicación de origen. Solo se aceptan rutas internas conocidas; el servidor guarda el destino de Google en su flujo OAuth, sin cambiar el callback configurado.

## API

| Método | Ruta | Acceso |
| --- | --- | --- |
| GET | /api/topics | Público |
| GET | /api/posts | Público |
| GET | /api/posts/:id | Público |
| GET | /api/posts/:id/replies | Público |
| POST | /api/posts | Sesión verificada |
| POST | /api/posts/:id/replies | Sesión verificada |
| GET / POST | /api/messages | Chat global, conserva acceso invitado |
| GET | /api/events | Eventos del chat global |

GET /api/posts admite topic, author, community, search, before y limit. La búsqueda compara texto literal sin interpretar % o _ como comodines. GET de respuestas admite before y limit. Las páginas se ordenan por ID descendente, con límite predeterminado de 20 y máximo de 50. La respuesta usa items, hasMore y nextCursor. Los IDs BIGINT viajan como cadenas.

Crear publicación recibe title (1–160 caracteres), body (1–10000), topicId, requestId UUID, communityId opcional y mediaIds opcional (UUID únicos; hasta tres por defecto). Solo admite imágenes READY del autor, sin asociarlas a otra publicación. La asociación y los avisos se confirman en la misma transacción de la publicación. Crear respuesta recibe body (1–5000) y requestId UUID. El servidor normaliza CRLF y espacios exteriores, rechaza campos desconocidos y asigna al autor desde la sesión. Nunca acepta un autor ni una condición de miembro enviados por el cliente. En publicaciones de comunidad también exige pertenecer a ella.

Las escrituras requieren JSON y el origen exacto de APP_URL. Se verifica la sesión de nuevo dentro de la transacción, bajo bloqueo del usuario; las respuestas también bloquean su publicación para actualizar el contador. Cada cuenta puede crear hasta 10 publicaciones y 60 respuestas por hora. El límite adicional por IP es de 60 solicitudes de escritura en diez minutos.

Los reintentos con el mismo autor y requestId devuelven el recurso guardado (200; la creación inicial devuelve 201). Reutilizar el identificador con contenido o publicación diferentes produce 409. El contador solo aumenta al insertar una respuesta nueva.

## Borradores y lectura

Los borradores del foro usan sessionStorage, separados por cuenta y, para respuestas, por publicación. Se conservan ante errores y se limpian al confirmar el envío. El chat conserva su almacenamiento independiente. Se informa si el navegador impide guardar el borrador. Salir de la pestaña o borrar los datos del navegador puede eliminarlo.

El texto se renderiza como texto de React, sin HTML ni Markdown ejecutable. Las respuestas se muestran de más recientes a anteriores y se cargan bajo petición; no hay presencia, sondeo ni SSE en el foro.

El formulario permite seleccionar, previsualizar, subir, reintentar y retirar imágenes. No permite publicar mientras quedan archivos sin confirmar. El borrador guarda IDs de medios, nunca los binarios ni URLs temporales. Al restaurarlo se comprueba su disponibilidad. El índice muestra la primera imagen y el detalle todas; cada lectura solicita un permiso temporal renovable. El propietario puede eliminar una imagen desde el detalle. La lista de IDs original de creación se conserva para reconocer un reintento aun después de retirar una imagen. No existe todavía edición de título/cuerpo ni incorporación de nuevas imágenes a una publicación ya creada. El flujo completo se documenta en [media.md](media.md).

## Base de datos y validación

La migración 003-create-forum crea forum_topics, forum_posts y forum_replies, carga los cinco tópicos y añade return_to a auth_google_flows. Se aplica mediante el mecanismo existente cuando se inicie la API. No modifica ni elimina los mensajes del chat ni las cuentas existentes.

Se añaden casos de prueba para permisos, sesiones revocadas o no verificadas, autoría, reintentos, contadores, paginación y validación. Por instrucción del usuario no se han ejecutado pruebas, compilaciones, migraciones ni servidores. La comprobación en ejecución y en navegador queda pendiente.


## Contenido privado

La lectura de comunidades privadas requiere una sesión verificada y pertenecer a la comunidad. El filtro se aplica en SQL antes de paginar, tanto en el índice general como al buscar, filtrar por autor o comunidad y consultar por ID. También protege respuestas, metadatos de medios y nuevos permisos temporales de lectura, incluso si la imagen fue subida por un exmiembro. Los recursos inaccesibles responden 404. Las vistas del índice y detalle se desmontan al cambiar de cuenta o cerrar sesión para retirar datos privados de la interfaz. Los permisos temporales ya emitidos conservan su caducidad; no se promete revocación instantánea de URLs o datos previamente recibidos por un cliente.
