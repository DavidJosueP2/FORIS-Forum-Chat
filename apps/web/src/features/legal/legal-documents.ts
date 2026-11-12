export const operator = { name: 'David Barragán', country: 'Ecuador', email: 'deividjosue52@hotmail.com' }
export const legalRevision = '2026-11-12'

interface LegalSection {
  id: string
  heading: string
  paragraphs: string[]
  points?: string[]
  links?: { label: string; href: string }[]
}

interface LegalDocument {
  slug: string
  title: string
  description: string
  sections: LegalSection[]
}

const contact = { label: operator.email, href: `mailto:${operator.email}` }
const privacy = { label: 'Política de privacidad', href: '/legal/privacidad' }
const cookies = { label: 'Cookies y almacenamiento', href: '/legal/cookies' }
const reports = { label: 'Reportes y solicitudes', href: '/legal/reportes' }
const rules = { label: 'Normas de comunidad', href: '/legal/normas' }
const chats = { label: 'Chats y videollamadas', href: '/legal/chats' }
const copyright = { label: 'Propiedad intelectual', href: '/legal/propiedad-intelectual' }

export const legalDocuments: LegalDocument[] = [
  {
    slug: 'terminos', title: 'Términos y condiciones',
    description: 'Las condiciones para navegar, crear una cuenta y participar en Foris.',
    sections: [
      { id: 'servicio', heading: 'Quién opera Foris', paragraphs: ['Foris es un proyecto independiente de carácter recreativo, operado por David Barragán desde Ecuador y accesible a personas de otros países. Estos términos abarcan la navegación, los foros, las comunidades, los chats y las videollamadas de Foris.'], links: [contact] },
      { id: 'cuenta', heading: 'Acceso y cuenta', paragraphs: ['Puedes leer contenido público y participar en el chat global como invitado. Las acciones que requieren cuenta se habilitan tras verificar el acceso al correo o ingresar con una cuenta de Google verificada. La verificación acredita el acceso a la cuenta, no la identidad civil de la persona.', 'Usa una cuenta que puedas controlar y mantén tus credenciales y códigos de acceso en privado. Si necesitas autorización de un representante legal para usar el servicio conforme a la ley aplicable, obtén esa autorización antes de participar.'] },
      { id: 'participacion', heading: 'Foros, comunidades y conversaciones', paragraphs: ['Cada superficie tiene su propio alcance. Una publicación puede quedar en el foro general o en una comunidad. Las comunidades públicas pueden tener publicaciones visibles sin cuenta, mientras que su chat es para miembros. Las comunidades privadas requieren una invitación válida para incorporarse. Puedes enviar un primer mensaje directo a otra persona. La conversación continúa si la otra persona responde o te sigue. Las videollamadas directas requieren seguimiento mutuo.', 'Antes de compartir, revisa el destino y la audiencia. Eres responsable de contar con los permisos necesarios para difundir lo que subes, incluido material creado por otras personas y datos de terceros.'], links: [rules, chats, copyright] },
      { id: 'licencia', heading: 'Permiso para mostrar tus aportes', paragraphs: ['Conservas los derechos que tengas sobre tu contenido. Al compartirlo, autorizas a Foris de forma no exclusiva y sin regalías a alojarlo, reproducirlo técnicamente, adaptarlo al formato de la interfaz y mostrarlo a la audiencia del espacio elegido. Este permiso se limita al funcionamiento del servicio y a la conservación necesaria que corresponda conforme a la ley.'], links: [copyright] },
      { id: 'uso-indebido', heading: 'Abuso y medidas', paragraphs: ['No uses Foris para acosar, defraudar, suplantar, difundir material ilícito, acceder a espacios sin autorización, recopilar datos personales de otras personas ni interferir con el funcionamiento del servicio. Ante un incumplimiento, Foris puede restringir acceso o visibilidad del contenido según el riesgo, el contexto y las obligaciones aplicables. Puedes solicitar una revisión por correo.'], links: [rules, reports] },
      { id: 'disponibilidad', heading: 'Disponibilidad y cambios', paragraphs: ['El servicio puede interrumpirse por mantenimiento, cambios, fallas de conexión o servicios externos. Guarda por tu cuenta una copia de los aportes que quieras conservar. Los contenidos de otras personas expresan sus opiniones y sus enlaces pueden llevarte a servicios con sus propias condiciones.', 'La fecha de revisión identifica la versión de esta página. Los cambios y limitaciones del servicio se aplican respetando los derechos y obligaciones que correspondan conforme a la ley.'] },
      { id: 'jurisdiccion', heading: 'Ley aplicable y contacto', paragraphs: ['Foris se opera desde Ecuador y se sujeta a la normativa ecuatoriana que resulte aplicable. Si accedes desde otro país, pueden aplicarse además normas obligatorias de tu lugar de residencia. Estos términos no limitan derechos irrenunciables ni el acceso a las autoridades competentes.'], links: [contact, privacy] },
    ],
  },
  {
    slug: 'privacidad', title: 'Política de privacidad',
    description: 'Qué información utiliza Foris, con qué fines, quién puede verla y cómo ejercer tus derechos.',
    sections: [
      { id: 'responsable', heading: 'Responsable del tratamiento', paragraphs: ['David Barragán, en Ecuador, opera Foris y es el responsable del tratamiento de los datos personales en el servicio. El canal de contacto público disponible actualmente es el correo indicado abajo. Puedes escribir allí aunque no tengas una cuenta.'], links: [contact] },
      { id: 'datos', heading: 'Datos que recibe Foris', paragraphs: ['Foris recibe datos directamente de lo que ingresas, de la actividad que genera tu navegador al usar el sitio y, si eliges esa opción, del servicio de acceso de Google. Los datos del servicio se guardan en su base de datos y, para imágenes, en el almacenamiento habilitado.'], points: [
        'Cuenta y perfil. Correo, nombre visible, datos de perfil que añadas, foto si la subes, fecha de registro y estado de verificación. Foris registra la versión y la fecha de aceptación de los términos al completar el registro. Si usas contraseña, el servidor guarda una representación protegida de esta. Con Google, Foris recibe la información de identidad necesaria para identificar y vincular la cuenta.',
        'Contenido y actividad. Publicaciones, respuestas, imágenes, votos, membresías, invitaciones, seguimientos, favoritas y preferencias de notificación, según las funciones que uses.',
        'Chats. Texto, fecha, identificadores y autoría del mensaje. Un mensaje como invitado incluye el nombre visible elegido y un identificador del navegador para el envío.',
        'Seguridad y conexión. Datos de sesión, verificaciones e información técnica de las solicitudes. La dirección IP puede intervenir en los límites de abuso y en la conexión de llamadas. El indicador de presencia usa identificadores derivados y actividad reciente para contar cuentas y navegadores.',
        'Videollamadas. El navegador comparte audio y vídeo al entrar con tu permiso. El servidor procesa temporalmente señales de conexión y datos de participación. Foris no graba ni almacena el audio o el vídeo de la llamada.',
      ] },
      { id: 'fines', heading: 'Fines y bases del tratamiento', paragraphs: ['Los datos necesarios para ofrecer una función solicitada se utilizan para prestar esa función. Esto incluye autenticarte, publicar y mostrar aportes a la audiencia correspondiente, entregar mensajes, gestionar membresías, preparar llamadas y enviar códigos de acceso cuando procede. Sin los datos necesarios, algunas funciones pueden quedar indisponibles.', 'Los controles destinados a proteger el servicio y prevenir abuso pueden basarse en el interés legítimo cuando corresponda y se cumplan los requisitos legales. Las obligaciones legales pueden requerir conservar o comunicar información en situaciones concretas. Si una finalidad requiere consentimiento, se solicita para esa finalidad y puede retirarse. El permiso del navegador para usar cámara o micrófono controla el acceso a esos dispositivos.'] },
      { id: 'audiencias', heading: 'Quién puede ver tus datos y aportes', paragraphs: ['El correo de la cuenta se usa para el acceso y la gestión de la cuenta. El nombre visible y la foto disponible pueden aparecer en perfiles, publicaciones y conversaciones. Tu presentación, si la agregas al perfil, puede ser visible para otras personas.'], points: [
        'Foros y chat global. El contenido público puede ser leído por visitantes, incluidos quienes navegan sin cuenta. Puede ser copiado o compartido por terceros.',
        'Comunidades. Los foros de una comunidad privada y los chats comunitarios están sujetos a sus permisos de acceso. Los miembros pueden acceder al historial de su chat y guardar copias por su cuenta.',
        'Seguimientos. Cuando sigues a una persona por primera vez, Foris le muestra un aviso con tu nombre visible y un enlace a tu perfil.',
        'Mensajes directos. El acceso normal en la interfaz se limita a las dos cuentas de la conversación. El servidor conserva el historial y aplica controles de acceso. No se ofrece cifrado de extremo a extremo para los mensajes de texto.',
      ], links: [chats] },
      { id: 'proveedores', heading: 'Proveedores y operación internacional', paragraphs: ['Para prestar el servicio, la información pertinente puede ser tratada por proveedores de alojamiento, base de datos, almacenamiento de imágenes y correo de verificación. Google interviene cuando seleccionas su opción de inicio de sesión. Los servicios de conexión y retransmisión WebRTC intervienen según la configuración de la llamada.', 'La operación internacional y los proveedores pueden implicar tratamiento fuera de Ecuador. Las ubicaciones y los destinatarios dependen de la configuración del entorno. Puedes pedir información sobre los proveedores y garantías de transferencia aplicables por el canal de contacto. El acceso o la comunicación a terceros también puede proceder cuando la ley lo requiera.'], links: [contact] },
      { id: 'conservacion', heading: 'Conservación y eliminación', paragraphs: ['La sesión de cuenta se emite por siete días. Los códigos de verificación caducan normalmente a los diez minutos. El indicador de presencia usa una ventana de actividad de 90 segundos y las señales de llamada quedan sujetas a limpieza tras dos minutos. La caducidad y el borrado físico son eventos distintos.', 'El historial de mensajes, las publicaciones y los registros de cuenta no tienen un vencimiento automático uniforme en la aplicación. Se conservan mientras sean necesarios para prestar el servicio y atender las obligaciones que correspondan. Puedes solicitar la eliminación por correo. Cerrar sesión, borrar cookies, dejar de seguir una cuenta o salir de una comunidad no borra por sí solo el historial guardado en el servidor.'], links: [cookies, reports] },
      { id: 'derechos', heading: 'Tus derechos y cómo ejercerlos', paragraphs: ['Cuando resulte aplicable, puedes ejercer tus derechos de información, acceso, rectificación o actualización, eliminación, oposición, portabilidad y suspensión del tratamiento. También puedes retirar un consentimiento cuando el tratamiento se base en él y ejercer los demás derechos que reconozca la normativa aplicable.', 'Escribe al correo del responsable con el derecho que quieres ejercer y una descripción suficiente para localizar los datos. Puede ser necesario verificar que eres titular o representante autorizado. Evita enviar contraseñas, códigos de acceso o documentos completos en el primer contacto. Puedes acudir a la Superintendencia de Protección de Datos Personales de Ecuador o a la autoridad competente según corresponda.'], links: [contact, { label: 'Derechos de los titulares · SPDP', href: 'https://www.spdp.gob.ec/docs/proteccion-de-datos-personales/cuales-son-mis-derechos/' }, { label: 'Cómo presentar una denuncia · SPDP', href: 'https://www.spdp.gob.ec/docs/proteccion-de-datos-personales/denuncias/como-presentar-una-denuncia/' }, { label: 'Ley Orgánica de Protección de Datos Personales · Registro Oficial', href: 'https://www.registroficial.gob.ec/quinto-suplemento-al-registro-oficial-no-459/' }] },
    ],
  },
  {
    slug: 'cookies', title: 'Cookies y almacenamiento',
    description: 'Qué guarda Foris en tu navegador y qué pasa al eliminarlo.',
    sections: [
      { id: 'cookies-tecnicas', heading: 'Cookies propias de Foris', paragraphs: ['Las cookies propias identificadas en la aplicación cumplen funciones de acceso y presencia. En HTTPS, sus nombres llevan el prefijo __Host-. El navegador las envía automáticamente a Foris cuando corresponde.'], points: [
        'foris_session. Mantiene la sesión de la cuenta hasta siete días. Cerrar sesión revoca la sesión actual y elimina esta cookie del navegador.',
        'foris_oauth. Vincula el inicio de sesión elegido con Google con el navegador que lo inició. Dura hasta diez minutos y se limpia al completar el flujo.',
        'foris_google_signup. Conserva de forma cifrada los datos de registro de una cuenta nueva verificada por Google mientras confirmas los términos. Caduca en diez minutos y se borra al crear la cuenta o al iniciar otro acceso con Google.',
        'foris_presence. Distingue navegadores invitados al calcular la actividad reciente del chat global. Es una cookie firmada que puede durar hasta treinta días. Borrarla puede hacer que una próxima visita cuente como un navegador diferente.',
      ] },
      { id: 'almacenamiento-local', heading: 'Preferencias y borradores', paragraphs: ['Foris usa almacenamiento local para recordar el tema de interfaz, el perfil de invitado, el borrador del chat global y una señal que sincroniza cambios de sesión entre pestañas. Estos datos pueden permanecer hasta que se sustituyan o se borren.', 'El almacenamiento de sesión de la pestaña conserva borradores de conversaciones privadas, publicaciones y respuestas, y el estado de procesos de verificación pendientes. Las contraseñas y los códigos de verificación no se guardan allí como preferencias o borradores.'] },
      { id: 'control', heading: 'Cómo controlar estos datos', paragraphs: ['Puedes bloquear cookies o borrar los datos de Foris desde la configuración del navegador. Esto puede cerrar tu sesión, restablecer el tema y el nombre de invitado, eliminar borradores pendientes o impedir que se calcule correctamente la presencia. Un navegador compartido puede conservar datos locales entre usos.', 'Borrar datos del navegador solo afecta esa copia local. Para solicitar acceso o eliminación de información que ya se guardó en el servidor, usa el canal de privacidad. Si eliges ingresar con Google, ese servicio aplica sus propias políticas en sus páginas.'], links: [privacy, reports] },
    ],
  },
  {
    slug: 'normas', title: 'Normas de comunidad',
    description: 'Pautas de convivencia para foros, comunidades, mensajes y llamadas.',
    sections: [
      { id: 'convivencia', heading: 'Participa con respeto', paragraphs: ['Discute las ideas sin atacar a las personas. Respeta los límites de otras personas, incluidas las solicitudes de no recibir más mensajes. Los desacuerdos y la crítica son compatibles con la convivencia cuando no incluyen intimidación, hostigamiento ni amenazas.'] },
      { id: 'prohibido', heading: 'Conductas que incumplen las normas', paragraphs: ['Estas pautas se aplican en espacios públicos y privados, durante las llamadas y al enviar enlaces, nombres, imágenes o texto.'], points: [
        'Amenazas, acoso, extorsión, discriminación, incitación a la violencia y ataques dirigidos contra una persona o grupo.',
        'Explotación o sexualización de menores, difusión de material íntimo sin autorización y uso de llamadas para exponer a otras personas a contenido sexual no solicitado.',
        'Suplantación, fraude, spam, engaños para obtener credenciales y enlaces distribuidos con fines maliciosos.',
        'Compartir datos personales o grabaciones de otras personas sin autorización, acceder a salas ajenas o distribuir invitaciones privadas sin permiso.',
        'Infringir derechos de autor, compartir contenido ilícito o interferir deliberadamente con el servicio y con la participación de otros.',
      ] },
      { id: 'comunidades', heading: 'Cuidar cada espacio', paragraphs: ['Usa títulos claros, publica donde tu aporte sea pertinente y conserva el contexto de tus respuestas. Las comunidades pueden adoptar pautas adicionales compatibles con estas normas. Si administras una comunidad privada, comparte las invitaciones únicamente con las personas a las que están destinadas.'] },
      { id: 'medidas', heading: 'Qué ocurre ante un reporte', paragraphs: ['Foris puede valorar el contexto, el daño, la repetición y la gravedad del caso. Cuando corresponda, puede limitar acceso, retirar contenido o actuar para cumplir una obligación legal. Puedes explicar el contexto o solicitar una revisión por correo.'], links: [reports] },
    ],
  },
  {
    slug: 'chats', title: 'Chats y videollamadas',
    description: 'Alcance de los mensajes, acceso a las salas y permisos de cámara y micrófono.',
    sections: [
      { id: 'tipos', heading: 'Elige la conversación adecuada', paragraphs: ['Los mensajes de texto quedan en el historial del chat correspondiente. Comprueba el nombre del chat antes de enviar información personal o reservada.'], points: [
        'Chat global. Está abierto a visitantes y a cuentas. El nombre de un invitado es un nombre visible elegido por esa persona. El historial es público.',
        'Chats de comunidad. Requieren cuenta verificada y pertenencia a esa comunidad, incluso si el foro de la comunidad es público.',
        'Mensajes directos. Puedes enviar un primer mensaje. Para continuar, la persona que lo recibe puede responder o seguirte. Si no respondió y deja de seguirte, tendrás que esperar para enviar más mensajes. El historial sigue disponible para las dos cuentas.',
      ] },
      { id: 'presencia', heading: 'Qué significa el indicador de presencia', paragraphs: ['En el chat global, Foris distingue cuentas y navegadores invitados con actividad en los últimos 90 segundos. Ese indicador no identifica a los visitantes, no equivale a un recuento de personas únicas y no confirma que alguien haya leído un mensaje.'], links: [cookies] },
      { id: 'entrar', heading: 'Entrar en una videollamada', paragraphs: ['Cada conversación tiene su propia sala. El chat global y el de comunidad permiten hasta cuatro participantes. Una llamada directa admite a las dos cuentas de esa conversación. Entrar requiere una cuenta verificada y los permisos de la conversación, además de tu acción explícita en el botón de entrada.', 'El navegador solicita cámara y micrófono al entrar. Puedes silenciarte, apagar la cámara o salir. Minimizar la llamada conserva la conexión y puede mantener activos ambos dispositivos. La participación dura hasta treinta minutos antes de requerir una nueva entrada.'] },
      { id: 'conexion', heading: 'Audio, vídeo y privacidad', paragraphs: ['Foris no graba ni almacena el audio o el vídeo. La llamada usa WebRTC y conserva de forma temporal señales técnicas para conectar a los participantes. Cuando se establece una conexión directa, la dirección IP puede ser visible para los demás participantes. Si se usa un servicio de retransmisión, este interviene en el transporte.', 'Otras personas pueden copiar mensajes o capturar audio, vídeo o pantalla por su cuenta. No grabes ni compartas una llamada o conversación privada sin la autorización necesaria. Si detectas un abuso, sal de la llamada y repórtalo sin volver a distribuir material sensible.'], links: [privacy, rules, reports] },
    ],
  },
  {
    slug: 'propiedad-intelectual', title: 'Propiedad intelectual',
    description: 'Derechos sobre el contenido que compartes, uso de materiales de terceros y solicitudes de retiro.',
    sections: [
      { id: 'tus-aportes', heading: 'Tus derechos sobre tus aportes', paragraphs: ['Publicar un texto, una imagen u otro aporte en Foris no transfiere la titularidad de la obra. El permiso para alojar y mostrar aportes se limita a la operación del servicio y a la audiencia elegida al publicar, según los términos de uso.'], links: [{ label: 'Términos y condiciones', href: '/legal/terminos' }] },
      { id: 'material-ajeno', heading: 'Antes de compartir una obra ajena', paragraphs: ['Comparte únicamente lo que tengas derecho a usar. Comprueba si la licencia permite subir o reutilizar el material en ese contexto y cumple sus condiciones, incluida la atribución cuando sea necesaria. Mencionar al autor por sí solo no sustituye el permiso cuando este es exigible. Que una obra esté accesible en línea no significa que su reutilización sea libre.', 'Los materiales, la marca y los componentes de terceros conservan los derechos y licencias que les correspondan. La posibilidad de leer una publicación en Foris no concede autorización general para reproducirla o redistribuirla.'], links: [{ label: 'Derecho de autor · SENADI', href: 'https://www.derechosintelectuales.gob.ec/derecho-de-autor/' }] },
      { id: 'retiro', heading: 'Solicitar revisión o retiro', paragraphs: ['Si eres titular de derechos o actúas con su autorización, envía el enlace exacto del contenido, una identificación de la obra original, una explicación de tu relación con ella y un medio de contacto. Indica qué material debería revisarse y por qué. Una referencia al original o a la licencia suele ser más útil que adjuntar copias completas.', 'Si tu aporte fue restringido y tienes permiso, una licencia u otra justificación aplicable, puedes pedir una revisión y aportar esa información por el mismo canal.'], links: [contact, reports] },
    ],
  },
  {
    slug: 'reportes', title: 'Reportes y solicitudes',
    description: 'Cómo contactar a Foris por problemas de convivencia, privacidad, derechos de autor o acceso a tu cuenta.',
    sections: [
      { id: 'canal', heading: 'Contacto', paragraphs: ['El canal público de Foris es el correo de David Barragán. En el asunto, indica si escribes por un reporte, una solicitud de privacidad, un asunto de derechos de autor o un problema de cuenta. Puedes contactar al responsable sin iniciar sesión.'], links: [contact] },
      { id: 'reportar', heading: 'Reportar contenido o comportamiento', paragraphs: ['Describe qué ocurrió, en qué espacio y cuándo. Incluye el enlace si existe o una referencia suficiente al chat, la comunidad o la publicación. Explica el motivo del reporte y qué revisión solicitas. Si ocurrió en un espacio privado, comparte solo el fragmento necesario por correo y oculta datos de personas ajenas al caso.', 'Evita adjuntar contraseñas, códigos, datos íntimos o material ilegal. Si hay peligro inmediato, contacta a los servicios de emergencia o autoridades de tu localidad. El correo de Foris no es un canal de urgencias.'], links: [rules] },
      { id: 'solicitudes', heading: 'Privacidad, cuenta y derechos de autor', paragraphs: ['Si quieres ejercer un derecho sobre tus datos, indica qué derecho quieres ejercer y cómo podemos identificar la cuenta o el contenido pertinente. Si no puedes acceder, indica la función que falló y el mensaje de error. Para derechos de autor, aporta los datos que permitan identificar la obra y el material señalado.'], links: [privacy, copyright] },
      { id: 'seguimiento', heading: 'Seguimiento y revisión', paragraphs: ['Conserva el asunto del mensaje si necesitas agregar información. Para atender el caso, puede ser necesario pedir detalles adicionales o comprobar que estás autorizado para solicitar un cambio. Si quieres que se reconsidere una medida, explica qué ocurrió, qué información nueva aportas y qué decisión quieres que se revise.'] },
    ],
  },
]
