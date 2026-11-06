
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApplication, startServer } from './application.js';

let startupPhase = 'nest';

async function bootstrap() {
  console.info('foris_starting', { phase: startupPhase });
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    { bodyParser: false, abortOnError: false },
  );

  startupPhase = 'configuration';
  configureApplication(app);
  app.enableShutdownHooks();
  startupPhase = 'listen';
  console.info('foris_starting', { phase: startupPhase });
  await startServer(app);
}

// La carga del módulo no espera a las conexiones del arranque de Nest.
void bootstrap().catch((error: unknown) => {
  console.error('foris_startup_failed', { phase: startupPhase });
  console.error(error instanceof Error ? ('code' in error ? error.code : error.message) : 'Error desconocido');
  process.exitCode = 1;
});
