import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ChangedForumReply, CreatedForumReply, ForumPost, ForumReply } from '@messages/contracts'
import { ChevronDown, ChevronUp, MessageCircle, MoreHorizontal, PencilLine, Pin, PinOff, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { IdentityImage } from '@/features/media/components/identity-image'
import { accountError, accountRequest } from '@/features/account/api/account-api'
import { ForumError, ForumLoading, ForumTime } from '../components/forum-states'
import { useForumPage, useResource } from '../hooks/use-forum'
import { ReplyComposer } from './reply-composer'
import { ShareLink, VoteButtons } from './reading-actions'
import type { Participation } from './reading-actions'

export function ReaderIdentity({ reply, authorId }: { reply: ForumReply; authorId: string }) {
  return <header className="reading-comment-meta">{!reply.deleted && <IdentityImage mediaId={reply.author.avatarId} name={reply.author.displayName} className="reading-avatar" />}
    {reply.deleted ? <span>Comentario eliminado</span> : <><Link to={'/?autor=' + reply.author.id} className="reading-name">{reply.author.displayName}</Link>{reply.author.id === authorId && <abbr className="reading-author-mark" title="Autor de la publicación">AU</abbr>}</>}
    <ForumTime value={reply.createdAt} />{!reply.deleted && reply.updatedAt && <span title={new Date(reply.updatedAt).toLocaleString('es-EC')}>editado</span>}
    {reply.pinned && <span className="reading-pinned"><Pin aria-hidden="true" />Anclado</span>}
  </header>
}

function Comment({ item, post, participation, onChange, onCount, onPin, permalink = false }: {
  item: ForumReply; post: ForumPost; participation: Participation; onChange: (reply: ForumReply) => void;
  onCount: (count: number) => void; onPin?: (reply: ForumReply) => void; permalink?: boolean;
}) {
  const [mode, setMode] = useState<'read' | 'reply' | 'edit'>('read')
  const [children, setChildren] = useState(permalink && item.replyCount > 0)
  const [childrenLoaded, setChildrenLoaded] = useState(children)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addedReplies, setAddedReplies] = useState<ForumReply[]>([])
  const [focusRequest, setFocusRequest] = useState(0)
  const article = useRef<HTMLElement>(null)
  const suppressMenuFocus = useRef(false)
  const guard = useRef(false)
  const alive = useRef(true)
  const navigate = useNavigate()
  const path = 'posts/' + post.id + '/replies/' + item.id
  const link = '/publicaciones/' + post.id + '?comentario=' + item.id
  const own = participation.userId === item.author.id
  const canPin = participation.userId === post.author.id && item.parentId === null && !participation.href
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => { if (focusRequest) article.current?.focus({ preventScroll: true }) }, [focusRequest])
  function closeComposer() { setMode('read'); setFocusRequest(current => current + 1) }
  async function change(kind: 'delete' | 'pin') {
    if (guard.current) return
    guard.current = true; setBusy(true); setError(null)
    try {
      if (kind === 'delete') {
        const result = await accountRequest<ChangedForumReply>(path, 'DELETE', { revision: item.revision })
        if (alive.current) { onChange(result.reply); onCount(result.replyCount); setDeleteOpen(false); setMode('read') }
      } else {
        const result = await accountRequest<ForumReply>(path + '/pin', 'PUT', { pinned: !item.pinned })
        if (alive.current) { onChange(result); onPin?.(result) }
      }
    } catch (cause) { if (alive.current) setError(accountError(cause)) }
    finally { guard.current = false; if (alive.current) setBusy(false) }
  }
  function saved(result: ChangedForumReply | CreatedForumReply) {
    onCount(result.replyCount); closeComposer()
    if ('created' in result) {
      if (result.created) onChange({ ...item, replyCount: item.replyCount + 1 })
      setAddedReplies(current => [result.reply, ...current.filter(reply => reply.id !== result.reply.id)]); setChildrenLoaded(true); setChildren(true)
    } else onChange(result.reply)
  }
  function reply() {
    if (participation.href) { navigate(participation.href); return }
    setMode(current => current === 'reply' ? 'read' : 'reply')
  }
  return <article ref={article} tabIndex={-1} id={'comentario-' + item.id} className={'reading-comment' + (item.pinned ? ' is-pinned' : '')} aria-label={item.deleted ? 'Comentario eliminado' : 'Comentario de ' + item.author.displayName}>
    <ReaderIdentity reply={item} authorId={post.author.id} />
    {mode === 'edit' && participation.userId ? <ReplyComposer key={'edit-' + item.id} postId={post.id} userId={participation.userId} editing={item} onSaved={saved} onCancel={closeComposer} onReload={reply => { onChange(reply); closeComposer() }} /> : <p className={'reading-comment-body' + (item.deleted ? ' is-deleted' : '')}>{item.deleted ? 'Este comentario fue eliminado.' : item.body}</p>}
    <div className="reading-comment-actions">
      {!item.deleted && mode === 'read' && <><VoteButtons votes={item.votes} path={path} participation={participation} disabled={busy} onBusyChange={setVoting} onChange={votes => onChange({ ...item, votes })} />
        {item.depth < 5 && <Button type="button" variant="ghost" className="reading-action" disabled={participation.pending || busy || voting} aria-expanded={false} onClick={reply}><MessageCircle aria-hidden="true" />Responder</Button>}
        <ShareLink path={link} title={post.title} compact />
        {(own || canPin) && <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" className="reading-icon" aria-label="Opciones del comentario" disabled={busy || voting || participation.pending}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="start" className="reading-menu" onCloseAutoFocus={event => { if (suppressMenuFocus.current) { event.preventDefault(); suppressMenuFocus.current = false } }}>
          {own && <><DropdownMenuItem disabled={Boolean(participation.href)} onSelect={() => { suppressMenuFocus.current = true; setMode('edit') }}><PencilLine aria-hidden="true" />Editar</DropdownMenuItem><DropdownMenuItem onSelect={() => { suppressMenuFocus.current = true; setDeleteOpen(true) }}><Trash2 aria-hidden="true" />Eliminar</DropdownMenuItem></>}
          {canPin && <DropdownMenuItem onSelect={() => void change('pin')}>{item.pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}{item.pinned ? 'Desanclar' : 'Anclar comentario'}</DropdownMenuItem>}
        </DropdownMenuContent></DropdownMenu>}
      </>}
      {item.replyCount > 0 && <Button type="button" variant="ghost" className="reading-action reading-thread-toggle" aria-expanded={children} onClick={() => { setChildrenLoaded(true); setChildren(current => !current) }}>{children ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}{children ? 'Ocultar respuestas' : item.replyCount + (item.replyCount === 1 ? ' respuesta' : ' respuestas')}</Button>}
    </div>
    {error && !deleteOpen && <p className="forum-error reading-inline-error" role="alert">{error}</p>}
    {mode === 'reply' && participation.userId && <ReplyComposer key={'reply-' + item.id} postId={post.id} userId={participation.userId} parent={item} onSaved={saved} onCancel={closeComposer} />}
    {childrenLoaded && <div className="reading-thread" hidden={!children}><ReplyList post={post} participation={participation} parentId={item.id} onCount={onCount} incoming={addedReplies} /></div>}
    <AlertDialog open={deleteOpen} onOpenChange={value => { if (!guard.current) setDeleteOpen(value) }}><AlertDialogContent onCloseAutoFocus={event => { event.preventDefault(); article.current?.focus({ preventScroll: true }) }}><AlertDialogHeader><AlertDialogTitle>¿Eliminar este comentario?</AlertDialogTitle><AlertDialogDescription>Se quitarán tu texto y tus votos. Las respuestas de otras personas permanecerán en el hilo.</AlertDialogDescription></AlertDialogHeader>{error && <p role="alert" className="forum-error">{error}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event => { event.preventDefault(); void change('delete') }}>{busy ? 'Eliminando…' : 'Eliminar'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </article>
}

