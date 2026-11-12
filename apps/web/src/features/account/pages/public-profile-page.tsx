import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { Community, ForumAuthorProfile } from '@messages/contracts'
import { ArrowLeft, MessageCircle, PencilLine, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePageTitle } from '@/hooks/use-page-title'
import { IdentityImage } from '@/features/media/components/identity-image'
import { ForisCharacter } from '@/components/brand/foris-character'
import { FollowButton } from '@/features/forum/following/follow-button'
import { ShareLink } from '@/features/forum/reading/reading-actions'
import { DiscoveryFeed } from '@/features/forum/discovery/discovery-feed'
import { ForumEmpty, ForumError } from '@/features/forum/components/forum-states'
import { ContentSkeleton, PostRowsPlaceholder } from '@/features/forum/components/content-skeletons'
import { useForumPage, useResource } from '@/features/forum/hooks/use-forum'
import { useAuth } from '../hooks/use-auth'
import { publicProfileLink } from '../lib/public-profile'
import { loginLink } from '../lib/return-target'
import '@/features/forum/components/content-layout.css'
import './public-profile.css'

function ProfileCommunityPlaceholders() {
  return <ul className="person-community-list">
    {[0, 1].map(index => <li key={index}>
      <div className="flex min-h-11 items-center gap-2.5">
        <Skeleton className="size-10" />
        <div className="grid w-40 max-w-full gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="mt-2 h-3.5 w-3/4 max-w-md" />
    </li>)}
  </ul>
}

