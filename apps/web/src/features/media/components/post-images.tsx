import { useEffect, useRef, useState } from 'react'
import type { MediaImage } from '@messages/contracts'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { accountError, accountRequest } from '@/features/account/api/account-api'
import { PrivateImage } from './private-image'

export function PostImages({ images, canDelete = false }: { images: MediaImage[]; canDelete?: boolean }) {
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const guard = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  async function remove(id: string) {
    if (guard.current) return
    guard.current = true
    setBusy(true); setError(null); setNotice(null)
    try {
      const result = await accountRequest<{ state: string }>('media/' + id, 'DELETE', {})
      if (!alive.current) return
      setRemoved(current => new Set([...current, id]))
      setNotice(result.state === 'DELETING' ? 'Imagen retirada. El borrado del archivo se completará en segundo plano.' : 'Imagen eliminada.')
    } catch (cause) { if (alive.current) setError(accountError(cause)) }
    finally { guard.current = false; if (alive.current) setBusy(false) }
  }
  return <div className="media-gallery">
    {images.filter(image => !removed.has(image.id)).map(image => <figure key={image.id}><PrivateImage image={image} />{canDelete && <figcaption><Button type="button" variant="ghost" className="h-11 px-4" disabled={busy} onClick={() => void remove(image.id)}><Trash2 aria-hidden="true" />Eliminar imagen</Button></figcaption>}</figure>)}
    {error && <p className="forum-error" role="alert">{error}</p>}
    {notice && <p className="forum-hint" role="status">{notice}</p>}
  </div>
}
