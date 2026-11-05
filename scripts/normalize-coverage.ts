import { readFile, writeFile } from 'node:fs/promises';

const target = new URL('../coverage/lcov.info', import.meta.url);
const content = await readFile(target, 'utf8');
const normalized = content.split(/\r?\n/u).map(line => line.startsWith('SF:') ? line.replaceAll('\\', '/') : line).join('\n');
await writeFile(target, normalized);
console.info('Informe LCOV listo para SonarQube en Windows o Linux.');
