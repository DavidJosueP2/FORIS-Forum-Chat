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
  canvas-tag-background: "#c5eee6"
  canvas-tag-foreground: "#134e46"
  canvas-tag-hover: "#afe4da"
  dark-canvas-tag-background: "#164e46"
  dark-canvas-tag-foreground: "#c5eee6"
  dark-canvas-tag-hover: "#21685c"
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
  discovery-title:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  discovery-title-compact:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "-0.02em"
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
  discovery-search:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "0 4px 0 14px"
    height: "44px"
  discovery-post-title:
    textColor: "{colors.ink}"
    typography: "{typography.discovery-title}"
  discovery-tag:
    backgroundColor: "{colors.canvas-tag-background}"
    textColor: "{colors.canvas-tag-foreground}"
    rounded: "{rounded.button}"
    padding: "8px 14px"
    height: "44px"
  canvas-tag:
    backgroundColor: "{colors.canvas-tag-background}"
    textColor: "{colors.canvas-tag-foreground}"
    rounded: "{rounded.button}"
  canvas-tag-hover:
    backgroundColor: "{colors.canvas-tag-hover}"
    textColor: "{colors.canvas-tag-foreground}"
  canvas-tag-dark:
    backgroundColor: "{colors.dark-canvas-tag-background}"
    textColor: "{colors.dark-canvas-tag-foreground}"
    rounded: "{rounded.button}"
  canvas-tag-dark-hover:
    backgroundColor: "{colors.dark-canvas-tag-hover}"
    textColor: "{colors.dark-canvas-tag-foreground}"
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

Base visual de Foris para conversar en comunidades públicas o privadas. La lectura manda; las formas suaves y los personajes aportan cercanía en momentos concretos. El contenido se organiza por tipografía, espacio y superficies sólidas. El inicio abre directamente un flujo de publicaciones con títulos Fraunces, imágenes disponibles y exploración por temáticas jerárquicas y etiquetas; Comunidades permite explorar espacios públicos y acceder a los privados de los que se forma parte. El chat global conserva la conversación inmediata y la escritura como invitado en /chat.

El nombre, las cuatro familias tipográficas y el lenguaje de personajes forman la identidad actual. La dirección del inicio se recoge en .impeccable/surfaces/src-features-forum-pages-forum-page-tsx.md; sustituye la composición inicial descrita en .impeccable/forum-direction.md y conserva sus pautas para las demás páginas del foro. La dirección de comunidades está en .impeccable/communities-direction.md y su extensión de privacidad y fotos en .impeccable/communities-privacy-direction.md, la del chat global en .impeccable/surfaces/apps-web-src-app-tsx.md, la de acceso y perfil en .impeccable/surfaces/apps-web-src-features-account-pages-login-page-tsx.md y la del lienzo en .impeccable/surfaces/src-features-forum-pages-create-post-page-tsx.md; las restricciones de estilo del usuario se conservan en el PRODUCT.md de la raíz.

**Key Characteristics:**

- Colores sólidos.
- Jerarquía por espacio y tipografía.
- Pocas tarjetas.
- Sin bordes decorativos.
- Botones con extremos completamente redondos.
- Foco de teclado visible.
- Personajes de formas suaves con emociones diferentes.

## Colors

Paleta de neutros cálidos con un matiz vegetal discreto. Los valores generales de la cabecera corresponden a los tokens de src/index.css; ese archivo contiene también sus equivalentes oscuros y estados funcionales. Los tokens canvas-tag y dark-canvas-tag proceden de src/features/forum/editor/canvas.css. El inicio reutiliza sus mismos valores mediante los tokens locales discovery-tag de src/features/forum/discovery/discovery.css para etiquetas de lectura y filtros seleccionados; no incorpora otra paleta.

