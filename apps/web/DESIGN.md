---
name: Foris
description: Conversación cercana, tipografía cálida y pequeños personajes expresivos.
colors:
  canvas: "#f7f7f2"
  ink: "#272b25"
  surface: "#eef0e8"
  popover: "#fcfcf8"
  primary: "#30362e"
  primary-hover: "#232820"
  secondary: "#e7eae1"
  secondary-hover: "#dce1d5"
  muted-text: "#5f6659"
  accent: "#e0e6d8"
  destructive: "#a13932"
  dark-canvas: "#181b16"
  dark-ink: "#eef0e8"
typography:
  title:
    fontFamily: "Axiforma, Plus Jakarta Sans, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
  heading:
    fontFamily: "Axiforma, Plus Jakarta Sans, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.03em"
  heading-compact:
    fontFamily: "Axiforma, Plus Jakarta Sans, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
  serif:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "2rem"
    fontWeight: 400
    lineHeight: 1.25
  ui:
    fontFamily: "SF Pro Display, Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  control: "10px"
  surface: "14px"
  button: "999px"
  composer: "24px"
  composer-compact: "20px"
  composer-inset: "4px"
spacing:
  small: "8px"
  base: "16px"
  large: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.popover}"
    rounded: "{rounded.button}"
    padding: "6px 10px"
    height: "32px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "6px 10px"
  input:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "4px 10px"
  message-composer:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.composer}"
    padding: "14px 16px 12px"
  surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "16px"
---

# Design System: Foris

## Overview

**Creative North Star: "Humano, sencillo y conversacional"**

Base visual de Foris para comunidades abiertas. La lectura manda; las formas suaves y los personajes aportan cercanía en momentos concretos. El contenido se organiza por tipografía, espacio y superficies sólidas. El inicio abre Foros con las publicaciones organizadas por tópico; Comunidades permite explorar espacios públicos y decidir cómo seguirlos. El chat global conserva la conversación inmediata y la escritura como invitado en /chat.

El nombre, las cuatro familias tipográficas y el lenguaje de personajes forman la identidad actual. La dirección del foro se recoge en .impeccable/forum-direction.md, la de comunidades en .impeccable/communities-direction.md, la del chat global en .impeccable/surfaces/apps-web-src-app-tsx.md y la de acceso y perfil en .impeccable/surfaces/apps-web-src-features-account-pages-login-page-tsx.md; las restricciones de estilo del usuario se conservan en el PRODUCT.md de la raíz.

**Key Characteristics:**

- Colores sólidos.
- Jerarquía por espacio y tipografía.
- Pocas tarjetas.
- Sin bordes decorativos.
- Botones con extremos completamente redondos.
- Foco de teclado visible.
- Personajes de formas suaves con emociones diferentes.

## Colors

Paleta de neutros cálidos con un matiz vegetal discreto. Los valores de la cabecera corresponden a los tokens de src/index.css; ese archivo contiene también sus equivalentes oscuros y estados funcionales.

Los personajes añaden turquesa, naranja, azul, salvia, dorado, lavanda, rosa, cacao y tinta. Estos colores pertenecen a los SVG de marca y no sustituyen los tokens semánticos de la interfaz. Una emoción o un color de personaje no implica un estado del usuario, del mensaje ni de la conexión.

La tinta y el color primario señalan texto y acciones. Las superficies cambian de tono para separar grupos. El color destructivo se reserva para errores y acciones destructivas. No usar el color para simular identidad verificada, presencia o mensajes que aún no existan.

## Typography

Las cuatro familias elegidas y facilitadas por el usuario se sirven desde src/assets/fonts mediante @font-face y font-display: swap, sin solicitudes a un servicio de tipografías externo. Los archivos originales y sus avisos se conservan. El navegador descarga una fuente cuando se utiliza; no se precarga el catálogo completo.

| Función | Familia | Clase Tailwind | Aplicación |
| --- | --- | --- | --- |
| Títulos | Axiforma | font-heading | Encabezados y nombre Foris; peso 600 habitual. |
| Texto sans serif | Plus Jakarta Sans | font-sans | Publicaciones, conversación, formularios y controles; 400 para texto y 500 para etiquetas. |
| Acento serif | Fraunces | font-serif | Frases editoriales o mensajes de bienvenida puntuales. |
| Alternativa de interfaz | SF Pro Display | font-ui | Controles de una superficie que elija expresamente esta variante. |

