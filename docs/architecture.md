# Arquitectura de Foris

Un repositorio npm workspaces contiene una API NestJS como monolito modular, un frontend React con Vite y los contratos públicos de TypeScript. El frontend tiene Tailwind CSS 4, el catálogo completo de shadcn/ui y una base de tema compartida. La página inicial abre Foros con publicaciones por tópicos y `/comunidades` añade espacios públicos o privados creados por usuarios. El foro general y las comunidades públicas permiten lectura pública; las privadas exigen pertenencia. Escribir requiere una cuenta verificada con sesión vigente y, dentro de una comunidad, pertenecer a ella. Los avisos de nuevas publicaciones se guardan en una bandeja privada dentro de Foris. El chat global se conserva en `/chat`, con historial, envío y recepción de mensajes como invitado o miembro. Una videollamada WebRTC opcional admite hasta cuatro cuentas verificadas desde ese chat. Registro nativo, Google, perfil y fotos opcionales de cuenta o comunidad completan los flujos.

## Organización

```text
apps/api/
  src/
    main.ts                 Punto de entrada y señales del proceso
    application.ts          Configuración HTTP, arranque y cierre
    app.module.ts           Composición de módulos
    config/                 Variables de entorno y configuración validada
    database/               Pool PostgreSQL y migraciones versionadas
      migrations/
    common/
      errors/               Errores públicos seguros
      filters/              Respuestas JSON de error
      middleware/           Política de origen y tipo de contenido
    modules/
      health/               Estado de la conexión PostgreSQL
      auth/                 Cuentas, sesiones, OTP, Google y cola SMTP
        auth.controller.ts
        account.controller.ts
        auth.service.ts
        auth.repository.ts
        session.service.ts
        otp.service.ts
        google-auth.service.ts
        auth-mail.service.ts
      messages/
        dto/                Entradas y validación de mensajes e historial
        pipes/              Integración de la validación con Nest
        middleware/         Límite de envíos
        messages.controller.ts
        messages.service.ts
        messages.repository.ts
        messages.types.ts
        message-events.service.ts
      forum/                Publicaciones y respuestas generales o de comunidad
        forum.controller.ts
        forum.repository.ts
        forum-validation.ts
        forum-write.middleware.ts
        forum-cursor.ts      Paginación cronológica de publicaciones UUID
        taxonomy.controller.ts
        taxonomy.repository.ts
        taxonomy-validation.ts
      media/                Imágenes, cuotas, verificación y limpieza recuperable
        storage.port.ts     Contrato de almacenamiento de objetos
        adapters/           Adaptadores local y S3 compatible con R2
      communities/          Comunidades, acceso, invitaciones, preferencias y avisos internos
        community.controller.ts
        community.repository.ts
        community-validation.ts
        community-invitations.controller.ts
        community-invitations.repository.ts
        notification.controller.ts
        notification.repository.ts
      video-calls/          Plazas y señalización privada de la llamada global
        video-call.controller.ts
        video-call.service.ts
        video-call.repository.ts
        video-call-validation.ts
  test/
    unit/
    integration/
    support/
packages/contracts/src/     Declaraciones públicas de mensajes, foro, imágenes, comunidades, avisos, cuentas y llamadas
apps/web/src/              Frontend React y TypeScript
  features/forum/          Índice, creación, lectura, respuestas y borradores por cuenta
  features/media/          Selectores de imágenes y fotos, progreso y enlaces temporales
  features/communities/    Directorio, creación, invitaciones, administración y bandeja
  features/chat/           Chat global General, estado, API y sesión invitada
  features/video-calls/    Panel en línea, dispositivos y conexiones WebRTC
  features/account/        Acceso, perfil, sesión de cuenta y formularios OTP
apps/web/public/           Archivos estáticos del frontend
scripts/                   Comandos del repositorio
```

Los comandos, ESLint y el lockfile se administran desde la raíz. El frontend anterior y sus herramientas de compilación ya se retiraron del repositorio.

## Base visual del frontend

Tailwind CSS se integra mediante el plugin de Vite. El alias `@/` apunta a `apps/web/src` tanto en Vite como en TypeScript. `apps/web/components.json` configura shadcn con Radix, el estilo nova, variables CSS y Lucide.

`src/components/ui` contiene los 63 archivos de componentes del catálogo instalado. Las utilidades y hooks de soporte permanecen en `src/lib` y `src/hooks`. Los componentes se importan directamente desde su módulo. `App.tsx` usa React Router para montar `ForumPage` en `/`, `CreatePostPage` en `/publicar`, `PostPage` en `/publicaciones/:postId`, `CommunitiesPage` en `/comunidades`, `CreateCommunityPage` en `/comunidades/crear`, `CommunityPage` en `/comunidades/:communityId`, `InvitationPage` en `/invitaciones/:token`, `NotificationsPage` en `/notificaciones`, `ChatHome` en `/chat`, `LoginPage` en `/login` y `ProfilePage` en `/profile`. `/publicar?comunidad=ID` conserva el contexto de comunidad. Las rutas desconocidas vuelven al índice del foro.

