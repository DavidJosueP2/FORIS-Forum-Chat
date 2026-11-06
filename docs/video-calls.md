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
| apps/api/src/modules/video-calls/cloudflare-turn.ts | Credenciales temporales de Cloudflare Realtime TURN, sin exponer la clave |
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

STUN es configurable, admite hasta cuatro URLs separadas por comas y se puede dejar vacío para pruebas exclusivamente locales. La integración no crea infraestructura ni claves TURN: se configuran aparte siguiendo los pasos de producción.

## Producción

Sin CALLS_ENABLED, producción deja la función deshabilitada. Para habilitarla necesitas HTTPS y TURN. Se admiten Cloudflare Realtime TURN y coturn con secreto compartido; la selección se hace en el backend. El contrato del navegador y la sala compartida no cambian.

### Cloudflare Realtime TURN en Vercel

1. Abre [Realtime en Cloudflare](https://dash.cloudflare.com/?to=/:account/calls), elige tu cuenta y entra en TURN. El panel puede aparecer con el nombre Calls.
2. Crea una clave TURN para Foris. Guarda su **Key ID** y su **API Token** en privado. Son credenciales de Realtime TURN; las credenciales S3 de R2 no sirven aquí.
3. En Vercel → proyecto Foris → Settings → Environment Variables, configura estas variables para **Production**. Añádelas también a Preview si necesitas llamadas en los despliegues de vista previa:

   ```dotenv
   CALLS_ENABLED=true
   CALLS_TURN_PROVIDER=cloudflare
   CALLS_CLOUDFLARE_TURN_KEY_ID=EL_KEY_ID_DE_TURN
   CALLS_CLOUDFLARE_TURN_API_TOKEN=EL_API_TOKEN_DE_ESTA_CLAVE_TURN
   ```

4. Deja `CALLS_TURN_URLS` y `CALLS_TURN_SECRET` vacías o sin definir; pertenecen a coturn. Guarda el API Token como Secret. Ninguna variable lleva prefijo `VITE_`.
5. Sube este cambio y despliega el nuevo commit. Cambiar variables no actualiza las funciones de un despliegue anterior. `APP_URL` debe seguir siendo el origen HTTPS exacto desde el que abres Foris.

Para usar Cloudflare también en local, copia las mismas cuatro variables a `.env.development.local` y reinicia únicamente la API; se recomienda otra clave TURN para desarrollo. El frontend no necesita variables nuevas. Si no configuras TURN en local, se mantiene la conexión directa con STUN.

Nest solicita credenciales con una duración de una hora al endpoint fijo HTTPS de Cloudflare, antes de reservar una plaza. Cada intento tiene un límite de ocho segundos y no sigue redirecciones. El navegador solo recibe URLs relay de Cloudflare y su usuario/contraseña temporal; nunca el API Token. Se descartan STUN y el puerto alternativo 53 para evitar retrasos de ICE sin trickle. Si Cloudflare falla, no se crea una participación nueva y el usuario puede volver a intentarlo. Una reserva posterior puede ser rechazada si la sala se llenó mientras se preparaba la conexión; en ese caso no se entregan las credenciales.

La configuración se valida al arrancar: detecta claves incompletas, proveedores desconocidos y mezcla de variables. No se llama a Cloudflare al arrancar ni al consultar disponibilidad, solo al intentar entrar con una cuenta verificada. Una clave inválida puede permitir mostrar el botón, pero la entrada devuelve `CALL_TURN_AUTH_FAILED`; comprueba su Key ID/API Token y que esa clave siga activa. `CALL_TURN_UNAVAILABLE` indica un fallo de conexión o respuesta HTTP no satisfactoria; `CALL_TURN_INVALID_RESPONSE`, que no se recibieron credenciales relay utilizables. No se registran las respuestas ni las credenciales del proveedor.

Cloudflare TURN tiene una [capa gratuita y facturación por tráfico](https://developers.cloudflare.com/realtime/turn/faq/). Consulta su panel para consumo y condiciones. Referencia de la integración: [generación de credenciales temporales](https://developers.cloudflare.com/realtime/turn/generate-credentials/).

### Coturn

La alternativa existente conserva las variables anteriores. El servicio debe admitir TURN REST con `use-auth-secret`; no basta con credenciales estáticas de usuario/contraseña de otro proveedor.

```dotenv
CALLS_ENABLED=true
CALLS_TURN_PROVIDER=coturn
CALLS_TURN_URLS=turns:relay.example.com:5349?transport=tcp,turn:relay.example.com:3478?transport=udp
CALLS_TURN_SECRET=
```

Configura el mismo secreto aleatorio de al menos 32 caracteres en el backend y TURN, sin VITE_ ni exposición al navegador. El servidor genera para cada participante un usuario con vencimiento de una hora y una credencial HMAC-SHA1, conforme al protocolo TURN REST de coturn; el secreto compartido nunca se entrega. La credencial temporal permite preparar conexiones durante la participación de treinta minutos. Reinicia los servicios afectados al cambiar la configuración.

Cuando hay TURN, el cliente selecciona exclusivamente relay y no utiliza candidatos de conexión directa. Esto mejora conectividad y evita compartir la IP directa entre participantes; el proveedor TURN conoce las conexiones. TURN retransmite tráfico y puede tener costes propios. Una credencial ya emitida no se revoca inmediatamente al salir. Configura cuotas por usuario, cuotas totales, límites de tráfico y restricciones de destinos privados/loopback en TURN, además de TLS, certificados válidos y su cortafuegos. No expongas un relay sin autenticación.

Los navegadores deben poder llegar a los puertos de TURN y su rango de relay. El backend no transporta el vídeo ni necesita proxy WebSocket: la señalización usa /api bajo el mismo origen. APP_URL debe coincidir con el frontend y su proxy. En despliegues con funciones suspendidas, el recolector por temporizador necesita un proceso persistente; la limpieza al recibir peticiones mantiene el límite lógico, pero no garantiza la eliminación física puntual de SDP cuando no hay tráfico.

Referencias: [getUserMedia y contextos seguros](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [negociación WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation), [configuración de coturn](https://github.com/coturn/coturn/blob/master/examples/etc/turnserver.conf).

### Pantalla completa y comprobación del despliegue

La vista usa `DialogContent layout="fullscreen"`. Este modo omite las clases de centrado, traslación, anchura máxima y animación del diálogo habitual. El CSS de la videollamada define la distribución interior y conserva los controles, el foco y la acción de minimizar.

En el CSS de producción inspeccionado, `.call-stage` se había optimizado a `transform: translate(0,0)` mientras Tailwind mantenía `translate: -50% -50%` mediante las clases del diálogo. Las dos propiedades son independientes: el contenido acababa media pantalla fuera de la ventana. El modo fullscreen evita aplicar esas clases, en lugar de depender de contrarrestarlas en otra hoja de estilos. Los demás diálogos conservan su diseño centrado.

Después de configurar TURN y desplegar, entra en `/chat` con una cuenta verificada. Al abrir Videollamada se debe ver toda la cabecera y el botón Cerrar. En Red, `GET /api/video-call` debe devolver `enabled: true` y `relay: true`. Solo al pulsar Entrar se solicitan cámara/micrófono. Comprueba la conexión con dos cuentas en navegadores y redes diferentes, después minimizar, volver y salir. No compartas el cuerpo de la respuesta de entrada: contiene las credenciales temporales de TURN.

En esta corrección se inspeccionaron el CSS publicado y los nombres de variables de Vercel sin descargar sus secretos. No se modificaron las variables remotas ni se hizo un despliegue. Quedan pendientes la clave TURN real y la comprobación con medios. Se añadieron fuentes de pruebas del adaptador y sus errores; no se ejecutaron por la restricción vigente de revisión estática.

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
