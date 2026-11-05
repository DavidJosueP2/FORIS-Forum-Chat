export interface AuthConfig {
  origin: string;
  secret: string;
  secureCookies: boolean;
  google: { clientId: string; clientSecret: string; callbackUrl: string };
  mail: { host: string; port: number; secure: boolean; user: string; password: string; from: string; fromAddress?: string };
}
export function readAuthConfig(env: NodeJS.ProcessEnv): AuthConfig {
  const url = new URL(env.APP_URL || 'http://127.0.0.1:5173');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash) throw new Error('APP_URL debe ser el origen público de Foris.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !local) throw new Error('APP_URL requiere HTTPS fuera de localhost.');
  const secret = env.AUTH_SECRET || '';
  if (secret && secret.length < 32) throw new Error('AUTH_SECRET debe tener al menos 32 caracteres aleatorios.');
  const mailPort = Number(env.SMTP_PORT || '587');
  if (!Number.isInteger(mailPort) || mailPort < 1 || mailPort > 65535) throw new Error('SMTP_PORT no es válido.');
  const clientId = env.GOOGLE_CLIENT_ID || '';
  const clientSecret = env.GOOGLE_CLIENT_SECRET || '';
  if (Boolean(clientId) !== Boolean(clientSecret)) throw new Error('Completa ambas credenciales de Google.');
  return {
    origin: url.origin, secret, secureCookies: url.protocol === 'https:',
    google: { clientId, clientSecret, callbackUrl: url.origin + '/api/auth/google/callback' },
    mail: {
      host: env.SMTP_HOST || '', port: mailPort,
      secure: env.SMTP_SECURE === 'true' || mailPort === 465,
      user: env.SMTP_USER || '', password: env.SMTP_PASSWORD || '', from: env.MAIL_FROM || '',
      fromAddress: env.MAIL_FROM_ADDRESS || '',
    },
  };
}
