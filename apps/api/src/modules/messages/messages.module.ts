import { Module, RequestMethod } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { json } from 'express';
import { SameOriginMiddleware } from '../../common/middleware/same-origin.middleware.js';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';
import { MessagesRepository } from './messages.repository.js';
import { MessageEventsService } from './message-events.service.js';
import { MessageRateLimitMiddleware } from './middleware/message-rate-limit.middleware.js';
import { CreateMessagePipe, ListMessagesPipe } from './pipes/message-validation.pipe.js';
import { AuthModule } from '../auth/auth.module.js';
import { PresenceRepository } from './presence.repository.js';
import { PresenceIdentityService } from './presence-identity.service.js';
import { AuthHttpMiddleware } from '../auth/auth-http.middleware.js';

@Module({
  imports: [AuthModule],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesRepository, MessageEventsService, CreateMessagePipe, ListMessagesPipe,
    PresenceRepository, PresenceIdentityService, AuthHttpMiddleware],
})
export class MessagesModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthHttpMiddleware, json({ limit: '1kb', strict: true, inflate: false }))
      .forRoutes({ path: 'chat/presence/identity', method: RequestMethod.POST });
    consumer.apply(SameOriginMiddleware, MessageRateLimitMiddleware, json({ limit: '16kb', strict: true }))
      .forRoutes({ path: 'messages', method: RequestMethod.POST });
  }
}