El turquesa aprobado distingue esos chips en ambos temas: fondo suave, texto contrastado y un tono de interacción para quitar una selección o abrir una etiqueta del inicio. Es un papel de color local; conserva los neutros de las demás acciones y no sustituye secondary ni su variante oscura. Las comprobaciones de contraste de los pares declarados son 7.59:1 en claro y 7.57:1 en oscuro; el fondo de interacción mantiene 6.77:1 y 5.23:1, respectivamente. Son cálculos de colores de fuente, sin validación visual en navegador.

Los personajes añaden turquesa, naranja, azul, salvia, dorado, lavanda, rosa, cacao y tinta. Estos colores pertenecen a los SVG de marca y no sustituyen los tokens semánticos de la interfaz. Una emoción o un color de personaje no implica un estado del usuario, del mensaje ni de la conexión.

La tinta y el color primario señalan texto y acciones. Las superficies cambian de tono para separar grupos. El color destructivo se reserva para errores y acciones destructivas. No usar el color para simular identidad verificada, presencia o mensajes que aún no existan.

## Typography

Las cuatro familias elegidas y facilitadas por el usuario se sirven desde src/assets/fonts mediante @font-face y font-display: swap, sin solicitudes a un servicio de tipografías externo. Los archivos originales y sus avisos se conservan. El navegador descarga una fuente cuando se utiliza; no se precarga el catálogo completo.

| Función | Familia | Clase Tailwind | Aplicación |
| --- | --- | --- | --- |
| Títulos | Axiforma | font-heading | Encabezados y nombre Foris; peso 600 habitual. |
| Texto sans serif | Plus Jakarta Sans | font-sans | Publicaciones, conversación, formularios y controles; 400 para texto y 500 para etiquetas. |
| Lectura editorial y acento serif | Fraunces | font-serif | Títulos de las publicaciones del inicio, frases editoriales y mensajes de bienvenida puntuales. |
| Alternativa de interfaz | SF Pro Display | font-ui | Controles de una superficie que elija expresamente esta variante. |

html y el texto general usan Jakarta. h1–h6 usan Axiforma por defecto; las utilidades de familia pueden sustituirla. Jakarta admite pesos variables de 200 a 800, y Fraunces de 100 a 900, en redonda y cursiva. Axiforma declara los pesos 100, 300, 400, 500, 600, 700, 800 y 900 en ambas variantes. SF Pro declara únicamente los pesos y estilos presentes: redonda 400/500/700 y cursiva 100/200/300/600/800/900. No depender de una variante ausente de SF Pro.

La escala usada en General corresponde a 12, 14, 16, 20, 24, 30 y 32 píxeles mediante rem. El texto de lectura parte de 1rem; el cuerpo de los mensajes usa interlineado 1.65 y un máximo de 70 caracteres de ancho. Las etiquetas usan el rol label y las horas, fechas, estados y ayudas el rol caption. General usa heading, con heading-compact en móvil; el nombre Foris usa title. La bienvenida usa Fraunces con el rol serif, reducido al tamaño de title en móvil. La serif también conduce los títulos del inicio; el texto de lectura y los controles conservan Jakarta. SF Pro es una alternativa preparada, no una cuarta voz obligatoria en cada pantalla.

El foro reutiliza esta escala: títulos de página entre 1.875rem y 2rem y encabezados de sección a 1.25rem. El inicio usa discovery-title para los títulos de publicaciones y discovery-title-compact por debajo de 768px: Fraunces con peso 500 y espaciado ligeramente cerrado. Sus extractos usan cuerpo de 1rem, interlineado 1.8 y hasta 70ch, con un máximo de cinco líneas visibles en escritorio y cuatro en móvil. Autor, comunidad y controles usan label; la fecha usa caption y el encabezado Recientes o Resultados usa Jakarta a 1rem y peso 600. La lista conservada dentro de las comunidades mantiene títulos Axiforma de 1.5rem y 1.25rem en móvil.

