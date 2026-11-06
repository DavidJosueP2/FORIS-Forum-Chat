# Usos y posturas de las mascotas de Foris

Estado: las ubicaciones de esta etapa están implementadas en el código. Se mantienen los nueve personajes originales; las veinte posturas contextuales son variantes de esos personajes, con 29 SVG en total.

## Identidad y avatares

Mimo acompaña a «Foris» dentro del enlace de inicio del navbar. Su variante de marca mide 32 px, o 28 px en móvil. Comparte el nombre accesible del enlace y permanece quieta salvo un gesto breve al enfocar o pasar el puntero.

Las personas y comunidades sin foto conservan la asignación estable entre las nueve mascotas base. Las fotos subidas tienen prioridad. Los avatares no se animan ni cambian al navegar. Los nombres, el carácter de invitado o miembro y los controles accesibles siguen expresándose con texto.

## Ubicaciones implementadas

| Personaje | Contexto | Posición y variante |
| --- | --- | --- |
| Mimo | Navbar, acceso y chat vacío confirmado | Marca junto al nombre, saludo en el acceso y postura inclinada en el chat. El original y estas tres variantes mantienen un brazo levantado. Su cuarta variante acompaña el lienzo. |
| Familia completa | Login, registro, recuperación y OTP | ForisFamily agrupa los nueve personajes en una sola composición decorativa, hasta 360px en escritorio y 240px bajo 768px. En móvil se muestran solo los personajes sobre el formulario; el texto editorial y su CTA se ocultan. Solo Mimo saluda una vez. |
| Lupa | Búsqueda o filtros sin resultados | Dos SVG: a la izquierda en publicaciones y a la derecha en comunidades, con orientaciones reflejadas. Silueta ovalada azul, ojos alineados y lupa dorada conservan su identidad curiosa y amable. |
| Nube | Bandeja vacía, perfil sin publicaciones, pestaña de comunidades del perfil y listas propias sin comunidades | Cuatro SVG y posturas: izquierda en avisos y publicaciones del perfil; derecha en comunidades. La vista previa lateral del perfil conserva solo texto para evitar duplicar ilustraciones. |
| Chispa | Primera publicación del foro, comunidad sin publicaciones y directorio sin comunidades | Tres SVG para vacíos: sobre publicaciones y a la derecha del directorio. Una cuarta postura positiva se usa en el título del lienzo. |
| Pipa | Publicación sin comentarios, después de resolver la consulta | A la izquierda del texto para comentar, a 48 px. Solo en el nivel principal y cuando el total es cero; no en cada rama de respuestas. |
| Oh | Invitación cuyos datos se han cargado correctamente | A la derecha de la cabecera, a 72 px. Se oculta si hay un error; el nombre, la privacidad, la caducidad y las acciones permanecen visibles. |
| Lento | «Siguiendo» sin publicaciones después de resolver la consulta | A la derecha del estado vacío, a 80 px. No aparece como sustituto de la petición de acceso de un invitado. |
| Hilo | Control de enlaces del editor | A la derecha de la etiqueta del enlace, a 48 px, únicamente dentro del popover existente cuando se abre. No añade un panel o una explicación al lienzo. |
| Brío | Confirmación de datos personales guardados | A la izquierda de la confirmación existente, a 48 px. Solo aparece tras la respuesta correcta del servidor; editar los datos retira la confirmación como antes. Una segunda postura positiva se usa en el lienzo. |
| Mimo, Brío o Chispa | Crear o editar una publicación | Una de tres posturas positivas aparece junto al título a 48px, sin invadir la escritura ni cambiar el foco. canvasCompanion elige según el requestId inicial y PostCanvas captura la elección una vez con useState: permanece estable al escribir aunque cambie ese ID; un nuevo montaje puede elegir otra. |

Los recursos están en `apps/web/src/assets/characters/scenes`. `forisScenes` relaciona cada contexto con su SVG, personaje y gesto. `ForisCharacter` permite elegir una mascota base con `mood` o una postura contextual con `scene`, sin mezclar ambas opciones.

## Movimiento

Los gestos duran entre 600 y 950 ms y se ejecutan una sola vez: saludo, asomarse, asentarse, giro de Chispa o asentimiento. No hay ciclos continuos, sonido ni contenido oculto antes de la animación. El navbar reserva su gesto para puntero o foco de teclado. Los avatares permanecen estáticos.

Con `prefers-reduced-motion: reduce`, las posturas se muestran quietas y se conserva toda la información. La postura del SVG sigue siendo distinta aunque se desactive el movimiento.

## Reglas de uso

- Mostrar los vacíos solo tras resolver los datos; conservar cargas y errores con sus controles. No usar una mascota festiva como señal de que una operación fallida terminó bien.
- No añadir una ilustración a cada publicación, botón, etiqueta o comentario. Las identidades que ya usan avatar pueden repetirse, siempre quietas; la familia del acceso cuenta como una sola composición.
- Mantener las emociones como cualidad del catálogo: no indican estado de ánimo, presencia, actividad o verificación de una persona.
- Conservar etiquetas, texto y foco. Las imágenes decorativas tienen alternativa vacía y no sustituyen explicaciones necesarias.
- Los ojos neutros son recortes transparentes, no rellenos blancos o negros elegidos para un tema. Se mantienen colores sólidos y siluetas regulares.
- Evitar tarjetas nuevas, frases de relleno, pasos adicionales y espacio grande destinado únicamente a una mascota.

## Alcance de la revisión

Se revisaron los 29 SVG mediante renders estáticos en tamaños grandes, 48 y 32px sobre fondos claros y oscuros, y la familia en composiciones amplia y compacta. Las capturas de recursos de esta extensión se conservan en .impeccable/review/family-and-membership (family.png, characters.png y poses.png). Se analizaron sintaxis de fuentes, imports locales, SVG y CSS, y se ejecutó ESLint. Los renders verifican los dibujos, no las páginas ni el movimiento en navegador. La compilación, las pruebas y la validación de la aplicación en ejecución no se han realizado por indicación del usuario.
