import { Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { json } from 'express';
import { AuthModule } from '../auth/auth.module.js';
import { AuthHttpMiddleware } from '../auth/auth-http.middleware.js';
import { CommunityController } from './community.controller.js';
import { CommunityRepository } from './community.repository.js';
import { NotificationController } from './notification.controller.js';
import { NotificationRepository } from './notification.repository.js';

@Module({
  imports: [AuthModule],
  controllers: [CommunityController, NotificationController],
  providers: [CommunityRepository, NotificationRepository, AuthHttpMiddleware],
  exports: [CommunityRepository],
})
export class CommunitiesModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthHttpMiddleware, json({ limit: '16kb', strict: true })).forRoutes(CommunityController, NotificationController);
  }
}
