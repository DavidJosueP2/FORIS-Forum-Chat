import type { MediaMetadata, MediaUploadIntent } from '@messages/contracts'
import { AccountApiError, accountRequest } from '@/features/account/api/account-api'

function uploadHttpError(request: XMLHttpRequest, remote: boolean): AccountApiError {
  if (!remote) {
    try {
      const data: unknown = JSON.parse(request.responseText)
      const error = data && typeof data === 'object' && 'error' in data ? data.error : undefined
      if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        && 'message' in error && typeof error.message === 'string') {
        return new AccountApiError(request.status, error.code, error.message)
      }
    } catch { /* Una respuesta no JSON conserva el estado HTTP para el diagnóstico. */ }
  }
  let code: string | undefined
  if (remote && request.responseText.length <= 8192) {
    const xml = new DOMParser().parseFromString(request.responseText, 'application/xml')
    const value = xml.getElementsByTagName('Code')[0]?.textContent
    if (value && /^[A-Za-z][A-Za-z0-9]{0,79}$/u.test(value)) code = value
  }
  if (code === 'ExpiredRequest' || code === 'RequestExpired') {
    return new AccountApiError(request.status, 'MEDIA_UPLOAD_EXPIRED', 'El permiso de subida caducó. Vuelve a seleccionar la imagen.')
  }
  if (code === 'SignatureDoesNotMatch') {
    return new AccountApiError(request.status, 'MEDIA_UPLOAD_SIGNATURE', 'El almacenamiento no aceptó el permiso de subida. Vuelve a seleccionar la imagen.')
  }
  if (request.status === 401 || request.status === 403) {
    return new AccountApiError(request.status, 'MEDIA_UPLOAD_DENIED', 'El almacenamiento rechazó la subida. Si vuelve a ocurrir, avisa al administrador.')
  }
  if (request.status === 413) return new AccountApiError(413, 'MEDIA_UPLOAD_TOO_LARGE', 'La imagen supera el tamaño admitido por el almacenamiento.')
  return new AccountApiError(request.status, 'MEDIA_UPLOAD_FAILED', 'El almacenamiento no pudo guardar la imagen. Inténtalo de nuevo.')
}

export function putImage(target: MediaUploadIntent['upload'], file: File, signal: AbortSignal, progress: (value: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Subida cancelada', 'AbortError')); return }
    if (!Number.isFinite(Date.parse(target.expiresAt)) || Date.parse(target.expiresAt) <= Date.now()) {
      reject(new AccountApiError(409, 'MEDIA_UPLOAD_EXPIRED', 'El permiso de subida caducó. Vuelve a seleccionar la imagen.')); return
    }
    const url = new URL(target.url, window.location.origin)
    if (url.origin !== window.location.origin && url.protocol !== 'https:') { reject(new Error('El destino de subida no es válido.')); return }
    const remote = url.origin !== window.location.origin
    const request = new XMLHttpRequest()
    let settled = false
    const abort = () => request.abort()
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', abort)
      if (error) reject(error); else resolve()
    }
    const fail = (event: 'http' | 'network' | 'timeout', error: AccountApiError) => {
      if (settled) return
      // Solo orígenes: nunca registrar la URL firmada, el ticket ni el objeto XMLHttpRequest.
      console.error('media_upload_failed', {
        event, code: error.code, status: error.status, method: target.method,
        pageOrigin: window.location.origin, storageOrigin: url.origin,
        headers: Object.keys(target.headers), requestId: remote ? undefined : request.getResponseHeader('X-Request-Id'),
        hint: event === 'network'
          ? 'Revisa la petición en Red: conectividad, bloqueo del navegador, CORS o un permiso rechazado/caducado. R2 puede omitir CORS en respuestas de error.'
          : 'Comprueba el estado HTTP y el código del error. El backend registra la causa al verificar la imagen.',
      })
      finish(error)
    }
    request.open(target.method, url.toString())
    request.withCredentials = !remote
    request.timeout = 120000
    for (const [name, value] of Object.entries(target.headers)) request.setRequestHeader(name, value)
    request.upload.onprogress = event => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)) }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) finish()
      else fail('http', uploadHttpError(request, remote))
    }
    request.onerror = () => fail('network', new AccountApiError(0, 'MEDIA_UPLOAD_NETWORK', 'El navegador no pudo enviar la imagen al almacenamiento. Revisa la conexión y vuelve a intentarlo.'))
    request.ontimeout = () => fail('timeout', new AccountApiError(0, 'MEDIA_UPLOAD_TIMEOUT', 'El almacenamiento tardó demasiado en recibir la imagen. Puedes volver a intentarlo.'))
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
