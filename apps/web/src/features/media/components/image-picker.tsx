import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { MediaImage, MediaMetadata, MediaOptions, MediaUploadIntent } from '@messages/contracts'
import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AccountApiError, accountError, accountRequest } from '@/features/account/api/account-api'
import { useResource } from '@/features/forum/hooks/use-forum'
import { confirmImage, putImage } from '../api/media-api'
import { PrivateImage } from './private-image'
import '../media.css'

interface SelectedImage { key: string; file: File; preview: string; requestId: string; mediaId?: string; status: string; progress: number; error?: string }
export function ImagePicker({ ids, disabled, onChange, onBusyChange, onPendingChange }: {
  ids: string[]; disabled: boolean; onChange: (ids: string[]) => void; onBusyChange: (busy: boolean) => void; onPendingChange: (pending: boolean) => void
}) {
  const options = useResource<MediaOptions>('media/options')
  const [files, setFiles] = useState<SelectedImage[]>([])
  const [saved, setSaved] = useState<MediaImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const guard = useRef(false)
  const alive = useRef(true)
  const controller = useRef<AbortController | null>(null)
  const previews = useRef<Set<string>>(new Set())
  const pending = useRef<Set<string>>(new Set())
  const unavailable = useRef<Set<string>>(new Set())
  const currentIds = useRef(ids)
  const signature = ids.join(',')
  useEffect(() => { currentIds.current = signature ? signature.split(',') : [] }, [signature])
  useEffect(() => {
    alive.current = true
    const ownedPreviews = previews.current
    return () => { alive.current = false; controller.current?.abort(); for (const url of ownedPreviews) URL.revokeObjectURL(url) }
  }, [])
  useEffect(() => {
    if (!signature) return
    const abort = new AbortController()
    void Promise.all(signature.split(',').map(id => accountRequest<MediaMetadata>('media/' + id, 'GET', undefined, abort.signal)))
      .then(items => {
        if (abort.signal.aborted) return
        setSaved(items.flatMap(item => item.image ? [item.image] : []))
        unavailable.current = new Set(items.filter(item => item.state !== 'READY').map(item => item.id))
        onPendingChange(pending.current.size > 0 || unavailable.current.size > 0)
        if (unavailable.current.size) setError('Una imagen del borrador ya no está disponible. Quítala antes de publicar.')
      }).catch(cause => { if (!abort.signal.aborted) { unavailable.current = new Set(signature.split(',')); onPendingChange(true); setError(accountError(cause)) } })
    return () => abort.abort()
  }, [signature, onPendingChange])
  function update(key: string, value: Partial<SelectedImage>) { if (alive.current) setFiles(current => current.map(item => item.key === key ? { ...item, ...value } : item)) }
  function remember(id: string, key: string) {
    const next = [...new Set([...currentIds.current, id])]
    currentIds.current = next
    onChange(next)
    pending.current.delete(key)
    unavailable.current.delete(id)
    onPendingChange(pending.current.size > 0 || unavailable.current.size > 0)
  }
  async function upload(item: SelectedImage, signal: AbortSignal) {
    update(item.key, { status: 'Autorizando…', error: undefined })
    try {
      if (item.mediaId) {
        const existing = await accountRequest<MediaMetadata>('media/' + item.mediaId, 'GET', undefined, signal)
        if (existing.state === 'READY' && existing.image) {
          if (alive.current) { remember(existing.id, item.key); setSaved(current => [...current.filter(image => image.id !== existing.id), existing.image!]); update(item.key, { status: 'Lista', progress: 100 }) }
          return
        }
        if (existing.state === 'VERIFYING') {
          const ready = await confirmImage(existing.id, signal)
          if (alive.current && ready.image) { remember(ready.id, item.key); setSaved(current => [...current.filter(image => image.id !== ready.id), ready.image!]); update(item.key, { status: 'Lista', progress: 100 }) }
          return
        }
        if (existing.state !== 'PENDING' || Date.parse(existing.uploadExpiresAt) <= Date.now()) {
          item = { ...item, requestId: crypto.randomUUID(), mediaId: undefined }
          update(item.key, { requestId: item.requestId, mediaId: undefined })
        }
      }
      const intent = await accountRequest<MediaUploadIntent>('media/uploads', 'POST', { originalName: item.file.name, mime: item.file.type, bytes: item.file.size, requestId: item.requestId }, signal)
      update(item.key, { mediaId: intent.media.id, requestId: item.requestId, status: 'Subiendo…' })
      await putImage(intent.upload, item.file, signal, value => update(item.key, { progress: value }))
      update(item.key, { status: 'Verificando…', progress: 100 })
      const ready = await confirmImage(intent.media.id, signal)
      if (alive.current && ready.image) {
        remember(ready.id, item.key)
        setSaved(current => [...current.filter(image => image.id !== ready.id), ready.image!])
        update(item.key, { status: 'Lista', error: undefined })
      }
    } catch (cause) { if (!signal.aborted) update(item.key, { status: 'No se completó', error: accountError(cause) }) }
  }
  async function run(items: SelectedImage[]) {
    if (guard.current || !items.length) return
    guard.current = true
    const abort = new AbortController()
    controller.current = abort
    setBusy(true); onBusyChange(true)
    try { for (const item of items) { if (abort.signal.aborted) break; await upload(item, abort.signal) } }
    finally { guard.current = false; if (alive.current) { setBusy(false); onBusyChange(false) } }
  }
  function select(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!options.data || guard.current) return
    setError(null)
    const queued = files.filter(item => !item.mediaId || !currentIds.current.includes(item.mediaId)).length
    if (selected.length + currentIds.current.length + queued > options.data.maxPerPost) { setError('Puedes adjuntar hasta ' + options.data.maxPerPost + ' imágenes.'); return }
    if (selected.some(file => !options.data!.allowedTypes.includes(file.type as MediaImage['mime']) || file.size < 1 || file.size > options.data!.maxBytes)) { setError('Elige imágenes JPEG, PNG o WebP de hasta ' + Math.round(options.data.maxBytes / 1024 / 1024) + ' MB.'); return }
    const items = selected.map(file => {
      const preview = URL.createObjectURL(file)
      previews.current.add(preview)
      return { key: crypto.randomUUID(), file, preview, requestId: crypto.randomUUID(), status: 'En espera', progress: 0 }
    })
    setFiles(current => [...current, ...items])
    for (const item of items) pending.current.add(item.key)
    onPendingChange(true)
    void run(items)
  }
  async function remove(id: string, key?: string) {
    if (guard.current) return
    guard.current = true; setBusy(true); onBusyChange(true); setError(null)
    try {
      if (id) {
        try { await accountRequest('media/' + id, 'DELETE', {}) }
        catch (cause) { if (!(cause instanceof AccountApiError) || cause.status !== 404) throw cause }
      }
      if (!alive.current) return
      const next = currentIds.current.filter(value => value !== id)
      currentIds.current = next; onChange(next)
      unavailable.current.delete(id)
      if (key) pending.current.delete(key)
      onPendingChange(pending.current.size > 0 || unavailable.current.size > 0)
      setSaved(current => current.filter(image => image.id !== id))
      setFiles(current => current.filter(item => {
        if ((key && item.key === key) || (id && item.mediaId === id)) { URL.revokeObjectURL(item.preview); previews.current.delete(item.preview); return false }
        return true
      }))
    } catch (cause) { if (alive.current) setError(accountError(cause)) }
    finally { guard.current = false; if (alive.current) { setBusy(false); onBusyChange(false) } }
  }
  const transient = files.filter(item => !item.mediaId || !ids.includes(item.mediaId))
  return <section className="media-picker" aria-labelledby="post-images-heading" aria-busy={busy}>
    <div className="media-picker-heading"><h2 id="post-images-heading">Imágenes <span>opcional</span></h2>
      <label className="media-select"><input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={disabled || busy || !options.data} onChange={select} /><span><ImagePlus aria-hidden="true" />Añadir imágenes</span></label>
    </div>
    <p className="forum-hint">{options.data ? 'Hasta ' + options.data.maxPerPost + ' imágenes, ' + Math.round(options.data.maxBytes / 1024 / 1024) + ' MB cada una. JPEG, PNG o WebP.' : 'Preparando imágenes…'}</p>
    {options.error && <div className="forum-error" role="alert"><p>{options.error}</p><Button type="button" variant="secondary" className="h-11" onClick={options.retry}>Volver a intentar</Button></div>}
    {error && <p className="forum-error" role="alert">{error}</p>}
    <div className="media-selected">
      {ids.map(id => {
        const image = saved.find(value => value.id === id)
        return <figure key={id}>{image ? <PrivateImage image={image} thumbnail /> : <p className="forum-hint">Imagen del borrador</p>}<figcaption><Button type="button" variant="ghost" className="h-11 px-3" disabled={disabled || busy} onClick={() => void remove(id)}><Trash2 aria-hidden="true" />Quitar imagen</Button></figcaption></figure>
      })}
      {transient.map(item => <figure key={item.key}><img src={item.preview} alt={'Vista previa de ' + item.file.name} /><figcaption><span>{item.file.name}</span><p className="forum-hint" role="status">{busy && !item.error && <LoaderCircle className="animate-spin" aria-hidden="true" />}{item.status}{item.status === 'Subiendo…' ? ' ' + item.progress + '%' : ''}</p>
        {item.error && <><p className="forum-error" role="alert">{item.error}</p><Button type="button" variant="secondary" className="h-11" disabled={disabled || busy} onClick={() => void run([item])}>Reintentar</Button></>}
        <Button type="button" variant="ghost" className="h-11 px-3" disabled={disabled || busy} onClick={() => void remove(item.mediaId ?? '', item.key)}><Trash2 aria-hidden="true" />Quitar</Button>
      </figcaption></figure>)}
    </div>
  </section>
}
