export interface CloudflareTurnConfig { provider: 'cloudflare'; keyId: string; apiToken: string }
export type TurnConfig = CloudflareTurnConfig | { provider: 'coturn'; urls: string[]; secret: string };
export interface VideoCallConfig { enabled: boolean; stunUrls: string[]; turn: TurnConfig | null }
function urls(value: string, pattern: RegExp): string[] {
  const result = value.split(',').map(item => item.trim()).filter(Boolean);
  if (result.length > 4 || result.some(item => !pattern.test(item))) throw new Error('Las URLs ICE de videollamadas no son válidas.');
  return result;
}
export function readVideoCallConfig(env: NodeJS.ProcessEnv): VideoCallConfig {
  if (env.CALLS_ENABLED && !['true', 'false'].includes(env.CALLS_ENABLED)) throw new Error('CALLS_ENABLED debe ser true o false.');
  const enabled = env.CALLS_ENABLED ? env.CALLS_ENABLED === 'true' : env.NODE_ENV !== 'production';
  const stunUrls = urls(env.CALLS_STUN_URLS ?? 'stun:stun.l.google.com:19302', /^stuns?:[a-z0-9.-]+(?::\d{1,5})?$/iu);
  const provider = env.CALLS_TURN_PROVIDER?.trim() || 'coturn';
  let turn: TurnConfig | null = null;
  if (provider === 'cloudflare') {
    if (env.CALLS_TURN_URLS || env.CALLS_TURN_SECRET) throw new Error('Cloudflare TURN no utiliza CALLS_TURN_URLS ni CALLS_TURN_SECRET. Deja esas variables vacías.');
    const keyId = env.CALLS_CLOUDFLARE_TURN_KEY_ID?.trim() || '';
    const apiToken = env.CALLS_CLOUDFLARE_TURN_API_TOKEN?.trim() || '';
    if (!/^[\w-]{16,128}$/u.test(keyId) || !/^[\x21-\x7e]{16,1024}$/u.test(apiToken)) throw new Error('Configura CALLS_CLOUDFLARE_TURN_KEY_ID y CALLS_CLOUDFLARE_TURN_API_TOKEN con las credenciales de una clave TURN de Cloudflare.');
    turn = { provider, keyId, apiToken };
  } else if (provider === 'coturn') {
    if (env.CALLS_CLOUDFLARE_TURN_KEY_ID || env.CALLS_CLOUDFLARE_TURN_API_TOKEN) throw new Error('Para las credenciales de Cloudflare, selecciona CALLS_TURN_PROVIDER=cloudflare.');
    const turnUrls = urls(env.CALLS_TURN_URLS || '', /^turns?:[a-z0-9.-]+(?::\d{1,5})?(?:\?transport=(?:udp|tcp))?$/iu);
    const secret = env.CALLS_TURN_SECRET || '';
    if ((turnUrls.length > 0) !== Boolean(secret) || (secret && secret.length < 32)) throw new Error('Configura CALLS_TURN_URLS y CALLS_TURN_SECRET (mínimo 32 caracteres) juntos.');
    if (turnUrls.length) turn = { provider, urls: turnUrls, secret };
  } else {
    throw new Error('CALLS_TURN_PROVIDER debe ser coturn o cloudflare.');
  }
  if (enabled && env.NODE_ENV === 'production' && !turn) throw new Error('Activa TURN antes de habilitar videollamadas en producción.');
  return { enabled, stunUrls, turn };
}
