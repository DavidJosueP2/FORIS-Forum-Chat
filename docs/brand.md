# Identidad de Foris

Foris es un espacio para compartir publicaciones por tópicos, reunir comunidades públicas o privadas y conversar en un chat global. La identidad combina lectura clara, superficies sólidas y personajes pequeños que acompañan al usuario. La referencia aportada inspira la sencillez y la cercanía; las siluetas y expresiones de este catálogo se dibujaron para Foris.

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

Los nueve originales están en [src/assets/characters](../apps/web/src/assets/characters). Cada archivo es un SVG independiente con fondo transparente, formas suaves y regulares y un lienzo de 160 × 160 con márgenes internos consistentes. Conservan sus nombres, colores, emociones e identidad y funcionan en los temas claro y oscuro sin cambiar su personalidad. Todos los ojos neutros son recortes transparentes: dejan ver el fondo real, sin pintar blanco o negro para simularlo. Un color propio de ojos requerirá definición expresa.

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

El catálogo tipado está en [foris-characters.ts](../apps/web/src/lib/foris-characters.ts). Las claves de los originales forman el tipo `ForisMood`; `forisScenes` relaciona veinte contextos con sus SVG, personajes y gestos mediante `ForisScene`. `ForisCharacter` recibe `mood` o `scene`, sin combinarlos ni elegir SVG mediante rutas de texto arbitrarias.

```tsx
import { ForisCharacter } from '@/components/brand/foris-character'

// Decorativo: el texto cercano ya explica la situación.
<ForisCharacter scene="chat" width={116} height={116} />

// Con significado propio: describir lo que aporta en este contexto.
<ForisCharacter mood="curious" alt="Lupa se asoma con curiosidad" width={96} height={96} />
```

Fuera de la marca, las escenas implementadas usan tamaños entre 48 y 128 píxeles; Mimo junto a Foris mide 32px, o 28px en móvil, dentro del mismo enlace de inicio de 44px y con su nombre accesible compartido. Conservar la proporción y el espacio alrededor. Los avatares reutilizan los tamaños de identidad de cada superficie. El SVG base de Mimo también sirve como favicon. El componente es decorativo por defecto y mantiene las dimensiones para reservar espacio mientras carga la imagen. El catálogo usa importaciones `?no-inline` y, como el favicon, se sirve mediante archivos del propio sitio, sin convertir los SVG en URLs de datos.

Como ilustración de bienvenida, estado vacío o ayuda, usar un personaje contextual por estado, sin contar la marca ni los avatares. El acceso reúne los nueve en una sola composición decorativa mediante ForisFamily: aparece en login, registro, recuperación y OTP, con un máximo de 360px en escritorio y 240px bajo 768px. En móvil se ocultan el texto editorial y su CTA, conservando la familia sobre el formulario; solo Mimo saluda una vez y los otros ocho permanecen quietos. No repetirlos como fondo, insignias o separadores ni añadir una ilustración a cada mensaje. Los avatares automáticos cumplen otra función y pueden repetirse donde ya aparece una identidad: son marcadores visuales de marca, no retratos ni señales de verificación, presencia, lectura o una respuesta generada por un bot. La emoción pertenece al catálogo, no al ánimo de la persona, y nunca sustituye el texto de un estado. Evitar personajes festivos en errores delicados y no añadirles globos de texto que parezcan mensajes reales.

Los avatares originales y las fotos permanecen estáticos. IdentityImage y PortraitPicker muestran la foto subida cuando está disponible; si falta, carga o falla, reutilizan la mascota asignada por identificador estable. La selección reparte los nueve personajes entre personas y comunidades, se conserva entre vistas y recargas y no almacena una foto ficticia ni modifica la cuenta. El fondo de la alternativa es transparente y la imagen mantiene su proporción. Los nombres accesibles se conservan y un invitado del chat sigue siendo invitado.

