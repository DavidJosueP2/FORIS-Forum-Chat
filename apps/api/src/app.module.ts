import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigurationModule } from './config/configuration.module.js';
import { DatabaseModule } from './database/database.module.js';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import { ForumModule } from './modules/forum/forum.module.js';
import { MessagesModule } from './modules/messages/messages.module.js';
import { CommunitiesModule } from './modules/communities/communities.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';

@Module({
  imports: [ConfigurationModule, DatabaseModule, HealthModule, AuthModule, CommunitiesModule, MediaModule, ForumModule, MessagesModule],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
