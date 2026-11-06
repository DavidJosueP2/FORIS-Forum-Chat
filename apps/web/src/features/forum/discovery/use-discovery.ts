import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ForumCategory, ForumTag } from '@messages/contracts'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/account/hooks/use-auth'
import { useResource } from '../hooks/use-forum'
import { clearDiscoveryFilters, discoveryQuery } from './discovery-query'

export function useDiscoveryState() {
  const location = useLocation()
  const navigate = useNavigate()
  const auth = useAuth()
  const home = location.pathname === '/'
  const [remembered, setRemembered] = useState(() => home ? location.search : '')
  if (home && remembered !== location.search) setRemembered(location.search)
  const serialized = home ? location.search : remembered
  const query = useMemo(() => discoveryQuery(new URLSearchParams(serialized)), [serialized])
  const [searchReset, setSearchReset] = useState(0)
  const resourceScope = (auth.session.user?.id ?? 'guest') + '.' + auth.status
  const categories = useResource<ForumCategory[]>('taxonomy/categories')
  const tags = useResource<ForumTag[]>('taxonomy/tags?limit=30', resourceScope)
  const selectedTags = useResource<ForumTag[]>(query.tags.length && !query.issue ? 'taxonomy/tags?ids=' + encodeURIComponent([...query.tags].sort().join(',')) : null, resourceScope)
  const apply = useCallback((next: URLSearchParams, replace = false) => {
    const suffix = next.toString()
    const target = '/' + (suffix ? '?' + suffix : '')
    if (!home || suffix !== new URLSearchParams(serialized).toString()) navigate(target, { replace: home && replace })
  }, [home, serialized, navigate])
  const onSearch = useCallback((value: string) => {
    if (!home && !value && !query.search) return
    const next = new URLSearchParams(serialized)
    if (value) next.set('q', value); else next.delete('q')
    apply(next, true)
  }, [serialized, apply, home, query.search])
  function onCategory(id: string | null) {
    const next = new URLSearchParams(serialized)
    next.delete('topico')
    if (id) next.set('categoria', id); else next.delete('categoria')
    apply(next)
  }
  function onTag(id: string) {
    const selected = query.tags.includes(id) ? query.tags.filter(item => item !== id) : [...query.tags, id]
    if (selected.length > 8) return
    const next = new URLSearchParams(serialized)
    next.delete('etiqueta')
    for (const tag of selected) next.append('etiqueta', tag)
    apply(next)
  }
  function onClear() { setSearchReset(current => current + 1); apply(clearDiscoveryFilters(new URLSearchParams(serialized))) }
  function onAuthorClear() { const next = new URLSearchParams(serialized); next.delete('autor'); apply(next) }
  return { query, categories, tags, selectedTags, resourceScope, searchReset, onSearch, onCategory, onTag, onClear, onSearchClear: () => onSearch(''), onAuthorClear }
}
export const DiscoveryContext = createContext<ReturnType<typeof useDiscoveryState> | null>(null)
export function useDiscovery() {
  const context = useContext(DiscoveryContext)
  if (!context) throw new Error('El explorador requiere DiscoveryProvider.')
  return context
}
