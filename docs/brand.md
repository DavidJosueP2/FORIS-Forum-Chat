# Identidad de Foris

Foris es un espacio para compartir publicaciones por tópicos, reunir comunidades públicas y conversar en un chat global. La identidad combina lectura clara, superficies sólidas y personajes pequeños que acompañan al usuario. La referencia aportada inspira la sencillez y la cercanía; las siluetas y expresiones de este catálogo se dibujaron para Foris.

## Tipografía

Las familias se declaran en [fonts.css](../apps/web/src/assets/fonts/fonts.css) y se importan desde la hoja global. Todos los archivos se sirven localmente con `font-display: swap`. Los pesos variables se declaran con su rango real; no se cargan todas las fuentes al entrar en la página.

| Uso | Familia | Clase |
| --- | --- | --- |
| Nombre y títulos | Axiforma | `font-heading` |
| Texto habitual y controles | Plus Jakarta Sans | `font-sans` |
| Acento editorial serif | Fraunces | `font-serif` |
| Variante sans para interfaz | SF Pro Display | `font-ui` |

Axiforma se aplica a `h1`–`h6`; Jakarta al resto de la página. Las otras dos familias se eligen expresamente. Mantener Jakarta como voz de lectura y reservar Fraunces para una frase o título puntual. No mezclar las cuatro familias en un mismo bloque.

```tsx
<h1 className="font-heading text-3xl font-semibold tracking-tight">Foris</h1>
<p className="font-sans text-base leading-6">Un espacio para conversar.</p>
<p className="font-serif text-2xl leading-tight">Cada conversación empieza con un hola.</p>
<span className="font-ui text-sm font-medium">Preferencias</span>
```

Jakarta: pesos 200–800, redonda y cursiva. Fraunces: 100–900, redonda y cursiva, con tamaño óptico automático. Axiforma: 100 y 300–900, redonda y cursiva. SF Pro: redonda 400/500/700; cursiva 100/200/300/600/800/900. Usar las variantes presentes, sin asumir que la carpeta contiene una familia completa de SF Pro.

Se conservan los originales y sus avisos de distribución; esta configuración no modifica ni otorga licencias de las fuentes.

## Personajes

Los nueve originales están en [src/assets/characters](../apps/web/src/assets/characters). Cada archivo es un SVG independiente con fondo transparente y un lienzo de 160 × 160. Funcionan en los temas claro y oscuro sin cambiar su personalidad.

| Personaje | `mood` | Emoción | Uso sugerido |
| --- | --- | --- | --- |
| Mimo | `welcome` | Bienvenida | Entrada, primer contacto. |
| Brío | `happy` | Alegría | Un pequeño logro confirmado. |
| Lupa | `curious` | Curiosidad | Explorar o encontrar una conversación. |
| Nube | `calm` | Calma | Una pausa o un estado vacío tranquilo. |
| Chispa | `inspired` | Inspiración | Invitar a comenzar una conversación. |
| Oh | `surprised` | Sorpresa | Un descubrimiento agradable. |
| Pipa | `shy` | Timidez | Acompañar el primer mensaje. |
| Lento | `sleepy` | Sueño | Un momento de poca actividad. |
| Hilo | `thoughtful` | Reflexión | Ayuda o explicación breve. |

El catálogo tipado está en [foris-characters.ts](../apps/web/src/lib/foris-characters.ts). Las claves forman el tipo `ForisMood`; no se eligen SVG mediante rutas de texto arbitrarias.

```tsx
import { ForisCharacter } from '@/components/brand/foris-character'

// Decorativo: el texto cercano ya explica la situación.
<ForisCharacter mood="welcome" width={112} height={112} />

// Con significado propio: describir lo que aporta en este contexto.
<ForisCharacter mood="curious" alt="Lupa se asoma con curiosidad" width={96} height={96} />
```

Usar normalmente entre 64 y 160 píxeles; conservar la proporción y el espacio alrededor. El SVG de Mimo también sirve como favicon. El componente es decorativo por defecto y mantiene las dimensiones para reservar espacio mientras carga la imagen.