Los metadatos y las ayudas habituales del foro usan 0.875rem; las publicaciones anteriores de texto y las respuestas conservan los saltos de línea, un máximo de 70ch e interlineado 1.9. El documento enriquecido conserva ese interlineado y un ancho de hasta 72ch, con encabezados, listas, tablas y pies de imagen que comparten la escala. En el lienzo, Crear publicación usa el encabezado compacto; el título editable usa 2rem, reducido a 1.5rem en móvil, y el estado del borrador usa caption. El código emplea la familia monoespaciada del sistema solo para contenido técnico. Las comunidades y la bandeja reutilizan los títulos de fila de 1.5rem y 1.25rem en móvil; las descripciones conservan saltos de línea, hasta 70ch e interlineado 1.8. No añadir una escala tipográfica distinta para estas superficies.

Evitar texto principal en mayúsculas, espaciados exagerados o tipografía monoespaciada decorativa. La conversación tiene prioridad.

## Layout

Usar el ritmo de espaciado de Tailwind, con grupos próximos y separación clara entre tareas. El inicio / abre artículos de publicaciones dentro de un máximo de 1200px, con una columna Explorar de 220px y un flujo de hasta 760px separados por 48px. Por debajo de 1180px, la columna lateral pasa a 200px y la separación a 32px; por debajo de 900px, desaparece y Filtrar abre un Sheet lateral con el mismo catálogo. Los artículos se separan con espacio, sin fondos de tarjeta ni contornos. Las imágenes reservan su proporción y una altura entre 160px y 480px, con radio surface y ajuste contain durante la lectura; carga, autorización y error usan el mismo espacio.

La cabecera compartida entre foro, comunidades y cuenta, con un máximo de 1280px, reúne Foris y los enlaces Foros, Comunidades y Chat global en ese orden; después ofrece notificaciones para la cuenta activa, tema y cuenta. Solo en el inicio, ForumShell añade la búsqueda automática y Crear publicación mediante su espacio discovery y mantiene la cabecera sticky. Por debajo de 1180px, esas herramientas ocupan una fila completa; por debajo de 768px, la navegación pasa a un menú accesible y la acción se abrevia a Crear conservando su nombre accesible. Los destinos de foco y el enlace Ir al contenido compensan la altura medida de la cabecera, con valores responsive de respaldo.

/publicaciones/:postId conserva un ancho máximo de 840px para la lectura y una lista vertical de respuestas. /publicar y /publicaciones/:postId/editar amplían el espacio hasta 1040px: Volver se alinea con un título de tarea pequeño y Vista previa y Publicar o Guardar cambios quedan a la derecha; debajo aparecen el estado discreto del borrador, el título editable y el contenido. La comunidad, la temática y las etiquetas se muestran al final; la comunidad permanece fija al editar. La estructura se sostiene con espacio y tipografía, sin tarjetas repetidas.

En los demás contextos, por debajo de 1024px la cabecera compartida pasa la navegación a una fila completa y permite que los enlaces se ajusten sin ocultarlos. Por debajo de 768px, sus introducciones y acciones se apilan y el contenido usa márgenes laterales de 20px. El inicio mantiene esos márgenes de 20px en móvil, pero entra directamente al flujo sin una introducción. Búsqueda, formularios y acciones conservan nombres accesibles y controles de 44px o más; los formularios mantienen etiquetas visibles. No trasladar al foro el desplazamiento interno ni el compositor fijo del chat.

El lienzo abre directamente la escritura, sin portada introductoria ni clasificación obligatoria. Su barra de herramientas compacta usa una superficie sólida y permanece junto al contenido al desplazar la página. En móvil, las acciones pasan a una fila completa, las herramientas se ajustan en varias líneas y las opciones finales se apilan cuando falta espacio; conservan áreas de al menos 44px. Las tablas disponen de desplazamiento horizontal dentro del documento.

