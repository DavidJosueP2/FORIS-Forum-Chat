import { Inject, Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { SessionService } from '../auth/session.service.js';
import { HttpError } from '../../common/errors/http-error.js';

@Injectable()
export class ForumWriteMiddleware implements NestMiddleware {
  private readonly limit = rateLimit({
    windowMs: 10 * 60000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new HttpError(429, 'FORUM_RATE_LIMIT', 'Espera unos minutos antes de participar de nuevo.')),
  });
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}
  use(request: Request, response: Response, next: NextFunction): void {
    if (request.get('origin') !== this.sessions.config.origin) {
      next(new HttpError(403, 'ORIGIN_REJECTED', 'Realiza esta acción desde Foris.')); return;
    }
    if (!request.is('application/json')) {
      next(new HttpError(415, 'JSON_REQUIRED', 'Envía el contenido como JSON.')); return;
    }
    this.limit(request, response, next);
  }
}
