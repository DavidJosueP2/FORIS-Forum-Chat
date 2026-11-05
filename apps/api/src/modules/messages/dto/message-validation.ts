import { HttpError } from '../../../common/errors/http-error.js';
import type { CreateMessageDto } from './create-message.dto.js';
import type { ListMessagesDto } from './list-messages.dto.js';

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_AUTHOR_LENGTH = 32;
const UUID = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu;
const MAX_ID = 9223372036854775807n;
const MESSAGE_FIELDS = new Set(['author', 'body', 'senderId', 'requestId']);

function invalid(message: string): never {
  throw new HttpError(400, 'INVALID_INPUT', message);
}

function hasControlCharacters(value: string, multiline: boolean): boolean {
  return [...value].some(character => {
    const point = character.codePointAt(0) ?? 0;
    return (point < 32 && !(multiline && (point === 10 || point === 9))) || point === 127;
  });
}

function text(value: unknown, label: string, maximum: number, multiline = false): string {
  if (typeof value !== 'string') invalid(`${label} debe ser texto.`);
  const normalized = value.replaceAll('\r\n', '\n').trim();
  if (!normalized || normalized.length > maximum || hasControlCharacters(normalized, multiline)) {
    invalid(`${label} debe contener entre 1 y ${maximum} caracteres válidos.`);
  }
  return normalized;
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) invalid(`${label} no es válido.`);
  return value.toLowerCase();
}

export function validateMessage(input: unknown): CreateMessageDto {
  if (!input || Array.isArray(input) || typeof input !== 'object') invalid('Envía un mensaje de texto.');
  if (Object.keys(input).some(key => !MESSAGE_FIELDS.has(key))) {
    invalid('Solo se admiten mensajes de texto, sin adjuntos.');
  }
  const fields = input as Record<string, unknown>;
  return {
    author: text(fields.author ?? 'Invitado', 'El nombre', MAX_AUTHOR_LENGTH),
    body: text(fields.body, 'El mensaje', MAX_MESSAGE_LENGTH, true),
    senderId: uuid(fields.senderId, 'El identificador del navegador'),
    requestId: uuid(fields.requestId, 'El identificador del envío'),
  };
}

function cursor(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^[1-9]\d{0,18}$/u.test(value) || BigInt(value) > MAX_ID) {
    invalid('La posición del historial no es válida.');
  }
  return value;
}

export function validatePagination(query: Record<string, unknown>): ListMessagesDto {
  const before = cursor(query.before);
  const after = cursor(query.after);
  if (before && after) invalid('Usa una sola dirección para consultar el historial.');
  const rawLimit = query.limit ?? '50';
  if (typeof rawLimit !== 'string' || !/^\d{1,3}$/u.test(rawLimit)) {
    invalid('El límite debe ser un número entre 1 y 100.');
  }
  const limit = Number(rawLimit);
  if (limit < 1 || limit > 100) invalid('El límite debe ser un número entre 1 y 100.');
  return { before, after, limit };
}
