import type { CreateCommunity, CommunityPreferences } from '@messages/contracts';
import { inputRecord, inputText, requestId, pageInput, invalidInput } from '../../common/validation/input.js';

export function communityInput(value: unknown): CreateCommunity {
  const fields = inputRecord(value, ['name', 'description', 'requestId', 'visibility', 'imageId']);
  const name = inputText(fields.name, 'El nombre', 80);
  if (name.length < 3) invalidInput('El nombre debe tener al menos 3 caracteres.');
  const visibility = fields.visibility ?? 'public';
  if (visibility !== 'public' && visibility !== 'private') invalidInput('Elige una comunidad pública o privada.');
  return { name, description: inputText(fields.description, 'La descripción', 500, true), requestId: requestId(fields.requestId), visibility,
    imageId: fields.imageId === undefined || fields.imageId === null ? null : requestId(fields.imageId) };
}
export function preferencesInput(value: unknown): CommunityPreferences {
  const fields = inputRecord(value, ['favorite', 'notifyPosts']);
  if (!Object.keys(fields).length || Object.values(fields).some(item => typeof item !== 'boolean')) invalidInput('Elige una preferencia válida.');
  return fields as CommunityPreferences;
}
export function communityFilters(query: Record<string, unknown>) {
  const pagination = pageInput(query);
  const scope = query.scope ?? 'all';
  if (scope !== 'all' && scope !== 'mine' && scope !== 'favorites') invalidInput('El filtro de comunidades no es válido.');
  const search = query.search === undefined || query.search === '' ? undefined : inputText(query.search, 'La búsqueda', 120);
  return { ...pagination, scope, search };
}
export type CommunityFilters = ReturnType<typeof communityFilters>;
