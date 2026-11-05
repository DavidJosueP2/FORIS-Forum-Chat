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

Base visual de Foris para comunidades abiertas. La lectura manda; las formas suaves y los personajes aportan cercanía en momentos concretos. El contenido se organiza por tipografía, espacio y superficies sólidas. La pantalla inicial abre directamente la conversación General y mantiene la escritura como invitado al alcance.

El nombre, las cuatro familias tipográficas y el lenguaje de personajes forman la identidad actual. La composición de General se recoge en .impeccable/surfaces/apps-web-src-app-tsx.md; las restricciones de estilo del usuario se conservan en el PRODUCT.md de la raíz.

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
| Texto sans serif | Plus Jakarta Sans | font-sans | Conversación, formularios y controles; 400 para texto y 500 para etiquetas. |
| Acento serif | Fraunces | font-serif | Frases editoriales o mensajes de bienvenida puntuales. |
| Alternativa de interfaz | SF Pro Display | font-ui | Controles de una superficie que elija expresamente esta variante. |

html y el texto general usan Jakarta. h1–h6 usan Axiforma por defecto; las utilidades de familia pueden sustituirla. Jakarta admite pesos variables de 200 a 800, y Fraunces de 100 a 900, en redonda y cursiva. Axiforma declara los pesos 100, 300, 400, 500, 600, 700, 800 y 900 en ambas variantes. SF Pro declara únicamente los pesos y estilos presentes: redonda 400/500/700 y cursiva 100/200/300/600/800/900. No depender de una variante ausente de SF Pro.

La escala usada en General corresponde a 12, 14, 16, 20, 24, 30 y 32 píxeles mediante rem. El texto de lectura parte de 1rem; el cuerpo de los mensajes usa interlineado 1.65 y un máximo de 70 caracteres de ancho. Las etiquetas usan el rol label y las horas, fechas, estados y ayudas el rol caption. General usa heading, con heading-compact en móvil; el nombre Foris usa title. La bienvenida usa Fraunces con el rol serif, reducido al tamaño de title en móvil. La serif es un acento, no una fuente para toda la conversación; SF Pro es una alternativa preparada, no una cuarta voz obligatoria en cada pantalla.

Evitar texto principal en mayúsculas, espaciados exagerados o tipografía monoespaciada decorativa. La conversación tiene prioridad.

## Layout

Usar el ritmo de espaciado de Tailwind, con grupos próximos y separación clara entre tareas. General organiza el espacio en navegación lateral, encabezado, hilo y compositor al pie; no en una cuadrícula de tarjetas. La navegación ocupa 248px en escritorio. El hilo y el compositor comparten un máximo de 840px, con texto alineado y espacio suficiente para leer.

La navegación lateral se oculta por debajo de 1024px y el nombre Foris pasa al encabezado. Desde 1360px aparece una columna de pautas de 264px; con menos espacio se accede a esa información mediante un diálogo. Por debajo de 640px disminuyen los márgenes y se compactan el encabezado y el compositor. El hilo tiene su propio desplazamiento y el compositor reserva el área segura inferior del dispositivo. El punto móvil de las primitivas genéricas del catálogo sigue siendo 768px; no determina estos cambios de General. Las acciones principales de la pantalla usan una altura de al menos 44px, aun cuando el catálogo ofrezca tamaños menores.

## Elevation & Depth

**Superficies.** Separar grupos mediante tono y espacio; evitar contornos y sombras.

No usar degradados, vidrio, fondos con tramas o puntos decorativos. Las capas modales son opacas; su contenido mantiene el cierre y la gestión de foco de las primitivas accesibles.

## Shapes

Los botones usan el token button para extremos completamente redondos; los tamaños de icono forman círculos cuando ancho y alto coinciden. Es el valor predeterminado de todas las variantes y tamaños de Button: default, xs, sm, lg, icon, icon-xs, icon-sm e icon-lg. className permite una sustitución deliberada cuando un patrón lo requiera.

Los campos conservan control y las superficies excepcionales conservan surface. El compositor es una forma de control específica: composer en escritorio, composer-compact en móvil y composer-inset para el área de texto interior. Estos radios no cambian las esquinas de tarjetas ni contenedores generales. Evitar convertir contenedores grandes en píldoras. Las tarjetas no llevan contornos ni sombras.

