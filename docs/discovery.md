# Inicio y descubrimiento

El inicio abre directamente las publicaciones más recientes, sin portada, saludo ni formulario de búsqueda antes del contenido. Un único ForumShell persistente reúne búsqueda automática, Crear publicación, navegación y cuenta en todas las páginas mediante Outlet. Explorar ocupa 248px fijos junto al borde izquierdo desde 1024px, bajo la cabecera medida y con desplazamiento independiente; el contenido reserva ese ancho. La navegación principal aparece arriba desde 1180px, en Explorar entre 1024px y 1179px y en el panel izquierdo por debajo de 1024px. El buscador tiene un máximo de 320px salvo en móvil: por debajo de 640px ocupa una segunda fila junto a Crear, abreviado desde menos de 900px.

Las publicaciones aparecen como artículos abiertos: autor y foto disponible, comunidad cuando corresponde, fecha, título con Fraunces, extracto de hasta 420 caracteres e imagen destacada. La temática y las etiquetas son accesos de exploración. Responder, Leer publicación y Copiar enlace funcionan con los permisos y recursos reales; no se añadieron votos, presencia, favoritos de publicaciones ni recomendaciones personalizadas. Si el navegador no permite copiar automáticamente, se ofrece el enlace para copiarlo manualmente.

Las imágenes mantienen los permisos temporales del almacenamiento. Su carga comienza al acercarse al área visible, para evitar solicitar todas las URLs del flujo al abrirlo. El contenedor reserva la proporción de las dimensiones conocidas y una altura acotada durante autorización, carga, error y visualización. La primera imagen tiene más espacio y las publicaciones con varias ofrecen acceso al conjunto. Una imagen no disponible muestra el error y su reintento. No se añadieron archivos de imagen ficticios o fotos de ejemplo.

## Búsqueda automática

Escribir espera 350 ms de pausa antes de actualizar el resultado; Enter también puede confirmar, pero no es necesario. La composición de texto IME espera su finalización. Se normalizan espacios y Unicode y se admiten hasta 120 caracteres válidos. La búsqueda vacía elimina el filtro y el botón de limpieza conserva el foco en el campo.

DiscoveryProvider y use-discovery conservan los últimos filtros entre rutas, pero la URL es la fuente de estado del inicio. Buscar desde otra página navega a / con esos filtros; las actualizaciones posteriores usan replace para no crear una entrada del historial por cada pausa al escribir. Navegar a otra página cancela una búsqueda pendiente. El parámetro q del directorio de comunidades pertenece a su buscador propio y no modifica la búsqueda global. El campo se sincroniza con Atrás/Adelante sin desmontarse en cada cambio. La actualización de resultados conserva el foco del buscador y los controles de filtros; los enlaces de autor, temática o etiqueta que desmontan su fila trasladan el foco al encabezado del flujo. Los resultados se anuncian mediante estados accesibles. Quitar todos los filtros también cancela y vacía un borrador de búsqueda aún pendiente de enviarse.

El panel móvil izquierdo incorpora también la navegación principal, mantiene el foco dentro del diálogo y lo devuelve al resultado tras aplicar filtros. Al cerrar o pasar a escritorio restituye el foco a un destino disponible. ResizeObserver mide la altura real de la cabecera sticky para situar Explorar y compensar destinos de foco, anclajes, el enlace Ir al contenido y la barra del editor, con valores responsive de respaldo. La reserva de proporción de imágenes y la compensación de cabecera ajustan únicamente propiedades numéricas mediante CSSOM, sin permitir CSS del autor ni relajar CSP; este mecanismo está descrito en [MDN: style-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src).

Las peticiones HTTP anteriores y las de paginación se abortan al desmontar o cambiar de consulta, y las respuestas de otra identidad de consulta no se muestran. El hook de recursos permite omitir solicitudes opcionales sin consultar endpoints vacíos. Esto no promete cancelar una sentencia SQL que el servidor ya haya recibido.

## Temáticas y etiquetas

En escritorio, Explorar presenta filtros laterales persistentes entre rutas. En móvil, Explorar abre el mismo catálogo en un panel izquierdo; las selecciones se aplican directamente y Ver publicaciones vuelve al contenido. Se puede buscar una temática, explorar sus subniveles o seleccionar cualquier nivel. Cada temática incluye sus descendientes.

Se pueden combinar hasta ocho etiquetas. Una publicación debe incluir todas las elegidas, además de coincidir con temática, búsqueda y autor cuando se usan. Las etiquetas seleccionadas mantienen el acento turquesa de Foris en ambos temas. Los filtros activos se pueden retirar individualmente o en conjunto.

