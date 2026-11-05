import { Inject, Injectable, Module, RequestMethod } from '@nestjs/common';
import type { MiddlewareConsumer, NestMiddleware, NestModule } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { json } from 'express';
import rateLimit from 'express-rate-limit';
import { APP_CONFIG } from '../../config/app-config.js';
import type { AppConfig } from '../../config/app-config.js';
import { HttpError } from '../../common/errors/http-error.js';
import { AuthModule } from '../auth/auth.module.js';
import { VideoCallController } from './video-call.controller.js';
import { VideoCallRepository } from './video-call.repository.js';
import { VideoCallService } from './video-call.service.js';

@Injectable()
export class VideoCallMiddleware implements NestMiddleware {
  private readonly limit = rateLimit({ windowMs: 60000, limit: 240, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_request, _response, next) => next(new HttpError(429, 'CALL_RATE_LIMIT', 'Espera un momento antes de volver a conectar.')) });
  private readonly joins = rateLimit({ windowMs: 60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_request, _response, next) => next(new HttpError(429, 'CALL_RATE_LIMIT', 'Has intentado entrar varias veces. Espera un minuto.')) });
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}
  use(request: Request, response: Response, next: NextFunction) {
    response.set('Cache-Control', 'no-store').set('Referrer-Policy', 'no-referrer');
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      if (request.get('origin') !== this.config.auth?.origin) return next(new HttpError(403, 'ORIGIN_REJECTED', 'Entra a la videollamada desde Foris.'));
      if (!request.is('application/json')) return next(new HttpError(415, 'JSON_REQUIRED', 'Envía la señal como JSON.'));
    }
    this.limit(request, response, error => {
      if (error) return next(error);
      if (request.method === 'POST' && request.path.endsWith('/join')) { this.joins(request, response, next); return; }
      next();
    });
  }
}
@Module({ imports: [AuthModule], controllers: [VideoCallController], providers: [VideoCallRepository, VideoCallService, VideoCallMiddleware] })
export class VideoCallModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VideoCallMiddleware).forRoutes(
      { path: 'video-call', method: RequestMethod.GET }, { path: 'video-call', method: RequestMethod.HEAD },
    );
    consumer.apply(VideoCallMiddleware, json({ limit: '80kb', strict: true, inflate: false }))
      .forRoutes({ path: 'video-call/{*path}', method: RequestMethod.POST });
  }
}
