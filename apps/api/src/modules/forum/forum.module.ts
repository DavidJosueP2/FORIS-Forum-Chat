import { Module, RequestMethod } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { json } from 'express';
import { AuthModule } from '../auth/auth.module.js';
import { CommunitiesModule } from '../communities/communities.module.js';
import { ForumController } from './forum.controller.js';
import { ForumRepository } from './forum.repository.js';
import { ForumWriteMiddleware } from './forum-write.middleware.js';

@Module({
  imports: [AuthModule, CommunitiesModule],
  controllers: [ForumController],
  providers: [ForumRepository, ForumWriteMiddleware],
})
export class ForumModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ForumWriteMiddleware, json({ limit: '64kb', strict: true }))
      .forRoutes({ path: 'posts', method: RequestMethod.POST }, { path: 'posts/:id/replies', method: RequestMethod.POST });
  }
}