`src/index.css` define colores semánticos, temas claro y oscuro, superficies sólidas, foco y movimiento reducido. `AppProviders` compone los proveedores de tema y autenticación, los tooltips y Sonner. El tema respeta la preferencia del sistema, guarda la elección local y sincroniza otras pestañas. `ForumShell` sirve de cabecera para foro, comunidades y `AccountShell`, con Foros, Comunidades y Chat global en ese orden; `NotificationEntry` añade la bandeja y su contador para la cuenta activa. El chat conserva su navegación propia con enlaces a Foros y Comunidades. Todas las superficies comparten tema y entrada de cuenta. `features/forum/forum.css` y `features/communities/communities.css` aplican la misma identidad a listas y formularios abiertos sin añadir tokens visuales.

`Button` usa extremos completamente redondos en todas sus variantes y tamaños, incluidos los de icono. `className` conserva la posibilidad de una sustitución deliberada. La política global elimina bordes y sombras de las primitivas y conserva el indicador de foco de teclado. Los campos y contenedores mantienen sus radios propios.

Las pautas de diseño están en [apps/web/DESIGN.md](../apps/web/DESIGN.md). Impeccable conserva su configuración y el catálogo visual de referencia en `apps/web/.impeccable`; esos dos archivos de configuración se versionan, mientras que informes y capturas quedan ignorados.

Las fuentes locales se declaran en `src/assets/fonts/fonts.css`. Tailwind expone `font-heading` (Axiforma), `font-sans` (Plus Jakarta Sans), `font-serif` (Fraunces) y `font-ui` (SF Pro Display). Los títulos usan Axiforma por defecto y el texto general usa Jakarta. Fraunces y SF Pro se aplican de forma explícita cuando el contenido lo necesita.

Los nueve SVG de identidad viven en `src/assets/characters`. `src/lib/foris-characters.ts` reúne sus rutas y emociones; `ForisCharacter` en `src/components/brand` permite elegirlos mediante `mood`. Son decorativos por defecto; una imagen que aporte significado necesita un `alt` contextual. Las pautas y ejemplos están en [docs/brand.md](brand.md).

Las variantes exportadas por shadcn y sus hooks públicos se permiten explícitamente en la regla de recarga de componentes de ESLint. Los demás componentes de aplicación mantienen la regla habitual. Los hooks de viewport y carrusel leen sus fuentes externas con `useSyncExternalStore`.

## Publicaciones y respuestas

`src/features/forum` separa páginas, componentes, hooks de carga y borradores. El índice permite buscar en título y cuerpo y filtrar por tópico o autor. General, Tecnología, Aprendizaje, Creatividad y Proyectos son tópicos predeterminados; las comunidades son espacios independientes creados por usuarios, sin añadir creación de tópicos. El detalle presenta cuerpo y respuestas como texto literal de React, sin interpretar HTML ni Markdown. Los límites son 160 caracteres para el título, 10000 para una publicación y 5000 para una respuesta.

La lectura de `/api/topics` es pública. `/api/posts`, el detalle y sus respuestas admiten sesión opcional y filtran comunidades privadas por pertenencia, también en búsqueda y filtros por autor. Las páginas de publicaciones y respuestas usan 20 elementos por defecto, con cursor `before` por identificador, orden `id DESC` y carga adicional explícita. La búsqueda usa `ILIKE` parametrizado y escapa los caracteres de patrón. El foro no usa SSE ni sondeo periódico; la recepción en tiempo real pertenece al chat global.

`ForumModule` importa `AuthModule`. `ForumController` obtiene la identidad mediante `SessionService.required`; `ForumRepository` bloquea al usuario, exige correo verificado y comprueba de nuevo la vigencia de la sesión dentro de la transacción. El autor procede de esa sesión. El repositorio reúne SQL parametrizado y coordinación transaccional para crear publicaciones o respuestas, actualizar el contador y registrar la última actividad. Los reintentos se resuelven por cuenta y `requestId`; repetirlo con contenido diferente devuelve 409. Los límites persistidos permiten hasta diez publicaciones y sesenta respuestas por cuenta y hora; los reintentos ya guardados se recuperan antes de consumir ese límite.

`ParticipationGate` explica el acceso requerido para escribir y ofrece el chat global para conversar como invitado. `CommunityWritingGate` añade el requisito de pertenencia para escribir en una comunidad. Los enlaces de acceso y el flujo OAuth conservan un destino interno permitido para volver a publicar o responder, incluidas las rutas de comunidades, invitaciones, bandeja y el parámetro validado `comunidad`. Los borradores se guardan en `sessionStorage` de la pestaña bajo claves por cuenta y comunidad al publicar y por publicación al responder. Se conservan ante un fallo, y la interfaz avisa si el navegador no permite guardarlos. No contienen contraseñas ni tokens de sesión. Las vistas de contenido privado se desmontan al cambiar o cerrar sesión. Los errores de carga y de paginación permiten reintentar; los estados vacíos no inventan contenido.

## Imágenes y almacenamiento

`MediaModule` separa el ciclo de vida de las imágenes del proveedor. `MediaService` consume `ObjectStoragePort`, inyectado mediante `OBJECT_STORAGE`; `LocalStorageAdapter` guarda archivos fuera del directorio público y `S3StorageAdapter` utiliza la API S3 para R2 u otro proveedor compatible. La selección se valida en `config/media-config.ts`: el entorno local usa disco por defecto y producción requiere S3. Cada registro conserva un perfil derivado del destino de almacenamiento para impedir operar accidentalmente sobre otro destino tras cambiar la configuración; cambiar de proveedor no migra los archivos existentes.