Usar un personaje por momento. No repetirlos como fondo, insignias o separadores ni colocarlos junto a cada mensaje. No representan personas reales, una identidad verificada, presencia, lectura ni una respuesta generada por un bot. La emoción nunca sustituye el texto de un estado. Evitar personajes festivos en errores delicados y no añadirles globos de texto que parezcan mensajes reales.

## Lenguaje visual

Colores sólidos, formas suaves y ojos claros. Sin bordes decorativos, degradados ni sombras. La paleta expresiva de los personajes convive con los neutros de la interfaz; no cambia el significado de los colores de error, selección o acción. Los ojos forman parte de cada personaje: no son una trama de puntos decorativos.

Los botones tienen extremos completamente redondos por defecto en todas las variantes y tamaños de `Button`, incluidos los de icono. Los campos conservan sus esquinas suaves y las superficies su radio propio; el compositor tiene una forma de control específica. El foco de teclado sigue visible.

Las decisiones completas del sistema están en [DESIGN.md](../apps/web/DESIGN.md). La pantalla inicial abre las publicaciones con búsqueda, tópicos y filas abiertas; el detalle y las respuestas dan prioridad al texto. La cabecera compartida entre foro, comunidades y cuenta muestra Foros, Comunidades y Chat global en ese orden, con campana para una cuenta activa. El chat en /chat conserva General, su navegación propia, el hilo lineal y el compositor al pie, y ofrece enlaces a Foros y Comunidades. Axiforma identifica Foris y los títulos; Jakarta mantiene la lectura; Fraunces aporta el acento de bienvenida y de las pautas laterales del chat. SF Pro continúa disponible como alternativa explícita. Las comunidades heredan los colores, las formas y la escala tipográfica existentes.

El directorio de comunidades, su detalle, la creación y la bandeja usan listas y formularios abiertos. El estado de pertenencia, la estrella de favorita y el checkbox de avisos tienen funciones distintas y texto explícito: guardar no implica unirse y silenciar no implica salir. Los avisos llegan solo dentro de Foris; no se presenta la campana como permiso del navegador ni como entrega instantánea. Carga, errores y confirmaciones se explican junto a la tarea. No se añaden personajes, colores ni símbolos de identidad para esta extensión; Lupa acompaña únicamente vacíos ya confirmados.

En el chat global, Mimo acompaña únicamente el historial vacío confirmado. Sus sugerencias preparan un borrador editable, sin publicar mensajes automáticamente. Lupa acompaña los estados vacíos del foro cuando la consulta ya se ha resuelto; no se añade un personaje a cada publicación o respuesta. Mimo también acompaña la columna editorial de /login en escritorio, con una bienvenida breve, lectura pública del foro y chat invitado disponibles. Los estados de carga, error y conexión se explican con texto; no se inventan publicaciones, respuestas, mensajes ni presencia. Los nombres de invitado no están verificados y el contador del chat informa de conexiones abiertas.

La entrada de cuenta dirige a /login o /profile según la sesión. El acceso reúne contraseña, Google, registro, recuperación y OTP; el perfil organiza datos personales, correo, contraseña y Google en secciones abiertas. Conservan Axiforma para títulos, Jakarta para formularios, Fraunces para el acento editorial y botones de píldora. AccountShell reutiliza la cabecera principal y ThemeToggle comparte el tema entre todas las superficies. Los invitados pueden leer el foro y las comunidades y escribir en el chat global; crear publicaciones y respuestas requiere una cuenta verificada con sesión vigente y, dentro de una comunidad, pertenecer a ella. Crear comunidades, unirse y guardar favoritas también requiere cuenta. El chat distingue «Miembro» e «Invitado» a partir de la identidad asignada por el servidor: una cuenta acredita acceso al correo o a Google, no el nombre real de una persona.

La interfaz explica cuándo el correo o Google no están disponibles por configuración y permite volver a Foros, Comunidades o al chat global como invitado. La implementación de cuentas no implica que esas integraciones ya estén activas; la configuración y los límites se detallan en [authentication.md](authentication.md). Los permisos y avisos de comunidades se recogen en [communities.md](communities.md). No se añaden personajes, imágenes rasterizadas ni señales visuales de verificación personal.
