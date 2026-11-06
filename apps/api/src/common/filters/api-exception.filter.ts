import { Catch, Inject } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { APP_LOGGER } from '../../config/app-config.js';
import type { AppLogger } from '../../config/app-config.js';
import { publicError } from '../errors/http-error.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(@Inject(APP_LOGGER) private readonly logger: AppLogger) {}

  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) { response.end(); return; }
    const safe = publicError(error);
    if (safe.status === 503) {
      const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' && /^[A-Z0-9]{5}$/u.test(error.code) ? error.code : undefined;
      // Solo SQLSTATE: omitir mensajes, consultas y valores que puedan contener datos privados.
      this.logger.error('request_failed', { type: error instanceof Error ? error.name : 'UnknownError', ...(code ? { code } : {}) });
    }
    response.status(safe.status).json({ error: { code: safe.code, message: safe.message } });
  }
}
