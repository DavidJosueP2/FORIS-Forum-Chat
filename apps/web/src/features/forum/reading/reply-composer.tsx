import { useId, useRef, useState } from 'react'
import type { ChangedForumReply, CreatedForumReply, ForumReply } from '@messages/contracts'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { AccountApiError, accountError, accountRequest } from '@/features/account/api/account-api'
import { useDraft } from '../hooks/use-draft'

export function ReplyComposer({ postId, userId, parent, editing, onSaved, onCancel, onReload }: {
  postId: string; userId: string; parent?: ForumReply; editing?: ForumReply;
  onSaved: (result: ChangedForumReply | CreatedForumReply) => void; onCancel?: () => void; onReload?: (reply: ForumReply) => void;
}) {
  const key = editing ? 'foris.forum.reply-edit.' + userId + '.' + editing.id : 'foris.forum.reply.' + userId + '.' + postId + (parent ? '.' + parent.id : '')
  const { draft, stored, change, clear, alive } = useDraft(key)
  const [initial] = useState(() => ({ body: editing?.body ?? '', revision: draft.revision ?? editing?.revision ?? 1 }))
  const [dirty, setDirty] = useState(() => Boolean(draft.body) || draft.revision !== undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const guard = useRef(false)
  const field = useRef<HTMLTextAreaElement>(null)
  const id = useId()
  const body = dirty ? draft.body : initial.body
  const exceeded = body.trim().normalize('NFC').length > 5000
  async function reload() {
    if (!editing || !onReload || guard.current) return
    guard.current = true; setBusy(true); setError(null)
    try {
      const current = await accountRequest<ForumReply>('posts/' + postId + '/replies/' + editing.id)
      if (alive.current) { clear(); onReload(current) }
    } catch (cause) { if (alive.current) setError(accountError(cause)) }
    finally { guard.current = false; if (alive.current) setBusy(false) }
  }
  async function submit() {
    if (guard.current) return
    if (!body.trim() || body.trim().normalize('NFC').length > 5000) { setError(!body.trim() ? 'Escribe un comentario.' : 'El comentario supera los 5000 caracteres.'); field.current?.focus(); return }
    guard.current = true; setBusy(true); setError(null)
    try {
      const path = 'posts/' + postId + '/replies'
      const result = editing
        ? await accountRequest<ChangedForumReply>(path + '/' + editing.id, 'PATCH', { body, revision: initial.revision })
        : await accountRequest<CreatedForumReply>(path, 'POST', { body, requestId: draft.requestId, parentId: parent?.id ?? null })
      if (!alive.current) return
      clear(); setDirty(false); onSaved(result)
    } catch (cause) {
      if (alive.current) { setError(accountError(cause)); setConflict(cause instanceof AccountApiError && cause.code === 'REPLY_VERSION_CONFLICT') }
    } finally { guard.current = false; if (alive.current) setBusy(false) }
  }
  return <form className="reading-composer" aria-busy={busy} onSubmit={event => { event.preventDefault(); void submit() }} onKeyDown={event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void submit() }
  }}>
    <label className="sr-only" htmlFor={id}>{editing ? 'Editar comentario' : parent ? 'Responder a ' + parent.author.displayName : 'Añadir comentario'}</label>
    <Textarea ref={field} id={id} rows={editing || parent ? 3 : 2} value={body} disabled={busy} autoFocus={Boolean(editing || parent)} placeholder={parent ? 'Responder a ' + parent.author.displayName + '…' : 'Añade un comentario…'} aria-invalid={body.trim().normalize('NFC').length > 5000} aria-describedby={error ? id + '-error' : undefined} onChange={event => { setDirty(true); change({ body: event.target.value, ...(editing ? { revision: initial.revision } : {}) }); setError(null) }} />
    {!stored && <p className="forum-error" role="status">No se pudo guardar el borrador. Conserva una copia antes de salir.</p>}
    {exceeded && !error && <p className="forum-error" role="alert">El comentario supera los 5000 caracteres. Acórtalo antes de comentar.</p>}
    {error && <p id={id + '-error'} className="forum-error" role="alert">{error} Tu texto sigue aquí.</p>}
    {conflict && <a className="reading-text-link" href={'/publicaciones/' + postId + '?comentario=' + editing?.id} target="_blank" rel="noopener noreferrer">Ver versión publicada</a>}
    {conflict && onReload && <AlertDialog><AlertDialogTrigger asChild><Button type="button" variant="ghost" className="reading-action" disabled={busy}>Cargar versión publicada</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Descartar este borrador?</AlertDialogTitle><AlertDialogDescription>Copia antes el texto que quieras conservar. Se cargará el comentario publicado.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Conservar borrador</AlertDialogCancel><AlertDialogAction onClick={() => void reload()}>Descartar y cargar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
    <div className="reading-composer-actions">{onCancel && <Button type="button" variant="ghost" className="reading-action" disabled={busy} onClick={onCancel}>Cancelar</Button>}<Button type="submit" className="reading-action social-action" disabled={busy}>{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? 'Guardando…' : editing ? 'Guardar' : 'Comentar'}</Button></div>
  </form>
}
