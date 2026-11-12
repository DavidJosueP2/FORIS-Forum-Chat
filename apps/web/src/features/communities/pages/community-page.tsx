import { publicProfileLink } from '@/features/account/lib/public-profile'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bell, LockKeyhole, MessageCircle, Plus, Star, UsersRound } from 'lucide-react'
import type { Community, CommunityPreferences } from '@messages/contracts'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/use-page-title'
import { useAuth } from '@/features/account/hooks/use-auth'
import { accountError, accountRequest } from '@/features/account/api/account-api'
import { loginLink } from '@/features/account/lib/return-target'
import { ForumEmpty, ForumError, ForumLoading } from '@/features/forum/components/forum-states'
import { PostList } from '@/features/forum/components/post-list'
import { useResource } from '@/features/forum/hooks/use-forum'
import { validCommunityId } from '../lib/notifications'
import { IdentityImage } from '@/features/media/components/identity-image'
import { CommunityManagement } from '../components/community-management'

function CommunityControls({ community, onChanged }: { community: Community; onChanged: (value: Community) => void }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const guard = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  async function change(action: 'join' | 'leave' | 'preferences', body: CommunityPreferences = {}) {
    if (guard.current) return
    guard.current = true
    setBusy(true); setError(null); setNotice(null)
    try {
      if (action === 'leave') {
        await accountRequest('communities/' + community.id + '/membership', 'DELETE', {})
        if (alive.current) navigate('/comunidades?vista=mias', { replace: true })
        return
      }
      const result = await accountRequest<Community>('communities/' + community.id + (action === 'preferences' ? '/preferences' : '/membership'), action === 'preferences' ? 'PATCH' : 'POST', body)
      if (!alive.current) return
      onChanged(result)
      setNotice(action === 'join' ? 'Ya formas parte de la comunidad.' : 'Tus preferencias se guardaron.')
    } catch (cause) { if (alive.current) setError(accountError(cause)) }
    finally { guard.current = false; if (alive.current) setBusy(false) }
  }
  return <section className="community-controls" aria-label="Tu relación con esta comunidad" aria-busy={busy}>
    <div className="forum-actions">
      {!community.membership && <Button className="h-11 px-6" disabled={busy} onClick={() => void change('join')}>Unirme</Button>}
      {community.membership && <Button asChild className="h-11 px-5"><Link to={'/chat/community:' + community.id}><MessageCircle aria-hidden="true" />Abrir chat</Link></Button>}
      <Button variant="secondary" className="h-11 px-5 community-star" data-active={community.isFavorite} aria-pressed={community.isFavorite} disabled={busy} onClick={() => void change('preferences', { favorite: !community.isFavorite })}><Star aria-hidden="true" />{community.isFavorite ? 'En favoritas' : 'Guardar favorita'}</Button>
    </div>
    {community.membership && <label className="community-notification-setting"><input type="checkbox" checked={community.membership.notifyPosts} disabled={busy} onChange={event => void change('preferences', { notifyPosts: event.target.checked })} /><span><strong><Bell aria-hidden="true" />Avisos de publicaciones</strong></span></label>}
    {community.membership?.role === 'member' && <Button variant="ghost" className="community-leave h-11" disabled={busy} onClick={() => void change('leave')}>Salir de la comunidad</Button>}
    {error && <p className="forum-error" role="alert">{error}</p>}
    {notice && <p className="sr-only" role="status">{notice}</p>}
  </section>
}
function CommunityContent({ id }: { id: string }) {
  const auth = useAuth()
  const valid = validCommunityId(id)
  const community = useResource<Community>(valid ? 'communities/' + id : null)
  usePageTitle(community.data?.name ?? 'Comunidad')
  if (!valid) return <ForumEmpty title="Esta comunidad no existe"><p>Vuelve a explorar para encontrar otro espacio.</p><Link to="/comunidades">Ver comunidades</Link></ForumEmpty>
  if (community.loading && !community.data) return <ForumLoading label="Abriendo comunidad…" />
  if (community.error) return <ForumError message={community.error} retry={community.retry} />
  if (!community.data) return null
  const item = community.data
  return <>
    <Link to="/comunidades" className="community-directory-back"><ArrowLeft aria-hidden="true" />Todas las comunidades</Link>
    <header className="community-heading">
      <div className="community-identity">
        <IdentityImage fallbackKey={'community:' + item.id} mediaId={item.imageId} name={item.name} className="community-photo" />
        <div>
          <h1>{item.name}</h1>
          <p className="community-description">{item.description}</p>
          <div className="forum-meta">
            {item.visibility === 'private' && <span className="community-members"><LockKeyhole aria-hidden="true" />Privada</span>}
            <span className="community-members"><UsersRound aria-hidden="true" />{item.memberCount} {item.memberCount === 1 ? 'miembro' : 'miembros'}</span>
            <span>{item.postCount} {item.postCount === 1 ? 'publicación' : 'publicaciones'}</span>
            <span>Creada por <Link to={publicProfileLink(item.owner.id)}>{item.owner.displayName}</Link></span>
            {item.membership && <span>Tu rol: <strong>{item.membership.role === 'owner' ? 'Creador' : 'Miembro'}</strong></span>}
          </div>
        </div>
      </div>
      <div className="community-heading-actions">
        {auth.status === 'loading' ? <ForumLoading label="Comprobando tu cuenta…" />
          : auth.status === 'error' ? <ForumError message={auth.error ?? 'No pudimos comprobar tu cuenta.'} retry={() => void auth.refresh()} />
          : auth.session.user ? <CommunityControls community={item} onChanged={community.setData} />
          : <div className="forum-actions">
            <Button asChild className="h-11 px-6"><Link to={loginLink('/comunidades/' + id)}>Entrar para unirme</Link></Button>
            <Button asChild variant="secondary" className="h-11 px-5"><Link to={loginLink('/comunidades/' + id)}><Star aria-hidden="true" />Guardar favorita</Link></Button>
          </div>}
      </div>
    </header>
    {item.membership?.role === 'owner' && <CommunityManagement community={item} onChanged={community.setData} />}
    <section className="community-forums" aria-labelledby="community-forums-heading">
      <div className="forum-list-heading">
        <h2 id="community-forums-heading">Publicaciones</h2>
        {item.membership && <Button asChild variant="secondary" className="h-11 px-5"><Link to={'/publicar?comunidad=' + id}><Plus aria-hidden="true" />Nueva publicación</Link></Button>}
      </div>
      <PostList key={id} path={'posts?community=' + id} filtered={false} createTo={'/publicar?comunidad=' + id} />
    </section>
  </>
}
export function CommunityPage() {
  const { communityId = '' } = useParams()
  const auth = useAuth()
  return <main id="forum-content" className="forum-main community-detail" tabIndex={-1}>
    <CommunityContent key={communityId + (auth.session.user?.id ?? 'guest') + auth.status} id={communityId} />
  </main>
}