El flujo autoriza una subida para una cuenta verificada, reserva cuota global y personal en PostgreSQL y devuelve una URL temporal para un PUT. El cliente envía los bytes y solicita confirmación; el servidor comprueba tamaño, formato real y dimensiones y recodifica con `sharp` antes de marcar la imagen como `READY`. El objeto provisional y la imagen validada tienen claves internas distintas. Los permisos, cuotas, estados y confirmación se comparten entre disco y S3. Los valores iniciales admiten hasta tres imágenes JPEG, PNG o WebP de 5 MB por publicación; las respuestas y el chat siguen siendo texto.

`ForumModule` importa `MediaModule` y asocia los IDs de imágenes propias y listas dentro de la misma transacción que crea la publicación, comprueba la membresía y registra avisos. El contrato devuelve metadatos e IDs, sin URLs firmadas persistidas. Solo el propietario puede consultar una imagen sin asociar. Una imagen vinculada hereda los permisos de su publicación o comunidad, incluso para quien la subió; los avatares vinculados admiten lectura pública. Salir de una privada impide obtener enlaces nuevos, aunque los firmados ya emitidos pueden vivir hasta su vencimiento, hasta 300 segundos con la configuración actual. El borrado retira la imagen de la lectura y reintenta la eliminación física si falla el proveedor. La limpieza periódica recupera autorizaciones caducadas, archivos huérfanos, verificaciones abandonadas y borrados pendientes mediante bloqueos y arrendamientos en PostgreSQL; conserva las imágenes asociadas a publicaciones, comunidades o perfiles y libera cuotas conforme se confirma la limpieza.

`features/media` incorpora `ImagePicker`, `PrivateImage` y `PostImages` a las páginas existentes. El borrador guarda IDs; las vistas previas locales y URLs de lectura viven en memoria. El selector muestra progreso real, verificación, errores y reintentos; el índice muestra la primera imagen y el detalle las presenta en secuencia, con retirada para el autor. `PrivateImage` renueva los enlaces temporales y permite volver a cargar una imagen. Se reutilizan colores semánticos, controles y foco de la base visual, sin añadir tokens de identidad. El detalle del contrato, la configuración y las operaciones manuales está en [media.md](media.md).

`PortraitPicker` reutiliza autorización, PUT y confirmación para imágenes de comunidad y fotos de perfil. Las finalidades `post`, `community` y `avatar` restringen la asociación de cada medio a un único recurso compatible. El creador administra la imagen de comunidad y cada cuenta su foto; reemplazar o retirar desvincula la anterior para su limpieza. El perfil actualiza solo el avatar en el estado compartido y las superficies de identidad reutilizan su imagen sin presentarla como verificación personal.

## Comunidades y avisos internos

`CommunitiesModule` importa `AuthModule` y `MediaModule`, expone controladores para comunidades, invitaciones y notificaciones y exporta `CommunityRepository` para el foro. El directorio admite búsqueda y vistas de exploración, propias o favoritas con paginación explícita, ocultando privadas a no miembros. El detalle reúne imagen, descripción, pertenencia, preferencias y publicaciones. Crear, unirse, guardar favoritas y cambiar preferencias requiere cuenta verificada. La entrada directa corresponde a públicas; las privadas requieren aceptar una invitación. Favorita y pertenencia son independientes: salir conserva la preferencia, pero una privada deja de aparecer hasta recuperar acceso. El creador entra como miembro, guarda su comunidad y no puede abandonarla en esta etapa. La visibilidad se elige al crear y no tiene edición posterior.

Solo el creador de una privada crea, lista o revoca enlaces de un uso y siete días. El repositorio guarda un resumen SHA-256 del token de 256 bits, serializa la aceptación con bloqueos de comunidad e invitación y confirma juntos consumo, membresía y avisos. La comprobación devuelve únicamente nombre, vencimiento y pertenencia propia. Los endpoints de comprobación y aceptación reciben el token en JSON; el frontend usa `/invitaciones/:token` y conserva ese destino tras autenticarse. El listado devuelve todas las activas y veinte históricas; se permiten diez activas y veinte creaciones por comunidad y hora.

Las transacciones comprueban la sesión y bloquean al usuario con `FOR NO KEY UPDATE`; el bloqueo de la comunidad serializa publicaciones, pertenencia y preferencias. El foro comprueba la membresía al crear publicaciones o respuestas de comunidad. Crear una publicación guarda sus contadores y los avisos en la misma transacción, excluyendo al autor y a quienes no sean miembros o hayan silenciado los avisos. Las claves de idempotencia impiden duplicar la publicación o sus avisos al reintentar.

Los avisos se entregan únicamente dentro de Foris. La bandeja, el contador y sus acciones se filtran por la cuenta de sesión y el acceso vigente a comunidades privadas. La lectura individual es idempotente y la lectura conjunta usa el ID más reciente cargado como corte para conservar pendientes los avisos posteriores. El contador se consulta al montar la cabecera, recuperar foco o visibilidad y confirmar lecturas; la bandeja permite actualizar de forma explícita. No hay correo, permisos del navegador, sondeo continuo ni SSE de notificaciones. Los contratos, límites y preferencias completos se mantienen en [communities.md](communities.md).