function ReplyList({ post, participation, parentId = null, onCount, rootComposer = false, incoming = [] }: {
  post: ForumPost; participation: Participation; parentId?: string | null; onCount: (count: number) => void; rootComposer?: boolean; incoming?: ForumReply[];
}) {
  const page = useForumPage<ForumReply>('posts/' + post.id + '/replies' + (parentId ? '?parentId=' + parentId : ''), incoming)
  const items = [...page.items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (BigInt(a.id) > BigInt(b.id) ? -1 : 1))
  function pin(saved: ForumReply) {
    for (const item of page.items) if (item.id !== saved.id && item.pinned) page.update({ ...item, pinned: false })
    page.update(saved)
  }
  return <>
    {rootComposer && <div id="responder" className="reading-reply-entry" tabIndex={-1}>{participation.userId && !participation.href && <ReplyComposer key={participation.userId} postId={post.id} userId={participation.userId} onSaved={result => { page.prepend(result.reply); onCount(result.replyCount) }} />}</div>}
    {page.loading && !page.ready && <ForumLoading label="Cargando comentarios…" />}{page.error && <ForumError message={page.error} retry={page.retry} />}
    {page.ready && !items.length && <p className="reading-empty">{parentId ? 'Todavía no hay respuestas.' : 'Sé el primero en comentar.'}</p>}
    <ol className="reading-comment-list" aria-label={parentId ? 'Respuestas al comentario' : 'Comentarios'}>{items.map(item => <li key={item.id}><Comment item={item} post={post} participation={participation} onChange={page.update} onCount={onCount} onPin={pin} /></li>)}</ol>
    {page.moreError && <p role="alert" className="forum-error">{page.moreError}</p>}{page.hasMore && <Button type="button" variant="ghost" className="reading-action" disabled={page.loadingMore} onClick={() => void page.loadMore()}>{page.loadingMore ? 'Cargando…' : 'Ver más comentarios'}</Button>}
  </>
}

