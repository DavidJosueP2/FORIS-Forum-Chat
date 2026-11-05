import { HttpError } from '../errors/http-error.js';

export function invalidInput(message: string): never { throw new HttpError(400, 'INVALID_INPUT', message); }
export function inputRecord(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) invalidInput('Los datos enviados no son válidos.');
  return value as Record<string, unknown>;
}
export function inputText(value: unknown, label: string, maximum: number, multiline = false): string {
  if (typeof value !== 'string') invalidInput(label + ' debe ser texto.');
  const result = value.replaceAll('\r\n', '\n').normalize('NFC').trim();
  if (!result || result.length > maximum || [...result].some(character => {
    const point = character.codePointAt(0) ?? 0;
    return (point < 32 && !(multiline && (point === 10 || point === 9))) || point === 127;
  })) invalidInput(label + ' debe contener entre 1 y ' + maximum + ' caracteres válidos.');
  return result;
}
export function resourceId(value: unknown): string {
  if (typeof value !== 'string' || !/^[1-9]\d{0,18}$/u.test(value) || BigInt(value) > 9223372036854775807n) invalidInput('El identificador no es válido.');
  return value;
}
export function requestId(value: unknown): string {
  if (typeof value !== 'string' || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu.test(value)) invalidInput('La solicitud no es válida.');
  return value.toLowerCase();
}
export function pageInput(query: Record<string, unknown>) {
  const before = query.before === undefined ? undefined : resourceId(query.before);
  const raw = query.limit ?? '20';
  if (typeof raw !== 'string' || !/^\d{1,2}$/u.test(raw) || Number(raw) < 1 || Number(raw) > 50) invalidInput('El límite debe estar entre 1 y 50.');
  return { before, limit: Number(raw) };
}
export function resultPage<T extends { id: string }>(items: T[], limit: number) {
  const selected = items.slice(0, limit);
  return { items: selected, hasMore: items.length > limit, nextCursor: items.length > limit ? selected.at(-1)!.id : null };
}
