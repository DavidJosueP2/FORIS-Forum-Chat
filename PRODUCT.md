# Foris

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Compartir preguntas, ideas y proyectos en publicaciones organizadas por tópicos, con respuestas que se pueden leer con calma. Mantener un chat global para conversar al instante, también como invitado.

## Users

Participantes de comunidades abiertas. Cualquiera puede leer el foro y enviar mensajes en el chat global; publicar o responder en el foro requiere una cuenta. La interfaz y los mensajes del sistema están en español.

## Capabilities and Constraints

- Foros de publicaciones con título, cuerpo y tópico. Los tópicos predeterminados son General, Tecnología, Aprendizaje, Creatividad y Proyectos.
- La navegación muestra Foros, Comunidades y Chat global en ese orden. Comunidades permite explorar espacios abiertos, crearlos con una cuenta, unirse, salir y guardar favoritas independientemente de la membresía.
- Cada comunidad tiene publicaciones asociadas. Sus miembros pueden publicar y responder; cualquiera puede leer. El creador pertenece a su comunidad y no puede abandonarla en esta etapa.
- Las preferencias por comunidad permiten recibir o silenciar avisos de nuevas publicaciones. El usuario confirmó notificaciones solo dentro de Foris, con bandeja privada y estado leído. No se notifica al autor su propia publicación ni se envían avisos a quien no pertenece a la comunidad.
- Inicio / con búsqueda, filtros por tópico o autor y paginación; /publicar para crear; /publicaciones/:postId para leer y responder. El foro no usa entrega en tiempo real.
- Los invitados solo leen el foro. La API exige una sesión vigente de una cuenta verificada para crear publicaciones o respuestas y asigna el autor desde esa sesión.
- El chat global se conserva en /chat con envío como invitado o miembro, historial y eventos en tiempo real. La petición más reciente del usuario mantiene expresamente esta participación anónima.
- Solo texto. Sin adjuntos, audio ni video.
- Nombre visible opcional para invitados. Una cuenta acredita acceso a un correo o identidad de Google, no el nombre real de una persona.
- Publicaciones, respuestas, cuentas e historial del chat persisten en PostgreSQL. Los reintentos de envío usan identificadores para evitar duplicados.
- API monolitica modular NestJS con adaptador Express, ejecutable localmente con Node.
- Un repositorio con npm workspaces: apps/api para NestJS, apps/web para React con Vite y packages/contracts para contratos publicos.
- El frontend React usa Tailwind CSS y shadcn/ui. El inicio abre el índice del foro, con acceso visible al chat global. El chat conserva nombre de invitado editable y borrador local. Los borradores del foro se guardan por cuenta y publicación en sessionStorage de la pestaña.
- Los estados de carga, historial vacío, reconexión y error muestran información real. No se incorporan conversaciones ni cifras de presencia ficticias. La presencia cuenta conexiones abiertas, no personas únicas.
- Servidor y cliente en TypeScript estricto. El backend se compila a apps/api/dist y el frontend a apps/web/dist.
- El acceso invitado se conserva. Se implementan registro nativo con OTP, acceso con contraseña o Google, sesiones y perfil. La entrega real de códigos y OAuth requieren completar SMTP y Google en el .env privado, según la guía de configuración.
- Una sola página /login concentra login, registro, verificación y recuperación. /profile permite editar datos personales, correo con verificación, contraseña y vinculación o desvinculación de Google.
- Google con correo confirmado por el proveedor no pide verificación local adicional. No se fusionan cuentas por coincidencia de correo ni se permite quitar el último método de acceso.
- Los OTP son aleatorios, de un solo uso y caducan a los diez minutos. Hay límite de intentos, pausa entre reenvíos y límites por correo y finalidad. Las sesiones se guardan en PostgreSQL y usan cookies HttpOnly.
- Docker para PostgreSQL y SonarQube; conservar el Dockerfile como alternativa.
- No ejecutar comandos Docker durante el desarrollo asistido. Entregar los comandos para ejecucion manual.
- Codigo y documentacion describen el producto directamente, sin etiquetas academicas.
- Calidad objetivo A en SonarQube; el resultado real depende del analisis, con B como minimo solicitado.

## Operating Context

El usuario confirma construccion directa de la interfaz, sin una maqueta previa. Las pruebas automatizadas no deben depender de iniciar Docker.

Por indicación del usuario, no compilar, ejecutar comprobaciones del compilador, iniciar servidores ni ejecutar pruebas durante este trabajo asistido. Se permite revisión estática con ESLint; la validación visual y en ejecución queda pendiente.

## Product Principles

- Leer, encontrar un tópico y abrir una publicación deben ser acciones directas.
- Distinguir las publicaciones del foro y la conversación del chat global, incluyendo sus permisos.
- Conservar el borrador cuando falla el envio.
- Diferenciar entrega al servidor de lectura por otra persona.
- Mostrar el estado real de la conexion y permitir recuperarse.
- Evitar contenido de ejemplo que parezca una conversacion real.

## Brand Commitments

- La aplicación se llama Foris.
- Axiforma para títulos; Plus Jakarta Sans para lectura y controles habituales; Fraunces para acentos serif; SF Pro Display como alternativa explícita de interfaz. Las cuatro familias se sirven desde archivos locales.
- Nueve personajes SVG originales, de formas suaves, ojos expresivos y colores sólidos. Acompañan bienvenida, estados vacíos y pequeñas ayudas sin reemplazar instrucciones, representar usuarios ni insinuar estados reales de conexión.
- Apariencia humana, sencilla y pensada para conversar; evitar composiciones que parezcan una plantilla generada.
- Colores solidos. Sin degradados, vidrio, fondos con tramas ni puntos decorativos.
- Pocas tarjetas: organizar el contenido mediante tipografia, espacio y superficies tonales.
- Las tarjetas y contenedores no llevan bordes decorativos ni contornos de colores. Los controles conservan una indicacion de foco visible para navegar con teclado.
- Los botones usan extremos completamente redondos como valor predeterminado, incluidos todos los tamaños de Button. Los contenedores y campos conservan su propia forma.
- La pantalla inicial abre las publicaciones sin una portada ni un registro obligatorio para leer. La entrada de cuenta dirige a /login o /profile según la sesión. El chat global permite escribir sin registro. La interfaz comunica las funciones no disponibles si falta configuración externa.