html y el texto general usan Jakarta. h1–h6 usan Axiforma por defecto; las utilidades de familia pueden sustituirla. Jakarta admite pesos variables de 200 a 800, y Fraunces de 100 a 900, en redonda y cursiva. Axiforma declara los pesos 100, 300, 400, 500, 600, 700, 800 y 900 en ambas variantes. SF Pro declara únicamente los pesos y estilos presentes: redonda 400/500/700 y cursiva 100/200/300/600/800/900. No depender de una variante ausente de SF Pro.

La escala usada en General corresponde a 12, 14, 16, 20, 24, 30 y 32 píxeles mediante rem. El texto de lectura parte de 1rem; el cuerpo de los mensajes usa interlineado 1.65 y un máximo de 70 caracteres de ancho. Las etiquetas usan el rol label y las horas, fechas, estados y ayudas el rol caption. General usa heading, con heading-compact en móvil; el nombre Foris usa title. La bienvenida usa Fraunces con el rol serif, reducido al tamaño de title en móvil. La serif es un acento, no una fuente para toda la conversación; SF Pro es una alternativa preparada, no una cuarta voz obligatoria en cada pantalla.

El foro reutiliza esta escala: títulos de página entre 1.875rem y 2rem, títulos de publicaciones en el índice a 1.5rem y a 1.25rem en móvil, y encabezados de sección a 1.25rem. Los metadatos y las ayudas usan 0.875rem; el cuerpo de publicaciones y respuestas conserva los saltos de línea, un máximo de 70ch e interlineado 1.9. Las comunidades y la bandeja reutilizan los títulos de fila de 1.5rem y 1.25rem en móvil; las descripciones conservan saltos de línea, hasta 70ch e interlineado 1.8. No añadir una escala tipográfica distinta para estas superficies.

Evitar texto principal en mayúsculas, espaciados exagerados o tipografía monoespaciada decorativa. La conversación tiene prioridad.

## Layout

Usar el ritmo de espaciado de Tailwind, con grupos próximos y separación clara entre tareas. El índice del foro en / organiza búsqueda, filtros por tópico y filas abiertas de publicaciones dentro de un máximo de 1040px. La cabecera compartida entre foro, comunidades y cuenta, con un máximo de 1280px, reúne Foris y los enlaces Foros, Comunidades y Chat global en ese orden; después ofrece notificaciones para la cuenta activa, tema y cuenta. /publicar y /publicaciones/:postId comparten un ancho máximo de 840px para el formulario o la lectura; las respuestas siguen una lista vertical. La estructura se sostiene con espacio y tipografía, sin tarjetas repetidas.

Por debajo de 1024px, la cabecera compartida pasa la navegación a una fila completa y permite que los enlaces se ajusten sin ocultarlos. Por debajo de 768px, la introducción y su acción se apilan y el contenido usa márgenes laterales de 20px. Los filtros por tópico se ajustan a varias líneas. Búsqueda, formularios y acciones conservan etiquetas visibles y controles de 44px o más. No trasladar al foro el desplazamiento interno ni el compositor fijo del chat.

/comunidades y /comunidades/:communityId reutilizan el ancho de 1040px. El directorio presenta búsqueda, filtros Explorar, Mis comunidades y Favoritas, y filas abiertas con descripción y recuentos reales; una acción explícita amplía la lista. El detalle coloca propósito, pertenencia, favorita y avisos antes de las publicaciones. /comunidades/crear usa el formulario abierto de 840px; /notificaciones mantiene una lista vertical con acciones de lectura. Las filas separan contenido con 28px de espacio vertical, reducidos a 24px por debajo de 768px. Las acciones se ajustan en varias líneas; las preferencias mantienen su texto junto al control.

El chat global en /chat conserva General: navegación lateral, encabezado, hilo y compositor al pie. La navegación ocupa 248px en escritorio. El hilo y el compositor comparten un máximo de 840px, con texto alineado y espacio suficiente para leer.

