import { Module, RequestMethod } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { json } from 'express';
import { SameOriginMiddleware } from '../../common/middleware/same-origin.middleware.js';
import { AuthModule } from '../auth/auth.module.js';
import { ForumReadMiddleware } from '../forum/forum-read.middleware.js';
import { MessageRateLimitMiddleware } from '../messages/middleware/message-rate-limit.middleware.js';
import { ConversationsController } from './conversations.controller.js';
import { ConversationsRepository } from './conversations.repository.js';

@Module({ imports: [AuthModule], controllers: [ConversationsController], providers: [ConversationsRepository, ForumReadMiddleware] })
export class ConversationsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ForumReadMiddleware).forRoutes({ path: 'conversations', method: RequestMethod.GET },
      { path: 'conversations/direct/:peer', method: RequestMethod.GET }, { path: 'conversations/:room/messages', method: RequestMethod.GET });
    consumer.apply(SameOriginMiddleware, MessageRateLimitMiddleware, json({ limit: '16kb', strict: true, inflate: false }))
      .forRoutes({ path: 'conversations/:room/messages', method: RequestMethod.POST });
  }
}
