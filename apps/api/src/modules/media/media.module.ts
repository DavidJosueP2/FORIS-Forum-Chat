import { Inject, Module, RequestMethod } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { json, raw } from 'express';
import { APP_CONFIG } from '../../config/app-config.js';
import type { AppConfig } from '../../config/app-config.js';
import { AuthModule } from '../auth/auth.module.js';
import { OBJECT_STORAGE } from './storage.port.js';
import { LocalStorageAdapter } from './adapters/local-storage.adapter.js';
import { S3StorageAdapter } from './adapters/s3-storage.adapter.js';
import { MediaRepository } from './media.repository.js';
import { MediaService } from './media.service.js';
import { MediaController, MediaLocalController } from './media.controller.js';
import { MediaHttpMiddleware, MediaLocalUploadMiddleware } from './media-http.middleware.js';
import { AccountAvatarController, PublicAvatarController } from './account-avatar.controller.js';
import { AuthHttpMiddleware } from '../auth/auth-http.middleware.js';

@Module({
  imports: [AuthModule],
  controllers: [MediaController, MediaLocalController, AccountAvatarController, PublicAvatarController],
  providers: [MediaRepository, MediaService, MediaHttpMiddleware, MediaLocalUploadMiddleware, AuthHttpMiddleware,
    { provide: OBJECT_STORAGE, inject: [APP_CONFIG], useFactory: (config: AppConfig) => config.media.driver === 'local'
      ? new LocalStorageAdapter(config.media, config.auth?.secret ?? '') : new S3StorageAdapter(config.media) }],
  exports: [MediaRepository],
})
export class MediaModule implements NestModule {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthHttpMiddleware, json({ limit: '16kb', strict: true })).forRoutes(AccountAvatarController);
    consumer.apply(MediaHttpMiddleware).forRoutes(PublicAvatarController);
    consumer.apply(MediaHttpMiddleware).forRoutes({ path: 'media/{*path}', method: RequestMethod.ALL });
    consumer.apply(json({ limit: '16kb', strict: true })).forRoutes(
      { path: 'media/uploads', method: RequestMethod.POST },
      { path: 'media/:id/complete', method: RequestMethod.POST },
      { path: 'media/:id', method: RequestMethod.DELETE },
    );
    consumer.apply(MediaLocalUploadMiddleware, raw({ type: () => true, limit: this.config.media.maxBytes, inflate: false }))
      .forRoutes({ path: 'media/:id/local-upload', method: RequestMethod.PUT });
  }
}