La navegación lateral se oculta por debajo de 1024px y el nombre Foris pasa al encabezado. Desde 1360px aparece una columna de pautas de 264px; con menos espacio se accede a esa información mediante un diálogo. Por debajo de 640px disminuyen los márgenes y se compactan el encabezado y el compositor. El hilo tiene su propio desplazamiento y el compositor reserva el área segura inferior del dispositivo. El punto móvil de las primitivas genéricas del catálogo sigue siendo 768px; no determina estos cambios de General. Las acciones principales de la pantalla usan una altura de al menos 44px, aun cuando el catálogo ofrezca tamaños menores.

Las páginas de cuenta extienden este sistema con formularios abiertos. El acceso comparte un máximo de 1280px entre una columna editorial y un formulario de hasta 400px. Por debajo de 768px se oculta la columna editorial y el formulario puede ocupar hasta 440px. El perfil tiene un máximo de 1040px y organiza cada tarea con una descripción lateral y sus campos; en móvil apila ambos grupos. No convertir sus secciones en una cuadrícula de tarjetas. AccountShell reutiliza ForumShell y su navegación completa, el enlace para saltar al contenido y ThemeToggle.

## Elevation & Depth

**Superficies.** Separar grupos mediante tono y espacio; evitar contornos y sombras.

No usar degradados, vidrio, fondos con tramas o puntos decorativos. Las capas modales son opacas; su contenido mantiene el cierre y la gestión de foco de las primitivas accesibles.

## Shapes

Los botones usan el token button para extremos completamente redondos; los tamaños de icono forman círculos cuando ancho y alto coinciden. Es el valor predeterminado de todas las variantes y tamaños de Button: default, xs, sm, lg, icon, icon-xs, icon-sm e icon-lg. className permite una sustitución deliberada cuando un patrón lo requiera.

Los campos conservan control y las superficies excepcionales conservan surface. El compositor es una forma de control específica: composer en escritorio, composer-compact en móvil y composer-inset para el área de texto interior. Estos radios no cambian las esquinas de tarjetas ni contenedores generales. Evitar convertir contenedores grandes en píldoras. Las tarjetas no llevan contornos ni sombras.

## Components

**Tema compacto.** Una sola fila con la etiqueta Tema y una píldora de tres iconos: luna para oscuro, sol para claro y pantalla para sistema. El color de selección identifica la opción activa, sin tres filas de texto ni marcas adicionales. Cada opción conserva un objetivo de 44px, nombre accesible y ayuda nativa; las flechas izquierda y derecha permiten elegir dentro del grupo. Cambiar el tema mantiene abierto el menú. Se comparte entre cuenta e invitados y conserva los tokens existentes.

El catálogo de shadcn está en src/components/ui. Se instaló el conjunto completo disponible del estilo radix-nova; incluir un componente en el repositorio no obliga a usarlo en la pantalla.

Los estilos comunes se centralizan en src/index.css para que las primitivas conserven comportamiento y semántica. Los campos usan relleno sólido; los estados inválidos usan una superficie diferenciada. La variante outline de Button funciona como un secundario relleno, sin dibujar un contorno.

**Botones.** Primario sólido para enviar y acciones principales; secundario tonal para recuperación y sugerencias; ghost para utilidades y el nombre de invitado. Todos parten de la forma de píldora. La política global elimina bordes y sombras de las primitivas sin eliminar el foco de teclado. Mantener los estados deshabilitado, enviando y reintento con texto comprensible.

**Publicaciones.** ForumShell reúne la navegación principal y los accesos de tema y cuenta; forum.css aplica los tokens compartidos sin otra paleta, tipografía ni sistema de formas. ForumPage presenta búsqueda de título o cuerpo, filtros por tópico o autor y filas con tópico, autor, fecha, título, extracto y número real de respuestas. Los tópicos son General, Tecnología, Aprendizaje, Creatividad y Proyectos; son filtros, no comunidades creadas por usuarios. Las páginas de 20 elementos se ordenan de más recientes a anteriores y se amplían con una acción explícita. El foro no incorpora SSE ni sondeo periódico.

**Crear y responder.** CreatePostPage usa tópico, título de hasta 160 caracteres y cuerpo de hasta 10000; PostPage conserva el texto literal y presenta respuestas de hasta 5000 caracteres. React muestra el texto sin interpretar HTML ni Markdown. ParticipationGate permite leer sin cuenta y explica que publicar o responder requiere una sesión vigente de una cuenta verificada, requisito que también impone la API. El enlace de acceso conserva la publicación o tarea de retorno; el chat global sigue al alcance para escribir como invitado. Los borradores del foro se guardan en sessionStorage de la pestaña por cuenta y, en respuestas, por publicación. Un fallo conserva el texto y permite reintentar; un fallo del almacenamiento se comunica con una ayuda visible.

