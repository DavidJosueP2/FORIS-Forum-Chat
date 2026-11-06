import { HttpError } from '../../common/errors/http-error.js';
export function record(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !allowed.includes(key))) invalid('Los datos enviados no son válidos.');
  return value as Record<string, unknown>;
}
export function invalid(message: string): never { throw new HttpError(400, 'INVALID_INPUT', message); }
export function text(value: unknown, label: string, maximum: number, optional = false, multiline = false): string {
  if (optional && (value === undefined || value === '')) return '';
  if (typeof value !== 'string') invalid(label + ' no es válido.');
  const normalized = value.replaceAll('\r\n', '\n').trim();
  if ((!optional && !normalized) || normalized.length > maximum || [...normalized].some(character => {
    const point = character.codePointAt(0) ?? 0;
    return (point < 32 && !(multiline && (point === 10 || point === 9))) || point === 127;
  })) invalid(label + ' no es válido.');
  return normalized;
}
export function email(value: unknown): string {
  const address = text(value, 'El correo', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(address)) invalid('Escribe un correo válido.');
  return address;
}
export function password(value: unknown, creating = true): string {
  if (typeof value !== 'string' || value.length > 128 || value.length < (creating ? 15 : 1)) {
    invalid(creating ? 'Usa una contraseña de entre 15 y 128 caracteres.' : 'Escribe tu contraseña.');
  }
  return value;
}
export function challengeInput(value: unknown, extra: string[] = []): Record<string, unknown> & { challengeId: string; code: string } {
  const fields = record(value, ['challengeId', 'code', ...extra]);
  if (typeof fields.challengeId !== 'string' || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu.test(fields.challengeId)) invalid('La solicitud no es válida.');
  if (typeof fields.code !== 'string' || !/^\d{6}$/.test(fields.code)) invalid('Escribe el código de seis dígitos.');
  return { ...fields, challengeId: fields.challengeId, code: fields.code };
}
