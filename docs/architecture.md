# Arquitectura de Foris

Un repositorio npm workspaces contiene una API NestJS como monolito modular, un frontend React con Vite y los contratos públicos de TypeScript. El frontend tiene Tailwind CSS 4, el catálogo completo de shadcn/ui y una base de tema compartida. La página inicial abre directamente General, con historial, envío y recepción de mensajes como invitado. La API conserva el acceso de invitados y el protocolo HTTP existente.

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
      messages/
        dto/                Entradas y validación de mensajes e historial
        pipes/              Integración de la validación con Nest
        middleware/         Límite de envíos
        messages.controller.ts
        messages.service.ts
        messages.repository.ts
        messages.types.ts
        message-events.service.ts
  test/
    unit/
    integration/
    support/
packages/contracts/src/     Declaraciones públicas de mensajes y paginación
apps/web/src/              Frontend React y TypeScript
  features/chat/           Página General, componentes, estado, API y sesión invitada
  features/account/        Diálogo informativo sobre cuentas futuras
apps/web/public/           Archivos estáticos del frontend
scripts/                   Comandos del repositorio
```

Los comandos, ESLint y el lockfile se administran desde la raíz. El frontend anterior y sus herramientas de compilación ya se retiraron del repositorio.

## Base visual del frontend

Tailwind CSS se integra mediante el plugin de Vite. El alias `@/` apunta a `apps/web/src` tanto en Vite como en TypeScript. `apps/web/components.json` configura shadcn con Radix, el estilo nova, variables CSS y Lucide.

`src/components/ui` contiene los 63 archivos de componentes del catálogo instalado. Las utilidades y hooks de soporte permanecen en `src/lib` y `src/hooks`. Los componentes se importan directamente desde su módulo. `App.tsx` monta `ChatHome`, en `src/features/chat/components/chat-home.tsx`; no hay una galería intermedia.

`src/index.css` define colores semánticos, temas claro y oscuro, superficies sólidas, foco y movimiento reducido. `AppProviders` compone el proveedor de tema, los tooltips y Sonner. El tema respeta la preferencia del sistema, guarda la elección local y sincroniza otras pestañas.

`Button` usa extremos completamente redondos en todas sus variantes y tamaños, incluidos los de icono. `className` conserva la posibilidad de una sustitución deliberada. La política global elimina bordes y sombras de las primitivas y conserva el indicador de foco de teclado. Los campos y contenedores mantienen sus radios propios.

Las pautas de diseño están en [apps/web/DESIGN.md](../apps/web/DESIGN.md). Impeccable conserva su configuración y el catálogo visual de referencia en `apps/web/.impeccable`; esos dos archivos de configuración se versionan, mientras que informes y capturas quedan ignorados.

Las fuentes locales se declaran en `src/assets/fonts/fonts.css`. Tailwind expone `font-heading` (Axiforma), `font-sans` (Plus Jakarta Sans), `font-serif` (Fraunces) y `font-ui` (SF Pro Display). Los títulos usan Axiforma por defecto y el texto general usa Jakarta. Fraunces y SF Pro se aplican de forma explícita cuando el contenido lo necesita.

Los nueve SVG de identidad viven en `src/assets/characters`. `src/lib/foris-characters.ts` reúne sus rutas y emociones; `ForisCharacter` en `src/components/brand` permite elegirlos mediante `mood`. Son decorativos por defecto; una imagen que aporte significado necesita un `alt` contextual. Las pautas y ejemplos están en [docs/brand.md](brand.md).

Las variantes exportadas por shadcn y sus hooks públicos se permiten explícitamente en la regla de recarga de componentes de ESLint. Los demás componentes de aplicación mantienen la regla habitual. Los hooks de viewport y carrusel leen sus fuentes externas con `useSyncExternalStore`.

## Conversación General

`src/features/chat` separa los componentes de presentación, el hook `useChat`, el cliente HTTP y las utilidades de mensajes y sesión. `ChatHome` compone navegación lateral, encabezado con estado de conexión, `MessageFeed`, `MessageComposer` y las pautas de la comunidad. La navegación se oculta por debajo de 1024px; las pautas aparecen como columna desde 1360px y siguen disponibles mediante diálogo con menos espacio. El encabezado ofrece cambio de tema y entrada de cuenta.

`chat-api.ts` consulta `/api/messages` en páginas de 50 mensajes. La carga inicial obtiene el historial reciente; `before` recupera mensajes anteriores. `useChat` recibe los eventos SSE y consulta páginas con `after` al abrir o recuperar la conexión para completar mensajes perdidos. El cursor de sincronización avanza con las páginas consultadas, no con eventos nuevos. El cliente valida la forma de las respuestas y combina los mensajes por identificador. Los identificadores BIGINT permanecen como cadenas y se ordenan mediante `BigInt`, sin convertirlos a `Number`.

El envío usa POST con UUID de remitente y `requestId`. Reintentar el mismo cuerpo, autor y remitente conserva el `requestId` para aprovechar la idempotencia del servidor. El mensaje se incorpora al confirmar la respuesta; la recepción SSE se deduplica por identificador. La interfaz diferencia envío confirmado de lectura por otra persona: no muestra confirmaciones de lectura.

`guest-session.ts` conserva el perfil invitado y el borrador en almacenamiento local mediante accesos protegidos; si el navegador lo bloquea, la visita continúa en memoria. El nombre opcional usa «Invitado» por defecto, tiene un límite de 32 caracteres y no representa una identidad verificada. El texto admite hasta 2000 caracteres. Un envío fallido conserva el borrador; un envío confirmado solo lo limpia si el borrador actual todavía coincide con el cuerpo enviado. Enter añade una línea y Ctrl o ⌘ + Enter solicita el envío, respetando la composición de texto.

`MessageFeed` presenta carga, historial vacío confirmado, errores y paginación. El historial sigue el final si el lector permanece cerca de él o acaba de enviar un mensaje propio. Al cargar mensajes anteriores conserva un elemento DOM de un mensaje visible como ancla y tiene en cuenta el desplazamiento realizado durante la solicitud; así la inserción al principio no se confunde con mensajes recibidos al final. La acción «Volver al final» permite retomar la conversación. La sugerencia del estado vacío solo rellena el borrador y le da foco.

El estado de conexión distingue conectando, en directo, reconectando y sin conexión. La presencia recibida cuenta conexiones abiertas, no personas únicas. Los mensajes y las cifras proceden de la API; no hay conversación ni presencia de ejemplo. Sin conexión se puede seguir preparando el texto y solicitar una reconexión.

`src/features/account/components/account-dialog.tsx` informa que las cuentas y el acceso con Google llegarán próximamente. Google permanece deshabilitado y «Seguir como invitado» cierra el diálogo. Esta entrega no añade autenticación ni rutas de cuenta.

### Integración de modales y CSP

La CSP de producción conserva `style-src 'self'`. La dependencia de bloqueo de desplazamiento usada por los modales de Radix inyecta una etiqueta de estilo sin nonce, que esa política rechaza. La revisión estática no establece un fallo de la tarea modal: la gestión de foco y el aislamiento de la rueda son mecanismos separados. El efecto de ese rechazo sobre el bloqueo de desplazamiento queda pendiente de comprobar en un navegador con la CSP de producción. No se ha debilitado la política ni se afirma validación en ejecución.

## Responsabilidades y dependencias

El controlador transforma solicitudes HTTP en llamadas al servicio. Los pipes validan y normalizan las entradas. El servicio coordina el guardado y la publicación de eventos; el repositorio ejecuta SQL parametrizado y resuelve reintentos concurrentes. El servicio de eventos administra conexiones SSE, presencia, latidos y límites de conexiones.

La base de datos y la configuración son servicios compartidos de infraestructura. `health` consulta la base directamente y no depende del módulo de mensajes. `messages` usa infraestructura y contratos públicos; no depende de otro módulo de negocio. Los módulos futuros de usuarios y autenticación expondrán sus capacidades mediante proveedores exportados.

`common` contiene mecanismos HTTP reutilizables. Las reglas de mensajes pertenecen a `modules/messages`. Los tipos privados del repositorio permanecen en ese módulo. `@messages/contracts` contiene exclusivamente declaraciones públicas sin dependencias de Nest o PostgreSQL; todos sus consumidores usan `import type`.

## Contrato HTTP

| Método | Ruta | Comportamiento |
| --- | --- | --- |
| GET | `/api/health` | Comprueba PostgreSQL |
| GET | `/api/messages` | Historial con `before`, `after` y `limit` |
| POST | `/api/messages` | Guarda y publica texto; 201 al crear, 200 al reintentar |
| GET | `/api/events` | SSE con eventos `message` y `presence` |

Se conserva el límite de 2000 caracteres, el nombre opcional normalizado a Invitado, los identificadores BIGINT como cadenas y el formato de error `{ error: { code, message } }`. Un `requestId` reutilizado con otro contenido devuelve 409. Solo los envíos nuevos se publican a los clientes conectados.

El POST aplica validación de origen, límite por IP y parser JSON de 16 KB antes del controlador. Helmet protege tanto la API como los archivos públicos. La API sirve el frontend compilado desde `apps/web/dist`, nunca los archivos TypeScript fuente.

En desarrollo, Vite escucha en `127.0.0.1:5173` y reenvía `/api` a Nest en el puerto configurado por `APP_PORT` o `PORT`. El proxy conserva `Host` y `Origin` para mantener la política de origen de la API.

## Datos y ciclo de vida

Al inicializarse, la API adquiere una conexión y ejecuta las migraciones pendientes dentro de una transacción. Un bloqueo asesor de PostgreSQL serializa los cambios de esquema entre procesos. `app_schema_migrations` registra la versión aplicada. La primera migración crea o adopta la tabla `messages` existente conservando sus datos.

Al cerrar, el servicio de eventos termina las conexiones SSE antes de que Nest cierre el servidor HTTP. El pool PostgreSQL termina al concluir el cierre de la aplicación. Los errores de solicitudes muestran mensajes públicos y los registros omiten consultas y credenciales.

La entrega SSE actual funciona en una instancia. Un despliegue con varias instancias necesitará distribución de eventos y límites compartidos; esa ampliación pertenece a otra etapa.

## Configuración, herramientas y pruebas

La API carga el `.env` de la raíz; las variables ya definidas por el entorno tienen prioridad. Los manifiestos de los workspaces y el lockfile único se mantienen desde la raíz. Node 24.15+ de la rama 24 LTS es la versión recomendada para las dependencias de desarrollo.

ESLint es el analizador común para API y React, con reglas de hooks y recarga de componentes. TypeScript 6 se usa en ambos workspaces para mantener la compatibilidad con typescript-eslint.

Las pruebas del backend usan Node Test Runner; `@nestjs/testing` crea el módulo real y sustituye únicamente la configuración, el pool y las dependencias requeridas por cada caso. `pg-mem` evita conectarse a datos reales. La cobertura LCOV corresponde al backend. SonarQube analiza también el código del frontend; la interfaz nueva todavía no tiene pruebas propias.

| Comando desde la raíz | Función |
| --- | --- |
| `npm ci` | Instala todos los workspaces con el lockfile único |
| `npm run dev` | Inicia Nest y Vite bajo observación |
| `npm run dev:api` | Inicia únicamente Nest bajo observación |
| `npm run dev:web` | Inicia únicamente Vite |
| `npm run build` | Compila API y frontend |
| `npm start` | Compila y sirve la API junto al frontend compilado |
| `npm run lint` | Analiza estáticamente todo el código |
| `npm run typecheck` | Comprueba los tipos de ambos workspaces y scripts |
| `npm test` | Compila y ejecuta las pruebas del backend con cobertura |

El `.env` local, las dependencias instaladas, compilaciones e informes están excluidos de Git. `.env.example` contiene únicamente la plantilla de configuración y se conserva en el repositorio.

La página General y esta actualización se entregan con revisión estática, sin ejecutar compilaciones, comprobaciones del compilador, pruebas, servidores de desarrollo, Docker ni renderizados de navegador por indicación del usuario. La validación visual y en ejecución permanece pendiente.
