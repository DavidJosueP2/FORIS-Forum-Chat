import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/use-page-title'
import { useAuth } from '@/features/account/hooks/use-auth'
import { loginLink } from '@/features/account/lib/return-target'
import { useDiscovery } from '../discovery/use-discovery'
import { ActiveDiscoveryFilters } from '../discovery/discovery-filters'
import { DiscoveryFeed } from '../discovery/discovery-feed'
import { HomeContext } from '../components/context-rail'
import { FOLLOWING_CHANGED, followingChange } from '../following/following-events'

function ForumIndex() {
  const discovery = useDiscovery()
  const auth = useAuth()
  const { query, onClear, feedHref } = discovery
  const [revision, setRevision] = useState(0)
  const viewer = auth.session.user?.id ?? null
  const following = query.feed === 'following'
  usePageTitle(following ? 'Siguiendo' : 'Foros')
  const discoverHref = feedHref(false)
  const followingHref = feedHref(true)
  useEffect(() => {
    if (!following) return
    const changed = (event: Event) => {
      if (!followingChange(event, viewer)) return
      const focusFeed = document.activeElement instanceof Element && Boolean(document.activeElement.closest('.discovery-feed-list'))
      setRevision(current => current + 1)
      if (focusFeed) {
        document.getElementById('discovery-heading')?.focus({ preventScroll: true })
        window.scrollTo({ top: 0, left: 0 })
      }
    }
    window.addEventListener(FOLLOWING_CHANGED, changed)
    return () => window.removeEventListener(FOLLOWING_CHANGED, changed)
  }, [following, viewer])
  return <main id="forum-content" className="forum-main discovery-layout content-layout" tabIndex={-1}>
    <h1 className="sr-only">Publicaciones de Foris</h1>
    <div className="content-columns"><section className="discovery-stream content-primary" aria-label="Publicaciones">
      <header className="discovery-stream-heading">
        <nav id="discovery-heading" tabIndex={-1} aria-label="Flujo de publicaciones" className="discovery-feed-tabs" data-discovery-control>
          <Link to={discoverHref} aria-current={following ? undefined : 'page'}>Para ti</Link>
          <Link to={followingHref} aria-current={following ? 'page' : undefined}>Siguiendo</Link>
        </nav>
        <span className="discovery-sort-note">Recientes</span>
      </header>
      <ActiveDiscoveryFilters {...discovery} />
      {query.issue ? <div className="discovery-invalid" role="alert"><p>{query.issue}</p><Button type="button" variant="secondary" className="h-11" onClick={onClear}>Restablecer filtros</Button></div> : following && !viewer ? <div className="discovery-follow-empty"><h2>Tu espacio para seguir conversaciones</h2><p>Entra para ver las publicaciones de autores que sigues y tus comunidades.</p><Button asChild className="h-11"><Link to={loginLink(followingHref)}>Entrar a Foris</Link></Button></div> : <DiscoveryFeed key={query.path + '.' + revision} path={query.path} following={following} filtered={query.filtered} onClear={onClear} discoverHref={discoverHref} />}
    </section><HomeContext /></div>
  </main>
}
export function ForumPage() {
  const auth = useAuth()
  return <ForumIndex key={(auth.session.user?.id ?? 'guest') + '.' + auth.status} />
}
