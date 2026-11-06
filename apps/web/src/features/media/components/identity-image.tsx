import { useEffect, useState } from 'react'
import type { MediaReadUrl } from '@messages/contracts'
import { accountRequest } from '@/features/account/api/account-api'
import { ForisCharacter } from '@/components/brand/foris-character'
import { avatarMood } from '@/lib/foris-characters'
import '../media.css'

/** Imagen pasiva: puede vivir dentro de un botón sin introducir controles anidados. */
export function IdentityImage({ mediaId, userId, fallbackKey, name, className = '' }: { mediaId?: string | null; userId?: string; fallbackKey?: string; name: string; className?: string }) {
  const [source, setSource] = useState<{ identity: string; url: string } | null>(null)
  const identity = mediaId ?? userId ?? ''
  useEffect(() => {
    if (!identity) return
    const abort = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    async function load() {
      try {
        const id = mediaId ?? (userId ? (await accountRequest<{ avatarId: string | null }>('profiles/' + userId + '/avatar', 'GET', undefined, abort.signal)).avatarId : null)
        if (!id) { if (!abort.signal.aborted) setSource(null); return }
        const result = await accountRequest<MediaReadUrl>('media/' + id + '/read-url', 'GET', undefined, abort.signal)
        if (abort.signal.aborted) return
        setSource({ identity, url: result.url })
        timer = setTimeout(() => void load(), Math.max(10000, Date.parse(result.expiresAt) - Date.now() - 10000))
      } catch { if (!abort.signal.aborted) setSource(null) }
    }
    void load()
    return () => { abort.abort(); clearTimeout(timer) }
  }, [identity, mediaId, userId])
  const photo = source?.identity === identity ? source.url : null
  const mood = avatarMood(fallbackKey ?? (userId ? 'user:' + userId : 'name:' + name))
  return <span className={'identity-image ' + className} data-fallback={photo ? undefined : 'character'} aria-hidden="true">
    {photo ? <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setSource(null)} /> : <ForisCharacter mood={mood} width={160} height={160} className="identity-character" />}
  </span>
}
