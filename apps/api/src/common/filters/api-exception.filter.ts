import { Catch, Inject } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { APP_LOGGER } from '../../config/app-config.js';
import type { AppLogger } from '../../config/app-config.js';
import { publicError } from '../errors/http-error.js';
import { errorDiagnostics } from '../errors/error-diagnostics.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(@Inject(APP_LOGGER) private readonly logger: AppLogger) {}

  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const safe = publicError(error);
    const requestId = randomUUID();
    // El path de Express excluye la consulta: códigos OAuth y tickets no entran al log.
    const route: unknown = request.route?.path;
    const details = {
      requestId, method: request.method,
      path: typeof route === 'string' ? request.baseUrl + route : request.path,
      status: safe.status, code: safe.code, message: safe.message,
      error: errorDiagnostics(error),
    };
    if (safe.status >= 500) this.logger.error('request_failed', details);
    else this.logger.info('request_rejected', details);
    if (response.headersSent) { response.end(); return; }
    response.set('X-Request-Id', requestId);
    response.status(safe.status).json({ error: { code: safe.code, message: safe.message } });
  }
}
