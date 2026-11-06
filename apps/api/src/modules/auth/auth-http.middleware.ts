import { Inject, Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { SessionService } from './session.service.js';
import { HttpError } from '../../common/errors/http-error.js';

@Injectable()
export class AuthHttpMiddleware implements NestMiddleware {
  private readonly limit = rateLimit({
    windowMs: 15 * 60000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new HttpError(429, 'AUTH_RATE_LIMIT', 'Hay demasiados intentos. Espera unos minutos.')),
  });
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}
  use(request: Request, response: Response, next: NextFunction): void {
    response.set('Cache-Control', 'no-store');
    response.set('Referrer-Policy', 'no-referrer');
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) { next(); return; }
    if (request.get('origin') !== this.sessions.config.origin) {
      next(new HttpError(403, 'ORIGIN_REJECTED', 'La solicitud debe proceder de Foris.')); return;
    }
    if (!request.is('application/json')) {
      next(new HttpError(415, 'JSON_REQUIRED', 'Envía los datos como JSON.')); return;
    }
    this.limit(request, response, next);
  }
}
