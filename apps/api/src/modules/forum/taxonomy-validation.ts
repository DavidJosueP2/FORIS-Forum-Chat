import { inputText, invalidInput, requestId } from '../../common/validation/input.js';

export function tagName(value: unknown): string {
  if (typeof value !== 'string' || value.length > 128 || /[\p{Cc}\p{Cf}]/u.test(value)) invalidInput('La etiqueta no es válida.');
  const name = value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase().normalize('NFC');
  if (!name || name.length > 32 || !/^[\p{L}\p{N}][\p{L}\p{N}\p{M} .+#-]*$/u.test(name)) invalidInput('Cada etiqueta debe tener entre 1 y 32 caracteres, sin símbolos de marcado.');
  return name;
}
export function postTags(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8) invalidInput('Puedes añadir hasta ocho etiquetas.');
  return [...new Set(value.map(tagName))].sort();
}
export function filterTagIds(value: unknown): string[] {
  if (value === undefined || value === '') return [];
  if (typeof value !== 'string' || value.length > 295) invalidInput('Elige hasta ocho etiquetas válidas.');
  const ids = value.split(',');
  if (ids.length > 8) invalidInput('Elige hasta ocho etiquetas.');
  return [...new Set(ids.map(requestId))];
}
export function tagFilters(query: Record<string, unknown>): { search: string; limit: number; ids: string[] } {
  if (Object.keys(query).some(key => key !== 'search' && key !== 'limit' && key !== 'ids')) invalidInput('El filtro de etiquetas no es válido.');
  const raw = query.limit ?? '20';
  if (typeof raw !== 'string' || !/^\d{1,2}$/u.test(raw) || Number(raw) < 1 || Number(raw) > 30) invalidInput('El límite debe estar entre 1 y 30.');
  const search = query.search === undefined || query.search === '' ? '' : inputText(query.search, 'La búsqueda', 64).normalize('NFKC').toLowerCase();
  return { search, limit: Number(raw), ids: filterTagIds(query.ids) };
}
