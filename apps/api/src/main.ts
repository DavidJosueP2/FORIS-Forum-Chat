import { createApplication, startServer } from './application.js';

async function bootstrap() {
  const app = await createApplication();
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
