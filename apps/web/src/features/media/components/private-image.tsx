import { useEffect, useRef, useState } from 'react'
import type { MediaImage, MediaReadUrl } from '@messages/contracts'
import { Button } from '@/components/ui/button'
import { accountError, accountRequest } from '@/features/account/api/account-api'
import '../media.css'

export function PrivateImage({ image, thumbnail = false, alt }: { image: MediaImage; thumbnail?: boolean; alt?: string }) {
  const [state, setState] = useState<{ url: string | null; error: string | null }>({ url: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const retried = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    void accountRequest<MediaReadUrl>('media/' + image.id + '/read-url', 'GET', undefined, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setState({ url: result.url, error: null })
      timer = setTimeout(() => setAttempt(current => current + 1), Math.max(10000, Date.parse(result.expiresAt) - Date.now() - 10000))
    }).catch(cause => { if (!controller.signal.aborted) setState({ url: null, error: accountError(cause) }) })
    return () => { controller.abort(); if (timer) clearTimeout(timer) }
  }, [image.id, attempt])
  return <div className={thumbnail ? 'media-image media-thumbnail' : 'media-image'}>
    {state.error ? <div className="media-image-error"><p role="alert">{state.error}</p><Button type="button" variant="secondary" className="h-11" onClick={() => { retried.current = false; setState({ url: null, error: null }); setAttempt(current => current + 1) }}>Volver a cargar imagen</Button></div>
      : state.url ? <img src={state.url} width={image.width} height={image.height} alt={alt ?? image.originalName} loading="lazy" decoding="async" referrerPolicy="no-referrer"
        onLoad={() => { retried.current = false }}
        onError={() => {
          if (!retried.current) { retried.current = true; setAttempt(current => current + 1) }
          else setState({ url: null, error: 'No pudimos mostrar esta imagen.' })
        }} />
        : <p className="forum-hint" role="status">Cargando imagen…</p>}
  </div>
}
