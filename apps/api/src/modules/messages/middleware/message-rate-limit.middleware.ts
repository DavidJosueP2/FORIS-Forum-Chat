import { Inject, Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { APP_CONFIG } from '../../../config/app-config.js';
import type { AppConfig } from '../../../config/app-config.js';

@Injectable()
export class MessageRateLimitMiddleware implements NestMiddleware {
  private readonly limiter: ReturnType<typeof rateLimit>;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.limiter = rateLimit({
      windowMs: 60000,
      limit: config.messagesPerMinute,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: { code: 'RATE_LIMITED', message: 'Has enviado muchos mensajes. Espera un minuto e inténtalo de nuevo.' } },
    });
  }

  use(request: Request, response: Response, next: NextFunction) {
    return this.limiter(request, response, next);
  }
}
