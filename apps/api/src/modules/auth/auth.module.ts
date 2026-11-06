import { Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { json } from 'express';
import { AuthController } from './auth.controller.js';
import { AccountController } from './account.controller.js';
import { AuthService } from './auth.service.js';
import { AuthRepository } from './auth.repository.js';
import { AuthMailService } from './auth-mail.service.js';
import { OtpService } from './otp.service.js';
import { SessionService } from './session.service.js';
import { GoogleAuthService } from './google-auth.service.js';
import { AuthHttpMiddleware } from './auth-http.middleware.js';

@Module({
  controllers: [AuthController, AccountController],
  providers: [AuthService, AuthRepository, AuthMailService, OtpService, SessionService, GoogleAuthService, AuthHttpMiddleware],
  exports: [SessionService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthHttpMiddleware, json({ limit: '16kb', strict: true })).forRoutes(AuthController, AccountController);
  }
}
