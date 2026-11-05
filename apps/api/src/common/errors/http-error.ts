import { HttpException } from '@nestjs/common';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export function publicError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  const type = typeof error === 'object' && error !== null && 'type' in error ? error.type : undefined;
  if (type === 'entity.parse.failed') {
    return new HttpError(400, 'INVALID_JSON', 'El contenido JSON no es válido.');
  }
  if (type === 'entity.too.large') {
    return new HttpError(413, 'BODY_TOO_LARGE', 'El contenido supera el tamaño permitido.');
  }
  if (type === 'charset.unsupported' || type === 'encoding.unsupported') {
    return new HttpError(415, 'UNSUPPORTED_ENCODING', 'Usa JSON con codificación UTF-8 y una compresión admitida.');
  }
  if (type === 'request.aborted' || type === 'request.size.invalid') {
    return new HttpError(400, 'INCOMPLETE_REQUEST', 'La solicitud está incompleta. Inténtalo de nuevo.');
  }
  if (error instanceof HttpException) {
    const status = error.getStatus();
    if (status === 404) return new HttpError(404, 'NOT_FOUND', 'No encontramos esta dirección.');
    if (status === 400) return new HttpError(400, 'INVALID_INPUT', 'La solicitud no es válida.');
    if (status === 403) return new HttpError(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.');
    if (status === 401) return new HttpError(401, 'UNAUTHORIZED', 'Inicia sesión para continuar.');
    if (status === 429) return new HttpError(429, 'RATE_LIMITED', 'Espera un minuto e inténtalo de nuevo.');
  }
  return new HttpError(503, 'UNAVAILABLE', 'No pudimos completar la solicitud. Inténtalo de nuevo.');
}
