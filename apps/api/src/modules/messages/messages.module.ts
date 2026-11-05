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

@Module({
  imports: [AuthModule],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesRepository, MessageEventsService, CreateMessagePipe, ListMessagesPipe],
})
export class MessagesModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SameOriginMiddleware, MessageRateLimitMiddleware, json({ limit: '16kb', strict: true }))
      .forRoutes({ path: 'messages', method: RequestMethod.POST });
  }
}
