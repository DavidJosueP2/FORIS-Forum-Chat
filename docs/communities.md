# Comunidades y notificaciones

La navegación muestra Foros, Comunidades y Chat global. Foros conserva las publicaciones y los tópicos existentes; Comunidades añade espacios públicos o privados creados por usuarios, con una imagen opcional. El chat global mantiene el envío como invitado.

| Ruta | Función |
| --- | --- |
| /comunidades | Explorar y buscar |
| /comunidades?vista=mias | Comunidades de la cuenta |
| /comunidades?vista=favoritas | Favoritas de la cuenta |
| /comunidades/crear | Crear una comunidad |
| /comunidades/:id | Descripción, pertenencia, preferencias y publicaciones |
| /invitaciones/:token | Comprobar y aceptar una invitación a una comunidad privada |
| /publicar?comunidad=ID | Publicar en una comunidad |
| /notificaciones | Bandeja privada |

## Pertenencia y preferencias

Cualquiera puede descubrir y leer las comunidades públicas y sus publicaciones. Las privadas solo aparecen y permiten leer su detalle, publicaciones, respuestas e imágenes a sus miembros; esto también se aplica a búsquedas, filtros por autor y favoritas. Un identificador conocido no concede acceso y el servidor responde como recurso no encontrado a quien no tenga permiso. Crear, unirse, guardar favoritas y modificar preferencias requiere una cuenta verificada con sesión vigente. Publicar o responder dentro de una comunidad requiere además pertenecer a ella. Los foros generales conservan la lectura pública y requieren únicamente una cuenta para escribir.

El nombre es único sin distinguir mayúsculas. Al crear se elige Pública o Privada; no hay cambio posterior de visibilidad en esta etapa. El creador entra como miembro y guarda su comunidad como favorita. No puede abandonarla; no hay transferencia de propiedad ni moderadores.

La entrada directa se limita a comunidades públicas. A una privada se entra aceptando una invitación válida. Unirse y salir son idempotentes: reintentar no altera dos veces el contador. Se puede guardar una favorita de una comunidad accesible sin unirse. Salir conserva la preferencia de favorita y detiene los avisos futuros; una privada deja de ser visible incluso en Favoritas y exige una invitación nueva para volver a entrar.

Al unirse se activan los avisos dentro de Foris; la interfaz lo comunica. Cada miembro puede silenciarlos en la página de la comunidad. Volver a unirse los activa de nuevo. Favoritas y avisos son preferencias independientes.

El seguimiento es otra relación independiente: permite incluir la comunidad en Siguiendo sin unirse ni cambiar favoritas o avisos. Una membresía nueva lo activa y salir lo retira; repetir una membresía existente respeta un seguimiento desactivado. Las privadas exigen pertenencia para seguirlas. El contrato y la migración 11 están en [following.md](following.md).

## Creación, imagen e invitaciones

El formulario reúne imagen opcional, nombre, descripción y elección de acceso. Los límites restantes están dentro de los campos, sin contadores externos `0/80` o `0/500`; las etiquetas y los límites accesibles permanecen. El borrador conserva los campos, la visibilidad y el ID de imagen por cuenta en la pestaña.

La imagen se autoriza con finalidad `community`, se sube con PUT y se confirma con la misma validación real, cuotas y almacenamiento de las publicaciones. Crear asocia únicamente una imagen propia y lista; el creador puede reemplazarla o retirarla desde «Administrar comunidad». Una imagen asociada hereda el acceso de su comunidad. Ser quien la subió no permite consultarla después de salir de una privada. La foto del perfil usa el mismo selector con finalidad `avatar`; el alcance técnico está en [media.md](media.md) y [authentication.md](authentication.md).

Solo el creador de una privada puede crear, consultar y revocar sus enlaces desde la sección plegable de administración. Cada enlace admite una entrada y vence a los siete días. El enlace completo se muestra únicamente al crearlo, con una acción de copia; si se pierde, se revoca y se crea otro. El listado conserva todas las invitaciones activas y hasta veinte históricas. Se permiten diez activas y veinte creaciones por comunidad y hora.

Abrir `/invitaciones/:token` comprueba la invitación y muestra solo el nombre de la comunidad, el vencimiento y la pertenencia propia. El acceso o registro conserva el destino. Aceptar exige cuenta verificada y sesión vigente, añade la membresía y activa los avisos en la misma transacción que consume el enlace. Una aceptación repetida por la misma cuenta ya miembro conserva el resultado; un enlace consumido no permite entrar a otra cuenta ni volver a entrar después de salir. Caducar o revocar impide nuevas aceptaciones, sin expulsar a quien ya entró.

Los tokens proceden de 32 bytes aleatorios y se representan con 43 caracteres base64url. PostgreSQL guarda solo su resumen SHA-256. La API recibe el token en el cuerpo JSON de comprobación o aceptación, no en su ruta. La ruta del frontend sí contiene el enlace recibido y debe compartirse únicamente con la persona invitada.

Los enlaces se construyen con `APP_URL`. Si apunta a `127.0.0.1`, funcionan en ese equipo; para compartirlos entre compañeros se necesita un origen común configurado y accesible para ellos.

## Avisos dentro de Foris

El usuario eligió avisos dentro de la aplicación. No se envían correos ni se solicitan permisos de notificación del navegador.

Crear una publicación guarda en la misma transacción un aviso para cada miembro que los tenga activados, salvo el autor. Las respuestas no generan avisos. No se entrega historial anterior a quien se une.

