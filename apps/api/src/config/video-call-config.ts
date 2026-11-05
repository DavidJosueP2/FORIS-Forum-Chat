export interface VideoCallConfig { enabled: boolean; stunUrls: string[]; turnUrls: string[]; turnSecret: string }
function urls(value: string, pattern: RegExp): string[] {
  const result = value.split(',').map(item => item.trim()).filter(Boolean);
  if (result.length > 4 || result.some(item => !pattern.test(item))) throw new Error('Las URLs ICE de videollamadas no son válidas.');
  return result;
}
export function readVideoCallConfig(env: NodeJS.ProcessEnv): VideoCallConfig {
  if (env.CALLS_ENABLED && !['true', 'false'].includes(env.CALLS_ENABLED)) throw new Error('CALLS_ENABLED debe ser true o false.');
  const enabled = env.CALLS_ENABLED ? env.CALLS_ENABLED === 'true' : env.NODE_ENV !== 'production';
  const turnUrls = urls(env.CALLS_TURN_URLS || '', /^turns?:[a-z0-9.-]+(?::\d{1,5})?(?:\?transport=(?:udp|tcp))?$/iu);
  const stunUrls = urls(env.CALLS_STUN_URLS ?? 'stun:stun.l.google.com:19302', /^stuns?:[a-z0-9.-]+(?::\d{1,5})?$/iu);
  const turnSecret = env.CALLS_TURN_SECRET || '';
  if ((turnUrls.length > 0) !== Boolean(turnSecret) || (turnSecret && turnSecret.length < 32)) throw new Error('Configura CALLS_TURN_URLS y CALLS_TURN_SECRET (mínimo 32 caracteres) juntos.');
  if (enabled && env.NODE_ENV === 'production' && !turnUrls.length) throw new Error('Activa TURN antes de habilitar videollamadas en producción.');
  return { enabled, stunUrls, turnUrls, turnSecret };
}