/comunidades y /comunidades/:communityId reutilizan el ancho de 1040px. El directorio presenta búsqueda, filtros Explorar, Mis comunidades y Favoritas, y filas abiertas con descripción y recuentos reales; una acción explícita amplía la lista. El detalle coloca propósito, pertenencia, favorita y avisos antes de las publicaciones. /comunidades/crear usa el formulario abierto de 840px; /notificaciones mantiene una lista vertical con acciones de lectura. Las filas separan contenido con 28px de espacio vertical, reducidos a 24px por debajo de 768px. Las acciones se ajustan en varias líneas; las preferencias mantienen su texto junto al control.

La creación de comunidad reúne imagen opcional, nombre, descripción y selector de acceso en ese formulario. Los caracteres restantes viven dentro de los campos y mantienen espacio propio; en móvil los controles se apilan con sus áreas táctiles. El detalle integra la imagen con el nombre y la condición privada cuando corresponde. La administración del creador se despliega bajo su acción y la página /invitaciones/:token presenta una sola tarea de entrada, con fecha y resultado reales.

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

En modo claro, los menús de cuenta y tema usan el gris suave de secondary, como el botón Tu perfil, con texto oscuro. La píldora del selector y las opciones enfocadas usan el blanco de popover para contrastar; la selección conserva el círculo oscuro y su icono claro. En modo oscuro se usan los tonos oscuros habituales del sistema. La separación se consigue con color sólido, sin bordes ni sombras.

El catálogo de shadcn está en src/components/ui. Se instaló el conjunto completo disponible del estilo radix-nova; incluir un componente en el repositorio no obliga a usarlo en la pantalla.

Los estilos comunes se centralizan en src/index.css para que las primitivas conserven comportamiento y semántica. Los campos usan relleno sólido; los estados inválidos usan una superficie diferenciada. La variante outline de Button funciona como un secundario relleno, sin dibujar un contorno.

**Botones.** Primario sólido para enviar y acciones principales; secundario tonal para recuperación y sugerencias; ghost para utilidades y el nombre de invitado. Todos parten de la forma de píldora. La política global elimina bordes y sombras de las primitivas sin eliminar el foco de teclado. Mantener los estados deshabilitado, enviando y reintento con texto comprensible.

**Publicaciones.** ForumShell reúne la navegación principal y los accesos de tema y cuenta; forum.css aplica los tokens compartidos sin otra paleta ni sistema de formas. ForumPage compone DiscoverySearch, DiscoveryFilters, MobileDiscoveryFilters, ActiveDiscoveryFilters y DiscoveryFeed desde features/forum/discovery. El inicio presenta artículos abiertos con avatar disponible de 36px, autor, comunidad cuando corresponde, fecha, título Fraunces, extracto de hasta 420 caracteres y primera imagen disponible. La temática y las etiquetas son enlaces de exploración. Responder o el recuento real de respuestas abre el destino correspondiente; Leer publicación abre el detalle y Copiar enlace confirma el resultado o presenta un campo de copia manual. Las fotos conservan permisos temporales y se solicitan al acercarse al área visible; las publicaciones con varias imágenes ofrecen acceso al conjunto. No se añaden votos, ranking ni presencia.

**Descubrimiento.** La búsqueda de título o cuerpo vive en la cabecera: espera 350ms de pausa, respeta IME, valida hasta 120 caracteres y actualiza la URL con replace. Buscar o cambiar filtros conserva el foco del control; los enlaces de autor, temática y etiqueta llevan el foco al encabezado del flujo. Explorar permite buscar una temática, abrir sus subniveles y elegir cualquier nivel con sus descendientes. Las etiquetas se combinan hasta ocho con condición de coincidencia de todas; los filtros activos se retiran individualmente o juntos. Quitar filtros cancela también el texto de búsqueda pendiente. En móvil, Sheet conserva el foco dentro del panel y Ver publicaciones devuelve al flujo después de cambiar la consulta. Carga, vacío, error y reintento proceden del resultado real; las peticiones anteriores se abortan y sus respuestas se descartan al cambiar de consulta. Los enlaces antiguos topico siguen siendo compatibles, pero las cinco raíces ya no son una fila fija de filtros. Las páginas de 20 elementos se ordenan de más recientes a anteriores y se amplían con una acción explícita. El contrato completo y los límites de verificación están en [docs/discovery.md](../../docs/discovery.md).

