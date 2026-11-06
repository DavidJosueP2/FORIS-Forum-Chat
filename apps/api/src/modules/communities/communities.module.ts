import { Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { json } from 'express';
import { AuthModule } from '../auth/auth.module.js';
import { AuthHttpMiddleware } from '../auth/auth-http.middleware.js';
import { CommunityController } from './community.controller.js';
import { CommunityRepository } from './community.repository.js';
import { NotificationController } from './notification.controller.js';
import { NotificationRepository } from './notification.repository.js';
import { MediaModule } from '../media/media.module.js';
import { CommunityInvitationsRepository } from './community-invitations.repository.js';
import { CommunityInvitationsController, InvitationAcceptanceController } from './community-invitations.controller.js';

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [CommunityController, NotificationController, CommunityInvitationsController, InvitationAcceptanceController],
  providers: [CommunityRepository, NotificationRepository, AuthHttpMiddleware, CommunityInvitationsRepository],
  exports: [CommunityRepository],
})
export class CommunitiesModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthHttpMiddleware, json({ limit: '16kb', strict: true })).forRoutes(CommunityController, NotificationController, CommunityInvitationsController, InvitationAcceptanceController);
  }
}
