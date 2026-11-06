import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import type { MediaMetadata, MediaOptions, MediaUploadIntent } from '@messages/contracts'
import { accountError, accountRequest } from '@/features/account/api/account-api'
import { confirmImage, putImage } from '@/features/media/api/media-api'
import { useResource } from '../hooks/use-forum'
import { documentImages, editorDocument } from './document'

interface Upload { key: string; file: File; requestId: string; mediaId?: string; status: string; progress: number; error?: string }
export function useCanvasImages(editor: Editor | null) {
  const options = useResource<MediaOptions>('media/options')
  const [uploads, setUploads] = useState<Upload[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const jobs = useRef<Upload[]>([])
  const guard = useRef(false)
  const alive = useRef(true)
  const anchor = useRef<number | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => {
    alive.current = true
    const track = ({ transaction }: { transaction: { mapping: { map: (position: number, bias?: number) => number } } }) => {
      if (anchor.current !== null) anchor.current = transaction.mapping.map(anchor.current, 1)
    }
    editor?.on('transaction', track)
    return () => { alive.current = false; controller.current?.abort(); editor?.off('transaction', track) }
  }, [editor])
  function update(key: string, fields: Partial<Upload>) {
    jobs.current = jobs.current.map(job => job.key === key ? { ...job, ...fields } : job)
    if (alive.current) setUploads([...jobs.current])
  }
  function discard(key: string) { jobs.current = jobs.current.filter(job => job.key !== key); setUploads([...jobs.current]); setError(null) }
  async function run(selected: Upload[]) {
    if (!editor || editor.isDestroyed || guard.current) return
    guard.current = true; setBusy(true); setError(null)
    if (anchor.current === null) anchor.current = editor.state.selection.from
    const abort = new AbortController(); controller.current = abort
    try {
      for (const selectedJob of selected) {
        if (abort.signal.aborted) break
        let job = jobs.current.find(item => item.key === selectedJob.key)!
        update(job.key, { error: undefined, status: 'Preparando imagen…' })
        try {
          let ready: MediaMetadata | null = null
          if (job.mediaId) {
            const metadata = await accountRequest<MediaMetadata>('media/' + job.mediaId, 'GET', undefined, abort.signal)
            if (metadata.state === 'READY') ready = metadata
            else if (metadata.state === 'VERIFYING') ready = await confirmImage(metadata.id, abort.signal)
            else if (metadata.state !== 'PENDING' || Date.parse(metadata.uploadExpiresAt) <= Date.now()) {
              job = { ...job, mediaId: undefined, requestId: crypto.randomUUID() }
              update(job.key, { mediaId: undefined, requestId: job.requestId })
            }
          }
          if (!ready) {
            const intent = await accountRequest<MediaUploadIntent>('media/uploads', 'POST', { originalName: job.file.name, mime: job.file.type, bytes: job.file.size, requestId: job.requestId }, abort.signal)
            update(job.key, { mediaId: intent.media.id, status: 'Subiendo imagen…' })
            await putImage(intent.upload, job.file, abort.signal, progress => update(job.key, { progress }))
            update(job.key, { status: 'Verificando imagen…', progress: 100 })
            ready = await confirmImage(intent.media.id, abort.signal)
          }
          if (!ready.image) throw new Error('La imagen no quedó disponible. Vuelve a intentarlo.')
          if (abort.signal.aborted || !alive.current || editor.isDestroyed) return
          const ids = documentImages(editorDocument(editor.getJSON()))
          if (!ids.includes(ready.id)) {
            if (ids.length >= (options.data?.maxPerPost ?? 3)) throw new Error('El lienzo ya tiene todas las imágenes permitidas. Quita una antes de reintentar.')
            const position = Math.min(anchor.current ?? editor.state.selection.from, editor.state.doc.content.size)
            const inserted = editor.commands.insertContentAt(position, [{ type: 'mediaImage', attrs: { mediaId: ready.id, alt: '', caption: '' } }, { type: 'paragraph' }], { updateSelection: false })
            if (!inserted) throw new Error('No pudimos insertar la imagen. Coloca el cursor en el texto y pulsa Reintentar.')
          }
          discard(job.key)
        } catch (cause) { if (!abort.signal.aborted && alive.current) update(job.key, { status: 'No se completó', error: accountError(cause) }) }
      }
    } finally { guard.current = false; if (alive.current) { setBusy(false); if (!jobs.current.length) anchor.current = null } }
  }
  function select(files: File[]) {
    if (!editor || guard.current || !files.length) return
    if (!options.data) { setError('No pudimos preparar las imágenes. Vuelve a cargar sus opciones.'); return }
    setError(null)
    if (documentImages(editorDocument(editor.getJSON())).length + jobs.current.length + files.length > options.data.maxPerPost) { setError('Puedes incluir hasta ' + options.data.maxPerPost + ' imágenes en esta publicación.'); return }
    if (files.some(file => !options.data!.allowedTypes.includes(file.type as MediaOptions['allowedTypes'][number]) || file.size < 1 || file.size > options.data!.maxBytes)) {
      setError('Elige imágenes JPEG, PNG o WebP de hasta ' + Math.round(options.data.maxBytes / 1024 / 1024) + ' MB.'); return
    }
    anchor.current = editor.state.selection.from
    const added = files.map(file => ({ key: crypto.randomUUID(), file, requestId: crypto.randomUUID(), status: 'En espera', progress: 0 }))
    jobs.current = [...jobs.current, ...added]; setUploads([...jobs.current]); void run(added)
  }
  function cancel() { controller.current?.abort(); jobs.current = []; setUploads([]); anchor.current = null; setError(null) }
  return { options, uploads, busy, error, select, retry: (key: string) => { const job = jobs.current.find(item => item.key === key); if (job) void run([job]) }, discard, cancel }
}
