# Cuentas y autenticación de Foris

El acceso invitado continúa disponible en el chat global (/chat). El contenido público del foro se puede leer sin cuenta; las comunidades privadas requieren membresía; crear publicaciones o respuestas requiere una sesión de cuenta verificada. La ruta /login concentra inicio de sesión, registro y recuperación; /profile permite editar datos, correo, contraseña y la vinculación con Google.

Las comunidades públicas permiten lectura sin cuenta; las privadas solo muestran contenido a sus miembros. Crear una, unirse, guardar favoritas, modificar preferencias y consultar la bandeja de notificaciones requiere una cuenta; escribir dentro de una comunidad exige pertenecer a ella. Los destinos de regreso tras acceso nativo, OTP o Google admiten las rutas conocidas de comunidades, invitaciones y notificaciones, y el parámetro comunidad al publicar. No se aceptan destinos externos. Los detalles están en [communities.md](communities.md).

La cabecera ofrece Tu perfil como menú para una sesión activa: Ver tu perfil, una fila Tema con tres iconos para oscuro, claro y sistema, y Cerrar sesión. El tema seleccionado se resalta y cada icono conserva un nombre accesible y una ayuda al pasar el puntero. El tema se guarda localmente; si no hay una elección previa, sigue al sistema. Cerrar sesión usa el endpoint existente, espera su confirmación y muestra un error recuperable si falla. Los invitados conservan Entrar y el mismo selector compacto de temas.

La implementación está preparada. El envío real de OTP y el acceso a Google requieren las credenciales que vas a completar en el archivo privado .env. No se ejecutaron compilaciones, comprobaciones del compilador, pruebas, migraciones, servidores ni envíos de correo durante esta entrega.

## Preparar el archivo local

Desde la raíz:

```powershell
npm run setup:auth
```

Este comando ya se ejecutó durante la preparación. Puedes repetirlo: conserva los valores existentes y solo genera AUTH_SECRET si falta o está vacío. No muestra secretos. .env sigue excluido de Git; .env.example contiene únicamente la plantilla.

Usa el mismo origen en el navegador, en APP_URL y en la configuración de Google. Para el desarrollo actual:

```dotenv
APP_URL=http://127.0.0.1:5173
TRUST_PROXY=0
```

Vite reenvía /api al backend. Por eso el retorno OAuth de desarrollo usa el puerto de la interfaz, 5173. No mezcles localhost con 127.0.0.1: sus cookies y orígenes son distintos.

Conserva AUTH_SECRET entre reinicios. Protege los resúmenes OTP y el cifrado temporal de la cola de correo. Cambiarlo invalida los códigos pendientes y hace ilegibles los correos que aún estén en la cola. En varias instancias debe ser el mismo secreto.

## Correo SMTP

Completa los datos reales de tu proveedor:

```dotenv
SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-usuario-smtp
SMTP_PASSWORD=tu-credencial-smtp
MAIL_FROM="Foris - Chat & Enjoy"
MAIL_FROM_ADDRESS=hola@tu-dominio.com
```

El remitente debe estar autorizado por ese proveedor. Usa su credencial SMTP, que puede ser diferente de la contraseña de tu buzón. Si el proveedor exige una contraseña de aplicación, utiliza esa credencial.

MAIL_FROM es el nombre visible. MAIL_FROM_ADDRESS permite indicar la dirección de remitente por separado. Si no se indica, se conserva la dirección del formato anterior `MAIL_FROM="Foris - Chat & Enjoy <hola@tu-dominio.com>"` o se usa SMTP_USER cuando es una dirección de correo. Si tu usuario SMTP es un identificador como «apikey», configura MAIL_FROM_ADDRESS. Un remitente sin dirección válida deja el correo deshabilitado en vez de intentar un envío inválido.

