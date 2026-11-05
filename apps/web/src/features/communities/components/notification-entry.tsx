import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/account/hooks/use-auth'
import { accountRequest } from '@/features/account/api/account-api'
import { NOTIFICATIONS_CHANGED } from '../lib/notifications'

function InboxEntry() {
  const [count, setCount] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void accountRequest<{ unreadCount: number }>('notifications/count', 'GET', undefined, controller.signal)
      .then(result => { if (!controller.signal.aborted) setCount(result.unreadCount) })
      .catch(() => { if (!controller.signal.aborted) setCount(null) })
    return () => controller.abort()
  }, [attempt])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setAttempt(current => current + 1) }
    window.addEventListener('focus', refresh)
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return <Button asChild variant="ghost" className="h-11 px-3" aria-label={count ? 'Notificaciones: ' + count + ' sin leer' : 'Notificaciones'}>
    <Link to="/notificaciones"><Bell aria-hidden="true" />{count !== null && count > 0 && <span className="community-unread-count">{count > 99 ? '99+' : count}</span>}</Link>
  </Button>
}
export function NotificationEntry() {
  const auth = useAuth()
  return auth.status === 'ready' && auth.session.user ? <InboxEntry key={auth.session.user.id} /> : null
}
