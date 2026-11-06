import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { ImageMime, ImagePurpose, MediaMetadata, MediaOptions, MediaUploadIntent } from '@messages/contracts'
import { Camera, LoaderCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { accountError, accountRequest } from '@/features/account/api/account-api'
import { useResource } from '@/features/forum/hooks/use-forum'
import { confirmImage, putImage } from '../api/media-api'
import { IdentityImage } from './identity-image'
import '../media.css'

interface Selection { file: File; preview: string; requestId: string; mediaId?: string }
export function PortraitPicker({ mediaId, name, purpose, disabled = false, onChange, onBusyChange }: {
  mediaId: string | null; name: string; purpose: Exclude<ImagePurpose, 'post'>; disabled?: boolean;
  onChange: (id: string | null) => void | Promise<void>; onBusyChange?: (busy: boolean) => void;
}) {
  const options = useResource<MediaOptions>('media/options')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const guard = useRef(false)
  const alive = useRef(true)
  const abort = useRef<AbortController | null>(null)
  const preview = useRef<string | null>(null)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; abort.current?.abort(); if (preview.current) URL.revokeObjectURL(preview.current) }
  }, [])
  function clearSelection() {
    if (preview.current) URL.revokeObjectURL(preview.current)
    preview.current = null; setSelection(null)
  }
  async function upload(initial: Selection) {
    if (guard.current) return
    guard.current = true; setBusy(true); onBusyChange?.(true); setError(null); setProgress(0); setStatus('Preparando imagen…')
    const controller = new AbortController(); abort.current = controller
    let item = initial
    try {
      let ready = false
      if (item.mediaId) {
        const metadata = await accountRequest<MediaMetadata>('media/' + item.mediaId, 'GET', undefined, controller.signal)
        if (metadata.state === 'READY') ready = true
        else if (metadata.state === 'VERIFYING') { await confirmImage(metadata.id, controller.signal); ready = true }
        else if (metadata.state !== 'PENDING' || Date.parse(metadata.uploadExpiresAt) <= Date.now()) item = { ...item, mediaId: undefined, requestId: crypto.randomUUID() }
      }
      if (!ready) {
        const intent = await accountRequest<MediaUploadIntent>('media/uploads', 'POST', { originalName: item.file.name, mime: item.file.type, bytes: item.file.size, requestId: item.requestId, purpose }, controller.signal)
        item = { ...item, mediaId: intent.media.id }
        if (alive.current) { setSelection(item); setStatus('Subiendo imagen…') }
        await putImage(intent.upload, item.file, controller.signal, value => { if (alive.current) setProgress(value) })
        if (alive.current) setStatus('Verificando imagen…')
        await confirmImage(intent.media.id, controller.signal)
      }
      if (!alive.current || controller.signal.aborted) return
      await onChange(item.mediaId!)
      if (alive.current) { clearSelection(); setStatus('Imagen lista.'); setProgress(100) }
    } catch (cause) {
      if (alive.current && !controller.signal.aborted) { setSelection(item); setError(accountError(cause)); setStatus(null) }
    } finally { guard.current = false; if (alive.current) { setBusy(false); onBusyChange?.(false) } }
  }
  function select(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file || !options.data || guard.current) return
    if (!options.data.allowedTypes.includes(file.type as ImageMime) || file.size < 1 || file.size > options.data.maxBytes) {
      setError('Elige una imagen JPEG, PNG o WebP de hasta ' + Math.round(options.data.maxBytes / 1024 / 1024) + ' MB.'); return
    }
    if (preview.current) URL.revokeObjectURL(preview.current)
    preview.current = URL.createObjectURL(file)
    const item = { file, preview: preview.current, requestId: crypto.randomUUID() }
    setSelection(item); void upload(item)
  }
  async function remove() {
    if (guard.current) return
    if (selection) { clearSelection(); setError(null); setStatus(null); return }
    guard.current = true; setBusy(true); onBusyChange?.(true); setError(null)
    try { await onChange(null); if (alive.current) setStatus('Imagen retirada.') }
    catch (cause) { if (alive.current) setError(accountError(cause)) }
    finally { guard.current = false; if (alive.current) { setBusy(false); onBusyChange?.(false) } }
  }
  return <div className="portrait-editor" data-purpose={purpose} aria-busy={busy}>
    <label className="portrait-select">
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || busy || !options.data} onChange={select} aria-label={purpose === 'avatar' ? 'Elegir foto de perfil' : 'Elegir imagen de comunidad'} />
      {selection ? <span className="identity-image portrait-preview"><img src={selection.preview} alt="" /></span> : <IdentityImage mediaId={mediaId} name={name} className="portrait-preview" />}
      <span className="portrait-action"><Camera aria-hidden="true" />{mediaId ? 'Cambiar imagen' : 'Elegir imagen'}</span>
    </label>
    {busy && <progress max={100} value={progress} aria-label="Progreso de subida" />}
    {status && <p className="forum-hint" role="status">{busy && <LoaderCircle className="inline size-4 animate-spin" aria-hidden="true" />} {status}{status === 'Subiendo imagen…' ? ' ' + progress + '%' : ''}</p>}
    {(error || options.error) && <p className="forum-error" role="alert">{error ?? options.error}</p>}
    <div className="portrait-actions">
      {selection && error && <Button type="button" variant="secondary" className="h-11" disabled={disabled || busy} onClick={() => void upload(selection)}>Reintentar</Button>}
      {options.error && <Button type="button" variant="secondary" className="h-11" onClick={options.retry}>Volver a conectar</Button>}
      {(mediaId || selection) && <Button type="button" variant="ghost" className="h-11" disabled={disabled || busy} onClick={() => void remove()}><Trash2 aria-hidden="true" />{selection ? 'Descartar selección' : 'Quitar imagen'}</Button>}
    </div>
  </div>
}
