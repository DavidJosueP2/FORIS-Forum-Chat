import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import type { CreatedForumReply, ForumPost, ForumReply } from '@messages/contracts'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/account/hooks/use-auth'
import { accountError, accountRequest } from '@/features/account/api/account-api'
import { ForumShell } from '../components/forum-shell'
import { ForumEmpty, ForumError, ForumLoading, ForumTime, ParticipationGate } from '../components/forum-states'
import { useForumPage, useResource } from '../hooks/use-forum'
import { useDraft } from '../hooks/use-draft'
import { CommunityWritingGate } from '@/features/communities/components/community-writing-gate'
import { PostImages } from '@/features/media/components/post-images'

function ReplyForm({ postId, userId, onSaved }: { postId: string; userId: string; onSaved: (result: CreatedForumReply) => void }) {
  const { draft, stored, change, clear, alive } = useDraft('foris.forum.reply.' + userId + '.' + postId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const guard = useRef(false)
  async function submit() {
    if (guard.current) return
    if (!draft.body.trim()) { setError('Escribe una respuesta antes de publicarla.'); return }
    guard.current = true
    setBusy(true)
    setSaved(false)
    setError(null)
    try {
      const result = await accountRequest<CreatedForumReply>('posts/' + postId + '/replies', 'POST', { body: draft.body, requestId: draft.requestId })
      if (!alive.current) return
      onSaved(result)
      clear()
      setSaved(true)
    } catch (cause) { if (alive.current) setError(accountError(cause)) }
    finally { guard.current = false; if (alive.current) setBusy(false) }
  }
  return <form className="forum-form forum-reply-form" aria-busy={busy} onSubmit={event => { event.preventDefault(); void submit() }}>
    <fieldset disabled={busy}>
      <div className="forum-field"><label htmlFor="reply-body">Comparte tu respuesta</label><Textarea id="reply-body" rows={5} required maxLength={5000} value={draft.body} onChange={event => { change({ body: event.target.value }); setSaved(false) }} placeholder="Aporta una idea, una experiencia o una pregunta." /><p className="forum-hint">{draft.body.length}/5000 caracteres. Tu respuesta será pública.</p></div>
      {!stored && <p className="forum-error" role="status">El borrador no se puede guardar en este navegador. Conserva una copia antes de salir.</p>}
      {error && <p className="forum-error" role="alert">{error} Tu borrador sigue aquí.</p>}
      {saved && <p className="forum-success" role="status">Tu respuesta ya está publicada.</p>}
      <Button type="submit" className="h-12 px-6">{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? 'Publicando…' : 'Publicar respuesta'}</Button>
    </fieldset>
  </form>
}
function Replies({ post, onCount }: { post: ForumPost; onCount: (count: number) => void }) {
  const auth = useAuth()
  const page = useForumPage<ForumReply>('posts/' + post.id + '/replies')
  const form = auth.session.user && <ReplyForm key={auth.session.user.id} postId={post.id} userId={auth.session.user.id} onSaved={result => { page.prepend(result.reply); onCount(result.replyCount) }} />
  return <section id="respuestas" className="forum-replies" aria-labelledby="replies-heading" tabIndex={-1}>
    <div className="forum-list-heading"><h2 id="replies-heading">{post.replyCount} {post.replyCount === 1 ? 'respuesta' : 'respuestas'}</h2><span>Más recientes primero</span></div>
    <div id="responder" className="forum-reply-entry" tabIndex={-1}>
      <ParticipationGate next={'/publicaciones/' + post.id + '#responder'}>
        {post.community ? <CommunityWritingGate key={auth.session.user?.id ?? 'guest'} communityId={post.community.id}>{form}</CommunityWritingGate> : form}
      </ParticipationGate>
    </div>
    {page.loading && !page.ready && <ForumLoading label="Cargando respuestas…" />}
    {page.error && <ForumError message={page.error} retry={page.retry} />}
    {page.ready && !page.items.length && <div className="forum-no-replies"><p>Aún no hay respuestas. Una conversación empieza con alguien que se anima.</p></div>}
    <ol className="forum-reply-list" aria-label="Respuestas a esta publicación">
      {page.items.map(reply => <li key={reply.id}><article className="forum-reply">
        <header className="forum-meta"><strong>{reply.author.displayName}</strong>{reply.author.id === post.author.id && <span className="forum-topic-label">Autor de la publicación</span>}<ForumTime value={reply.createdAt} /></header>
        <p className="forum-prose">{reply.body}</p>
      </article></li>)}
    </ol>
    {page.moreError && <p className="forum-error" role="alert">{page.moreError}</p>}
    {page.hasMore && <Button variant="secondary" className="h-11 px-6 forum-more" disabled={page.loadingMore} onClick={() => void page.loadMore()}>{page.loadingMore ? 'Cargando…' : 'Ver respuestas anteriores'}</Button>}
  </section>
}
function PostContent({ id }: { id: string }) {
  const auth = useAuth()
  const post = useResource<ForumPost>('posts/' + id)
  const { hash } = useLocation()
  const loaded = post.data !== null
  useEffect(() => {
    if (!loaded || (hash !== '#responder' && hash !== '#respuestas')) return
    const target = document.getElementById(hash.slice(1))
    target?.scrollIntoView()
    if (hash === '#responder') target?.focus({ preventScroll: true })
  }, [loaded, hash])
  if (post.loading && !post.data) return <ForumLoading label="Cargando publicación…" />
  if (post.error) return <ForumError message={post.error} retry={post.retry} />
  if (!post.data) return null
  const item = post.data
  return <>
    <article className="forum-publication">
      <header><div className="forum-meta"><Link to={'/?topico=' + item.topic.id} className="forum-topic-label">{item.topic.name}</Link>{item.community && <Link to={'/comunidades/' + item.community.id}>{item.community.name}</Link>}</div><h1>{item.title}</h1><div className="forum-meta"><span>Por {item.author.displayName}</span><ForumTime value={item.createdAt} /></div></header>
      <p className="forum-prose">{item.body}</p>
      <PostImages images={item.images} canDelete={auth.session.user?.id === item.author.id} />
    </article>
    <Replies key={item.id} post={item} onCount={count => post.setData({ ...item, replyCount: count })} />
  </>
}
export function PostPage() {
  const auth = useAuth()
  const { postId = '' } = useParams()
  const valid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu.test(postId)
  return <ForumShell><main id="forum-content" className="forum-main forum-reading" tabIndex={-1}>
    <Link to="/" className="forum-back"><ArrowLeft aria-hidden="true" />Foros</Link>
    {valid ? <PostContent key={postId + (auth.session.user?.id ?? 'guest') + auth.status} id={postId} /> : <ForumEmpty title="Esta publicación no existe"><p>Vuelve al foro para encontrar otra conversación.</p><Link to="/">Ver publicaciones</Link></ForumEmpty>}
  </main></ForumShell>
}
