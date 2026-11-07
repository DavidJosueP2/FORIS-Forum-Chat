import { Inject, Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { APP_CONFIG } from '../../config/app-config.js';
import type { AppConfig } from '../../config/app-config.js';
import { HttpError } from '../errors/http-error.js';

@Injectable()
export class SameOriginMiddleware implements NestMiddleware {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    const origin = request.get('origin');
    // El proxy puede entregar HTTP o un host interno aunque el navegador use HTTPS.
    // La autoridad es APP_URL, igual que en autenticación; nunca Host ni X-Forwarded-*.
    const expected = this.config.auth?.origin;
    if (origin && origin !== expected) {
      return next(new HttpError(403, 'ORIGIN_REJECTED', 'La solicitud debe proceder de esta aplicación.'));
    }
    if (!request.is('application/json')) {
      return next(new HttpError(415, 'JSON_REQUIRED', 'Envía el mensaje como application/json.'));
    }
    next();
  }
}
