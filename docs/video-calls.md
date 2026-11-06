# Videollamada del chat global

El botón «Videollamada» aparece a la derecha de «Chat global» en /chat; en móvil conserva el icono con nombre accesible. Abre una vista que ocupa toda la ventana de Foris, con vídeos grandes y controles al pie. El navegador solo pide cámara y micrófono al pulsar «Entrar con cámara y micrófono». Una llamada activa se puede minimizar para seguir escribiendo: aparece una franja con «Volver a la llamada» y salida, sin desconectar ni detener el audio. Volver restaura la vista completa. Salir de la llamada detiene los dispositivos. Antes de entrar, cerrar cancela cualquier preparación pendiente. Los invitados mantienen el chat de texto y el enlace para entrar con una cuenta.

## Alcance

Una sala global compartida, hasta cuatro cuentas verificadas y una participación por cuenta. No hay llamadas privadas, invitaciones, grabación, pantalla compartida, archivos de vídeo ni dependencia de un servicio de reuniones. Cada persona se une voluntariamente; no se activa ningún dispositivo por abrir /chat. Cualquier cuenta verificada puede entrar mientras haya plaza. Los nombres visibles no acreditan la identidad real.

WebRTC transporta audio y vídeo entre navegadores; Nest coordina únicamente presencia y señales. La conexión usa una malla pequeña: cada participante tiene hasta tres conexiones. Este diseño limita el alcance y consumo iniciales; para grupos grandes se necesitaría un SFU.

## Arquitectura y seguridad

| Ubicación | Responsabilidad |
| --- | --- |
| apps/api/src/modules/video-calls/ | Autenticación, autorización, plazas, señales y limpieza |
| apps/api/src/config/video-call-config.ts | Habilitación e infraestructura STUN/TURN |
| apps/api/src/database/migrations/006-create-video-calls.ts | Sala, participantes y señales efímeras |
| packages/contracts/src/video-calls.d.ts | Contratos públicos de llamada |
| apps/web/src/features/video-calls/lib/video-call-client.ts | Dispositivos, conexiones, negociación y liberación |
| apps/web/src/features/video-calls/components/global-video-call.tsx | Vista completa, consentimiento, minimizar/regresar y controles |
| apps/web/src/features/video-calls/components/call-media.tsx | Vídeos y audio remoto persistente al minimizar |

Se reutilizan las sesiones HttpOnly y el patrón de transacciones del proyecto. Cada operación verifica la cuenta y sesión; el participante queda vinculado a ambas. Las escrituras requieren el origen exacto de APP_URL y JSON limitado a 80 KiB, sin compresión. Los IDs y campos se validan, las consultas son parametrizadas y el SDP se limita a 65536 caracteres. No se aceptan autores enviados por el cliente. Las señales solo se consultan por el destinatario de esa sesión y solo se envían a otros participantes vigentes.

La fila de sala se bloquea con FOR UPDATE antes de comprobar plazas o alterar participantes, de modo que el límite y la exclusión de otras pestañas se comparten entre instancias del backend. Reintentar la misma entrada devuelve la participación existente. Cada pareja tiene un iniciador determinista (el ID menor); se envía una descripción completa tras recopilar candidatos ICE, sin trickle ni renegociación. Solo se admite una señal por dirección y pareja mientras existe, y los reintentos con el mismo identificador son idempotentes. Cambiar los datos de una solicitud produce conflicto.

La sincronización privada consulta señales aproximadamente cada 1,5 segundos y renueva una presencia de noventa segundos. Las señales caducan a los dos minutos; eliminarlas no rompe una conexión establecida. La participación coordinada dura hasta treinta minutos. Hay limpieza al operar y cada minuto, sin persistir SDP en logs o almacenamiento del navegador. PostgreSQL conserva temporalmente el SDP, que contiene información de conexión; no contiene grabaciones. Revocar la sesión elimina la participación mediante la relación existente y corta futuras operaciones de señalización.

La salida cierra conexiones y detiene pistas de cámara/micrófono, también al cancelar, desmontar la página, recibir pagehide u offline. La falta de comunicación exitosa con Foris durante treinta segundos detiene la llamada en el cliente. Una petición de salida perdida se recupera con la caducidad de presencia. La API no puede cancelar el diálogo nativo de permisos; si la persona sale antes de responder, cualquier flujo que se obtenga después se detiene. El audio remoto permanece montado fuera de la vista completa, de modo que minimizar no lo interrumpe. Los vídeos están silenciados para evitar sonido duplicado. Si el navegador bloquea la reproducción se ofrece «Activar audio» tanto en la vista completa como en la franja de regreso.

Los navegadores pueden suspender temporizadores en segundo plano. La caducidad del servidor controla participación y señalización; el cierre del transporte WebRTC depende del cliente. Un navegador modificado podría conservar una conexión ya establecida fuera de esos controles: no se promete revocación instantánea de medios P2P. Una implementación con SFU permitiría controlar ese transporte desde el servidor.