function LinkedComment({ id, post, participation, onCount }: { id: string; post: ForumPost; participation: Participation; onCount: (count: number) => void }) {
  const comment = useResource<ForumReply>('posts/' + post.id + '/replies/' + id)
  const container = useRef<HTMLDivElement>(null)
  const loaded = Boolean(comment.data)
  useEffect(() => { if (loaded) { container.current?.scrollIntoView({ block: 'start' }); container.current?.focus({ preventScroll: true }) } }, [loaded])
  return <div ref={container} tabIndex={-1} className="reading-linked-comment">
    <div className="reading-context-links"><Link to={'/publicaciones/' + post.id + '#respuestas'}>Todos los comentarios</Link>{comment.data?.parentId && <Link to={'/publicaciones/' + post.id + '?comentario=' + comment.data.parentId}>Ver comentario anterior</Link>}</div>
    {comment.loading && !comment.data && <ForumLoading label="Cargando comentario…" />}{comment.error && <ForumError message={comment.error} retry={comment.retry} />}
    {comment.data && <Comment item={comment.data} post={post} participation={participation} onChange={comment.setData} onCount={onCount} permalink />}
  </div>
}

export function Discussion({ post, participation, target, onCount }: { post: ForumPost; participation: Participation; target: string | null; onCount: (count: number) => void }) {
  return <section id="respuestas" className="reading-discussion" aria-labelledby="replies-heading">
    <header className="reading-discussion-heading"><h2 id="replies-heading">Comentarios <span>{post.replyCount}</span></h2>{!target && <span>Anclado primero · Recientes</span>}</header>
    <div className="reading-reply-entry">
      {participation.pending ? <p className="reading-empty" role="status">Comprobando acceso…</p> : participation.href && <p className="reading-sign-in"><Link to={participation.href}>{participation.userId ? 'Únete a la comunidad para participar' : 'Entra o crea una cuenta para comentar'}</Link></p>}
    </div>
    {target ? <LinkedComment key={target} id={target} post={post} participation={participation} onCount={onCount} /> : <ReplyList post={post} participation={participation} onCount={onCount} rootComposer />}
  </section>
}
