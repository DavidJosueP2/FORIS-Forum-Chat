const hints: Record<string, string> = {
  MEDIA_STORAGE_CHANGED: 'La imagen pertenece a otro perfil de almacenamiento. Cambiar de disco a S3 no migra sus archivos.',
  ORIGIN_REJECTED: 'Abre el frontend desde el origen exacto de APP_URL y reinicia la API tras cambiarlo.',
  AccessDenied: 'Revisa las credenciales S3 y el permiso de lectura/escritura sobre el bucket seleccionado.',
  InvalidAccessKeyId: 'El proveedor no reconoce S3_ACCESS_KEY_ID. Usa las credenciales de la API S3 del bucket.',
  SignatureDoesNotMatch: 'Revisa las credenciales S3, región, endpoint, reloj del servidor y los encabezados firmados.',
  ExpiredRequest: 'El permiso temporal caducó. Solicita una nueva autorización de subida.',
  RequestTimeTooSkewed: 'Sincroniza la fecha y hora del servidor que firma las solicitudes.',
  NoSuchBucket: 'Comprueba S3_BUCKET y que pertenezca a la cuenta de S3_ENDPOINT.',
  InvalidArgument: 'El proveedor rechazó los parámetros. Revisa el formato de las credenciales, endpoint, bucket y región S3.',
  ENOTFOUND: 'No se pudo resolver el host. Revisa el endpoint y el DNS.',
  ECONNREFUSED: 'El destino rechazó la conexión. Comprueba el host, puerto y servicio.',
  ECONNRESET: 'La conexión se interrumpió antes de completar la operación.',
  ETIMEDOUT: 'El destino no respondió dentro del plazo. Revisa conectividad y disponibilidad.',
  TimeoutError: 'La operación superó su tiempo de espera.',
  AbortError: 'La operación fue cancelada o agotó su tiempo de espera.',
  EACCES: 'El proceso no tiene permiso para acceder al directorio de almacenamiento local.',
  EPERM: 'El sistema denegó el acceso al almacenamiento local.',
  EROFS: 'El sistema de archivos es de solo lectura. En producción configura almacenamiento S3.',
  ENOSPC: 'No queda espacio disponible en el disco del servidor.',
  '28P01': 'PostgreSQL rechazó la autenticación. Revisa sus credenciales en el entorno del servidor.',
  '42P01': 'Falta una tabla de PostgreSQL. Revisa el estado de las migraciones.',
  '42703': 'Falta una columna de PostgreSQL. Revisa el estado de las migraciones.',
};

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}
function identifier(value: unknown): string | undefined {
  return typeof value === 'string' && /^[\w.-]{1,120}$/u.test(value) ? value : undefined;
}
function hintFor(code: string): string | undefined {
  return Object.hasOwn(hints, code) ? hints[code] : undefined;
}

export interface ErrorDiagnostics {
  type: string;
  code?: string;
  upstreamStatus?: number;
  upstreamRequestId?: string;
  hint?: string;
  frames?: string[];
  cause?: ErrorDiagnostics;
}

/** Selección explícita: nunca serializar mensajes internos, SQL, cuerpos, cabeceras ni URLs firmadas. */
export function errorDiagnostics(error: unknown, seen = new Set<object>(), depth = 0): ErrorDiagnostics {
  const fields = record(error);
  const type = identifier(fields?.name) ?? 'UnknownError';
  if (!fields || seen.has(fields) || depth >= 4) return { type };
  seen.add(fields);
  const code = identifier(fields.code) ?? identifier(fields.Code);
  const metadata = record(fields.$metadata);
  const status = metadata?.httpStatusCode;
  const requestId = identifier(metadata?.requestId);
  const hint = hintFor(code ?? '') ?? hintFor(type);
  // Retirar el mensaje completo, también si contiene saltos de línea que imitan frames.
  const header = error instanceof Error ? `${error.name}: ${error.message}` : undefined;
  const trace = header && typeof fields.stack === 'string' && fields.stack.startsWith(header) ? fields.stack.slice(header.length) : '';
  const frames = trace.split('\n')
    .filter(line => /^\s+at /u.test(line))
    .slice(0, 6)
    .map(line => line.trim().replace(/https?:\/\/[^\s)]+/gu, '[url omitida]').slice(0, 300));
  return {
    type,
    ...(code ? { code } : {}),
    ...(typeof status === 'number' && status >= 100 && status <= 599 ? { upstreamStatus: status } : {}),
    ...(requestId ? { upstreamRequestId: requestId } : {}),
    ...(hint ? { hint } : {}),
    ...(frames.length && type !== 'HttpError' ? { frames } : {}),
    ...(fields.cause ? { cause: errorDiagnostics(fields.cause, seen, depth + 1) } : {}),
  };
}