La lista anterior se conserva en components/post-list.tsx para las publicaciones de comunidades, con su presentación existente. El foro no incorpora SSE ni sondeo periódico. El inicio no altera el detalle, el lienzo, la edición, el chat, las cuentas ni los permisos.

**Crear, editar y responder.** CreatePostPage y EditPostPage cargan el mismo lienzo enriquecido bajo demanda y mantienen título y escritura como tarea principal. La barra agrupa formato, encabezados, listas y tareas, citas, código, enlaces HTTP(S), alineación, tablas, imágenes y deshacer o rehacer. Los controles reutilizan botones píldora, menús opacos y foco del sistema; la selección de herramientas usa los tonos semánticos existentes. Vista previa muestra el mismo documento que la lectura y permite volver al lienzo. El lienzo no muestra contadores ni limita la escritura con un corte automático: al superar los 160 caracteres del título o los 10000 del texto aparece el error junto al contenido afectado y se exige corregirlo para publicar o guardar. Durante el envío se bloquean la edición y las opciones para conservar el contenido enviado.

Las imágenes se insertan donde se escribe y conservan descripción alternativa y pie. Elegir archivos, pegar o arrastrar comparte progreso, verificación, cancelación y reintento reales; una subida pendiente o fallida exige resolverla antes de publicar. Quitar o arrastrar una imagen actúa sobre su bloque. La descripción y el pie se despliegan junto a ella y solo muestran errores al superar sus límites. El documento usa listas, citas y tablas mediante espacio y superficies tonales; los indicadores de selección y foco tienen una función de edición. La lectura conserva el formato con elementos React, sin ejecutar HTML del autor. Las publicaciones anteriores siguen usando texto literal e imágenes; las respuestas continúan como texto de hasta 5000 caracteres.

Comunidad, temática jerárquica y etiquetas son opciones al final del lienzo. Sus selectores permiten buscar, explorar niveles y quitar selecciones; la comunidad ofrece los espacios de los que se forma parte y expresa si la publicación será pública o seguirá el acceso de esa comunidad. Al crear, el botón vacío dice «Seleccionar comunidad»; dentro del selector, «Sin comunidad» permite elegir una publicación pública general. Al editar, el destino se muestra como texto fijo con su icono. ParticipationGate permite leer sin cuenta y explica que publicar, editar o responder requiere una sesión vigente de una cuenta verificada, requisito que también impone la API. El enlace de acceso conserva la publicación o tarea de retorno; el chat global sigue al alcance para escribir como invitado.

**Etiquetas del lienzo y del inicio.** Los chips seleccionados del lienzo usan los tokens turquesa canvas-tag en ambos temas, con forma de píldora, texto de 0.875rem e interlineado 1.5, altura mínima de 44px y 16px de espacio a la izquierda. La acción de quitar conserva un área de 44 × 44px, nombre accesible con la etiqueta y foco del sistema; solo su fondo cambia a canvas-tag-hover al pasar el cursor. El inicio reutiliza esos colores en las etiquetas de lectura, las opciones seleccionadas y los filtros activos: las etiquetas enlazadas tienen 14px de relleno horizontal y los filtros activos una acción de quitar de 44 × 44px. Las opciones sin seleccionar y los demás filtros usan los tonos neutrales existentes. Este uso compartido no cambia los botones secundarios ni la presentación de etiquetas de las otras páginas.

