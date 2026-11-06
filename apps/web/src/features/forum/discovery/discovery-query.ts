export const isUuid = (value: string) => /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu.test(value)
export const normalizeSearch = (value: string) => value.normalize('NFC').replace(/\s+/gu, ' ').trim()
export function searchIssue(value: string): string | null {
  if (normalizeSearch(value).length > 120) return 'Acorta la búsqueda a 120 caracteres.'
  if ([...value].some(character => { const code = character.codePointAt(0)!; return (code < 32 && !/\s/u.test(character)) || code === 127 })) return 'La búsqueda contiene caracteres no válidos.'
  return null
}
export function discoveryQuery(params: URLSearchParams) {
  const search = normalizeSearch(params.get('q') ?? '')
  const category = (params.get('categoria') ?? '').toLowerCase()
  const topic = params.get('topico') ?? ''
  const author = (params.get('autor') ?? '').toLowerCase()
  const tags = [...new Set(params.getAll('etiqueta').map(value => value.toLowerCase()))]
  const issue = searchIssue(params.get('q') ?? '')
    ?? (['q', 'categoria', 'topico', 'autor'].some(key => params.getAll(key).length > 1) ? 'Hay filtros repetidos en este enlace.' : null)
    ?? ((category && !isUuid(category)) || (author && !isUuid(author)) || tags.some(tag => !isUuid(tag)) || tags.length > 8 ? 'Uno de los filtros de este enlace no es válido.' : null)
    ?? (topic && !/^[a-z][a-z0-9-]{0,31}$/u.test(topic) ? 'La temática de este enlace no es válida.' : null)
  const api = new URLSearchParams()
  if (search) api.set('search', search)
  if (category) api.set('category', category); else if (topic) api.set('topic', topic)
  if (author) api.set('author', author)
  if (tags.length) api.set('tags', [...tags].sort().join(','))
  return { search, category, topic, author, tags, issue, path: 'posts' + (api.size ? '?' + api.toString() : ''), filtered: Boolean(search || category || topic || author || tags.length) }
}
export type DiscoveryQuery = ReturnType<typeof discoveryQuery>
export function clearDiscoveryFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const key of ['q', 'categoria', 'topico', 'autor', 'etiqueta']) next.delete(key)
  return next
}
export function categoryLink(id: string): string { return '/?categoria=' + encodeURIComponent(id) }
export function tagLink(id: string): string { return '/?etiqueta=' + encodeURIComponent(id) }
