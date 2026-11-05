# Mensajes

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Enviar y recibir mensajes de texto al instante en una unica sala General, sin cuentas ni inicio de sesion.

## Users

Participantes de comunidades abiertas que quieren abrir la aplicacion y escribir inmediatamente. La interfaz y los mensajes del sistema estan en espanol.

## Capabilities and Constraints

- Una sola sala General compartida, confirmada por el usuario.
- Solo texto. Sin adjuntos, audio ni video.
- Nombre visible opcional; los nombres no son identidades verificadas.
- Historial persistente en PostgreSQL y entrega en tiempo real.
- API monolitica modular NestJS con adaptador Express, ejecutable localmente con Node.
- Un repositorio con npm workspaces: apps/api para NestJS, apps/web para React con Vite y packages/contracts para contratos publicos.
- El frontend React esta inicializado con su plantilla; la interfaz de mensajeria y shadcn se incorporaran posteriormente. El frontend anterior ya se retiro del repositorio.
- Servidor y cliente en TypeScript estricto. El backend se compila a apps/api/dist y el frontend a apps/web/dist.
- El acceso anonimo se conserva. Cuentas e inicio de sesion con Google son una evolucion prevista; aun no estan implementados.
- Docker para PostgreSQL y SonarQube; conservar el Dockerfile como alternativa.
- No ejecutar comandos Docker durante el desarrollo asistido. Entregar los comandos para ejecucion manual.
- Codigo y documentacion describen el producto directamente, sin etiquetas academicas.
- Calidad objetivo A en SonarQube; el resultado real depende del analisis, con B como minimo solicitado.

## Operating Context

El usuario confirma construccion directa de la interfaz, sin una maqueta previa. Las pruebas automatizadas no deben depender de iniciar Docker.

## Product Principles

- Escribir debe ser la accion mas directa.
- Conservar el borrador cuando falla el envio.
- Diferenciar entrega al servidor de lectura por otra persona.
- Mostrar el estado real de la conexion y permitir recuperarse.
- Evitar contenido de ejemplo que parezca una conversacion real.
