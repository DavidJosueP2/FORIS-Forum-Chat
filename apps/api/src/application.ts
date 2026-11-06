import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Express, Request, Response, NextFunction } from 'express';
import type { Server } from 'node:http';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { APP_CONFIG, APP_LOGGER } from './config/app-config.js';
import type { AppConfig, AppLogger } from './config/app-config.js';

export function configureApplication(app: NestExpressApplication): void {
  const config = app.get<AppConfig>(APP_CONFIG);
  const express = app.getHttpAdapter().getInstance() as Express;
  express.disable('x-powered-by');
  express.set('query parser', 'simple');
  if (config.trustProxy) express.set('trust proxy', config.trustProxy);
  const storageOrigins = config.media.driver === 's3' ? [new URL(config.media.s3.endpoint).origin] : [];
  app.setGlobalPrefix('api');
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.set('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=()');
    next();
  });
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], connectSrc: ["'self'", ...storageOrigins],
        imgSrc: ["'self'", 'blob:', ...storageOrigins],
        mediaSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"], frameAncestors: ["'none'"], upgradeInsecureRequests: null,
      },
    },
    strictTransportSecurity: false,
  }));
  app.useStaticAssets(config.publicDirectory, { etag: true, maxAge: 0 });
  for (const path of ['/login', '/profile', '/chat', '/publicar', '/publicaciones/:id', '/comunidades', '/comunidades/crear', '/comunidades/:id', '/invitaciones/:token', '/notificaciones']) {
    express.get(path, (_request, response) => {
      response.set('Cache-Control', 'no-store');
      response.sendFile('index.html', { root: config.publicDirectory });
    });
  }
}

export async function createApplication(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, abortOnError: false });
  configureApplication(app);
  return app;
}

export async function startServer(app: NestExpressApplication) {
  const config = app.get<AppConfig>(APP_CONFIG);
  const logger = app.get<AppLogger>(APP_LOGGER);
  try {
    await app.listen(config.port, config.host);
  } catch (error) {
    await app.close();
    throw error;
  }
  let closing: Promise<void> | undefined;
  const close = () => { closing ??= app.close(); return closing; };
  logger.info(`Foris disponible en http://${config.host}:${config.port}`);
  return { app, server: app.getHttpServer() as Server, close };
}
