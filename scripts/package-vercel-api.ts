import { access, copyFile, cp, mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Services aplana outputDirectory. Conservar apps/api mantiene la resolución ESM
// y las rutas que la API obtiene de @messages/api/package.json.
const apiRoot = fileURLToPath(new URL('../apps/api/', import.meta.url));
const compiledRoot = join(apiRoot, 'dist');
const outputRoot = join(compiledRoot, 'vercel');
const runtimeApi = join(outputRoot, 'apps', 'api');

await access(join(compiledRoot, 'main.js'));
const entries = await readdir(compiledRoot, { withFileTypes: true });
await mkdir(join(runtimeApi, 'dist'), { recursive: true });
for (const entry of entries) {
  if (entry.name === 'vercel') continue;
  await cp(join(compiledRoot, entry.name), join(runtimeApi, 'dist', entry.name), { recursive: true });
}
await copyFile(join(apiRoot, 'package.json'), join(runtimeApi, 'package.json'));
await writeFile(
  join(outputRoot, 'package.json'),
  JSON.stringify({ private: true, type: 'module', main: 'index.mjs' }, null, 2) + '\n',
);
// La importación dinámica permite registrar fallos de carga antes de crear Nest.
await writeFile(join(outputRoot, 'index.mjs'), [
  "console.info('foris_starting', { phase: 'entrypoint', node: process.version });",
  "void import('./apps/api/dist/main.js').catch((error) => {",
  "  console.error('foris_startup_failed', { phase: 'import', type: error instanceof Error ? error.name : 'unknown', code: error?.code });",
  '  process.exitCode = 1;',
  '});',
  '',
].join('\n'));