## Chat global General

`src/features/chat` separa los componentes de presentación, el hook `useChat`, el cliente HTTP y las utilidades de mensajes y sesión. `ChatHome` compone navegación lateral, encabezado con estado de conexión, `MessageFeed`, `MessageComposer` y las pautas de la comunidad. La navegación se oculta por debajo de 1024px; las pautas aparecen como columna desde 1360px y siguen disponibles mediante diálogo con menos espacio. El encabezado ofrece cambio de tema y entrada de cuenta.

`chat-api.ts` consulta `/api/messages` en páginas de 50 mensajes. La carga inicial obtiene el historial reciente; `before` recupera mensajes anteriores. `useChat` recibe los eventos SSE y consulta páginas con `after` al abrir o recuperar la conexión para completar mensajes perdidos. El cursor de sincronización avanza con las páginas consultadas, no con eventos nuevos. El cliente valida la forma de las respuestas y combina los mensajes por identificador. Los identificadores BIGINT permanecen como cadenas y se ordenan mediante `BigInt`, sin convertirlos a `Number`.

El envío usa POST con UUID de remitente y `requestId`. Reintentar el mismo cuerpo y propietario conserva el `requestId` para aprovechar la idempotencia del servidor; un cambio de nombre visible del miembro no crea otro intento. Para invitados, cambiar el autor sí inicia uno nuevo. El mensaje se incorpora al confirmar la respuesta; la recepción SSE se deduplica por identificador. La interfaz diferencia envío confirmado de lectura por otra persona: no muestra confirmaciones de lectura.

`guest-session.ts` conserva el perfil invitado y el borrador en almacenamiento local mediante accesos protegidos; si el navegador lo bloquea, la visita continúa en memoria. El nombre opcional usa «Invitado» por defecto, tiene un límite de 32 caracteres y no representa una identidad verificada. El texto admite hasta 2000 caracteres. Un envío fallido conserva el borrador; un envío confirmado solo lo limpia si el borrador actual todavía coincide con el cuerpo enviado. Enter añade una línea y Ctrl o ⌘ + Enter solicita el envío, respetando la composición de texto.

`MessageFeed` presenta carga, historial vacío confirmado, errores y paginación. El historial sigue el final si el lector permanece cerca de él o acaba de enviar un mensaje propio. Al cargar mensajes anteriores conserva un elemento DOM de un mensaje visible como ancla y tiene en cuenta el desplazamiento realizado durante la solicitud; así la inserción al principio no se confunde con mensajes recibidos al final. La acción «Volver al final» permite retomar la conversación. La sugerencia del estado vacío solo rellena el borrador y le da foco.

El estado de conexión distingue conectando, en directo, reconectando y sin conexión. La presencia recibida cuenta conexiones abiertas, no personas únicas. Los mensajes y las cifras proceden de la API; no hay conversación ni presencia de ejemplo. Sin conexión se puede seguir preparando el texto y solicitar una reconexión.

`AccountEntry` sustituye el antiguo diálogo informativo y dirige a `/login` o `/profile` según la sesión. La navegación lateral y el compositor distinguen miembro e invitado; los mensajes usan `accountId` asignado por el servidor. `X-Foris-Identity` declara intención `account` o `guest`: `account` exige una sesión válida y el servidor fija autor, remitente y cuenta; `guest` no recibe cuenta asociada. Un encabezado o nombre enviado por el cliente no acredita identidad. Los clientes anteriores sin el encabezado conservan la resolución previa por sesión.

La interfaz espera a resolver la sesión antes de enviar y permite seguir preparando el texto. El perfil invitado y el borrador se conservan al entrar o salir de una cuenta. La condición «Miembro» acredita acceso a una cuenta, no la identidad real del nombre mostrado.

### Videollamada compartida

`ChatHome` reserva un espacio junto al título «Chat global» para el botón de videollamada. `GlobalVideoCall` coloca allí el botón mediante un portal, manteniendo una sola instancia de la llamada dentro de la conversación. Al abrirlo, un diálogo modal ocupa toda la ventana, con vídeos grandes y controles al pie. Minimizar una llamada activa devuelve el foco al botón y muestra una franja «Volver a la llamada» para reabrir la vista completa mientras se escribe en el chat. `RemoteCallAudio` permanece montado fuera del diálogo para conservar el audio al minimizar; los vídeos están silenciados para evitar duplicarlo. La vista reutiliza colores semánticos, tipografía y botones de píldora. Abrirla no activa dispositivos: una segunda acción explícita solicita cámara y micrófono. Los invitados conservan los mensajes de texto y reciben un enlace de acceso para llamar; la API exige una cuenta verificada y sesión vigente.

`VideoCallModule` importa `AuthModule`. El controlador resuelve la sesión, el servicio entrega configuración ICE y coordina la limpieza, y el repositorio serializa las plazas mediante el bloqueo de una fila de sala en PostgreSQL. Hasta cuatro cuentas pueden participar, con una participación por cuenta vinculada a la sesión. Las señales SDP son temporales y privadas entre participantes autorizados. El sondeo de sincronización renueva la presencia; las plazas y señales caducan y se limpian al operar o mediante el temporizador del servicio. Estas restricciones se comparten entre instancias; los límites por IP siguen siendo locales al proceso.

