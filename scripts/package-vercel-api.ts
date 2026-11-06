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
await writeFile(join(outputRoot, 'index.mjs'), "import './apps/api/dist/main.js';\n");
