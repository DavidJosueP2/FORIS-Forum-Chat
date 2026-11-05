import type { VideoDescription } from '@messages/contracts';
import { inputRecord, invalidInput, requestId } from '../../common/validation/input.js';
export function joinInput(value: unknown) { const data = inputRecord(value, ['requestId']); return requestId(data.requestId); }
export function syncInput(value: unknown) {
  const data = inputRecord(value, ['after']);
  if (typeof data.after !== 'string' || !/^(?:0|[1-9]\d{0,18})$/u.test(data.after) || BigInt(data.after) > 9223372036854775807n) invalidInput('El cursor de llamada no es válido.');
  return data.after;
}
export function signalInput(value: unknown) {
  const data = inputRecord(value, ['to', 'requestId', 'description']);
  const description = inputRecord(data.description, ['type', 'sdp']);
  if (description.type !== 'offer' && description.type !== 'answer') invalidInput('El tipo de señal no es válido.');
  if (typeof description.sdp !== 'string' || description.sdp.length > 65536 || !description.sdp.startsWith('v=0\r\n')
    || [...description.sdp].some(character => {
      const point = character.charCodeAt(0);
      return ![9, 10, 13].includes(point) && (point < 32 || point > 126);
    })) invalidInput('La descripción de conexión no es válida.');
  return { to: requestId(data.to), requestId: requestId(data.requestId),
    description: { type: description.type, sdp: description.sdp } as VideoDescription };
}
export type SignalInput = ReturnType<typeof signalInput>;
