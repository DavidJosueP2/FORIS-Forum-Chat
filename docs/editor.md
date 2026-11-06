# Lienzo de publicaciones

`/publicar` abre directamente el espacio de creación. Volver está junto a Crear publicación; Vista previa y Publicar permanecen al alcance. No hay portada introductoria, selección de tópico obligatoria ni contadores de caracteres. Se puede seguir escribiendo al superar una extensión; el aviso aparece en rojo y se exige corregirla antes de publicar.

Los errores del lienzo se anuncian con `role="alert"` debajo de «Borrador guardado en esta pestaña» y se limpian al editar el título o el contenido, sin mover el foco al aviso. Si se intenta publicar sin título, el foco permanece en el campo del título para corregirlo.

## Herramientas

El editor usa Tiptap 3 y ProseMirror, cargados bajo demanda únicamente al entrar al lienzo. El índice de Foros conserva su implementación y sus filtros. La integración sigue la [instalación oficial de React](https://tiptap.dev/docs/editor/getting-started/install/react) y utiliza extensiones abiertas; no requiere un servicio remoto de edición ni una cuenta de Tiptap.

| Herramienta | Comportamiento |
| --- | --- |
| Texto | Párrafos, encabezados y subencabezados |
| Formato | Negrita, cursiva, subrayado, tachado, resaltado, código en línea, subíndice y superíndice |
| Estructura | Listas con viñetas, numeradas y de tareas; citas, separadores y bloques de código |
| Enlaces | Añadir, editar y quitar direcciones HTTP(S) |
| Alineación | Izquierda, centro, derecha y justificada |
| Tablas | Insertar, añadir o quitar filas/columnas, combinar y separar celdas, encabezado y eliminación |
| Imágenes | Elegir archivos, pegar o arrastrar imágenes al lienzo, pie y descripción alternativa, reordenar y quitar |
| Historial | Deshacer y rehacer, incluidos los atajos habituales |
| Publicación | Vista previa y Ctrl/⌘ + Enter para enviar |

Los menús conservan las primitivas accesibles existentes y las acciones tienen nombres y áreas de al menos 44px. Las herramientas permanecen junto al área de escritura durante el desplazamiento; en móvil se ajustan a varias líneas. La apariencia usa los colores y fuentes de Foris, sin tarjetas repetidas, degradados ni bordes decorativos. Los trazos de foco y selección tienen una función de teclado o edición.

Al final del contenido se eligen la comunidad, la temática y las etiquetas. La comunidad es opcional y el selector muestra solo aquellas de las que se es miembro; se conserva la comprobación del servidor antes de publicar. La temática también es opcional: permite buscar o explorar ramas y seleccionar cualquier nivel. Las etiquetas se sugieren desde el vocabulario accesible o se crean al publicar. Se mantienen las reglas de normalización y privacidad descritas en [forum.md](forum.md).

Cuando no hay comunidad elegida, el control dice «Seleccionar comunidad». Dentro del selector, «Sin comunidad» permite volver a una publicación pública general. Las etiquetas seleccionadas usan un acento turquesa sólido exclusivo de esos chips, con variantes claras y oscuras; el resto de los controles conserva los tonos de Foris.

## Edición por el autor

El detalle ofrece «Editar publicación» a su autor y abre `/publicaciones/:UUID/editar`. Se utiliza el mismo lienzo para modificar título, documento, imágenes, temática y etiquetas, con Vista previa y Guardar cambios. La comunidad queda fija después de publicar; no se cambia el acceso del contenido desde una edición. La API exige una sesión verificada vigente, autoría y, si existe una comunidad, pertenencia vigente. El botón no es la única comprobación de permisos.

El borrador de edición usa una clave separada por cuenta y publicación, independiente del borrador de creación. Conserva la revisión de partida. Las publicaciones anteriores de texto se convierten al documento del editor; las imágenes ya retiradas se excluyen al preparar el lienzo. Los cambios solo se confirman al guardar y solo entonces se limpia ese borrador.

El envío usa `PATCH /api/posts/:UUID` con `title`, `content`, `categoryId`, `tags`, `requestId` y `revision`. El servidor valida el mismo documento y rechaza campos como autor, comunidad, contadores, body o mediaIds. La respuesta incluye la publicación, su revisión y la fecha de edición. Un reintento idéntico no aplica de nuevo los cambios. El mismo requestId con una intención distinta devuelve 409.

La revisión evita sobrescribir otra edición: si cambió desde que se abrió el lienzo, la API devuelve `POST_VERSION_CONFLICT` y conserva el borrador local. Se puede abrir la versión publicada en otra pestaña o cargarla en el lienzo. Reemplazar el borrador requiere confirmar el descarte, con oportunidad de copiar antes los cambios que se quieran conservar. Cargar la versión publicada vuelve a consultar el servidor; no reutiliza una revisión antigua almacenada al abrir la pantalla.

Las imágenes existentes se conservan o reordenan por UUID y se pueden añadir imágenes propias READY. Las omitidas se retiran y pasan a la limpieza existente. El servidor valida todas las imágenes antes de modificar asociaciones y libera temporalmente sus ordinales dentro de la transacción para intercambiar posiciones sin colisiones. Documento, etiquetas, medios y registro de edición se confirman juntos. Mientras se guarda o se carga una versión, el lienzo y los menús no aceptan modificaciones.

Editar conserva UUID, autor, comunidad, fecha de creación, contador de respuestas y posición cronológica. No aumenta el contador de publicaciones de la comunidad ni genera otra notificación de publicación nueva. Se permiten veinte ediciones por cuenta y hora, además del límite HTTP existente. El detalle muestra «Editado» con la fecha correspondiente.

## Imágenes y borradores

Las imágenes usan los adaptadores local/S3 existentes. El lienzo muestra autorización, subida con progreso real y verificación, con reintento y cancelación. Se puede seguir escribiendo durante la subida: la posición de inserción se actualiza con las transacciones del editor. La publicación espera a que las subidas terminen o se retiren las fallidas. Los formatos, tamaños y cantidad proceden de `/api/media/options`; inicialmente son JPEG, PNG o WebP, 5 MiB por archivo y tres imágenes por publicación.

Solo se persiste el UUID de cada imagen junto a su descripción y pie. La vista solicita metadatos y permisos temporales al servidor y conserva las comprobaciones de propiedad, estado READY y acceso a comunidades privadas. No se aceptan imágenes remotas incrustadas, binarios ni URLs firmadas en el documento. Quitar una imagen del lienzo la excluye de la publicación; los medios que quedan sin asociar siguen la limpieza de [media.md](media.md). El autor puede retirar una imagen publicada desde el detalle.

El autoguardado usa sessionStorage con una clave por cuenta y contexto de comunidad, con una pausa breve para no escribir en disco en cada pulsación. Conserva título, documento, clasificación, etiquetas, destino e identificador de reintento. Migra los borradores de texto anteriores al nuevo formato y convierte sus imágenes en bloques. No se comparte entre cuentas ni se sube al servidor. Un fallo del almacenamiento muestra una advertencia; cerrar la pestaña o limpiar los datos del navegador puede eliminar el borrador. Solo se limpia después de una respuesta de publicación confirmada.

## Contrato y validación

Las publicaciones nuevas envían `title`, `content`, `categoryId`, `tags`, `communityId` opcional y `requestId`. El documento tiene la forma:

```json
{
  "version": 1,
  "content": [
    { "type": "paragraph", "content": [{ "type": "text", "text": "Mi idea", "marks": [{ "type": "bold" }] }] }
  ]
}
```

El servidor acepta una lista cerrada de nodos, marcas y atributos. Comprueba estructura, anidamiento, tamaño, tablas y enlaces, deriva el texto buscable y los UUID de imágenes y adjunta estos medios en la misma transacción. Un documento con imágenes puede tener texto vacío. No permite mezclar `content` con `body` o `mediaIds`; el formato anterior de texto sigue funcionando por compatibilidad.

Se conserva el límite de título de 160 caracteres y texto de 10000. El documento admite hasta 3000 nodos, veinte niveles de anidamiento y tablas de veinte filas y doce columnas, con una cuadrícula coherente incluso al combinar celdas. La descripción de imagen admite 300 caracteres y el pie 500. El cuerpo HTTP está limitado a 256 KiB. Los controles del lienzo no recortan la escritura silenciosamente.

Los enlaces deben ser HTTP(S), sin credenciales en la URL. La lectura añade `noopener noreferrer nofollow ugc` y muestra el documento mediante elementos React, sin ejecutar HTML del autor. Las extensiones de alineación y tablas usan clases/atributos de datos en lugar de estilos del documento; no se relajó la política CSP. Vídeos como archivos, documentos adjuntos y colaboración simultánea siguen fuera de este alcance.

La migración aditiva 008 añade `forum_posts.content` JSONB y permite texto vacío cuando existe un documento. Las publicaciones anteriores conservan `content=null` y su lector de texto e imágenes. La respuesta del detalle añade `content`; el resumen del inicio continúa usando el extracto de texto. La idempotencia de creación compara el documento normalizado sin depender del orden de claves de JSONB.

La migración aditiva 009 añade revisión, fecha de edición y `forum_post_edits`. Esta tabla conserva UUID de publicación/autor, identificador y huella de solicitud, revisión de partida/resultante y fecha; no duplica los documentos ni almacena URLs. Permite reconocer reintentos y limitar frecuencia. Repetir una edición ya aplicada devuelve el estado actual de la publicación sin restaurar una versión anterior. Ninguna migración se ejecutó durante el trabajo asistido.

## Verificación de esta entrega

Se realizó análisis estático con ESLint, revisión de fuentes de las dependencias, CSS y SQL. Se prepararon casos de prueba de formato, derivación de texto, enlaces inseguros, imágenes externas, límites, tablas e idempotencia, sin ejecutarlos. Por instrucción del usuario no se compilaron archivos, no se ejecutó el compilador de tipos ni pruebas, no se iniciaron servidores, no se aplicaron migraciones y no se abrió un navegador. La validación visual y de interacción en escritorio/móvil queda pendiente.
