import type { AccountUser } from '@messages/contracts'
import { PortraitPicker } from '@/features/media/components/portrait-picker'
import { accountRequest } from '../api/account-api'
import { useAuth } from '../hooks/use-auth'

export function ProfilePhoto({ user }: { user: AccountUser }) {
  const auth = useAuth()
  return <section className="profile-section" aria-labelledby="profile-photo-heading">
    <div className="profile-section-description"><h2 id="profile-photo-heading">Tu foto</h2><p>Una imagen para reconocerte en las conversaciones. Puedes cambiarla o quitarla cuando quieras.</p></div>
    <div className="profile-section-content"><PortraitPicker mediaId={user.avatarId ?? null} name={user.displayName} purpose="avatar" onChange={async mediaId => {
      const result = await accountRequest<{ avatarId: string | null }>('account/avatar', 'PATCH', { mediaId })
      auth.updateAvatar(user.id, result.avatarId)
    }} /></div>
  </section>
}
