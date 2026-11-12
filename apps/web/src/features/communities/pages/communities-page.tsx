import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, FileText, LockKeyhole, Plus, Search, Star, UsersRound } from 'lucide-react'
import type { Community } from '@messages/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { usePageTitle } from '@/hooks/use-page-title'
import { useAuth } from '@/features/account/hooks/use-auth'
import { ForumEmpty, ForumError, ParticipationGate } from '@/features/forum/components/forum-states'
import { ContentSkeleton } from '@/features/forum/components/content-skeletons'
import { useForumPage } from '@/features/forum/hooks/use-forum'
import { IdentityImage } from '@/features/media/components/identity-image'

function CommunityEntry({ item }: { item: Community }) {
  const titleId = `community-title-${item.id}`
  const isPrivate = item.visibility === 'private'
  return <li>
    <Link to={'/comunidades/' + item.id} className="community-entry" aria-labelledby={titleId}>
      <IdentityImage fallbackKey={'community:' + item.id} mediaId={item.imageId} name={item.name} className="community-directory-photo" />
      <div className="community-entry-content">
        <div className="community-entry-title">
          <h2 id={titleId}>{item.name}</h2>
          <ArrowRight aria-hidden="true" />
        </div>
        <p className="community-description">{item.description}</p>
        <div className="community-entry-meta forum-meta">
          <span><UsersRound aria-hidden="true" /><span><strong>{item.memberCount}</strong> {item.memberCount === 1 ? 'miembro' : 'miembros'}</span></span>
          <span><FileText aria-hidden="true" /><span><strong>{item.postCount}</strong> {item.postCount === 1 ? 'publicación' : 'publicaciones'}</span></span>
        </div>
        {(isPrivate || item.isFavorite || item.membership) && <div className="community-entry-status">
          {isPrivate && <span><LockKeyhole aria-hidden="true" />Privada</span>}
          {item.isFavorite && <span><Star aria-hidden="true" />Favorita</span>}
          {item.membership && <span>{item.membership.role === 'owner' ? 'La creaste tú' : 'Formas parte'}</span>}
        </div>}
      </div>
    </Link>
  </li>
}

function CommunityDirectorySkeleton() {
  return <ContentSkeleton label="Cargando comunidades…">
    <ol className="community-list">
      {[0, 1, 2, 3].map(index => <li key={index}>
        <div className="community-entry">
          <Skeleton className="community-directory-photo" />
          <div className="community-entry-content pt-1">
            <Skeleton className={index % 2 ? 'h-5 w-2/3' : 'h-5 w-4/5'} />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-3/5" />
            <div className="community-entry-meta forum-meta">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
      </li>)}
    </ol>
  </ContentSkeleton>
}

function CommunityList({ path, scope, searched }: { path: string; scope: string; searched: boolean }) {
  const page = useForumPage<Community>(path)
  if (page.loading && !page.ready) return <CommunityDirectorySkeleton />
  if (page.error) return <ForumError message={page.error} retry={page.retry} />
  if (!page.items.length) return <ForumEmpty scene={searched ? 'communitySearch' : scope === 'all' ? 'communityDiscovery' : 'communityList'} placement="end" title={searched ? 'No encontramos esa comunidad' : scope === 'favorites' ? 'Tus favoritas tendrán lugar aquí' : scope === 'mine' ? 'Encuentra un espacio para ti' : 'La primera comunidad puede ser la tuya'}>
    <p>{searched ? 'Prueba otro nombre o una palabra diferente.' : scope === 'favorites' ? 'Guarda una comunidad con la estrella de su página. Puedes hacerlo sin unirte.' : scope === 'mine' ? 'Explora las comunidades y únete a las que te interesen.' : 'Reúne a otras personas alrededor de una idea que te importe.'}</p>
    <Button asChild variant="secondary" className="h-11 mt-5 px-6"><Link to={scope === 'all' && !searched ? '/comunidades/crear' : '/comunidades'}>{scope === 'all' && !searched ? 'Crear comunidad' : 'Explorar comunidades'}</Link></Button>
  </ForumEmpty>
  return <>
    <ol className="community-list" aria-label="Comunidades">
      {page.items.map(item => <CommunityEntry key={item.id} item={item} />)}
    </ol>
    {page.moreError && <p className="forum-error" role="alert">{page.moreError}</p>}
    {page.hasMore && <Button variant="secondary" className="h-11 px-6 forum-more" disabled={page.loadingMore} onClick={() => void page.loadMore()}>{page.loadingMore ? 'Cargando…' : 'Ver más comunidades'}</Button>}
  </>
}
function CommunitiesIndex() {
  const auth = useAuth()
  const [params, setParams] = useSearchParams()
  const scope = params.get('vista') === 'mias' ? 'mine' : params.get('vista') === 'favoritas' ? 'favorites' : 'all'
  usePageTitle(scope === 'mine' ? 'Mis comunidades' : scope === 'favorites' ? 'Comunidades favoritas' : 'Comunidades')
  const search = params.get('q') ?? ''
  const [query, setQuery] = useState(search)
  const filters = new URLSearchParams({ scope })
  if (search) filters.set('search', search)
  const path = 'communities?' + filters.toString()
  const list = <CommunityList key={path + (auth.session.user?.id ?? 'guest') + auth.status} path={path} scope={scope} searched={Boolean(search)} />
  return <main id="forum-content" className="forum-main community-directory" tabIndex={-1}>
    <header className="forum-intro">
      <div><h1>Encuentra tu gente.</h1><p>Un espacio para las ideas que compartes y las personas con quienes quieres seguir conversando.</p></div>
      <Button asChild className="h-12 px-6"><Link to="/comunidades/crear"><Plus aria-hidden="true" />Crear comunidad</Link></Button>
    </header>
    <div className="community-directory-tools">
      <form className="forum-search" role="search" onSubmit={event => { event.preventDefault(); const next = new URLSearchParams(params); if (query.trim()) next.set('q', query.trim()); else next.delete('q'); setParams(next) }}>
        <label htmlFor="community-search">Busca una comunidad</label><div><Input id="community-search" type="search" maxLength={120} value={query} onChange={event => setQuery(event.target.value)} placeholder="Nombre o interés…" /><Button type="submit" variant="secondary" className="h-12 px-5"><Search aria-hidden="true" />Buscar</Button></div>
      </form>
      <nav className="forum-topics" aria-label="Filtrar comunidades">
        {([['all', 'Explorar', ''], ['mine', 'Mis comunidades', 'mias'], ['favorites', 'Favoritas', 'favoritas']] as const).map(([value, label, param]) => <Button key={value} variant={scope === value ? 'secondary' : 'ghost'} className="h-11 px-5" aria-pressed={scope === value} onClick={() => { const next = new URLSearchParams(params); if (param) next.set('vista', param); else next.delete('vista'); setParams(next) }}>{label}</Button>)}
      </nav>
    </div>
    {search && <p className="forum-active-filter"><span>Buscando «{search}»</span><Link to={scope === 'all' ? '/comunidades' : '/comunidades?vista=' + (scope === 'mine' ? 'mias' : 'favoritas')}>Quitar búsqueda</Link></p>}
    {scope === 'all' ? list : auth.status === 'loading' ? <CommunityDirectorySkeleton />
      : <ParticipationGate next="/comunidades" description="Entra con tu cuenta para encontrar tus comunidades y guardar tus favoritas.">{list}</ParticipationGate>}
  </main>
}
export function CommunitiesPage() {
  const [params] = useSearchParams()
  return <CommunitiesIndex key={params.toString()} />
}
