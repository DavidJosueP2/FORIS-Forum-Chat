import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/account/hooks/use-auth'
import { useDiscovery } from '../discovery/use-discovery'
import { ActiveDiscoveryFilters } from '../discovery/discovery-filters'
import { DiscoveryFeed } from '../discovery/discovery-feed'

function ForumIndex() {
  const discovery = useDiscovery()
  const { query, onClear } = discovery
  return <main id="forum-content" className="forum-main discovery-layout" tabIndex={-1}>
    <h1 className="sr-only">Publicaciones de Foris</h1>
    <section className="discovery-stream" aria-labelledby="discovery-heading"><header className="discovery-stream-heading"><h2 id="discovery-heading" tabIndex={-1}>{query.search ? 'Resultados' : query.author ? 'De este perfil' : 'Recientes'}</h2><span className="discovery-sort-note">Más recientes primero</span></header>
      <ActiveDiscoveryFilters {...discovery} />
      {query.issue ? <div className="discovery-invalid" role="alert"><p>{query.issue}</p><Button type="button" variant="secondary" className="h-11" onClick={onClear}>Restablecer filtros</Button></div> : <DiscoveryFeed key={query.path} path={query.path} filtered={query.filtered} onClear={onClear} />}
    </section>
  </main>
}
export function ForumPage() {
  const auth = useAuth()
  return <ForumIndex key={(auth.session.user?.id ?? 'guest') + '.' + auth.status} />
}