Hay límites por IP de 240 peticiones de llamada por minuto y diez intentos de entrada por minuto. Son locales al proceso, coherentes con los limitadores existentes; para muchas réplicas se necesita un almacén compartido del limitador. Las restricciones de plazas y propiedad se comparten mediante PostgreSQL. La API limita cámara y micrófono al propio origen con Permissions-Policy y no habilita pantalla compartida.

## Desarrollo local

No necesitas cambiar npm run dev. Las llamadas están habilitadas por defecto fuera de producción. La migración 006 se aplicará al iniciar la API mediante el mecanismo habitual, sin modificar mensajes existentes. Durante esta entrega no se ha ejecutado.

El navegador requiere HTTPS o un origen local confiable, como localhost o 127.0.0.1. Abrir la aplicación por una IP de LAN mediante HTTP no garantiza permiso de cámara. Puedes comprobar la interfaz con dos cuentas en perfiles de navegador diferentes. Sin TURN se intenta conexión directa y STUN; puede funcionar localmente y fallar entre redes con NAT o cortafuegos restrictivos. La interfaz avisa de que esa conexión directa puede revelar la IP a los participantes.

```dotenv
# Opcional en desarrollo; false permite desactivar la función.
CALLS_ENABLED=true
CALLS_STUN_URLS=stun:stun.l.google.com:19302
CALLS_TURN_URLS=
CALLS_TURN_SECRET=
```

STUN es configurable, admite hasta cuatro URLs separadas por comas y se puede dejar vacío para pruebas exclusivamente locales. No se configura ni consulta infraestructura TURN durante esta entrega.

## Producción

Sin CALLS_ENABLED, producción deja la función deshabilitada. Para habilitarla necesitas HTTPS y un servicio TURN compatible con credenciales temporales mediante secreto compartido, como coturn con use-auth-secret. No basta con introducir credenciales de usuario/contraseña permanentes de otro proveedor: ese proveedor debe soportar este mecanismo.

```dotenv
CALLS_ENABLED=true
CALLS_TURN_URLS=turns:relay.example.com:5349?transport=tcp,turn:relay.example.com:3478?transport=udp
CALLS_TURN_SECRET=
```

Configura el mismo secreto aleatorio de al menos 32 caracteres en el backend y TURN, sin VITE_ ni exposición al navegador. El servidor genera para cada participante un usuario con vencimiento de una hora y una credencial HMAC-SHA1, conforme al protocolo TURN REST de coturn; el secreto compartido nunca se entrega. La credencial temporal permite preparar conexiones durante la participación de treinta minutos. Reinicia los servicios afectados al cambiar la configuración.

Cuando hay TURN, el cliente selecciona exclusivamente relay y no utiliza candidatos de conexión directa. Esto mejora conectividad y evita compartir la IP directa entre participantes; el proveedor TURN conoce las conexiones. TURN retransmite tráfico y puede tener costes propios. Una credencial ya emitida no se revoca inmediatamente al salir. Configura cuotas por usuario, cuotas totales, límites de tráfico y restricciones de destinos privados/loopback en TURN, además de TLS, certificados válidos y su cortafuegos. No expongas un relay sin autenticación.

Los navegadores deben poder llegar a los puertos de TURN y su rango de relay. El backend no transporta el vídeo ni necesita proxy WebSocket: la señalización usa /api bajo el mismo origen. APP_URL debe coincidir con el frontend y su proxy. En despliegues con funciones suspendidas, el recolector por temporizador necesita un proceso persistente; la limpieza al recibir peticiones mantiene el límite lógico, pero no garantiza la eliminación física puntual de SDP cuando no hay tráfico.

Referencias: [getUserMedia y contextos seguros](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [negociación WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation), [credenciales temporales de coturn](https://github.com/coturn/coturn/wiki/turnserver).

## API y comprobación

Todas las rutas requieren sesión de cuenta verificada y devuelven no-store.

| Método y ruta | Función |
| --- | --- |
| GET /api/video-call | Habilitación, plazas y disponibilidad de relay |
| POST /api/video-call/join | Entrada idempotente con requestId UUID |
| POST /api/video-call/:memberId/sync | Presencia, participantes y señales propias desde after |
| POST /api/video-call/:memberId/signals | Señal a un participante con to, requestId y description |
| POST /api/video-call/:memberId/leave | Salida idempotente; objeto JSON vacío |

Se añadieron fuentes de pruebas para configuración, validación, credenciales TURN, autenticación/origen, capacidad, idempotencia, propiedad y privacidad de señales, cursores y caducidad. Las pruebas de integración preparadas usan pg-mem; no demuestran los bloqueos reales de PostgreSQL. La comprobación de concurrencia en PostgreSQL y de medios entre navegadores/redes queda pendiente.

Por petición vigente del usuario, solo se realizó revisión estática: ESLint, imports, CSS, configuración y revisión independiente de fuentes. No se ejecutaron pruebas, compilación, typecheck, migraciones, servidores, Docker ni llamadas reales. La apertura automática, minimizar/regresar, continuidad de audio, foco y adaptación a móvil requieren comprobación posterior en navegador. Tampoco se abrió la cámara. Debe validarse manualmente la conexión entre navegadores, permisos rechazados, cámara ocupada, pérdida de red, cierre de pestaña y funcionamiento de TURN antes de desplegar.
