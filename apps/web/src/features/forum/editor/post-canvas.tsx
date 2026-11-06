import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EditorContent, useEditor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import type { ForumCategory, ForumPost } from '@messages/contracts'
import { ArrowLeft, Check, Eye, LoaderCircle, PencilLine, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { AccountApiError, accountError, accountRequest } from '@/features/account/api/account-api'
import { useResource } from '../hooks/use-forum'
import { canvasExtensions } from './extensions'
import { documentImages, documentText, editorDocument } from './document'
import { DocumentView } from './document-view'
import { EditorToolbar } from './editor-toolbar'
import { PublicationSettings } from './publication-settings'
import { useCanvasDraft } from './use-canvas-draft'
import type { CanvasDraft } from './use-canvas-draft'
import { useCanvasImages } from './use-canvas-images'
import './canvas.css'

export default function PostCanvas({ userId, initialTopic, initialCommunity, post }: { userId: string; initialTopic: string; initialCommunity: string | null; post?: ForumPost }) {
  const { draft, latest, storage, change: changeDraft, clear, alive, replacePublished } = useCanvasDraft(userId, initialCommunity, initialTopic, post)
  const categories = useResource<ForumCategory[]>('taxonomy/categories')
  const [extensions] = useState(canvasExtensions)
  const [preview, setPreview] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(() => Boolean(post && draft.revision !== post.revision))
  const [recovering, setRecovering] = useState(false)
  const guard = useRef(false)
  const title = useRef<HTMLTextAreaElement>(null)
  const errorMessage = useRef<HTMLParagraphElement>(null)
  const uploadHandler = useRef<((files: File[]) => void) | null>(null)
  const navigate = useNavigate()
  function change(values: Partial<CanvasDraft>) { if (!guard.current) changeDraft(values) }
  const editor = useEditor({
    extensions, content: { type: 'doc', content: draft.content.content }, injectCSS: false,
    immediatelyRender: false, shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: 'foris-document canvas-writing', role: 'textbox', 'aria-label': 'Contenido de tu publicación', 'aria-multiline': 'true', 'aria-describedby': 'canvas-content-errors' },
      handlePaste(_view, event) {
        const files = Array.from(event.clipboardData?.files ?? [])
        if (files.length) { uploadHandler.current?.(files); return true }
        return false
      },
      handleDrop(view, event, _slice, moved) {
        if (moved || !event.dataTransfer?.files.length) return false
        event.preventDefault()
        const point = view.posAtCoords({ left: event.clientX, top: event.clientY })
        if (point) view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(point.pos))))
        uploadHandler.current?.(Array.from(event.dataTransfer.files)); return true
      },
    },
    onUpdate({ editor: current }) { change({ content: editorDocument(current.getJSON()) }); setError(null) },
  })
  const images = useCanvasImages(editor)
  useEffect(() => { uploadHandler.current = images.select; return () => { uploadHandler.current = null } }, [images.select])
  useEffect(() => { editor?.setEditable(!publishing && !recovering && !preview, false) }, [editor, publishing, recovering, preview])
  const categoryId = draft.categoryId ?? (draft.legacyTopicId ? categories.data?.find(item => item.parentId === null && item.slug === draft.legacyTopicId)?.id ?? null : null)
  const body = documentText(draft.content)
  const titleExceeded = draft.title.trim().normalize('NFC').length > 160
  const textExceeded = body.length > 10000
  useEffect(() => { if (error && draft.title.trim()) errorMessage.current?.focus() }, [error, draft.title])
  async function publish() {
    if (!editor || guard.current) return
    setError(null)
    if (images.busy || images.uploads.length) { setError('Espera a que terminen las imágenes. Si una falló, reinténtala o quítala antes de publicar.'); return }
    const snapshot = { ...latest.current, content: editorDocument(editor.getJSON()) }
    const snapshotCategory = snapshot.categoryId ?? (snapshot.legacyTopicId ? categories.data?.find(item => item.parentId === null && item.slug === snapshot.legacyTopicId)?.id ?? null : null)
    const text = documentText(snapshot.content)
    if (!snapshot.title.trim()) { setError('Dale un título a tu publicación antes de compartirla.'); title.current?.focus(); return }
    if (snapshot.title.trim().normalize('NFC').length > 160 || text.length > 10000) { setError('Acorta el texto indicado en rojo antes de publicar.'); return }
    if (!text && !documentImages(snapshot.content).length) { setError('Escribe algo o añade una imagen antes de publicar.'); editor.commands.focus(); return }
    if (new TextEncoder().encode(JSON.stringify(snapshot.content)).length > 240000) { setError('El documento tiene demasiados bloques. Simplifica su estructura antes de publicar.'); return }
    if (snapshot.legacyTopicId && !snapshot.categoryId && !snapshotCategory) { setError('No pudimos resolver la temática del borrador. Elige otra o déjalo sin temática.'); return }
    guard.current = true; setPublishing(true)
    try {
      const fields = { title: snapshot.title, content: snapshot.content, categoryId: snapshotCategory, tags: snapshot.tags, requestId: snapshot.requestId }
      const result = post
        ? await accountRequest<{ post: ForumPost; updated: boolean }>('posts/' + post.id, 'PATCH', { ...fields, revision: snapshot.revision })
        : await accountRequest<{ post: ForumPost; created: boolean }>('posts', 'POST', { ...fields, communityId: snapshot.communityId ?? undefined })
      if (!alive.current) return
      clear(); navigate('/publicaciones/' + result.post.id, { replace: true })
    } catch (cause) { if (alive.current) { setError(accountError(cause)); if (cause instanceof AccountApiError && cause.code === 'POST_VERSION_CONFLICT') setConflict(true) } }
    finally { guard.current = false; if (alive.current) setPublishing(false) }
  }
  async function reloadPublished() {
    if (!post || !editor || guard.current) return
    guard.current = true; setRecovering(true); setError(null); images.cancel()
    try {
      const current = await accountRequest<ForumPost>('posts/' + post.id)
      if (!alive.current || editor.isDestroyed) return
      const fresh = replacePublished(current)
      editor.commands.setContent({ type: 'doc', content: fresh.content.content }, { emitUpdate: false })
      setConflict(false)
    } catch (cause) { if (alive.current) setError(accountError(cause)) }
    finally { guard.current = false; if (alive.current) setRecovering(false) }
  }
  const back = post ? '/publicaciones/' + post.id : initialCommunity ? '/comunidades/' + initialCommunity : '/'
  const saveLabel = post ? 'Guardar cambios' : 'Publicar'
  return <section className="post-canvas" aria-labelledby="canvas-heading" aria-busy={publishing || recovering} onKeyDown={event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !(event.target instanceof Element && event.target.closest('[role="dialog"], [role="alertdialog"]'))) { event.preventDefault(); void publish() }
  }}>
    <header className="canvas-header"><div className="canvas-heading"><Button asChild variant="ghost" size="icon" className="h-11 w-11"><Link to={back} aria-label={post ? 'Volver a la publicación' : initialCommunity ? 'Volver a la comunidad' : 'Volver a Foros'} title="Volver"><ArrowLeft aria-hidden="true" /></Link></Button><h1 id="canvas-heading">{post ? 'Editar publicación' : 'Crear publicación'}</h1></div>
      <div className="canvas-header-actions"><Button type="button" variant="ghost" className="h-11" disabled={publishing || recovering} aria-pressed={preview} onClick={() => setPreview(current => !current)}>{preview ? <PencilLine aria-hidden="true" /> : <Eye aria-hidden="true" />}<span>{preview ? 'Seguir creando' : 'Vista previa'}</span></Button><Button type="button" className="h-11 px-6" disabled={!editor || publishing || recovering || images.busy} onClick={() => void publish()}>{publishing && <LoaderCircle className="animate-spin" aria-hidden="true" />}{publishing ? post ? 'Guardando…' : 'Publicando…' : saveLabel}</Button></div>
    </header>
    <div className="canvas-draft-status" role="status">{storage === 'unavailable' ? 'No pudimos guardar el borrador en esta pestaña. Conserva una copia antes de salir.' : storage === 'saving' ? 'Guardando borrador…' : <><Check aria-hidden="true" />Borrador guardado en esta pestaña</>}</div>
    {conflict && post && <div className="canvas-version-conflict"><p role="alert">Hay otra versión de esta publicación. Tu borrador se conserva; puedes revisarlo antes de cargar la versión publicada.</p><div className="canvas-inline-actions"><Button asChild variant="ghost" className="h-11"><Link to={'/publicaciones/' + post.id} target="_blank" rel="noopener noreferrer">Ver versión publicada</Link></Button><AlertDialog><AlertDialogTrigger asChild><Button type="button" variant="secondary" className="h-11" disabled={publishing || recovering}>{recovering ? 'Cargando versión…' : 'Cargar versión publicada'}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Reemplazar este borrador?</AlertDialogTitle><AlertDialogDescription>Se cargarán los cambios publicados. Copia antes cualquier texto o cambio de este borrador que quieras conservar.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Conservar borrador</AlertDialogCancel><AlertDialogAction onClick={() => void reloadPublished()}>Cargar versión publicada</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></div>}
    <label htmlFor="canvas-title" className="sr-only">Título de tu publicación</label><textarea ref={title} id="canvas-title" className="canvas-title" rows={1} value={draft.title} placeholder="Un título para tu idea" readOnly={preview} disabled={publishing || recovering} aria-invalid={titleExceeded} aria-describedby={titleExceeded ? 'canvas-title-error' : undefined} onChange={event => change({ title: event.target.value })} onKeyDown={event => { if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) { event.preventDefault(); editor?.commands.focus('start') } }} />
    {titleExceeded && <p id="canvas-title-error" className="forum-error" role="alert">El título supera los 160 caracteres. Acórtalo antes de publicar.</p>}
    <fieldset disabled={publishing || recovering} className="canvas-workspace"><legend className="sr-only">Contenido y opciones de la publicación</legend>
    {editor && !preview && <fieldset disabled={publishing} className="canvas-toolbar-fieldset"><legend className="sr-only">Herramientas del lienzo</legend><EditorToolbar editor={editor} onImages={images.select} imagesDisabled={images.busy || !images.options.data} /></fieldset>}
    {(images.uploads.length > 0 || images.error || images.options.error) && <div className="canvas-uploads" aria-label="Estado de las imágenes">
      {images.uploads.map(item => <div key={item.key}><p><span>{item.file.name}</span><span role="status">{item.status}{item.status === 'Subiendo imagen…' ? ' ' + item.progress + '%' : ''}</span></p>{item.error && <p className="forum-error" role="alert">{item.error}</p>}<div className="canvas-inline-actions">{item.error && <Button type="button" variant="secondary" className="h-11" disabled={images.busy || publishing} onClick={() => images.retry(item.key)}>Reintentar</Button>}{!images.busy && <Button type="button" variant="ghost" className="h-11" disabled={publishing} onClick={() => images.discard(item.key)}><X aria-hidden="true" />Quitar</Button>}</div></div>)}
      {images.busy && <Button type="button" variant="ghost" className="h-11" onClick={images.cancel}>Cancelar subida</Button>}
      {images.error && <p className="forum-error" role="alert">{images.error}</p>}{images.options.error && <><p className="forum-error" role="alert">{images.options.error}</p><Button type="button" variant="ghost" onClick={images.options.retry}>Preparar imágenes de nuevo</Button></>}
    </div>}
    {preview ? <div className="canvas-preview"><p className="sr-only">Vista previa de la publicación</p><DocumentView document={draft.content} preview /></div> : <EditorContent editor={editor} className="canvas-editor-content" />}
    <div id="canvas-content-errors">{textExceeded && <p className="forum-error" role="alert">La publicación supera los 10000 caracteres. Puedes seguir escribiendo; acórtala antes de publicar.</p>}</div>
    <footer className="canvas-footer"><PublicationSettings categoryId={categoryId} categories={categories} communityId={draft.communityId} tags={draft.tags} disabled={publishing || recovering} communityLocked={Boolean(post)}
      onCategory={value => change({ categoryId: value, legacyTopicId: '' })} onCommunity={value => change({ communityId: value })} onTags={value => change({ tags: value })} />
      <div className="canvas-footer-notes"><p>{post ? 'La comunidad y el acceso de la publicación se conservan.' : draft.communityId ? 'Se compartirá con quienes puedan ver la comunidad elegida.' : 'Se compartirá públicamente en Foris.'}</p><p>Ctrl/⌘ + Enter para {post ? 'guardar cambios' : 'publicar'}</p></div>
      {error && <p ref={errorMessage} className="forum-error" role="alert" tabIndex={-1}>{error} Tu borrador sigue aquí.</p>}
    </footer>
    </fieldset>
  </section>
}
