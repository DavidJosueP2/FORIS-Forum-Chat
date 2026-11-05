import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigurationModule } from './config/configuration.module.js';
import { DatabaseModule } from './database/database.module.js';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import { MessagesModule } from './modules/messages/messages.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [ConfigurationModule, DatabaseModule, HealthModule, MessagesModule],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
