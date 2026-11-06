import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import type { ForumCategory, ForumTag } from '@messages/contracts'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/account/hooks/use-auth'
import { ForumShell } from '../components/forum-shell'
import { useResource } from '../hooks/use-forum'
import { DiscoverySearch } from '../discovery/discovery-search'
import { ActiveDiscoveryFilters, DiscoveryFilters, MobileDiscoveryFilters } from '../discovery/discovery-filters'
import { DiscoveryFeed } from '../discovery/discovery-feed'
import { clearDiscoveryFilters, discoveryQuery } from '../discovery/discovery-query'
import '../discovery/discovery.css'

function ForumIndex() {
  const [params, setParams] = useSearchParams()
  const serialized = params.toString()
  const query = useMemo(() => discoveryQuery(new URLSearchParams(serialized)), [serialized])
  const [searchReset, setSearchReset] = useState(0)
  const categories = useResource<ForumCategory[]>('taxonomy/categories')
  const tags = useResource<ForumTag[]>('taxonomy/tags?limit=30')
  const selectedTags = useResource<ForumTag[]>(query.tags.length && !query.issue ? 'taxonomy/tags?ids=' + encodeURIComponent([...query.tags].sort().join(',')) : null)
  const search = useCallback((value: string) => {
    const next = new URLSearchParams(serialized)
    if (value) next.set('q', value); else next.delete('q')
    if (next.toString() !== serialized) setParams(next, { replace: true })
  }, [serialized, setParams])
  const category = (id: string | null) => {
    const next = new URLSearchParams(params)
    next.delete('topico')
    if (id) next.set('categoria', id); else next.delete('categoria')
    setParams(next)
  }
  const tag = (id: string) => {
    const selected = query.tags.includes(id) ? query.tags.filter(item => item !== id) : [...query.tags, id]
    if (selected.length > 8) return
    const next = new URLSearchParams(params)
    next.delete('etiqueta')
    for (const selectedId of selected) next.append('etiqueta', selectedId)
    setParams(next)
  }
  const clear = () => { setSearchReset(current => current + 1); setParams(clearDiscoveryFilters(params)) }
  const filters = { query, categories, tags, selectedTags, onCategory: category, onTag: tag, onClear: clear, onSearchClear: () => search(''), onAuthorClear: () => { const next = new URLSearchParams(params); next.delete('autor'); setParams(next) } }
  return <ForumShell discovery={<><DiscoverySearch key={searchReset} applied={query.search} onSearch={search} /><Button asChild className="discovery-create h-11 px-5"><Link to="/publicar" aria-label="Crear publicación"><Plus aria-hidden="true" /><span className="discovery-create-label">Crear publicación</span><span className="discovery-create-short">Crear</span></Link></Button></>}>
    <main id="forum-content" className="forum-main discovery-layout" tabIndex={-1}>
      <h1 className="sr-only">Publicaciones de Foris</h1>
      <DiscoveryFilters {...filters} />
      <section className="discovery-stream" aria-labelledby="discovery-heading"><header className="discovery-stream-heading"><h2 id="discovery-heading" tabIndex={-1}>{query.search ? 'Resultados' : query.author ? 'De este perfil' : 'Recientes'}</h2><span className="discovery-sort-note">Más recientes primero</span><MobileDiscoveryFilters {...filters} /></header>
        <ActiveDiscoveryFilters {...filters} />
        {query.issue ? <div className="discovery-invalid" role="alert"><p>{query.issue}</p><Button type="button" variant="secondary" className="h-11" onClick={clear}>Restablecer filtros</Button></div> : <DiscoveryFeed key={query.path} path={query.path} filtered={query.filtered} onClear={clear} />}
      </section>
    </main>
  </ForumShell>
}
export function ForumPage() {
  const auth = useAuth()
  return <ForumIndex key={(auth.session.user?.id ?? 'guest') + '.' + auth.status} />
}