**Estados del foro.** Carga, errores con reintento, tópico o búsqueda sin resultados, publicación inexistente y ausencia de respuestas tienen texto específico. ForumEmpty usa Lupa únicamente después de resolver una colección vacía. El bloque de acceso usa una superficie tonal con el radio surface; no convierte cada publicación o respuesta en tarjeta. Ningún estado vacío introduce publicaciones, autores o recuentos ficticios.

**Comunidades.** communities.css extiende las listas, formularios y estados del foro con los mismos tokens. El directorio distingue pertenencia de favorita: el texto indica «Formas parte» o «La creaste tú», mientras la estrella identifica una favorita. En el detalle, guardar favorita usa un botón con aria-pressed y no implica unirse. Unirse activa los avisos dentro de Foris; la ayuda lo explica antes de la acción. Los miembros pueden silenciarlos mediante un checkbox con etiqueta y descripción visibles. Salir conserva la favorita y detiene los avisos futuros; el creador conserva su pertenencia. Cada cambio muestra confirmación o error junto a los controles y bloquea envíos simultáneos.

La lectura de comunidades y sus publicaciones es pública. Crear, unirse, guardar favoritas y configurar avisos exige cuenta verificada; escribir o responder en una comunidad exige además pertenencia. CommunityWritingGate explica ese paso y conserva el destino de acceso. Crear una comunidad es una página dedicada; sus borradores y los de publicaciones se separan por cuenta y comunidad cuando corresponde. Los estados vacíos reutilizan Lupa y texto específico, sin miembros ni publicaciones ficticios.

**Bandeja de avisos.** NotificationEntry aparece solo con cuenta activa y enlaza a /notificaciones. La campana conserva nombre accesible y muestra el recuento sin leer, abreviado visualmente a 99+ si procede. La bandeja privada usa filas abiertas con comunidad, publicación, fecha y estado de lectura; el texto y el peso tipográfico distinguen leído de pendiente. Permite abrir la publicación, marcar un aviso, marcar todos hasta el ID más reciente cargado y actualizar. El corte de lectura conserva los avisos posteriores sin leer. Son avisos dentro de Foris, sin correo ni permisos del navegador. El contador se refresca al montar, recuperar foco, volver a una pestaña visible y confirmar una lectura; no representa entrega en tiempo real. Los permisos y el contrato se detallan en [docs/communities.md](../../docs/communities.md).

**Chat global.** ChatHome conserva la conversación General en /chat con participación de invitados y miembros. Compone navegación, estado de conexión, MessageFeed y MessageComposer. Los mensajes forman una lista lineal con autor, condición de miembro o invitado, hora y separadores de día. La condición de miembro depende de accountId asignado por el servidor; acredita acceso a una cuenta, no el nombre real de una persona. El estado propio se indica con «Tú» y la condición correspondiente. La bienvenida con Mimo aparece únicamente después de confirmar un historial vacío; sus sugerencias rellenan el borrador editable y no lo envían. Carga, error de historial, reconexión y falta de conexión tienen estados explícitos. El contador representa conexiones abiertas, no personas únicas; no se añaden conversaciones ni presencia ficticias.

**Compositor.** Texto de hasta 2000 caracteres, nombre de invitado editable de hasta 32 y aviso de publicación pública. Para una cuenta muestra el nombre del perfil con acceso a /profile y la condición «Miembro». El envío espera a resolver la identidad sin impedir preparar el borrador. Enter conserva el salto de línea; Ctrl o ⌘ + Enter envía. El borrador se conserva tras un fallo y solo se limpia al confirmar el envío si aún coincide con el texto enviado. El hilo sigue el final cuando corresponde y ofrece «Volver al final» al leer mensajes anteriores; cargar historial conserva una referencia al mensaje visible para mantener la posición de lectura.