`VideoCallClient` mantiene una malla de hasta tres conexiones `RTCPeerConnection` por participante, con iniciador determinista por pareja y recopilación ICE completa antes de enviar cada descripción. Audio y vídeo viajan entre navegadores o por TURN; Nest y PostgreSQL coordinan la llamada sin grabar sus medios. Producción requiere TURN con credenciales temporales y usa únicamente relay. Sin TURN, el entorno local intenta conexión directa y STUN y advierte sobre la IP compartida con participantes.

Los controles permiten silenciar, apagar cámara, cancelar y salir. Minimizar conserva la conexión y los dispositivos; cerrar antes de completar la entrada cancela el intento. Salir cierra conexiones y detiene pistas, igual que cancelar, desmontar, cambiar de cuenta, perder comunicación o recibir `pagehide` u `offline`. Un error que termina la llamada vuelve a abrir la vista para explicarlo. La caducidad del servidor restringe participación y señalización; una conexión P2P ya establecida depende del cierre del cliente. Los contratos, plazos, límites, configuración y comprobaciones manuales pendientes se detallan en [video-calls.md](video-calls.md).

### Integración de modales y CSP

La CSP de producción conserva `style-src 'self'`. La dependencia de bloqueo de desplazamiento usada por los modales de Radix inyecta una etiqueta de estilo sin nonce, que esa política rechaza. La revisión estática no establece un fallo de la tarea modal: la gestión de foco y el aislamiento de la rueda son mecanismos separados. El efecto de ese rechazo sobre el bloqueo de desplazamiento queda pendiente de comprobar en un navegador con la CSP de producción. No se ha debilitado la política ni se afirma validación en ejecución.

Las páginas de acceso y perfil no añaden modales; emplean formularios dentro de la página.

## Cuentas y autenticación

`AuthModule` pertenece al mismo proceso Nest. Sus controladores exponen acceso y gestión de cuenta; `AuthService` coordina los casos de uso, con `OtpService`, `SessionService`, `GoogleAuthService` y `AuthMailService`. `AuthRepository` aporta transacciones, búsqueda y bloqueo de usuarios y bloqueos asesores. Los servicios coordinan su SQL parametrizado mediante `SqlClient` dentro de esas transacciones, apoyadas por `DatabaseService.transaction`; el repositorio no concentra todas las consultas de autenticación. Las operaciones sensibles bloquean primero al usuario y comprueban después que la sesión siga vigente.

`/login` reúne inicio de sesión, registro, recuperación y verificación OTP. El registro nativo emite sesión solo después de confirmar el correo. Google acepta el correo verificado por el proveedor y usa `sub` como identidad estable, sin fusionar cuentas por coincidencia de correo. Vincular Google exige confirmación de contraseña; desvincularlo conserva otro método de acceso. `/profile` separa nombre visible, nombres, apellidos y presentación del cambio de correo, contraseña y Google. El correo nuevo requiere prueba de identidad y OTP antes de sustituir al anterior. Los requisitos y rutas HTTP completos están en [authentication.md](authentication.md).

Los OTP tienen seis dígitos, un solo uso y diez minutos de vigencia, con cinco intentos, espera de 60 segundos para reenviar y hasta cinco envíos por hora, correo y finalidad. La solicitud permite reenvíos durante 30 minutos. Se guarda un HMAC del código; la cola SMTP conserva temporalmente el mensaje cifrado con AES-256-GCM. `AuthMailService` reclama y reintenta entregas dentro del mismo proceso Nest, sin trabajador desplegado por separado. Aceptar una solicitud no demuestra la entrega del proveedor.

Las contraseñas usan scrypt con N=131072, r=8 y p=1, sal aleatoria y un máximo de dos derivaciones simultáneas. Las sesiones opacas de siete días guardan solo el resumen SHA-256 del token en PostgreSQL y admiten hasta cinco sesiones por cuenta. La cookie usa `HttpOnly`, `SameSite=Lax`, ruta `/` y, en HTTPS, `Secure` con prefijo `__Host-`. Los cambios sensibles rotan o revocan sesiones e invalidan códigos pendientes. `GET /auth/session` no borra cookies, para que una respuesta atrasada no elimine una sesión recién rotada.

Google usa PKCE, `state`, vinculación al navegador y `nonce`; la biblioteca oficial verifica el ID token y el backend exige correo verificado. La cookie del flujo OAuth también usa ruta `/` y prefijo `__Host-` en HTTPS. Las credenciales y tokens de Google permanecen en el backend. `AuthHttpMiddleware` exige JSON y el origen configurado para las escrituras, aplica límites por IP y complementa los límites persistidos de acceso y OTP.

`AuthProvider` consulta sesión y disponibilidad, descarta respuestas antiguas y avisa a otras pestañas mediante una señal sin secretos. La respuesta de una edición de datos solo mezcla esos campos públicos, conservando metadatos de credenciales más recientes. `sessionStorage` conserva únicamente los metadatos de un OTP pendiente de registro o recuperación, nunca código, contraseña ni token de sesión. Las opciones de la API permiten explicar funciones deshabilitadas por configuración sin bloquear el acceso invitado.

