import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, RefreshCw } from 'lucide-react'
import { publicProfileLink } from '@/features/account/lib/public-profile'
import type { InboxNotification } from '@messages/contracts'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/account/hooks/use-auth'
import { accountError, accountRequest } from '@/features/account/api/account-api'
import { ForumEmpty, ForumError, ForumLoading, ForumTime, ParticipationGate } from '@/features/forum/components/forum-states'
import { useForumPage } from '@/features/forum/hooks/use-forum'
import { notifyInboxChanged } from '../lib/notifications'

function Inbox() {
  const page = useForumPage<InboxNotification>('notifications')
  const [read, setRead] = useState<Set<string>>(new Set())
  const [through, setThrough] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const guard = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  function isRead(item: InboxNotification) { return Boolean(item.readAt || read.has(item.id) || (through && BigInt(item.id) <= BigInt(through))) }
  async function mark(id: string, all = false) {
    if (guard.current) return
    guard.current = true
    setBusy(true); setError(null); setNotice(null)
    try {
      await accountRequest(all ? 'notifications/read-all' : 'notifications/' + id + '/read', 'POST', all ? { throughId: id } : {})
      notifyInboxChanged()
      if (!alive.current) return
      if (all) setThrough(id); else setRead(current => new Set([...current, id]))
      setNotice(all ? 'Los avisos recibidos hasta ahora están marcados como leídos.' : 'Aviso marcado como leído.')
    } catch (cause) { if (alive.current) setError(accountError(cause)) }
    finally { guard.current = false; if (alive.current) setBusy(false) }
  }
  if (page.loading && !page.ready) return <ForumLoading label="Cargando tus avisos…" />
  if (page.error) return <ForumError message={page.error} retry={page.retry} />
  if (!page.items.length) return <ForumEmpty scene="inbox" placement="beside" title="Las novedades llegarán aquí"><p>Aquí verás quién empieza a seguirte y las nuevas publicaciones de las comunidades con avisos activos.</p><Button asChild variant="secondary" className="h-11 mt-5 px-6"><Link to="/comunidades">Explorar comunidades</Link></Button></ForumEmpty>
  return <>
    <div className="community-inbox-tools"><Button variant="secondary" className="h-11 px-5" disabled={busy} onClick={() => void mark(page.items[0].id, true)}><Check aria-hidden="true" />Marcar todas como leídas</Button></div>
    {error && <p className="forum-error" role="alert">{error}</p>}
    {notice && <p className="forum-success" role="status">{notice}</p>}
    <ol className="community-inbox" aria-label="Tus notificaciones">
      {page.items.map(item => <li key={item.id}><article className="community-notification" data-read={isRead(item)}>
        <div className="forum-meta">{item.kind === 'community' ? <Link to={'/comunidades/' + item.community.id}>{item.community.name}</Link> : <span>Nuevo seguidor</span>}<ForumTime value={item.createdAt} />{!isRead(item) && <span className="forum-topic-label">Sin leer</span>}</div>
        {item.kind === 'follow'
          ? <h2><Link to={publicProfileLink(item.follower.id)}>{item.follower.displayName}</Link> empezó a seguirte.</h2>
          : <><h2><Link to={'/publicaciones/' + item.post.id}>{item.post.title}</Link></h2><p>{item.authorName} compartió una nueva publicación.</p></>}
        {!isRead(item) && <Button variant="ghost" className="h-11 px-3" disabled={busy} onClick={() => void mark(item.id)}>Marcar como leída</Button>}
      </article></li>)}
    </ol>
    {page.moreError && <p className="forum-error" role="alert">{page.moreError}</p>}
    {page.hasMore && <Button variant="secondary" className="h-11 px-6 forum-more" disabled={page.loadingMore} onClick={() => void page.loadMore()}>{page.loadingMore ? 'Cargando…' : 'Ver avisos anteriores'}</Button>}
  </>
}
export function NotificationsPage() {
  const auth = useAuth()
  const [version, setVersion] = useState(0)
  return <main id="forum-content" className="forum-main forum-reading" tabIndex={-1}>
    <header className="forum-intro"><div><h1>Tus notificaciones</h1><p>Nuevos seguidores y publicaciones de tus comunidades.</p></div><Button variant="secondary" className="h-11 px-5" onClick={() => { setVersion(current => current + 1); notifyInboxChanged() }}><RefreshCw aria-hidden="true" />Actualizar</Button></header>
    <ParticipationGate next="/notificaciones" description="Entra con tu cuenta para ver tus avisos. Son privados y solo tú puedes consultarlos.">{auth.session.user && <Inbox key={auth.session.user.id + '.' + version} />}</ParticipationGate>
    <p className="forum-hint community-inbox-note">Puedes activar o silenciar los avisos en cada comunidad. Aquí solo recibes notificaciones dentro de Foris.</p>
  </main>
}
