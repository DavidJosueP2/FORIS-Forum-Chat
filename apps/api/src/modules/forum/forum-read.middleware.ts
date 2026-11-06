import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { HttpError } from '../../common/errors/http-error.js';

@Injectable()
export class ForumReadMiddleware implements NestMiddleware {
  private readonly limit = rateLimit({
    windowMs: 60000, limit: 240, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_request, _response, next) => next(new HttpError(429, 'FORUM_READ_LIMIT', 'Has hecho varias consultas seguidas. Espera un momento antes de volver a buscar.')),
  });
  use(request: Request, response: Response, next: NextFunction): void { this.limit(request, response, next); }
}