function PublicCommunities({ personId, preview = false }: { personId: string; preview?: boolean }) {
  const page = useForumPage<Community>('authors/' + personId + '/communities?limit=' + (preview ? '3' : '20'))
  if (page.loading && !page.ready) return preview ? <p className="person-status" role="status">Cargando comunidades…</p>
    : <ContentSkeleton label="Cargando comunidades…"><ProfileCommunityPlaceholders /></ContentSkeleton>
  if (page.error) return <ForumError message={page.error} retry={page.retry} />
  if (!page.items.length) return preview ? <p className="person-empty">No hay comunidades para mostrar.</p> : <div className="person-empty with-character"><div><p>No hay comunidades para mostrar.</p></div><ForisCharacter scene="profileCommunities" width={72} height={72} /></div>
  return <><ul className={'person-community-list' + (preview ? ' is-preview' : '')} aria-label="Comunidades de esta persona">{page.items.map(item => <li key={item.id}>
    <Link to={'/comunidades/' + item.id} className="person-community-identity"><IdentityImage fallbackKey={'community:' + item.id} mediaId={item.imageId} name={item.name} className="person-community-avatar" /><span><strong>{item.name}</strong><small>{item.owner.id === personId ? 'Creador' : 'Miembro'}</small></span></Link>
    {!preview && <><p className="person-community-description">{item.description}</p><div className="person-community-actions"><span><UsersRound aria-hidden="true" />{item.memberCount} {item.memberCount === 1 ? 'miembro' : 'miembros'}</span></div></>}
  </li>)}</ul>{page.moreError && <p className="forum-error" role="alert">{page.moreError}</p>}{!preview && page.hasMore && <Button type="button" variant="secondary" className="h-11" disabled={page.loadingMore} onClick={() => void page.loadMore()}>{page.loadingMore ? 'Cargando…' : 'Ver más comunidades'}</Button>}</>
}
function PublicProfile({ id }: { id: string }) {
  const auth = useAuth()
  const valid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu.test(id)
  const person = useResource<ForumAuthorProfile>(valid ? 'authors/' + id : null)
  const [params, setParams] = useSearchParams()
  const communities = params.get('vista') === 'comunidades'
  const name = person.data?.displayName ?? 'Perfil público'
  usePageTitle(communities ? `${name} · Comunidades` : name)
  function showCommunities(value: boolean) { setParams(value ? { vista: 'comunidades' } : {}) }
  if (!valid) return <ForumEmpty title="Este perfil no está disponible"><Link to="/">Volver a Foros</Link></ForumEmpty>
  const backLink = <Link to="/" className="person-back"><ArrowLeft aria-hidden="true" />Foros</Link>
  if (person.loading && !person.data) return <>
    {backLink}
    <ContentSkeleton label="Abriendo perfil…">
      <div className="person-header">
        <Skeleton className="size-11 rounded-full md:size-14" />
        <div className="person-identity grid gap-2.5">
          <Skeleton className="h-7 w-3/4 max-w-56" />
          <Skeleton className="h-3 w-4/5 max-w-44" />
          <Skeleton className="mt-2 h-4 w-5/6 max-w-md" />
        </div>
      </div>
      <div className="person-navigation">
        <Skeleton className="h-11 w-28 rounded-full" />
        <Skeleton className="h-11 w-28 rounded-full" />
      </div>
      {communities ? <ProfileCommunityPlaceholders /> : <div className="content-columns"><div className="content-primary"><PostRowsPlaceholder /></div></div>}
    </ContentSkeleton>
  </>
  if (person.error) return <ForumError message={person.error} retry={person.retry} />
  if (!person.data) return null
  const profile = person.data
  const own = auth.session.user?.id === id
  const chat = '/chat/direct:' + id
  const joined = new Date(profile.createdAt).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })
  return <>
    {backLink}
    <header className="person-header"><IdentityImage fallbackKey={'user:' + profile.id} mediaId={profile.avatarId} name={profile.displayName} className="person-avatar" /><div className="person-identity"><h1>{profile.displayName}</h1><p className="person-joined">En Foris desde <time dateTime={profile.createdAt}>{joined}</time></p>{profile.bio && <p className="person-bio">{profile.bio}</p>}</div>
      <div className="person-header-actions">{own ? <Button asChild variant="secondary" className="h-11"><Link to="/profile"><PencilLine aria-hidden="true" />Editar perfil</Link></Button> : <>
        <FollowButton id={id} name={profile.displayName} initial={profile.isFollowing} />
        <Button asChild variant="secondary" className="h-11 social-action"><Link to={auth.session.user ? chat : loginLink(chat)}><MessageCircle aria-hidden="true" />Enviar mensaje</Link></Button>
      </>}<ShareLink path={publicProfileLink(id)} title={'Perfil de ' + profile.displayName} /></div>
    </header>
    <div className="person-navigation" role="group" aria-label="Actividad del perfil" data-profile-navigation><Button type="button" variant={communities ? 'ghost' : 'secondary'} className="h-11" aria-pressed={!communities} onClick={() => showCommunities(false)}>Publicaciones <span>{profile.publicPostCount}</span></Button><Button type="button" variant={communities ? 'secondary' : 'ghost'} className="h-11" aria-pressed={communities} onClick={() => showCommunities(true)}>Comunidades <span>{profile.publicCommunityCount}</span></Button></div>
    {communities ? <section className="person-communities" aria-label="Comunidades"><PublicCommunities key={'all-' + id} personId={id} /></section> : <div className="content-columns"><section className="content-primary" aria-label="Publicaciones"><DiscoveryFeed key={'posts-' + id} path={'authors/' + id + '/posts'} filtered={false} showFollow={false} onClear={() => undefined} emptyState={<div className="person-empty with-character"><ForisCharacter scene="profilePosts" width={72} height={72} /><div><p>No hay publicaciones para mostrar.</p>{own && <Button asChild variant="secondary" className="h-11"><Link to="/publicar">Crear publicación</Link></Button>}</div></div>} /></section>
      <aside className="context-rail" aria-label="Comunidades del perfil"><section className="context-section"><h2>Comunidades</h2><PublicCommunities key={'preview-' + id} personId={id} preview />{profile.publicCommunityCount > 0 && <Button type="button" variant="ghost" className="h-11 person-see-communities" onClick={() => showCommunities(true)}>Ver todas ({profile.publicCommunityCount})</Button>}</section></aside>
    </div>}
  </>
}
export function PublicProfilePage() {
  const { userId = '' } = useParams()
  const auth = useAuth()
  return <main id="forum-content" className="forum-main person-page" tabIndex={-1}><PublicProfile key={userId + '.' + (auth.session.user?.id ?? 'guest') + '.' + auth.status} id={userId.toLowerCase()} /></main>
}
