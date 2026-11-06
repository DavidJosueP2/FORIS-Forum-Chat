import type { MediaMetadata, MediaUploadIntent } from '@messages/contracts'
import { AccountApiError, accountRequest } from '@/features/account/api/account-api'

export function putImage(target: MediaUploadIntent['upload'], file: File, signal: AbortSignal, progress: (value: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Subida cancelada', 'AbortError')); return }
    const url = new URL(target.url, window.location.origin)
    if (url.origin !== window.location.origin && url.protocol !== 'https:') { reject(new Error('El destino de subida no es válido.')); return }
    const request = new XMLHttpRequest()
    const abort = () => request.abort()
    const finish = (error?: Error) => { signal.removeEventListener('abort', abort); if (error) reject(error); else resolve() }
    request.open('PUT', url.toString())
    request.withCredentials = url.origin === window.location.origin
    request.timeout = 120000
    for (const [name, value] of Object.entries(target.headers)) request.setRequestHeader(name, value)
    request.upload.onprogress = event => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)) }
    request.onload = () => finish(request.status >= 200 && request.status < 300 ? undefined : new Error('No pudimos subir la imagen. Revisa la conexión y vuelve a intentarlo.'))
    request.onerror = () => finish(new Error('No pudimos conectar con el almacenamiento de imágenes.'))
    request.ontimeout = () => finish(new Error('La subida tardó demasiado. Puedes volver a intentarlo.'))
    request.onabort = () => finish(new DOMException('Subida cancelada', 'AbortError'))
    signal.addEventListener('abort', abort, { once: true })
    request.send(file)
  })
}
function pause(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Operación cancelada', 'AbortError')); return }
    const abort = () => { clearTimeout(timer); reject(new DOMException('Operación cancelada', 'AbortError')) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, 1500)
    signal.addEventListener('abort', abort, { once: true })
  })
}
export async function confirmImage(id: string, signal: AbortSignal): Promise<MediaMetadata> {
  for (let attempt = 0; attempt < 20; attempt++) {
    try { return await accountRequest<MediaMetadata>('media/' + id + '/complete', 'POST', {}, signal) }
    catch (cause) {
      if (!(cause instanceof AccountApiError) || cause.code !== 'MEDIA_PROCESSING') throw cause
      await pause(signal)
      const status = await accountRequest<MediaMetadata>('media/' + id, 'GET', undefined, signal)
      if (status.state === 'READY') return status
      if (status.state !== 'VERIFYING' && status.state !== 'PENDING') throw new Error('La imagen no está disponible. Vuelve a seleccionarla.')
    }
  }
  throw new Error('La verificación sigue en proceso. Pulsa Reintentar en unos segundos.')
}