La bandeja y su contador son privados. Se puede abrir una publicación, marcar un aviso como leído o marcar todos hasta el ID más reciente cargado. Este corte conserva sin leer los avisos posteriores. Al salir de una comunidad pública los avisos anteriores permanecen accesibles. Los de una privada quedan ocultos en bandeja y contador al perder la membresía, y sus acciones exigen conservar acceso.

El contador se actualiza al montar la cabecera, recuperar el foco, volver a una pestaña visible y confirmar una lectura. La bandeja ofrece Actualizar. No hay entrega en tiempo real, sondeo continuo ni SSE de avisos; el chat conserva sus propios eventos.

## API

Los listados usan items, hasMore y nextCursor, con IDs como cadenas y orden descendente. Límite predeterminado 20 y máximo 50. Los datos personalizados usan Cache-Control: no-store.

| Método | Ruta | Acceso |
| --- | --- | --- |
| GET | /api/communities | Públicas y privadas propias; scope=mine, favorites o following requiere cuenta |
| GET | /api/communities/:id | Pública o miembro de privada; preferencias propias si hay sesión |
| POST | /api/communities | Cuenta verificada |
| POST | /api/communities/:id/membership | Unirse directamente a una pública |
| DELETE | /api/communities/:id/membership | Salir, salvo creador |
| PATCH | /api/communities/:id/preferences | Preferencias propias |
| PATCH | /api/communities/:id/image | Cambiar o retirar imagen; solo creador |
| GET / POST | /api/communities/:id/invitations | Listar o crear enlaces; solo creador de privada |
| DELETE | /api/communities/:id/invitations/:invitationId | Revocar un enlace; solo creador de privada |
| POST | /api/community-invitations/preview | Comprobar enlace; sesión opcional |
| POST | /api/community-invitations/accept | Aceptar enlace con cuenta verificada |
| GET | /api/notifications | Bandeja propia |
| GET | /api/notifications/count | Contador sin leer |
| POST | /api/notifications/:id/read | Marcar aviso propio |
| POST | /api/notifications/read-all | Marcar hasta throughId |

Comunidades admite scope=all|mine|favorites|following, search, before y limit. Crear recibe name (3–80 caracteres), description (1–500), requestId UUID, visibility opcional (`public` por defecto o `private`) e imageId opcional o nulo. La respuesta incluye visibility, imageId e isFollowing propio. Preferencias recibe favorite y/o notifyPosts booleanos; cambiar imagen recibe mediaId UUID o nulo. Crear o revocar invitación recibe un objeto vacío y preview/accept reciben `{ token }`. Unirse, salir y marcar un aviso reciben un objeto JSON vacío; marcar todos recibe throughId. El listado de invitaciones devuelve metadatos y estados, sin recuperar el token.

GET /api/posts admite community=ID y POST /api/posts admite communityId opcional. Las respuestas identifican la comunidad; las publicaciones generales conservan community=null.

Las lecturas de publicaciones, respuestas e imágenes resuelven la sesión opcional y aplican el mismo permiso de comunidad. Dejar una privada impide emitir nuevos enlaces de imagen. Los enlaces firmados ya emitidos pueden seguir funcionando hasta su vencimiento, hasta 300 segundos con la configuración actual; la salida no implica revocación instantánea de esos enlaces. Cambiar o cerrar sesión desmonta las vistas de contenido privado del cliente.

## Persistencia y permisos

La migración 004-create-communities es aditiva: crea communities, community_memberships, community_preferences y community_notifications, y añade community_id opcional a forum_posts. Conserva cuentas, publicaciones y mensajes. Se aplica por el mecanismo habitual al iniciar la API.

La migración 007-community-privacy-and-portraits es aditiva y está preparada, sin aplicar durante esta entrega. Añade visibilidad con valor inicial público para conservar las comunidades existentes, invitaciones con resumen y fechas de consumo/revocación, finalidad de medios y asociaciones únicas a comunidad o avatar. Las restricciones impiden asociar un medio a varios recursos o usar una finalidad distinta. La limpieza conserva imágenes enlazadas a publicaciones, comunidades o perfiles.

La sesión se comprueba dentro de las transacciones, bloqueando el usuario con FOR NO KEY UPDATE. Este bloqueo conserva la exclusión con cambios de credenciales y permite referencias de notificaciones a otros destinatarios. El bloqueo de la comunidad serializa publicaciones, membresías, preferencias e invitaciones; aceptar bloquea además el enlace para impedir consumos concurrentes. Contadores y avisos se confirman junto con la publicación.

Las claves por autor y requestId evitan duplicar comunidades o publicaciones; la clave por destinatario y publicación evita duplicar avisos. Reutilizar una solicitud con otros datos devuelve conflicto. Las escrituras validan campos, JSON y origen APP_URL. Cada cuenta puede crear tres comunidades al día; este módulo limita a 60 escrituras por IP cada quince minutos.

Los borradores usan sessionStorage de la pestaña, separados por cuenta y, al publicar, por comunidad. Propietario, autor y destinatarios se determinan en servidor.

## Validación

Los casos existentes cubren permisos, idempotencia, favoritas, preferencias aisladas, membresía al escribir, silenciamiento, salida, privacidad de bandeja y corte de lectura. La revisión estática de esta extensión comprobó filtros de acceso, consumo y revocación de invitaciones, asociaciones de imágenes y conservación de las funciones públicas. La revisión independiente cerró los dos hallazgos de su pase inicial: el acceso del autor de una imagen tras salir de una privada y la omisión de invitaciones activas antiguas al listar. Esto no acredita ejecución ni resultados de pruebas.

Por instrucción del usuario no se ejecutaron compilaciones, typecheck, pruebas, migraciones, servidores, Docker ni renderizados. La verificación visual y en ejecución queda pendiente.
