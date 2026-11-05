import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

const target = new URL('../.env', import.meta.url);
let content = '';
try {
  content = await readFile(target, 'utf8');
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
}
const existing = parseEnv(content);
const defaults = {
  APP_PORT: '3000', HOST: '127.0.0.1', PGHOST: '127.0.0.1', PGPORT: '5433',
  PGDATABASE: 'messages', PGUSER: 'messages', PGPASSWORD: randomBytes(32).toString('hex'),
  SONAR_PORT: '9000', SONAR_DB_PASSWORD: randomBytes(32).toString('hex'),
};
for (const [key, value] of Object.entries(defaults)) {
  if (existing[key]) continue;
  const lines = content.split(/\r?\n/u);
  const index = lines.findIndex(line => line.startsWith(`${key}=`));
  if (index === -1) lines.push(`${key}=${value}`);
  else lines[index] = `${key}=${value}`;
  content = lines.join('\n');
}
if (!Object.hasOwn(existing, 'SONAR_TOKEN')) content += '\nSONAR_TOKEN=\n';
await writeFile(target, content.trim() + '\n', { mode: 0o600 });
console.info('Configuración local lista. Las claves existentes se conservaron y las nuevas se guardaron en .env.');
