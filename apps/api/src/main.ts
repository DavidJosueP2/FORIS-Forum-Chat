
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApplication, startServer } from './application.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    { bodyParser: false, abortOnError: false },
  );

  configureApplication(app);
  app.enableShutdownHooks();
  await startServer(app);
}

try {
  await bootstrap();
} catch (error) {
  console.error('No se pudo iniciar Foris. Comprueba PostgreSQL y la configuración de .env.');
  console.error(error instanceof Error ? ('code' in error ? error.code : error.message) : 'Error desconocido');
  process.exitCode = 1;
}