**Cuenta.** AccountEntry ofrece Entrar a invitados y abre un menú desde Tu perfil para una cuenta activa. El menú reúne Ver tu perfil, las opciones Predeterminado del sistema, Claro y Oscuro, y Cerrar sesión. Los temas forman un grupo de selección única con indicador visible; los elementos tienen un mínimo de 44px y forma de píldora. El cierre de sesión muestra progreso y conserva el menú con un error que permite reintentar si falla. Se reutiliza la sesión del servidor. /login concentra inicio de sesión, registro, recuperación y confirmación OTP. El registro con contraseña confirma el correo antes de abrir una sesión; Google aprovecha el correo confirmado por el proveedor. La disponibilidad se obtiene de la API: una función sin configuración externa muestra una explicación y mantiene al alcance la lectura de Foros y Comunidades y el chat global como invitado. La guía técnica y de configuración está en [docs/authentication.md](../../docs/authentication.md).

El perfil separa datos personales, correo, contraseña y Google mediante títulos, espacio y ayudas breves. Nombre visible, nombres, apellidos y presentación se guardan como datos personales; el correo tiene su propia confirmación de identidad y código enviado a la dirección nueva. La contraseña y la vinculación o desvinculación de Google expresan sus requisitos junto a la acción y conservan un método de acceso. No presentar un nombre visible como identidad real verificada.

Los formularios conservan etiquetas visibles, campos sólidos, acciones de al menos 44px y errores junto a la tarea. El OTP usa un único campo de seis dígitos con autocompletado, plazo visible y reenvío explícito; la caducidad y los límites proceden de la API. Los estados ocupado, confirmación y fallo se explican con texto. Mimo acompaña la columna editorial del acceso en escritorio; no se añaden personajes por campo ni modales nuevos en estas páginas.

**Interacción.** Conservar foco, selección y estados funcionales aunque el aspecto sea plano.

El foco usa un trazo de 2px separado 3px del control. Es un indicador funcional de teclado, no una decoración. Conservar también los indicadores de checkbox, radio, carga y selección; la restricción de puntos se refiere a adornos.

AppProviders configura tema claro, oscuro o del sistema, sesión de cuenta, tooltips y notificaciones. El tema inicial sigue al sistema cuando no existe una preferencia guardada; una elección explícita se conserva y se sincroniza entre pestañas. ThemeMenuOptions comparte las tres opciones entre el menú de cuenta y ThemeToggle, disponible para invitados. Para miembros se elimina el botón de tema separado de la cabecera. Los menús shadcn se abren sin modalidad ni bloqueo de desplazamiento y conservan navegación de teclado, selección y cierre de Radix. useTheme permite cambiar la preferencia. Las etiquetas comunes predeterminadas están en español. La base respeta movimiento reducido. RouteFocus lleva el foco al contenido al cambiar de página; el detalle permite abrir las respuestas o la tarea de responder mediante sus anclas.

**Personajes de Foris.** Nueve SVG originales en src/assets/characters, con fondo transparente, colores sólidos y una pareja de ojos expresivos. Comparten un lienzo de 160 × 160 y márgenes internos; cambian la silueta, la postura y la mirada. No llevan contornos, sombras, degradados ni animaciones automáticas.

ForisCharacter recibe mood y permite controlar el tamaño. Su alt vacío predeterminado evita repetir información al lector de pantalla; si el personaje comunica algo que no está escrito al lado, darle un alt contextual. Un personaje acompaña bienvenida, estados vacíos o ayudas puntuales; no sustituye instrucciones, iconos funcionales ni avatares de personas. Usar uno por momento, sin llenar la página de adornos. El catálogo y ejemplos están en docs/brand.md, en la raíz del repositorio.

El tema propio actualiza la clase del documento sin inyectar un script de arranque inline. No modificar la CSP del backend para configurar los componentes. Las integraciones que generen estilos dinámicos requieren su revisión al usarse en una pantalla real.

## Do's and Don'ts

### Do

- **Do** usar colores semánticos y superficies sólidas.
- **Do** conservar foco visible y estados accesibles.
- **Do** priorizar la lectura de publicaciones y conversaciones, con permisos claros para cada superficie.
- **Do** usar un personaje cuando aporte cercanía o contexto.

### Don't

- **Don't** usar degradados, vidrio ni puntos decorativos.
- **Don't** construir la página como una cuadrícula de tarjetas.
- **Don't** añadir bordes de colores ni contornos decorativos.
- **Don't** usar personajes como identidades verificadas ni como señales de conexión real.