Las veinte posturas suman 29 SVG junto con los nueve originales y están implementadas en [src/assets/characters/scenes](../apps/web/src/assets/characters/scenes): Mimo distingue marca, acceso, chat vacío y lienzo; su original y las variantes de marca, acceso y chat levantan un brazo en saludo. Lupa conserva su azul y su curiosidad mediante una silueta ovalada y ojos alineados, junto a una lupa dorada; sus variantes reflejan las orientaciones de búsqueda. Lupa acompaña las búsquedas de publicaciones y comunidades; Nube, la bandeja, el perfil y las listas propias; Chispa, los primeros contenidos. Mimo, Brío y Chispa aportan tres posturas positivas para el lienzo. Pipa acompaña únicamente el vacío principal de comentarios con total cero, Oh una invitación válida, Lento el vacío resuelto de Siguiendo, Hilo el popover existente de enlaces y Brío el guardado confirmado de datos personales. Junto al título del lienzo aparece una de esas tres posturas, a 48px. canvasCompanion selecciona por el requestId inicial del borrador y PostCanvas la captura una sola vez con useState: permanece estable mientras se escribe aunque ese identificador cambie, y un nuevo montaje puede elegir otra. No ocupa el cuerpo ni modifica el foco. El manifiesto de posiciones, tamaños y condiciones está en [mascot-placement-plan.md](mascot-placement-plan.md). No se añade una escena a cargas, errores o ramas de respuestas vacías.

Los cinco gestos de [foris-character.css](../apps/web/src/components/brand/foris-character.css) duran entre 600 y 950ms y se ejecutan una vez, solo con `prefers-reduced-motion: no-preference`. Con movimiento reducido se conserva la postura estática. Mimo en la marca solo saluda al pasar el puntero o enfocar el enlace; las demás escenas pueden hacer su gesto al aparecer. Permanecen visibles desde el inicio, sin ciclos continuos, sonido ni bloqueo. La revisión de las posturas se hizo con renders estáticos en ambos temas; las páginas y el movimiento en navegador no se han validado.

## Lenguaje visual

Colores sólidos, formas suaves y ojos neutros transparentes. Sin bordes decorativos, degradados ni sombras. La paleta expresiva de los personajes convive con los neutros de la interfaz; no cambia el significado de los colores de error, selección o acción. Los ojos forman parte de cada personaje: no son una trama de puntos decorativos.

Los botones tienen extremos completamente redondos por defecto en todas las variantes y tamaños de `Button`, incluidos los de icono. Los campos conservan sus esquinas suaves y las superficies su radio propio; el compositor tiene una forma de control específica. El foco de teclado sigue visible.

Las decisiones completas del sistema están en [DESIGN.md](../apps/web/DESIGN.md). La pantalla inicial abre las publicaciones con búsqueda, tópicos y filas abiertas; el detalle y las respuestas dan prioridad al texto. La cabecera compartida entre foro, comunidades y cuenta muestra Foros, Comunidades y Chat global en ese orden, con campana para una cuenta activa. El chat en /chat conserva General, su navegación propia, el hilo lineal y el compositor al pie, y ofrece enlaces a Foros y Comunidades. Axiforma identifica Foris y los títulos; Jakarta mantiene la lectura; Fraunces aporta el acento de bienvenida y de las pautas laterales del chat. SF Pro continúa disponible como alternativa explícita. Las comunidades heredan los colores, las formas y la escala tipográfica existentes.

El directorio de comunidades, su detalle, la creación y la bandeja usan listas y formularios abiertos. El estado de pertenencia, la estrella de favorita y el checkbox de avisos tienen funciones distintas y texto explícito: guardar no implica unirse y silenciar no implica salir. Los avisos llegan solo dentro de Foris; no se presenta la campana como permiso del navegador ni como entrega instantánea. Carga, errores y confirmaciones se explican junto a la tarea. Se conservan los nueve personajes y sus colores; los avatares reutilizan los originales y las escenas distinguen búsquedas sin resultados, listas propias vacías y primeros contenidos solo tras resolver los datos.

Crear una comunidad reúne foto opcional, nombre, descripción y selector Pública/Privada en un editor abierto. Los caracteres restantes aparecen dentro de los campos, sin contadores externos `0/80` o `0/500`; las etiquetas y los límites accesibles permanecen. El texto de acceso explica qué se puede descubrir, leer y compartir. Una privada identifica su condición con icono y texto para sus miembros; el creador administra imagen e invitaciones desde una sección plegable. Los enlaces de un uso y siete días muestran vencimiento, copia, revocación y errores junto a la tarea. La aceptación explica la entrada antes de confirmarla y conserva el destino al acceder o registrarse.

Las fotos de comunidad y perfil son contenido aportado por usuarios, con selector, progreso y retirada explícitos. La imagen de identidad se reutiliza donde corresponde con prioridad para la foto disponible y la misma mascota automática como alternativa. Ni las fotos ni los avatares de marca representan identidad verificada. El selector reutiliza fuentes, colores y controles existentes y no incorpora tokens de identidad. La dirección de esta extensión está en [communities-privacy-direction.md](../apps/web/.impeccable/communities-privacy-direction.md).

