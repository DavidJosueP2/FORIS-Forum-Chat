import { Inject, Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { APP_CONFIG } from '../../config/app-config.js';
import type { AppConfig } from '../../config/app-config.js';
import { HttpError } from '../../common/errors/http-error.js';
import { SessionService } from '../auth/session.service.js';
import type { AuthRequest } from '../auth/auth.types.js';
import { MediaService } from './media.service.js';
import { mediaId } from './media-validation.js';

@Injectable()
export class MediaHttpMiddleware implements NestMiddleware {
  private readonly reads = rateLimit({ windowMs: 60000, limit: 600, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new HttpError(429, 'MEDIA_RATE_LIMIT', 'Espera un momento antes de consultar más imágenes.')) });
  private readonly writes = rateLimit({ windowMs: 15 * 60000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new HttpError(429, 'MEDIA_RATE_LIMIT', 'Espera unos minutos antes de volver a subir imágenes.')) });
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}
  use(request: Request, response: Response, next: NextFunction) {
    response.set('Cache-Control', 'no-store').set('Referrer-Policy', 'no-referrer');
    if (request.method === 'GET' || request.method === 'HEAD') { this.reads(request, response, next); return; }
    if (request.get('origin') !== this.config.auth?.origin) { next(new HttpError(403, 'ORIGIN_REJECTED', 'Adjunta archivos desde Foris.')); return; }
    if (request.method !== 'PUT' && !request.is('application/json')) { next(new HttpError(415, 'JSON_REQUIRED', 'Envía los datos como JSON.')); return; }
    this.writes(request, response, next);
  }
}
@Injectable()
export class MediaLocalUploadMiddleware implements NestMiddleware {
  constructor(@Inject(MediaService) private readonly media: MediaService, @Inject(SessionService) private readonly sessions: SessionService) {}
  async use(request: AuthRequest, response: Response, next: NextFunction) {
    try {
      const actor = await this.sessions.required(request);
      await this.media.authorizeLocalUpload(mediaId(request.params.id), request.query, actor, request.get('content-type'));
      const timeout = setTimeout(() => request.destroy(), 30000);
      timeout.unref();
      response.once('finish', () => clearTimeout(timeout));
      request.once('close', () => clearTimeout(timeout));
      next();
    } catch (error) { next(error); }
  }
}
