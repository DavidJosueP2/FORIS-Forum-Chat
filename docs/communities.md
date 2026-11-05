# Comunidades y notificaciones

La navegación muestra Foros, Comunidades y Chat global. Foros conserva las publicaciones y los tópicos existentes; Comunidades añade espacios públicos creados por usuarios. El chat global mantiene el envío como invitado.

| Ruta | Función |
| --- | --- |
| /comunidades | Explorar y buscar |
| /comunidades?vista=mias | Comunidades de la cuenta |
| /comunidades?vista=favoritas | Favoritas de la cuenta |
| /comunidades/crear | Crear una comunidad |
| /comunidades/:id | Descripción, pertenencia, preferencias y publicaciones |
| /publicar?comunidad=ID | Publicar en una comunidad |
| /notificaciones | Bandeja privada |

## Pertenencia y preferencias

Cualquiera puede leer las comunidades y sus publicaciones. Crear, unirse, guardar favoritas y modificar preferencias requiere una cuenta verificada con sesión vigente. Publicar o responder dentro de una comunidad requiere además pertenecer a ella. Los foros generales siguen requiriendo únicamente una cuenta para escribir.

El nombre es único sin distinguir mayúsculas. El creador entra como miembro y guarda su comunidad como favorita al crearla. En esta etapa no puede abandonarla; no hay transferencia de propiedad, moderadores, invitaciones ni comunidades privadas.

Unirse y salir son idempotentes: reintentar no altera dos veces el contador. Se puede guardar una favorita sin unirse. Salir conserva la favorita y detiene los avisos futuros.

Al unirse se activan los avisos dentro de Foris; la interfaz lo comunica. Cada miembro puede silenciarlos en la página de la comunidad. Volver a unirse los activa de nuevo. Favoritas y avisos son preferencias independientes.

## Avisos dentro de Foris

El usuario eligió avisos dentro de la aplicación. No se envían correos ni se solicitan permisos de notificación del navegador.

Crear una publicación guarda en la misma transacción un aviso para cada miembro que los tenga activados, salvo el autor. Las respuestas no generan avisos. No se entrega historial anterior a quien se une.

La bandeja y su contador son privados. Se puede abrir una publicación, marcar un aviso como leído o marcar todos hasta el ID más reciente cargado. Este corte conserva sin leer los avisos posteriores. Los anteriores permanecen en la bandeja al salir de una comunidad.

El contador se actualiza al montar la cabecera, recuperar el foco, volver a una pestaña visible y confirmar una lectura. La bandeja ofrece Actualizar. No hay entrega en tiempo real, sondeo continuo ni SSE de avisos; el chat conserva sus propios eventos.

## API

Los listados usan items, hasMore y nextCursor, con IDs como cadenas y orden descendente. Límite predeterminado 20 y máximo 50. Los datos personalizados usan Cache-Control: no-store.

| Método | Ruta | Acceso |
| --- | --- | --- |
| GET | /api/communities | Público; scope=mine o favorites requiere cuenta |
| GET | /api/communities/:id | Público, con preferencias propias si hay sesión |
| POST | /api/communities | Cuenta verificada |
| POST | /api/communities/:id/membership | Unirse |
| DELETE | /api/communities/:id/membership | Salir, salvo creador |
| PATCH | /api/communities/:id/preferences | Preferencias propias |
| GET | /api/notifications | Bandeja propia |
| GET | /api/notifications/count | Contador sin leer |
| POST | /api/notifications/:id/read | Marcar aviso propio |
| POST | /api/notifications/read-all | Marcar hasta throughId |

Comunidades admite scope=all|mine|favorites, search, before y limit. Crear recibe name (3–80 caracteres), description (1–500) y requestId UUID. Preferencias recibe favorite y/o notifyPosts booleanos. Unirse, salir y marcar un aviso reciben un objeto JSON vacío; marcar todos recibe throughId.

GET /api/posts admite community=ID y POST /api/posts admite communityId opcional. Las respuestas identifican la comunidad; las publicaciones generales conservan community=null.

## Persistencia y permisos

La migración 004-create-communities es aditiva: crea communities, community_memberships, community_preferences y community_notifications, y añade community_id opcional a forum_posts. Conserva cuentas, publicaciones y mensajes. Se aplica por el mecanismo habitual al iniciar la API.

La sesión se comprueba dentro de las transacciones, bloqueando el usuario con FOR NO KEY UPDATE. Este bloqueo conserva la exclusión con cambios de credenciales y permite referencias de notificaciones a otros destinatarios. El bloqueo de la comunidad serializa publicaciones, membresías y preferencias. Contadores y avisos se confirman junto con la publicación.

Las claves por autor y requestId evitan duplicar comunidades o publicaciones; la clave por destinatario y publicación evita duplicar avisos. Reutilizar una solicitud con otros datos devuelve conflicto. Las escrituras validan campos, JSON y origen APP_URL. Cada cuenta puede crear tres comunidades al día; este módulo limita a 60 escrituras por IP cada quince minutos.

Los borradores usan sessionStorage de la pestaña, separados por cuenta y, al publicar, por comunidad. Propietario, autor y destinatarios se determinan en servidor.

## Validación

Se añadieron casos para permisos, idempotencia, favoritas, preferencias aisladas, membresía al escribir, silenciamiento, salida, privacidad de bandeja y corte de lectura. Su código pasó ESLint; no se ejecutaron.

Por instrucción del usuario no se ejecutaron compilaciones, typecheck, pruebas, migraciones, servidores, Docker ni renderizados. La verificación visual y en ejecución queda pendiente.