## Components

El catálogo de shadcn está en src/components/ui. Se instaló el conjunto completo disponible del estilo radix-nova; incluir un componente en el repositorio no obliga a usarlo en la pantalla.

Los estilos comunes se centralizan en src/index.css para que las primitivas conserven comportamiento y semántica. Los campos usan relleno sólido; los estados inválidos usan una superficie diferenciada. La variante outline de Button funciona como un secundario relleno, sin dibujar un contorno.

**Botones.** Primario sólido para enviar y acciones principales; secundario tonal para recuperación y sugerencias; ghost para utilidades y el nombre de invitado. Todos parten de la forma de píldora. La política global elimina bordes y sombras de las primitivas sin eliminar el foco de teclado. Mantener los estados deshabilitado, enviando y reintento con texto comprensible.

**Conversación General.** ChatHome compone navegación, estado de conexión, MessageFeed y MessageComposer. Los mensajes forman una lista lineal con autor, condición de invitado, hora y separadores de día. El estado propio se indica con «Tú, invitado», sin insinuar una identidad verificada. La bienvenida con Mimo aparece únicamente después de confirmar un historial vacío; sus sugerencias rellenan el borrador editable y no lo envían. Carga, error de historial, reconexión y falta de conexión tienen estados explícitos. El contador representa conexiones abiertas, no personas únicas; no se añaden conversaciones ni presencia ficticias.

**Compositor.** Texto de hasta 2000 caracteres, nombre de invitado editable de hasta 32 y aviso de publicación pública. Enter conserva el salto de línea; Ctrl o ⌘ + Enter envía. El borrador se conserva tras un fallo y solo se limpia al confirmar el envío si aún coincide con el texto enviado. El hilo sigue el final cuando corresponde y ofrece «Volver al final» al leer mensajes anteriores; cargar historial conserva una referencia al mensaje visible para mantener la posición de lectura.

**Cuenta.** El diálogo comunica que las cuentas y Google llegarán próximamente. La acción de Google está deshabilitada y «Seguir como invitado» permite cerrar el diálogo. No hay rutas nuevas de autenticación.

**Interacción.** Conservar foco, selección y estados funcionales aunque el aspecto sea plano.

El foco usa un trazo de 2px separado 3px del control. Es un indicador funcional de teclado, no una decoración. Conservar también los indicadores de checkbox, radio, carga y selección; la restricción de puntos se refiere a adornos.

AppProviders configura tema claro, oscuro o del sistema, tooltips y notificaciones. useTheme permite cambiar la preferencia; las etiquetas comunes predeterminadas están en español. La base respeta movimiento reducido.

**Personajes de Foris.** Nueve SVG originales en src/assets/characters, con fondo transparente, colores sólidos y una pareja de ojos expresivos. Comparten un lienzo de 160 × 160 y márgenes internos; cambian la silueta, la postura y la mirada. No llevan contornos, sombras, degradados ni animaciones automáticas.

ForisCharacter recibe mood y permite controlar el tamaño. Su alt vacío predeterminado evita repetir información al lector de pantalla; si el personaje comunica algo que no está escrito al lado, darle un alt contextual. Un personaje acompaña bienvenida, estados vacíos o ayudas puntuales; no sustituye instrucciones, iconos funcionales ni avatares de personas. Usar uno por momento, sin llenar la página de adornos. El catálogo y ejemplos están en docs/brand.md, en la raíz del repositorio.

El tema propio actualiza la clase del documento sin inyectar un script de arranque inline. No modificar la CSP del backend para configurar los componentes. Las integraciones que generen estilos dinámicos requieren su revisión al usarse en una pantalla real.

## Do's and Don'ts

### Do

- **Do** usar colores semánticos y superficies sólidas.
- **Do** conservar foco visible y estados accesibles.
- **Do** priorizar la lectura de la conversación.
- **Do** usar un personaje cuando aporte cercanía o contexto.

### Don't

- **Don't** usar degradados, vidrio ni puntos decorativos.
- **Don't** construir la página como una cuadrícula de tarjetas.
- **Don't** añadir bordes de colores ni contornos decorativos.
- **Don't** usar personajes como identidades verificadas ni como señales de conexión real.
