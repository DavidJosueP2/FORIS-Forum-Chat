import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check, LoaderCircle, Plus } from 'lucide-react'
import type { FollowState } from '@messages/contracts'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/account/hooks/use-auth'
import { loginLink } from '@/features/account/lib/return-target'
import { accountError, accountRequest } from '@/features/account/api/account-api'
import { FOLLOWING_CHANGED, followingChange } from './following-events'

export function FollowButton({ id, name, initial = false, compact = false }: { id: string; name: string; initial?: boolean; compact?: boolean }) {
  const auth = useAuth()
  const viewer = auth.session.user?.id ?? null
  const identity = viewer + ':author:' + id
  const [override, setOverride] = useState<{ identity: string; base: boolean; value: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const guard = useRef(false)
  const alive = useRef(true)
  const location = useLocation()
  const navigate = useNavigate()
  if (override?.identity === identity && override.base !== initial) setOverride(null)
  const followed = override?.identity === identity && override.base === initial ? override.value : initial
  useEffect(() => {
    alive.current = true
    const changed = (event: Event) => {
      const detail = followingChange(event, viewer)
      if (detail?.id === id) setOverride({ identity, base: initial, value: detail.isFollowing })
    }
    window.addEventListener(FOLLOWING_CHANGED, changed)
    return () => { alive.current = false; window.removeEventListener(FOLLOWING_CHANGED, changed) }
  }, [identity, viewer, id, initial])
  async function toggle() {
    if (guard.current) return
    if (!viewer) { navigate(loginLink(location.pathname + location.search)); return }
    guard.current = true; setBusy(true); setError(null)
    try {
      const result = await accountRequest<FollowState>('authors/' + id + '/follow', 'PUT', { following: !followed })
      window.dispatchEvent(new CustomEvent(FOLLOWING_CHANGED, { detail: { viewer, kind: 'author', id, isFollowing: result.isFollowing } }))
    } catch (cause) { if (alive.current) setError(accountError(cause)) }
    finally { guard.current = false; if (alive.current) setBusy(false) }
  }
  if (id === viewer) return null
  return <span className="follow-control"><Button type="button" variant={followed ? 'secondary' : 'ghost'} className={compact ? 'follow-button follow-compact h-11' : 'follow-button h-11'} disabled={busy || auth.status === 'loading'} aria-pressed={followed} aria-label={(followed ? 'Dejar de seguir a ' : 'Seguir a ') + name} title={followed ? 'Dejar de seguir' : 'Ver sus publicaciones en Siguiendo'} onClick={() => void toggle()}>{busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : followed ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}<span>{followed ? 'Siguiendo' : 'Seguir'}</span></Button>{error && <span className="forum-error follow-error" role="alert">{error}</span>}</span>
}