## Responsabilidades y dependencias

En `messages`, el controlador transforma solicitudes HTTP en llamadas al servicio. Los pipes validan y normalizan las entradas. El servicio coordina el guardado y la publicación de eventos; el repositorio ejecuta SQL parametrizado y resuelve reintentos concurrentes. El servicio de eventos administra conexiones SSE, presencia, latidos y límites de conexiones.

La base de datos y la configuración son servicios compartidos de infraestructura. `health` consulta la base directamente y no depende del módulo de mensajes. `messages` importa `AuthModule` y consume su proveedor exportado `SessionService` para resolver al remitente; no accede a las tablas de cuentas por su cuenta. `forum` importa `AuthModule`, `CommunitiesModule` y `MediaModule`: consume `SessionService`, `CommunityRepository` y `MediaRepository` para exigir verificación, pertenencia, asociación de imágenes y avisos transaccionales. `communities` usa sesiones y persistencia compartida para sus permisos y preferencias. `media` usa sesiones, persistencia compartida y su puerto de almacenamiento. `video-calls` usa sesiones, transacciones y configuración de ICE; no depende del SSE ni del historial de mensajes. `auth` usa infraestructura compartida y contratos públicos.

`common` contiene mecanismos HTTP reutilizables. Las reglas de mensajes pertenecen a `modules/messages`, las de publicaciones a `modules/forum`, las de imágenes a `modules/media`, las de comunidades y avisos a `modules/communities`, las de llamadas a `modules/video-calls` y las de cuentas a `modules/auth`. Los tipos privados de cada módulo permanecen en él. `@messages/contracts` contiene exclusivamente declaraciones públicas de mensajes, foro, imágenes, comunidades, notificaciones, cuentas y llamadas sin dependencias de Nest o PostgreSQL; todos sus consumidores usan `import type`.

## Contrato HTTP

| Método | Ruta | Comportamiento |
| --- | --- | --- |
| GET | `/api/health` | Comprueba PostgreSQL |
| GET | `/api/messages` | Historial con `before`, `after` y `limit` |
| POST | `/api/messages` | Guarda y publica texto; 201 al crear, 200 al reintentar |
| GET | `/api/events` | SSE con eventos `message` y `presence` |
| GET / POST | `/api/video-call`, `/api/video-call/*` | Disponibilidad, entrada, sincronización privada, señales y salida con cuenta verificada |
| GET | `/api/topics` | Tópicos predeterminados |
| GET | `/api/posts` | Publicaciones con `topic`, `author`, `community`, `search`, `before` y `limit` |
| GET | `/api/posts/:id` | Publicación completa |
| GET | `/api/posts/:id/replies` | Respuestas con `before` y `limit` |
| POST | `/api/posts` | Crea con cuenta verificada y pertenencia si hay `communityId`; 201 al crear, 200 al reintentar |
| POST | `/api/posts/:id/replies` | Responde con cuenta verificada y pertenencia si corresponde; 201 al crear, 200 al reintentar |
| GET / POST / DELETE | `/api/media/*` | Opciones, cuota propia, autorización, confirmación, metadatos, enlaces temporales y borrado |
| PUT / GET | `/api/media/:id/local-upload`, `/api/media/:id/local-content` | Transporte local con autorización temporal; el PUT también exige sesión |
| GET / POST / DELETE / PATCH | `/api/communities/*` | Directorio filtrado, creación, pertenencia, imagen, preferencias e invitaciones del creador |
| POST | `/api/community-invitations/preview`, `/api/community-invitations/accept` | Comprobación limitada y aceptación con cuenta; token en JSON |
| GET / POST | `/api/notifications/*` | Bandeja, contador privado y lectura individual o hasta un corte |
| GET / POST | `/api/auth/*` | Disponibilidad, sesión, registro, acceso, OTP, recuperación y Google |
| GET / PATCH / POST | `/api/account/*` | Datos personales, cambio verificado de correo, contraseña y Google |

Se conserva el límite de 2000 caracteres, el nombre opcional de invitado normalizado a Invitado, los identificadores BIGINT como cadenas y el formato de error `{ error: { code, message } }`. Los mensajes pueden incluir `accountId`, asignado solo por el servidor. Un `requestId` reutilizado con otro contenido devuelve 409. Solo los envíos nuevos se publican a los clientes conectados. La tabla detallada de rutas de cuenta está en [authentication.md](authentication.md).

El POST de mensajes aplica validación de origen, límite por IP y parser JSON de 16 KB antes del controlador; las rutas de cuentas tienen su middleware y el mismo tamaño de parser. Comunidades, invitaciones y notificaciones reutilizan `AuthHttpMiddleware` y el parser de 16 KB. Las escrituras del foro exigen el origen configurado y JSON, limitan a sesenta solicitudes por IP cada diez minutos y usan un parser de 64 KB para admitir los cuerpos previstos. `VideoCallMiddleware` valida origen y JSON en sus escrituras, limita solicitudes y entradas por IP y usa un parser de 80 KiB sin compresión. Helmet protege tanto la API como los archivos públicos; `Permissions-Policy` restringe cámara y micrófono al propio origen y deshabilita captura de pantalla. La API sirve el frontend compilado desde `apps/web/dist`, nunca los archivos TypeScript fuente, y devuelve `index.html` sin caché para las entradas directas a `/login`, `/profile`, `/chat`, `/publicar`, `/publicaciones/:id`, `/comunidades`, `/comunidades/crear`, `/comunidades/:id`, `/invitaciones/:token` y `/notificaciones`.