| Parámetro de la interfaz | Uso |
| --- | --- |
| q | Texto de búsqueda |
| categoria | UUID de temática, incluye descendientes |
| etiqueta | UUID de etiqueta; repetible hasta ocho valores distintos |
| autor | UUID de autor |
| topico | Compatibilidad con enlaces anteriores a las cinco raíces |

Ejemplo: `/?categoria=UUID&etiqueta=UUID_A&etiqueta=UUID_B&q=proyecto`. Elegir una temática elimina el parámetro topico anterior. Los enlaces de etiquetas y temáticas de una publicación abren esa exploración. Las selecciones se conservan en la URL, sin datos privados de contenido ni URLs firmadas.

## API y privacidad

`GET /api/posts` conserva topic, category, tag, author, community, search, before y limit, y añade tags como una lista de UUID separados por comas. tag sigue funcionando como alias de una etiqueta y se combina sin duplicados con tags. Ambos juntos admiten hasta ocho UUID. El servidor aplica todas las condiciones mediante parámetros SQL y conserva la comprobación de privacidad antes de paginar. La búsqueda sigue tratando % y _ como texto literal.

`GET /api/taxonomy/tags` admite ids con hasta ocho UUID, además de search y limit. Resolver una etiqueta por UUID conserva exactamente la misma política que sugerirla: debe ser inicial o pertenecer a una publicación accesible para la sesión. Un identificador de una etiqueta exclusiva de una comunidad privada no revela su nombre a invitados, terceros o exmiembros. El inicio muestra un nombre genérico mientras se resuelve o cuando no está disponible.

Las listas de publicaciones y las consultas de etiquetas comparten un límite de 240 solicitudes por IP y minuto dentro de una instancia de la API. El middleware devuelve 429 antes de consultar el repositorio cuando se supera. Los límites de longitud, cantidad de etiquetas y paginación se validan también en el servidor. El middleware sigue la configuración de proxy de Express existente; no se añadieron variables de entorno.

El resumen incorpora avatarId del autor solo cuando existe. La foto se obtiene mediante la relación única `media.avatar_user_id` con el autor y solo si el medio está READY; `users` no tiene una columna avatar_id. El LEFT JOIN permite listar publicaciones sin foto y devolver una lista vacía en una base nueva. Su proyección SQL enumera los campos necesarios y excluye el documento JSONB completo, para no recuperarlo y deserializarlo en cada búsqueda automática. El detalle conserva su consulta completa y la misma relación de avatar. Los avatares conservan su finalidad pública y las imágenes de publicaciones respetan su acceso. Cambiar o cerrar sesión retira el contenido privado del flujo. Las sugerencias y la resolución de etiquetas seleccionadas se identifican por cuenta y estado de autenticación, abortan las peticiones anteriores y descartan sus respuestas; el catálogo público de temáticas se reutiliza.

## Alcance y verificación

La presentación vive en `features/forum/discovery` y el layout en `features/forum/components/platform-shell.css`. App.tsx agrupa trece declaraciones de ruta, incluida la redirección desconocida, bajo un solo ForumShell con Outlet: inicio, comunidades, creación y detalle, publicaciones y edición, invitaciones, notificaciones, acceso, perfil y chat. Crear publicación conserva la comunidad desde /comunidades/:communityId o /publicar?comunidad. La lista de comunidades conserva `components/post-list.tsx`. El chat elimina únicamente su navegación y cuenta duplicadas, mantiene GuestName y RoomInfo en su encabezado y reserva la altura de ventana menos la cabecera; mensajes y videollamada conservan su lógica. El lienzo, las cuentas y los permisos conservan su funcionalidad.

El layout compartido es un cambio de frontend, sin API nueva, cambios de base de datos, dependencias ni migraciones, y conserva paleta y tipografías globales. Se revisaron fuentes, CSS, imports, rutas estáticas y ESLint de los archivos modificados. El detector devolvió una lista vacía en su único pase y la revisión final concluyó SHIP dentro del alcance estático. Se prepararon casos de prueba para combinación de filtros, validación de UUID y privacidad de etiquetas por ID, sin ejecutarlos. No se realizaron compilación, typecheck, pruebas, servidores, migraciones, Docker ni capturas de navegador por indicación del usuario. Queda pendiente verificar visualmente y en ejecución la búsqueda rápida, Atrás/Adelante, filtros móviles, imágenes y ambos temas.
