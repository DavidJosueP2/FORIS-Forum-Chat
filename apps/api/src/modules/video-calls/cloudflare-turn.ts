import type { VideoCallJoin } from '@messages/contracts';
import type { CloudflareTurnConfig } from '../../config/video-call-config.js';
import { HttpError } from '../../common/errors/http-error.js';

type IceServers = VideoCallJoin['iceServers'];
function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
function invalidResponse() {
  return new HttpError(503, 'CALL_TURN_INVALID_RESPONSE', 'No pudimos preparar la conexión de la videollamada. Inténtalo de nuevo.');
}
function credential(value: unknown): value is string {
  return typeof value === 'string' && /^[\x21-\x7e]{1,1024}$/u.test(value);
}
function iceServers(payload: unknown): IceServers {
  const entries = record(payload)?.iceServers;
  if (!Array.isArray(entries) || entries.length > 8) throw invalidResponse();
  const result: IceServers = [];
  for (const entry of entries) {
    const server = record(entry);
    if (!server || !Array.isArray(server.urls) || server.urls.length > 8) throw invalidResponse();
    // Solo relay de Cloudflare. El puerto alternativo 53 bloquea ICE sin trickle en navegadores.
    const urls = server.urls.filter((url): url is string => typeof url === 'string' && /^turns?:turn\.cloudflare\.com:(?:3478|5349|443|80)\?transport=(?:udp|tcp)$/u.test(url));
    if (!urls.length) continue;
    if (!credential(server.username) || !credential(server.credential)) throw invalidResponse();
    result.push({ urls: [...new Set(urls)], username: server.username, credential: server.credential });
  }
  if (!result.length) throw invalidResponse();
  return result;
}

/** La clave duradera nunca sale de Nest; solo se devuelven credenciales TURN temporales. */
export async function cloudflareTurnServers(config: CloudflareTurnConfig, request: typeof fetch = fetch): Promise<IceServers> {
  try {
    const response = await request(`https://rtc.live.cloudflare.com/v1/turn/keys/${config.keyId}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiToken}`, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ttl: 3600 }),
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
    });
    if (!response.ok) {
      await response.body?.cancel();
      const code = response.status === 401 || response.status === 403 ? 'CALL_TURN_AUTH_FAILED' : 'CALL_TURN_UNAVAILABLE';
      throw new HttpError(503, code, 'El servicio de videollamadas no está disponible. Inténtalo más tarde.');
    }
    return iceServers(await response.json());
  } catch (cause) {
    if (cause instanceof HttpError) throw cause;
    throw new HttpError(503, 'CALL_TURN_UNAVAILABLE', 'No pudimos conectar con el servicio de videollamadas. Inténtalo de nuevo.', { cause });
  }
}