En desarrollo, Vite escucha en `127.0.0.1:5173` y reenvía `/api` a Nest en el puerto configurado por `APP_PORT` o `PORT`. El proxy conserva `Host` y `Origin` para mantener la política de origen de la API.

## Datos y ciclo de vida

Al inicializarse, la API adquiere una conexión y ejecuta las migraciones pendientes dentro de una transacción. Un bloqueo asesor de PostgreSQL serializa los cambios de esquema entre procesos. `app_schema_migrations` registra la versión aplicada. La primera migración crea o adopta la tabla `messages` existente conservando sus datos.

La migración 002 añade `users`, `user_google_identities`, `auth_sessions`, `auth_otp_challenges`, `auth_google_flows`, `auth_mail_outbox` y `auth_login_attempts`, además de una asociación opcional `messages.user_id`. Los mensajes previos se conservan como invitados. La cola cifrada comparte PostgreSQL con las solicitudes OTP y sus plazos. La migración y su fixture se actualizaron mediante revisión estática; no se aplicaron ni ejecutaron durante esta entrega.

La migración 003 crea `forum_categories`, `forum_tags`, `forum_post_tags`, `forum_posts` y `forum_replies`. El catálogo jerárquico se carga desde `database/seeds/forum-catalog.ts`; el modelo tiene una categoría opcional y varias etiquetas por publicación. `forum_posts.id` y todas sus referencias son UUID, independientes de `request_id`. La paginación combina fecha con precisión de milisegundos y UUID; los IDs de respuestas siguen siendo BIGINT. `GET /api/topics` proyecta las cinco raíces para conservar el inicio actual. Los contratos y rutas de taxonomía se describen en [forum.md](forum.md). Añade también `auth_google_flows.return_to` para conservar el destino tras OAuth.

Por solicitud del usuario, que eliminó su base local, las versiones iniciales 003, 004 y 005 se redefinieron para este modelo. Requieren una base nueva; no convierten versiones antiguas ya registradas. No se borró ninguna base ni se aplicaron migraciones durante este trabajo.

La migración 004 añade `communities`, `community_memberships`, `community_preferences`, `community_notifications` y `forum_posts.community_id` opcional. Conserva las cuentas, publicaciones y mensajes existentes; las publicaciones generales mantienen la comunidad nula. Usa el mismo mecanismo versionado de arranque y no se aplicó durante este trabajo.

La migración 005 añade `media`, `media_quotas`, `media_events` y `media_metrics`, además de `forum_posts.media_request_ids` para comprobar la idempotencia de publicaciones con imágenes. PostgreSQL guarda metadatos, permisos, cuotas, estados y claves de objetos; los bytes permanecen en disco o en el bucket privado. Es aditiva y no se aplicó durante este trabajo.

La migración 006 añade `video_call_room`, `video_call_members` y `video_call_signals` para coordinar plazas y señales con expiración. Los participantes se vinculan a cuentas y sesiones; las señales se eliminan al retirar sus participantes. Es aditiva y no se aplicó durante este trabajo. No guarda grabaciones ni archivos de medios.

La migración 007 añade visibilidad de comunidades, `community_invitations`, finalidad de medios y asociaciones únicas a comunidad y avatar. Las comunidades existentes conservan visibilidad pública y los medios previos la finalidad `post`. Las restricciones validan la finalidad y evitan asociar un medio a varios recursos. Es aditiva y está preparada, sin aplicarse durante esta entrega.

La migración 008 añade `forum_posts.content` JSONB para documentos versionados. La API valida nodos, marcas, atributos, enlaces y referencias de medios mediante una lista cerrada, deriva el texto de búsqueda y conserva las escrituras en una sola transacción. El editor Tiptap/ProseMirror se carga bajo demanda en el lienzo; el lector usa React sin HTML arbitrario. Las publicaciones anteriores siguen siendo texto literal. No se modificó el inicio ni se relajó CSP. El alcance y los límites están en [editor.md](editor.md). La migración no se aplicó durante el trabajo asistido.

La migración 009 añade revisión, fecha de edición y `forum_post_edits` con huellas de solicitud y revisiones para idempotencia y límites de frecuencia. `PATCH /api/posts/:id` exige sesión verificada y autoría; conserva la comunidad y exige pertenencia si existe. Edición de documento, etiquetas y medios es transaccional, con control optimista de revisión y bloqueos en el orden usuario → comunidad → publicación → medios. Los ordinales de imágenes se liberan dentro de la transacción antes de reordenarlas; las retiradas pasan al limpiador existente. Editar no genera avisos de publicación nueva ni cambia la fecha de creación. El frontend reutiliza el lienzo con borradores de edición separados. La migración queda preparada, sin ejecutarse.