Nodemailer recibe el nombre y la dirección por separado, por lo que el nombre puede contener espacios y «&». Este formato sigue su [documentación de direcciones](https://nodemailer.com/message/addresses). Tras cambiar estas variables, reinicia manualmente el backend para cargarlas; no basta con recargar la página.

El puerto 587 exige STARTTLS; el 465 utiliza TLS desde el inicio y SMTP_SECURE=true. No se desactiva la validación de certificados. Los parámetros siguen el [transporte SMTP de Nodemailer](https://nodemailer.com/smtp).

Si falta esta configuración, el registro y las solicitudes de código responden que el correo no está disponible. El acceso con una contraseña existente puede seguir funcionando; Google se configura de forma independiente. Los códigos no se imprimen en la consola como alternativa al correo.

## Google OAuth

En tu proyecto de Google Cloud:

1. Configura la pantalla de consentimiento para Foris. Si el proyecto está en modo de prueba, incorpora las cuentas que usarás para probar.
2. Crea un cliente OAuth de tipo Aplicación web.
3. Registra este URI de redirección autorizado exactamente: http://127.0.0.1:5173/api/auth/google/callback.
4. Si configuras orígenes de JavaScript, usa http://127.0.0.1:5173.
5. Copia el ID y el secreto del cliente en las variables del backend:

```dotenv
GOOGLE_CLIENT_ID=tu-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-secreto-de-cliente
```

No uses variables VITE_ para estas credenciales. El navegador solo recibe una URL de autorización y una cookie de sesión HttpOnly; no recibe el secreto, el verificador PKCE, tokens de acceso ni tokens de actualización de Google.

Solo se solicitan openid, email y profile. El backend verifica la firma y destinatario del ID token, su caducidad, nonce y email_verified. La identidad estable es sub; el correo de Google no se usa para fusionar cuentas. Se emplean state, vinculación al navegador mediante cookie y PKCE. Véanse el [flujo web de Google](https://developers.google.com/identity/protocols/oauth2/web-server) y su [documentación OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).

Cuando cambies .env, reinicia manualmente el backend para cargar la configuración. No se inició ningún proceso durante esta tarea.

## Comportamiento de las cuentas

| Acción | Comportamiento |
| --- | --- |
| Registro manual | Guarda una solicitud pendiente y exige un OTP del correo antes de emitir una sesión. |
| Entrar con Google | Crea o abre la cuenta identificada por sub si Google confirma el correo; no pide una verificación local adicional. |
| Correo ya utilizado al entrar con otro Google | No une cuentas automáticamente. Hay que entrar a la cuenta existente y vincular Google desde el perfil. |
| Vincular Google | Requiere sesión y confirmación de la contraseña local; la vuelta OAuth debe pertenecer al mismo navegador y sesión. |
| Desvincular Google | Requiere una contraseña local y su confirmación. No permite eliminar el último método de acceso. |
| Añadir contraseña a una cuenta Google | «Crear contraseña», en Contraseña o en la ayuda de Google, abre y enfoca el formulario. Se elige y repite la contraseña, se solicita un OTP y se confirma para guardarla. Exige acceso reciente con Google y un OTP al correo de la cuenta. |
| Cambiar contraseña local | Confirma contraseña actual y OTP. Rota la sesión actual e invalida las demás. |
| Recuperar contraseña | Solicitud genérica por correo y OTP; no revela si la cuenta existe. Tras confirmar, hay que volver a entrar. |
| Cambiar correo | Confirma identidad y un OTP enviado al nuevo correo; la dirección anterior continúa hasta la confirmación. |
| Actualizar datos | Permite nombre visible, nombres, apellidos y presentación; no modifica directamente el correo ni las credenciales. |

Los cambios de métodos de acceso y correo rotan la sesión e invalidan códigos pendientes. La confirmación con Google para acciones sensibles también está disponible desde el perfil. Las respuestas de datos personales solo actualizan esos campos en el cliente y preservan metadatos de acceso más recientes.

## OTP y correo pendiente

- Código aleatorio de seis dígitos, con caducidad de 10 minutos y un solo uso.
- Máximo de cinco intentos por código; los fallos se contabilizan incluso cuando se rechaza la confirmación.
- Reenvío a partir de 60 segundos, con hasta cinco envíos por hora, correo y finalidad.
- Una solicitud permite reenvíos durante 30 minutos; después hay que empezar una nueva.
- El reenvío cambia el código, invalida el anterior y renueva su plazo.
- Verificación, recuperación, cambio de contraseña y cambio de correo tienen finalidades distintas. Un código no sirve para otra operación.
- Los códigos de cambios de perfil están ligados al usuario y a la sesión que solicitó el cambio.

La tabla de solicitudes guarda un HMAC, no el código legible. Para entregar el correo se guarda temporalmente un mensaje cifrado con AES-256-GCM en la misma base de datos. El trabajador SMTP reclama trabajos con bloqueo, reintenta fallos y elimina el mensaje cifrado al entregarlo o caducar. No necesita otro servicio o proceso separado de Nest.

Una aceptación de la solicitud no demuestra entrega del proveedor. En un fallo de SMTP, la interfaz conserva la solicitud y sus plazos; el trabajador reintenta mientras sea válida. Si se agotan el plazo o los intentos, se puede empezar otra solicitud. El código recibido más recientemente es el que corresponde al último reenvío.

## Sesiones e identidad del chat

Las sesiones tienen tokens aleatorios de 256 bits, cuyo resumen SHA-256 se guarda en PostgreSQL. Duran siete días y se conservan hasta cinco por cuenta. No hay JWT ni tokens de sesión en localStorage. La cookie usa HttpOnly, SameSite=Lax y, en HTTPS, Secure y prefijo __Host- sin Domain. La cookie del flujo Google también queda ligada al host en HTTPS.

Las operaciones de escritura de autenticación exigen JSON y el Origin configurado en APP_URL. Además del límite por IP, el acceso nativo limita los fallos por correo y los OTP tienen límites persistidos. Las contraseñas usan scrypt con N=131072, r=8, p=1 y sal aleatoria; hay un límite de dos derivaciones simultáneas para acotar el consumo de memoria. La elección sigue los parámetros de [OWASP para almacenar contraseñas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html); los códigos siguen sus recomendaciones de [recuperación de acceso](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

El cliente del chat declara X-Foris-Identity=account o guest. Ese encabezado expresa cómo quiere participar, no acredita una identidad. account exige una sesión válida; el servidor asigna el nombre y accountId. guest no recibe accountId. Un remitente o nombre enviado en JSON nunca convierte un mensaje en mensaje de miembro. Los clientes anteriores sin encabezado conservan la resolución de sesión previa. La interfaz espera a resolver la sesión antes de enviar para evitar atribuciones accidentales.

El GET de sesión no borra cookies: una respuesta atrasada no puede eliminar una sesión recién rotada. La sesión inválida deja de autorizar acciones, aunque su cookie siga en el navegador hasta caducar, cerrar sesión o ser reemplazada. Un reintento de miembro conserva su identificador aunque cambie su nombre visible; el propietario y el cuerpo siguen siendo los mismos.

## Rutas HTTP

Todas están bajo /api y devuelven JSON salvo el retorno de Google:

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | /auth/options | Disponibilidad de cuentas, Google y correo. |
| GET | /auth/session | Sesión actual o invitado. |
| POST | /auth/register | Solicitar registro nativo. |
| POST | /auth/verify-email | Verificar OTP y entrar. |
| POST | /auth/login | Entrar o continuar la verificación pendiente. |
| POST | /auth/logout | Cerrar la sesión actual. |
| POST | /auth/otp/resend | Reenviar OTP de una solicitud. |
| POST | /auth/password/forgot | Solicitar recuperación sin revelar existencia. |
| POST | /auth/password/reset | Confirmar OTP y nueva contraseña. |
| POST | /auth/google/start | Iniciar login, vinculación o confirmación con Google. |
| GET | /auth/google/callback | Validar retorno OAuth y volver a la aplicación. |
| GET / PATCH | /account/profile | Consultar o actualizar datos personales. |
| POST | /account/email/request | Pedir cambio de correo. |
| POST | /account/email/confirm | Verificar correo nuevo y rotar sesión. |
| POST | /account/password/request | Pedir cambio o creación de contraseña. |
| POST | /account/password/confirm | Confirmar código y contraseña. |
| POST | /account/google/unlink | Desvincular conservando otro acceso. |

## Producción y validación pendiente

Configura APP_URL con el origen HTTPS real y registra el retorno equivalente en Google. Si hay exactamente un proxy inverso de confianza, configura TRUST_PROXY=1 y evita exponer Nest directamente a clientes que puedan falsificar sus encabezados. No actives confianza de proxy en una instalación sin ese proxy.

La migración 002 se aplica al iniciar Nest y conserva los mensajes existentes, añadiendo su asociación opcional al usuario. No se aplicó a tu base durante esta tarea. Guarda copia de seguridad de los datos antes de una actualización de producción.

La revisión realizada fue estática, con ESLint y lectura de contratos y flujos. Quedan pendientes la compilación, migración real, pruebas, entrega SMTP, consentimiento y retorno OAuth, accesibilidad en navegador y presentación en escritorio/móvil. No se afirma que Google o los correos estén activos antes de completar las credenciales y comprobarlos en tu entorno.


## Foto de perfil

Tu foto permite subir, cambiar o quitar una imagen JPEG, PNG o WebP mediante el módulo de medios y sus límites actuales. PATCH /api/account/avatar solo vincula una imagen READY propia de finalidad avatar, o la retira con null. La foto de perfil es pública; no se utiliza como prueba de identidad. El cliente actualiza únicamente avatarId, conserva los demás datos del perfil y avisa a otras pestañas. El cambio no requiere OTP ni modifica contraseñas, sesiones o la vinculación de Google. Las fotos aparecen en el perfil, la entrada de cuenta y los mensajes del chat; otros lectores pueden necesitar recargar los mensajes ya mostrados para ver cambios recientes.