**Edición de publicaciones.** El detalle ofrece Editar publicación a su autor y muestra Editado con fecha cuando corresponde. El mismo lienzo permite cambiar título, documento, imágenes, temática y etiquetas; Guardar cambios mantiene la comunidad y su acceso. La autorización exige autoría, cuenta verificada y pertenencia vigente a la comunidad. Una revisión incompatible conserva el borrador y ofrece Ver versión publicada en otra pestaña o Cargar versión publicada; reemplazarlo requiere confirmar el descarte, con texto para copiar antes los cambios que se quieran conservar. La carga vuelve a consultar el servidor y bloquea temporalmente el lienzo. Guardar mantiene la fecha de creación, los contadores y el orden cronológico, sin avisos de publicación nueva.

El lienzo guarda automáticamente el borrador en sessionStorage de la pestaña: al crear, por cuenta y contexto de comunidad; al editar, por cuenta y publicación con una clave independiente y la revisión de partida. Recupera el formato anterior de texto e imágenes. Las respuestas conservan su propio borrador por cuenta y publicación. El estado discreto comunica guardando, guardado o fallo del almacenamiento; un fallo de envío conserva el contenido y permite reintentar. Solo la creación o edición confirmada limpia su borrador. Los documentos y borradores guardan referencias de imagen por UUID, sin binarios ni URLs firmadas. Los permisos de comunidad y medios se conservan; el contrato y los límites estructurales están en [docs/editor.md](../../docs/editor.md).

**Estados del foro.** Carga, errores con reintento, filtros o búsqueda sin resultados, publicación inexistente y ausencia de respuestas tienen texto específico. ForumEmpty usa Lupa únicamente después de resolver una colección vacía. El bloque de acceso usa una superficie tonal con el radio surface; no convierte cada publicación o respuesta en tarjeta. Ningún estado vacío introduce publicaciones, autores o recuentos ficticios.

**Comunidades.** communities.css extiende las listas, formularios y estados del foro con los mismos tokens. El directorio distingue pertenencia de favorita: el texto indica «Formas parte» o «La creaste tú», mientras la estrella identifica una favorita. En el detalle, guardar favorita usa un botón con aria-pressed y no implica unirse. Unirse activa los avisos dentro de Foris; la ayuda lo explica antes de la acción. Los miembros pueden silenciarlos mediante un checkbox con etiqueta y descripción visibles. Salir conserva la favorita y detiene los avisos futuros; el creador conserva su pertenencia. Cada cambio muestra confirmación o error junto a los controles y bloquea envíos simultáneos.

Pública y Privada forman un selector de una sola opción con texto, icono y foco visible. La explicación cambia junto al control: una pública permite descubrir y leer; una privada requiere invitación y pertenencia. El nombre y la descripción mantienen etiquetas visibles y límites accesibles; los caracteres restantes se muestran dentro de los campos, sin contadores externos `0/80` o `0/500`. «Administrar comunidad» es una sección plegable del creador para imagen y, en privadas, enlaces de invitación de un uso y siete días. Crear, copiar o revocar muestra progreso y resultado junto a la acción. El enlace completo se ofrece solo al crearlo; la lista conserva estados y vencimientos. La aceptación permite acceder o registrarse conservando el destino y explica que aceptar incorpora a la comunidad. Los datos privados quedan fuera de las vistas de no miembros y se retiran al cambiar o cerrar sesión.

**Fotos de comunidad y perfil.** PortraitPicker comparte autorización, subida y confirmación con las imágenes existentes y permite cambiar o quitar una foto. El progreso, la verificación y los errores usan texto real junto al control. Las fotos son contenido aportado por usuarios; su alternativa conserva una identidad legible sin insinuar verificación personal. Las imágenes de cuenta se reutilizan en perfil, cabecera y chat donde corresponde. Este flujo conserva colores, fuentes, foco y botones actuales, sin nuevos tokens ni personajes de marca.

