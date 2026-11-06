import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const examplePath = fileURLToPath(new URL('../.env.example', import.meta.url));
let source = existsSync(envPath) ? readFileSync(envPath, 'utf8') : readFileSync(examplePath, 'utf8');
const values = parseEnv(source);
const newline = source.includes('\r\n') ? '\r\n' : '\n';
const defaults: Record<string, string> = {
  APP_URL: 'http://127.0.0.1:5173', TRUST_PROXY: '0',
  AUTH_SECRET: randomBytes(32).toString('base64url'),
  GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '',
  SMTP_HOST: '', SMTP_PORT: '587', SMTP_SECURE: 'false',
  SMTP_USER: '', SMTP_PASSWORD: '', MAIL_FROM: '"Foris - Chat & Enjoy"', MAIL_FROM_ADDRESS: '',
};
for (const [key, value] of Object.entries(defaults)) {
  if (values[key]) continue;
  const assignment = new RegExp('^' + key + '\\s*=.*$', 'm');
  if (assignment.test(source)) {
    if (value) source = source.replace(assignment, () => key + '=' + value);
  } else {
    source = source.trimEnd() + newline + key + '=' + value + newline;
  }
}
writeFileSync(envPath, source.endsWith(newline) ? source : source + newline, { encoding: 'utf8', mode: 0o600 });
console.log('Configuración local de cuentas preparada en .env. No se muestran secretos.');
console.log('Los valores existentes se conservaron. Completa SMTP, MAIL_FROM y Google según docs/authentication.md.');
