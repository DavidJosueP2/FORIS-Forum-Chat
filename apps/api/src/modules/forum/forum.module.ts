import { Module, RequestMethod } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { json } from 'express';
import { AuthModule } from '../auth/auth.module.js';
import { CommunitiesModule } from '../communities/communities.module.js';
import { MediaModule } from '../media/media.module.js';
import { ForumController } from './forum.controller.js';
import { ForumRepository } from './forum.repository.js';
import { ForumWriteMiddleware } from './forum-write.middleware.js';
import { TaxonomyController } from './taxonomy.controller.js';
import { TaxonomyRepository } from './taxonomy.repository.js';
import { ForumReadMiddleware } from './forum-read.middleware.js';
import { ForumAccess } from './forum-access.service.js';
import { ForumDiscussionRepository } from './forum-discussion.repository.js';
import { ForumFollowRepository } from './forum-follow.repository.js';
import { ForumFollowController } from './forum-follow.controller.js';
import { SearchRepository } from './search.repository.js';

@Module({
  imports: [AuthModule, CommunitiesModule, MediaModule],
  controllers: [ForumController, TaxonomyController, ForumFollowController],
  providers: [ForumRepository, ForumDiscussionRepository, ForumFollowRepository, ForumAccess, ForumWriteMiddleware, ForumReadMiddleware, TaxonomyRepository, SearchRepository],
})
export class ForumModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ForumReadMiddleware).forRoutes({ path: 'search', method: RequestMethod.GET });
    consumer.apply(ForumReadMiddleware).forRoutes({ path: 'authors/:id', method: RequestMethod.GET }, { path: 'authors/:id/posts', method: RequestMethod.GET }, { path: 'authors/:id/communities', method: RequestMethod.GET });
    consumer.apply(ForumWriteMiddleware, json({ limit: '8kb', strict: true })).forRoutes({ path: 'authors/:id/follow', method: RequestMethod.PUT });
    consumer.apply(ForumReadMiddleware).forRoutes({ path: 'posts', method: RequestMethod.GET }, { path: 'posts/:id', method: RequestMethod.GET }, { path: 'posts/:id/replies', method: RequestMethod.GET }, { path: 'posts/:id/replies/:replyId', method: RequestMethod.GET }, { path: 'taxonomy/tags', method: RequestMethod.GET });
    consumer.apply(ForumWriteMiddleware, json({ limit: '256kb', strict: true }))
      .forRoutes({ path: 'posts', method: RequestMethod.POST }, { path: 'posts/:id/replies', method: RequestMethod.POST }, { path: 'posts/:id', method: RequestMethod.PATCH },
        { path: 'posts/:id/replies/:replyId', method: RequestMethod.PATCH }, { path: 'posts/:id/replies/:replyId', method: RequestMethod.DELETE },
        { path: 'posts/:id/vote', method: RequestMethod.PUT }, { path: 'posts/:id/replies/:replyId/vote', method: RequestMethod.PUT }, { path: 'posts/:id/replies/:replyId/pin', method: RequestMethod.PUT });
  }
}
