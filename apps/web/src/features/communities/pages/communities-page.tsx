import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, LockKeyhole, Plus, Search, Star, UsersRound } from 'lucide-react'
import type { Community } from '@messages/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/account/hooks/use-auth'
import { ForumEmpty, ForumError, ForumLoading, ParticipationGate } from '@/features/forum/components/forum-states'
import { useForumPage } from '@/features/forum/hooks/use-forum'
import { IdentityImage } from '@/features/media/components/identity-image'

function CommunityList({ path, scope, searched }: { path: string; scope: string; searched: boolean }) {
  const page = useForumPage<Community>(path)
  if (page.loading && !page.ready) return <ForumLoading label="Buscando comunidades…" />
  if (page.error) return <ForumError message={page.error} retry={page.retry} />
  if (!page.items.length) return <ForumEmpty title={searched ? 'No encontramos esa comunidad' : scope === 'favorites' ? 'Tus favoritas tendrán lugar aquí' : scope === 'mine' ? 'Encuentra un espacio para ti' : 'La primera comunidad puede ser la tuya'}>
    <p>{searched ? 'Prueba otro nombre o una palabra diferente.' : scope === 'favorites' ? 'Guarda una comunidad con la estrella de su página. Puedes hacerlo sin unirte.' : scope === 'mine' ? 'Explora las comunidades y únete a las que te interesen.' : 'Reúne a otras personas alrededor de una idea que te importe.'}</p>
    <Button asChild variant="secondary" className="h-11 mt-5 px-6"><Link to={scope === 'all' && !searched ? '/comunidades/crear' : '/comunidades'}>{scope === 'all' && !searched ? 'Crear comunidad' : 'Explorar comunidades'}</Link></Button>
  </ForumEmpty>
  return <>
    <ol className="community-list" aria-label="Comunidades">
      {page.items.map(item => <li key={item.id}><article className="community-row community-row-with-image"><IdentityImage mediaId={item.imageId} name={item.name} className="community-list-photo" /><div>
        <div className="community-row-title"><h2><Link to={'/comunidades/' + item.id}>{item.name}<ArrowUpRight aria-hidden="true" /></Link></h2>{item.isFavorite && <Star className="community-saved-star" aria-label="En favoritas" />}{item.membership && <span className="forum-topic-label">{item.membership.role === 'owner' ? 'La creaste tú' : 'Formas parte'}</span>}</div>
        <p className="community-description">{item.description}</p>
        <div className="forum-meta">{item.visibility === 'private' && <span className="community-members"><LockKeyhole aria-hidden="true" />Privada</span>}<span className="community-members"><UsersRound aria-hidden="true" />{item.memberCount} {item.memberCount === 1 ? 'miembro' : 'miembros'}</span><span>{item.postCount} {item.postCount === 1 ? 'publicación' : 'publicaciones'}</span></div>
      </div></article></li>)}
    </ol>
    {page.moreError && <p className="forum-error" role="alert">{page.moreError}</p>}
    {page.hasMore && <Button variant="secondary" className="h-11 px-6 forum-more" disabled={page.loadingMore} onClick={() => void page.loadMore()}>{page.loadingMore ? 'Cargando…' : 'Ver más comunidades'}</Button>}
  </>
}
function CommunitiesIndex() {
  const auth = useAuth()
  const [params, setParams] = useSearchParams()
  const scope = params.get('vista') === 'mias' ? 'mine' : params.get('vista') === 'favoritas' ? 'favorites' : 'all'
  const search = params.get('q') ?? ''
  const [query, setQuery] = useState(search)
  const filters = new URLSearchParams({ scope })
  if (search) filters.set('search', search)
  const path = 'communities?' + filters.toString()
  const list = <CommunityList key={path + (auth.session.user?.id ?? 'guest') + auth.status} path={path} scope={scope} searched={Boolean(search)} />
  return <main id="forum-content" className="forum-main" tabIndex={-1}>
    <header className="forum-intro"><div><h1>Encuentra tu gente.</h1><p>Un espacio para las ideas que compartes y las personas con quienes quieres seguir conversando.</p></div><Button asChild className="h-12 px-6"><Link to="/comunidades/crear"><Plus aria-hidden="true" />Crear comunidad</Link></Button></header>
    <form className="forum-search" role="search" onSubmit={event => { event.preventDefault(); const next = new URLSearchParams(params); if (query.trim()) next.set('q', query.trim()); else next.delete('q'); setParams(next) }}>
      <label htmlFor="community-search">Busca una comunidad</label><div><Input id="community-search" type="search" maxLength={120} value={query} onChange={event => setQuery(event.target.value)} placeholder="Un interés, un nombre, una idea…" /><Button type="submit" variant="secondary" className="h-12 px-5"><Search aria-hidden="true" />Buscar</Button></div>
    </form>
    <nav className="forum-topics" aria-label="Filtrar comunidades">
      {([['all', 'Explorar', ''], ['mine', 'Mis comunidades', 'mias'], ['favorites', 'Favoritas', 'favoritas']] as const).map(([value, label, param]) => <Button key={value} variant={scope === value ? 'secondary' : 'ghost'} className="h-11 px-5" aria-pressed={scope === value} onClick={() => { const next = new URLSearchParams(params); if (param) next.set('vista', param); else next.delete('vista'); setParams(next) }}>{label}</Button>)}
    </nav>
    {search && <p className="forum-active-filter"><span>Buscando «{search}»</span><Link to={scope === 'all' ? '/comunidades' : '/comunidades?vista=' + (scope === 'mine' ? 'mias' : 'favoritas')}>Quitar búsqueda</Link></p>}
    {scope === 'all' ? list : <ParticipationGate next="/comunidades" description="Entra con tu cuenta para encontrar tus comunidades y guardar tus favoritas.">{list}</ParticipationGate>}
  </main>
}
export function CommunitiesPage() {
  const [params] = useSearchParams()
  return <CommunitiesIndex key={params.toString()} />
}