La lectura de comunidades y sus publicaciones es pública. Crear, unirse, guardar favoritas y configurar avisos exige cuenta verificada; escribir o responder en una comunidad exige además pertenencia. CommunityWritingGate explica ese paso y conserva el destino de acceso. Crear una comunidad es una página dedicada; sus borradores y los de publicaciones se separan por cuenta y comunidad cuando corresponde. Los estados vacíos reutilizan Lupa y texto específico, sin miembros ni publicaciones ficticios.

**Bandeja de avisos.** NotificationEntry aparece solo con cuenta activa y enlaza a /notificaciones. La campana conserva nombre accesible y muestra el recuento sin leer, abreviado visualmente a 99+ si procede. La bandeja privada usa filas abiertas con comunidad, publicación, fecha y estado de lectura; el texto y el peso tipográfico distinguen leído de pendiente. Permite abrir la publicación, marcar un aviso, marcar todos hasta el ID más reciente cargado y actualizar. El corte de lectura conserva los avisos posteriores sin leer. Son avisos dentro de Foris, sin correo ni permisos del navegador. El contador se refresca al montar, recuperar foco, volver a una pestaña visible y confirmar una lectura; no representa entrega en tiempo real. Los permisos y el contrato se detallan en [docs/communities.md](../../docs/communities.md).

**Chat global.** ChatHome conserva la conversación General en /chat con participación de invitados y miembros. Compone navegación, estado de conexión, MessageFeed y MessageComposer. Los mensajes forman una lista lineal con autor, condición de miembro o invitado, hora y separadores de día. La condición de miembro depende de accountId asignado por el servidor; acredita acceso a una cuenta, no el nombre real de una persona. El estado propio se indica con «Tú» y la condición correspondiente. La bienvenida con Mimo aparece únicamente después de confirmar un historial vacío; sus sugerencias rellenan el borrador editable y no lo envían. Carga, error de historial, reconexión y falta de conexión tienen estados explícitos. El contador representa conexiones abiertas, no personas únicas; no se añaden conversaciones ni presencia ficticias.

**Compositor.** Texto de hasta 2000 caracteres, nombre de invitado editable de hasta 32 y aviso de publicación pública. Para una cuenta muestra el nombre del perfil con acceso a /profile y la condición «Miembro». El envío espera a resolver la identidad sin impedir preparar el borrador. Enter conserva el salto de línea; Ctrl o ⌘ + Enter envía. El borrador se conserva tras un fallo y solo se limpia al confirmar el envío si aún coincide con el texto enviado. El hilo sigue el final cuando corresponde y ofrece «Volver al final» al leer mensajes anteriores; cargar historial conserva una referencia al mensaje visible para mantener la posición de lectura.

**Cuenta.** AccountEntry ofrece Entrar a invitados y abre un menú desde Tu perfil para una cuenta activa. El menú reúne Ver tu perfil, las opciones Predeterminado del sistema, Claro y Oscuro, y Cerrar sesión. Los temas forman un grupo de selección única con indicador visible; los elementos tienen un mínimo de 44px y forma de píldora. El cierre de sesión muestra progreso y conserva el menú con un error que permite reintentar si falla. Se reutiliza la sesión del servidor. /login concentra inicio de sesión, registro, recuperación y confirmación OTP. El registro con contraseña confirma el correo antes de abrir una sesión; Google aprovecha el correo confirmado por el proveedor. La disponibilidad se obtiene de la API: una función sin configuración externa muestra una explicación y mantiene al alcance la lectura de Foros y Comunidades y el chat global como invitado. La guía técnica y de configuración está en [docs/authentication.md](../../docs/authentication.md).

El perfil separa foto, datos personales, correo, contraseña y Google mediante títulos, espacio y ayudas breves. Nombre visible, nombres, apellidos y presentación se guardan como datos personales; el correo tiene su propia confirmación de identidad y código enviado a la dirección nueva. La contraseña y la vinculación o desvinculación de Google expresan sus requisitos junto a la acción y conservan un método de acceso. No presentar un nombre visible o una foto como identidad real verificada.

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
