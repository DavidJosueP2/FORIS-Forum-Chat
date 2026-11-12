import { parseArgs } from 'node:util';
import { forumCatalog, forumSeedTags } from '../apps/api/src/database/seeds/forum-catalog.js';
import { seedCatalogs } from './demo/catalogs.js';
import { demoPool, demoTransaction, DemoError, localDemoTarget, migrateLocalDatabase } from './demo/local-target.js';
import { prepareDemo } from './demo/plan.js';
import { resetLocalDatabase } from './demo/reset.js';
import { seedDemo } from './demo/seed.js';

const help = [
  'npm run db:migrate                       Aplica migraciones a la base local configurada.',
  'npm run db:reset                         Inventario de la base configurada, solo lectura.',
  'npm run db:reset -- --confirm=<base>      Borra los datos de Foris y sus imágenes registradas.',
  'npm run db:seed:catalogs                  Carga categorías y etiquetas oficiales.',
  'npm run db:seed:demo                      Carga la demo con las imágenes WebP del repositorio.',
  'Añade --dry-run al seed para revisar el plan sin conectarte a PostgreSQL.',
  'Configuración y preparación: docs/demo.md',
].join('\n');

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const { values } = parseArgs({ args, options: { 'dry-run': { type: 'boolean' }, confirm: { type: 'string' }, help: { type: 'boolean' } } });
  if (values.help || !command) { console.info(help); return; }
  if (command !== 'migrate' && command !== 'reset' && command !== 'catalogs' && command !== 'demo') {
    throw new DemoError('Comando de datos desconocido.');
  }
  const target = localDemoTarget();
  const { config, database, connection } = target;
  if (values.confirm !== undefined && (command !== 'reset' || values.confirm !== database || values['dry-run'])) {
    throw new DemoError('Solo el reset admite --confirm y debe coincidir con PGDATABASE=' + database + '.');
  }
  console.info('Destino local', { base: database, servidor: connection.host, puerto: connection.port, archivos: config.media.localRoot });
  const plan = command === 'demo' ? await prepareDemo(config.media, JSON.stringify([database, connection.port])) : undefined;
  if (plan) {
    console.info('Plan de la demo', { cuentas: plan.people.length, comunidades: plan.posts.length,
      publicaciones: plan.posts.length, comentarios: plan.posts.reduce((sum, post) => sum + post.replies.length, 0),
      imagenesWebP: plan.assets.size, bytes: plan.bytes.toString() });
  }
  if (command === 'catalogs') console.info('Catálogo oficial', { categorias: forumCatalog.length, etiquetas: forumSeedTags.length });
  if (values['dry-run'] && command !== 'reset') return;

  const password = process.env.FORIS_DEMO_PASSWORD;
  if (command === 'demo' && !config.auth?.secret) throw new DemoError('Configura AUTH_SECRET con npm run setup:auth para poder abrir las imágenes locales.');
  if (command === 'demo' && password && (password.length < 15 || password.length > 128)) {
    throw new DemoError('FORIS_DEMO_PASSWORD debe tener entre 15 y 128 caracteres.');
  }

  const pool = demoPool(target);
  try {
    if (command === 'reset') {
      const apply = values.confirm === database;
      await resetLocalDatabase(pool, database, config.media, apply);
      console.info(apply ? 'Datos de Foris eliminados en ' + database + '.' : 'Simulación. Para borrar, añade --confirm=' + database + '.');
      return;
    }
    await migrateLocalDatabase(pool, database);
    if (command === 'migrate') {
      console.info('Migraciones al día en ' + database + '.');
      return;
    }
    if (command === 'catalogs') {
      await demoTransaction(pool, database, seedCatalogs);
      console.info('Catálogo cargado.');
    } else if (plan) {
      const created = await seedDemo(pool, database, config, plan, password);
      console.info(created ? 'Demo cargada.' : 'La demo ya estaba cargada. Conservamos los datos y cambios existentes.');
      if (created && password) console.info('Cuenta para entrar: ana@foris-demo.test. Usa la contraseña configurada en privado.');
    }
  } finally {
    await pool.end();
  }
}

try { await main(); }
catch (error) {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    && /^[A-Z0-9_]{1,32}$/u.test(error.code) ? ' (' + error.code + ')' : '';
  console.error(error instanceof DemoError ? error.message : 'La operación se detuvo' + code + '. Revisa docs/demo.md, la configuración local y el estado de la base.');
  process.exitCode = 1;
}
