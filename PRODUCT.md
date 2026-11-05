# Foris

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Enviar y recibir mensajes de texto al instante en una única sala General, con entrada directa como invitado y sin exigir una cuenta.

## Users

Participantes de comunidades abiertas que quieren abrir la aplicacion y escribir inmediatamente. La interfaz y los mensajes del sistema estan en espanol.

## Capabilities and Constraints

- Una sola sala General compartida, confirmada por el usuario.
- Solo texto. Sin adjuntos, audio ni video.
- Nombre visible opcional para invitados. Una cuenta acredita acceso a un correo o identidad de Google, no el nombre real de una persona.
- Historial persistente en PostgreSQL y entrega en tiempo real.
- API monolitica modular NestJS con adaptador Express, ejecutable localmente con Node.
- Un repositorio con npm workspaces: apps/api para NestJS, apps/web para React con Vite y packages/contracts para contratos publicos.
- El frontend React usa Tailwind CSS y shadcn/ui. La página de inicio abre directamente General con historial paginado, envío de texto, recepción en tiempo real, nombre de invitado editable y borrador local.
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

- Escribir debe ser la accion mas directa.
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
- La pantalla inicial abre General sin una portada ni un registro obligatorio. La entrada de cuenta dirige a /login o /profile según la sesión. La interfaz distingue miembros autenticados por el servidor de invitados y comunica las funciones no disponibles si falta configuración externa.
