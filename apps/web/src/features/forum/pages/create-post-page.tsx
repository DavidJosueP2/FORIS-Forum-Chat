import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import type { ForumPost, ForumTopic } from '@messages/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/account/hooks/use-auth'
import { accountError, accountRequest } from '@/features/account/api/account-api'
import { ForumShell } from '../components/forum-shell'
import { ForumError, ForumLoading, ParticipationGate } from '../components/forum-states'
import { useResource } from '../hooks/use-forum'
import { useDraft } from '../hooks/use-draft'
import { CommunityWritingGate } from '@/features/communities/components/community-writing-gate'
import { validCommunityId } from '@/features/communities/lib/notifications'
import { ImagePicker } from '@/features/media/components/image-picker'

function PostForm({ userId, topicId, communityId }: { userId: string; topicId: string; communityId?: string }) {
  const topics = useResource<ForumTopic[]>('topics')
  const { draft, stored, change, clear, alive } = useDraft('foris.forum.post.' + userId + (communityId ? '.community.' + communityId : ''), topicId)
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [imagesBusy, setImagesBusy] = useState(false)
  const [imagesPending, setImagesPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const guard = useRef(false)
  const selectedTopic = topics.data?.find(topic => topic.id === draft.topicId)
  async function submit() {
    if (guard.current || imagesBusy) return
    if (imagesPending) { setError('Termina la subida de las imágenes o quita las que no se completaron.'); return }
    if (!draft.title.trim() || !draft.body.trim() || !selectedTopic) {
      setError('Escribe un título, elige un tópico y cuéntanos tu idea.'); return
    }
    guard.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await accountRequest<{ post: ForumPost; created: boolean }>('posts', 'POST', { ...draft, communityId })
      if (!alive.current) return
      clear()
      navigate('/publicaciones/' + result.post.id, { replace: true })
    } catch (cause) { if (alive.current) setError(accountError(cause)) }
    finally { guard.current = false; if (alive.current) setBusy(false) }
  }
  if (topics.loading) return <ForumLoading label="Preparando los tópicos…" />
  if (topics.error) return <ForumError message={topics.error} retry={topics.retry} />
  return <form className="forum-form" aria-busy={busy} onSubmit={event => { event.preventDefault(); void submit() }}>
    <fieldset disabled={busy || imagesBusy}>
      <div className="forum-field"><label htmlFor="post-topic">Tópico</label>
        <select id="post-topic" required value={selectedTopic?.id ?? ''} onChange={event => change({ topicId: event.target.value })}>
          <option value="" disabled>Elige dónde compartir tu idea</option>
          {topics.data?.map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
        </select>
        {selectedTopic && <p className="forum-hint">{selectedTopic.description}</p>}
      </div>
      <div className="forum-field"><label htmlFor="post-title">Un título para abrir la conversación</label><Input id="post-title" name="title" required maxLength={160} value={draft.title} onChange={event => change({ title: event.target.value })} placeholder="¿Qué te gustaría compartir?" /><span className="forum-hint">{draft.title.length}/160</span></div>
      <div className="forum-field"><label htmlFor="post-body">Tu publicación</label><Textarea id="post-body" name="body" required rows={10} maxLength={10000} value={draft.body} onChange={event => change({ body: event.target.value })} placeholder="Da un poco de contexto. Una buena pregunta también es un buen comienzo." /><span className="forum-hint">{draft.body.length}/10000 caracteres. Solo texto, con los saltos de línea que necesites.</span></div>
      <ImagePicker ids={draft.mediaIds} disabled={busy} onChange={mediaIds => change({ mediaIds })} onBusyChange={setImagesBusy} onPendingChange={setImagesPending} />
      <p className="forum-hint">Tu publicación y sus imágenes serán públicas y aparecerán con el nombre de tu perfil. Evita compartir datos privados.</p>
      {!stored && <p className="forum-error" role="status">El navegador no permite guardar el borrador. Conserva una copia antes de salir de esta página.</p>}
      {error && <p className="forum-error" role="alert">{error} Tu borrador sigue aquí.</p>}
      <div className="forum-actions"><Button type="submit" className="h-12 px-7">{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? 'Publicando…' : 'Publicar'}</Button><Button asChild variant="ghost" className="h-12 px-6"><Link to="/">Volver al foro</Link></Button></div>
    </fieldset>
  </form>
}
export function CreatePostPage() {
  const [params] = useSearchParams()
  const topicId = params.get('topico') ?? ''
  const communityId = params.get('comunidad') ?? ''
  const auth = useAuth()
  const target = new URLSearchParams()
  if (topicId) target.set('topico', topicId)
  if (communityId) target.set('comunidad', communityId)
  const next = '/publicar' + (target.size ? '?' + target.toString() : '')
  const form = auth.session.user && <PostForm key={auth.session.user.id + communityId} userId={auth.session.user.id} topicId={topicId} communityId={communityId || undefined} />
  return <ForumShell><main id="forum-content" className="forum-main forum-editor" tabIndex={-1}>
    <Link to={communityId && validCommunityId(communityId) ? '/comunidades/' + communityId : '/'} className="forum-back"><ArrowLeft aria-hidden="true" />{communityId ? 'Comunidad' : 'Foros'}</Link>
    <header className="forum-page-heading"><h1>Abre una conversación.</h1><p>Una pregunta, un descubrimiento, algo que estás construyendo. Empieza por ahí.</p></header>
    <ParticipationGate next={next}>{communityId ? validCommunityId(communityId) ? <CommunityWritingGate key={auth.session.user?.id ?? 'guest'} communityId={communityId}>{form}</CommunityWritingGate> : <p className="forum-error" role="alert">La comunidad indicada no es válida. Vuelve al foro e inténtalo de nuevo.</p> : form}</ParticipationGate>
  </main></ForumShell>
}
