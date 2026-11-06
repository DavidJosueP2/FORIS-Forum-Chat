import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bell, Check, Globe2, LockKeyhole, Plus, Star, UsersRound } from 'lucide-react'
import type { Community, CommunityPreferences } from '@messages/contracts'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/account/hooks/use-auth'
import { accountError, accountRequest } from '@/features/account/api/account-api'
import { loginLink } from '@/features/account/lib/return-target'
import { ForumShell } from '@/features/forum/components/forum-shell'
import { ForumEmpty, ForumError, ForumLoading } from '@/features/forum/components/forum-states'
import { PostList } from '@/features/forum/pages/forum-page'
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
      {community.membership ? <span className="community-member-status"><Check aria-hidden="true" />{community.membership.role === 'owner' ? 'Creaste esta comunidad' : 'Formas parte de esta comunidad'}</span> : <Button className="h-11 px-6" disabled={busy} onClick={() => void change('join')}>Unirme a la comunidad</Button>}
      <Button variant="secondary" className="h-11 px-5 community-star" data-active={community.isFavorite} aria-pressed={community.isFavorite} disabled={busy} onClick={() => void change('preferences', { favorite: !community.isFavorite })}><Star aria-hidden="true" />{community.isFavorite ? 'En favoritas' : 'Guardar favorita'}</Button>
      {community.membership?.role === 'member' && <Button variant="ghost" className="h-11 px-5" disabled={busy} onClick={() => void change('leave')}>Salir de la comunidad</Button>}
    </div>
    {community.membership ? <label className="community-notification-setting"><input type="checkbox" checked={community.membership.notifyPosts} disabled={busy} onChange={event => void change('preferences', { notifyPosts: event.target.checked })} /><span><strong><Bell aria-hidden="true" />Avisos de nuevas publicaciones</strong><span>Recíbelos dentro de Foris. No te avisaremos de tus propias publicaciones.</span></span></label> : <p className="forum-hint">Al unirte recibirás avisos dentro de Foris; puedes silenciarlos aquí cuando quieras. Guardar una favorita no te une a la comunidad.</p>}
    {error && <p className="forum-error" role="alert">{error}</p>}
    {notice && <p className="forum-success" role="status">{notice}</p>}
  </section>
}
function CommunityContent({ id }: { id: string }) {
  const auth = useAuth()
  const community = useResource<Community>('communities/' + id)
  if (community.loading && !community.data) return <ForumLoading label="Abriendo comunidad…" />
  if (community.error) return <ForumError message={community.error} retry={community.retry} />
  if (!community.data) return null
  const item = community.data
  return <>
    <header className="community-heading"><IdentityImage mediaId={item.imageId} name={item.name} className="community-photo" /><div><h1>{item.name}</h1><p className="community-description">{item.description}</p><div className="forum-meta"><span className="community-members">{item.visibility === 'private' ? <LockKeyhole aria-hidden="true" /> : <Globe2 aria-hidden="true" />}{item.visibility === 'private' ? 'Privada' : 'Pública'}</span><span className="community-members"><UsersRound aria-hidden="true" />{item.memberCount} {item.memberCount === 1 ? 'miembro' : 'miembros'}</span><span>{item.postCount} {item.postCount === 1 ? 'publicación' : 'publicaciones'}</span><span>Creada por {item.owner.displayName}</span></div></div></header>
    {auth.status === 'loading' ? <ForumLoading label="Comprobando tu cuenta…" /> : auth.status === 'error' ? <ForumError message={auth.error ?? 'No pudimos comprobar tu cuenta.'} retry={() => void auth.refresh()} /> : auth.session.user ? <CommunityControls community={item} onChanged={community.setData} /> : <section className="community-controls"><div className="forum-actions"><Button asChild className="h-11 px-6"><Link to={loginLink('/comunidades/' + id)}>Entrar para unirme</Link></Button><Button asChild variant="secondary" className="h-11 px-5"><Link to={loginLink('/comunidades/' + id)}><Star aria-hidden="true" />Guardar favorita</Link></Button></div><p className="forum-hint">Puedes leer sin cuenta. Para unirte o guardar favoritas, entra con Google o con tu correo.</p></section>}
    {item.membership?.role === 'owner' && <CommunityManagement community={item} onChanged={community.setData} />}
    <section className="community-forums" aria-labelledby="community-forums-heading">
      <div className="forum-list-heading"><h2 id="community-forums-heading">Foros de la comunidad</h2>{item.membership && <Button asChild className="h-11 px-5"><Link to={'/publicar?comunidad=' + id}><Plus aria-hidden="true" />Nueva publicación</Link></Button>}</div>
      <PostList key={id} path={'posts?community=' + id} filtered={false} createTo={'/publicar?comunidad=' + id} emptyTitle="Una comunidad empieza escuchando" />
    </section>
  </>
}
export function CommunityPage() {
  const { communityId = '' } = useParams()
  const auth = useAuth()
  return <ForumShell><main id="forum-content" className="forum-main" tabIndex={-1}>
    <Link to="/comunidades" className="forum-back"><ArrowLeft aria-hidden="true" />Comunidades</Link>
    {validCommunityId(communityId) ? <CommunityContent key={communityId + (auth.session.user?.id ?? 'guest') + auth.status} id={communityId} /> : <ForumEmpty title="Esta comunidad no existe"><p>Vuelve a explorar para encontrar otro espacio.</p><Link to="/comunidades">Ver comunidades</Link></ForumEmpty>}
  </main></ForumShell>
}
