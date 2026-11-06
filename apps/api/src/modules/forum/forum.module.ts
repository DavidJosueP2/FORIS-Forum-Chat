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

@Module({
  imports: [AuthModule, CommunitiesModule, MediaModule],
  controllers: [ForumController, TaxonomyController],
  providers: [ForumRepository, ForumWriteMiddleware, TaxonomyRepository],
})
export class ForumModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ForumWriteMiddleware, json({ limit: '256kb', strict: true }))
      .forRoutes({ path: 'posts', method: RequestMethod.POST }, { path: 'posts/:id/replies', method: RequestMethod.POST }, { path: 'posts/:id', method: RequestMethod.PATCH });
  }
}