Las imágenes opcionales acompañan el texto de las publicaciones. Su selector conserva el formulario abierto, el botón de píldora, las ayudas junto a la tarea y el foco visible; la carga muestra progreso, verificación y errores reales. Las miniaturas usan el contenido aportado por el usuario: no son ilustraciones de marca ni señales de identidad. El índice muestra la primera imagen bajo el extracto y el detalle las ordena después del cuerpo, con una acción explícita de retirada para el autor. Esta extensión mantiene las fuentes y colores semánticos existentes, sin añadir tarjetas, bordes, sombras, personajes ni tokens de marca. La dirección de esta superficie se conserva en [media-direction.md](../apps/web/.impeccable/media-direction.md); el flujo y sus permisos están en [media.md](media.md).

Como ilustración del chat global, Mimo acompaña únicamente el historial vacío confirmado. Sus sugerencias preparan un borrador editable, sin publicar mensajes automáticamente. Lupa acompaña búsquedas o filtros sin resultados cuando la consulta ya se ha resuelto; no se añade una ilustración a cada publicación o respuesta. La familia completa acompaña /login y sus modos de registro, recuperación y OTP; Mimo usa su postura de saludo, distinta de la del chat. La columna de escritorio conserva una bienvenida breve, lectura pública del foro y chat invitado disponibles; en móvil permanece la composición familiar sobre el formulario. Los avatares automáticos de esas superficies conservan su función de marcador de identidad. Los estados de carga, error y conexión se explican con texto; no se inventan publicaciones, respuestas, mensajes ni presencia. Los nombres de invitado no están verificados y el contador del chat informa de conexiones abiertas.

La videollamada se abre desde un botón discreto a la derecha del título «Chat global», con icono y texto en escritorio y solo icono con nombre accesible en móvil. La vista ocupa toda la ventana, con vídeos grandes y controles al pie. Minimizar permite escribir en el chat conservando la llamada y el audio; una franja «Volver a la llamada» reabre la vista completa. Salir termina la participación y libera los dispositivos. Mantiene los colores semánticos, las fuentes y los botones de píldora existentes. La disponibilidad y las plazas proceden del servidor; cada vídeo tiene nombre y estado escritos. Los vídeos son medios aportados por participantes, no imágenes de marca ni prueba de identidad real. Abrir la vista no activa dispositivos: «Entrar con cámara y micrófono» expresa el consentimiento antes del permiso del navegador. Los controles principales muestran texto junto al icono y la salida de la franja mantiene nombre accesible. Hasta cuatro cuentas verificadas pueden unirse; los invitados mantienen el chat de texto y reciben un enlace de acceso para llamar. Esta extensión no añade personajes ni tokens de identidad. Su dirección está en [video-call-direction.md](../apps/web/.impeccable/video-call-direction.md) y el alcance y la configuración, en [video-calls.md](video-calls.md).

La entrada de cuenta dirige a /login o /profile según la sesión. El acceso reúne contraseña, Google, registro, recuperación y OTP; el perfil organiza foto, datos personales, correo, contraseña y Google en secciones abiertas. Conservan Axiforma para títulos, Jakarta para formularios, Fraunces para el acento editorial y botones de píldora. AccountShell reutiliza la cabecera principal y ThemeToggle comparte el tema entre todas las superficies. Los invitados pueden leer el foro general y las comunidades públicas y escribir en el chat global; las privadas requieren pertenencia mediante invitación. Crear publicaciones y respuestas requiere una cuenta verificada con sesión vigente y, dentro de una comunidad, pertenecer a ella. Crear comunidades, unirse y guardar favoritas también requiere cuenta. El chat distingue «Miembro» e «Invitado» a partir de la identidad asignada por el servidor: una cuenta acredita acceso al correo o a Google, no el nombre real de una persona.

La interfaz explica cuándo el correo o Google no están disponibles por configuración y permite volver a Foros, Comunidades o al chat global como invitado. La implementación de cuentas no implica que esas integraciones ya estén activas; la configuración y los límites se detallan en [authentication.md](authentication.md). Los permisos y avisos de comunidades se recogen en [communities.md](communities.md). Esta extensión conserva los personajes y recursos de marca y no añade señales visuales de verificación personal.