El inicio usa `features/forum/discovery` para un flujo directo con búsqueda automática en navbar, títulos Fraunces y filtros de catálogo/etiquetas. ForumShell incorpora esas herramientas mediante un slot del inicio. La lista previa de comunidades se conserva en `components/post-list.tsx`. Los recursos distinguen la identidad de consulta y cancelan peticiones de páginas anteriores; RouteFocus conserva el foco del buscador al cambiar consultas en el inicio. Los parámetros de interfaz se traducen a consultas API validadas, con hasta ocho etiquetas combinadas y resolución de nombres que respeta la privacidad. ForumReadMiddleware limita las consultas de publicaciones y etiquetas a 240 por IP y minuto. No se añadieron dependencias ni cambios de esquema para este rediseño. Los detalles están en [discovery.md](discovery.md).

Al cerrar, el servicio de eventos termina las conexiones SSE y `MediaService` y `VideoCallService` cancelan sus temporizadores y esperan la limpieza en curso antes de que Nest cierre el servidor HTTP. El pool PostgreSQL termina al concluir el cierre de la aplicación. Los errores de solicitudes muestran mensajes públicos y los registros omiten consultas y credenciales.

La entrega SSE actual funciona en una instancia. Un despliegue con varias instancias necesitará distribución de eventos y límites compartidos; esa ampliación pertenece a otra etapa.

## Configuración, herramientas y pruebas

La API carga los archivos de entorno de la raíz según NODE_ENV; sin una selección externa usa development. Las variables del proceso tienen prioridad, seguidas de .env.[entorno].local, .env.[entorno], .env.local y .env. El perfil .env.development versionado contiene únicamente valores públicos para los hosts locales; las credenciales y los puertos existentes continúan en el entorno privado. Vite comparte el directorio de configuración y el perfil development, y su proxy respeta PORT y APP_PORT. La configuración tipada expone environment. El detalle está en [development.md](development.md).

Los manifiestos de los workspaces y el lockfile único se mantienen desde la raíz. Node 24.15+ de la rama 24 LTS es la versión recomendada para las dependencias de desarrollo.

`config/auth-config.ts` valida `APP_URL`, el secreto de autenticación, SMTP y las credenciales Google del backend. `AUTH_SECRET` habilita cuentas; SMTP completo habilita el envío de códigos y Google se configura de forma independiente. Sin correo, el registro y las solicitudes OTP no están disponibles, mientras un acceso con contraseña existente puede continuar. `npm run setup:auth` prepara el archivo privado preservando valores existentes y genera un secreto si falta, sin mostrarlo. Ya se ejecutó ese paso; el usuario completará SMTP y Google según [authentication.md](authentication.md). No se activaron ni comprobaron integraciones externas. Ninguna credencial se publica con variables `VITE_`.

`config/video-call-config.ts` valida `CALLS_ENABLED`, las URLs STUN/TURN y el secreto compartido de TURN. La función se habilita por defecto fuera de producción; producción requiere activación explícita y TURN con credenciales temporales. El secreto permanece en el backend y en TURN, y el navegador recibe únicamente credenciales con vencimiento. Los requisitos y la configuración manual están en [video-calls.md](video-calls.md).

ESLint es el analizador común para API y React, con reglas de hooks y recarga de componentes. TypeScript 6 se usa en ambos workspaces para mantener la compatibilidad con typescript-eslint.

Las pruebas del backend usan Node Test Runner; `@nestjs/testing` crea el módulo real y sustituye únicamente la configuración, el pool y las dependencias requeridas por cada caso. `pg-mem` evita conectarse a datos reales. La cobertura LCOV corresponde al backend. SonarQube analiza también el código del frontend; la interfaz nueva todavía no tiene pruebas propias.

| Comando desde la raíz | Función |
| --- | --- |
| `npm ci` | Instala todos los workspaces con el lockfile único |
| `npm run setup:auth` | Prepara `.env` y genera `AUTH_SECRET` solo si falta o está vacío |
| `npm run dev` | Inicia Nest y Vite bajo observación |
| `npm run dev:api` | Inicia únicamente Nest bajo observación |
| `npm run dev:web` | Inicia únicamente Vite |
| `npm run build` | Compila API y frontend |
| `npm start` | Compila y sirve la API junto al frontend compilado |
| `npm run lint` | Analiza estáticamente todo el código |
| `npm run typecheck` | Comprueba los tipos de ambos workspaces y scripts |
| `npm test` | Compila y ejecuta las pruebas del backend con cobertura |

El .env privado, .env.local y .env.development.local, las dependencias instaladas, compilaciones e informes están excluidos de Git. .env.example contiene la plantilla de configuración y .env.development los valores públicos del perfil local; ambos se conservan en el repositorio.

El foro, las imágenes, las comunidades, la bandeja, el chat global, la videollamada y los flujos de cuenta se entregan con revisión estática, sin ejecutar compilaciones, comprobaciones del compilador, pruebas, migraciones, servidores de desarrollo, Docker ni renderizados de navegador por indicación del usuario. No se usaron cámara ni micrófono durante este trabajo. La validación visual y en ejecución, la conexión WebRTC entre navegadores y redes, TURN, la integración con el bucket, la entrega SMTP y el retorno OAuth permanecen pendientes de configuración y comprobación en el entorno del usuario. Los detalles del foro y de sus permisos están en [forum.md](forum.md); los de comunidades y avisos, en [communities.md](communities.md); los de almacenamiento, en [media.md](media.md); los de llamada, en [video-calls.md](video-calls.md).
