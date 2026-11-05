import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../errors/http-error.js';

@Injectable()
export class SameOriginMiddleware implements NestMiddleware {
  use(request: Request, _response: Response, next: NextFunction): void {
    const origin = request.get('origin');
    const expected = `${request.protocol}://${request.get('host')}`;
    if (origin && origin !== expected) {
      return next(new HttpError(403, 'ORIGIN_REJECTED', 'La solicitud debe proceder de esta aplicación.'));
    }
    if (!request.is('application/json')) {
      return next(new HttpError(415, 'JSON_REQUIRED', 'Envía el mensaje como application/json.'));
    }
    next();
  }
}
