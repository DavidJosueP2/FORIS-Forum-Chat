import { useRef, useState } from 'react'
import type { Community, CommunityInvitation } from '@messages/contracts'
import { Copy, Link2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { accountError, accountRequest } from '@/features/account/api/account-api'
import { useResource } from '@/features/forum/hooks/use-forum'
import { PortraitPicker } from '@/features/media/components/portrait-picker'

function CommunityInvitations({ id }: { id: string }) {
  const invitations = useResource<CommunityInvitation[]>('communities/' + id + '/invitations')
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const linkRef = useRef<HTMLInputElement>(null)
  const guard = useRef(false)
  async function create() {
    if (guard.current) return
    guard.current = true; setBusy(true); setError(null); setNotice(null)
    try {
      const result = await accountRequest<{ invitation: CommunityInvitation; url: string }>('communities/' + id + '/invitations', 'POST', {})
      setUrl(result.url); invitations.retry()
    } catch (cause) { setError(accountError(cause)) }
    finally { guard.current = false; setBusy(false) }
  }
  async function revoke(invitationId: string) {
    if (guard.current) return
    guard.current = true; setBusy(true); setError(null)
    try {
      await accountRequest('communities/' + id + '/invitations/' + invitationId, 'DELETE', {})
      setUrl(null); setNotice('Invitación revocada. Ese enlace ya no permite entrar.'); invitations.retry()
    } catch (cause) { setError(accountError(cause)) }
    finally { guard.current = false; setBusy(false) }
  }
  return <section className="community-invitations" aria-labelledby="community-invitations-heading" aria-busy={busy}>
    <div><h3 id="community-invitations-heading">Invita a tu gente</h3><p className="forum-hint">Cada enlace permite entrar a una persona y caduca en siete días. Puedes revocarlo antes.</p></div>
    <Button type="button" className="h-11" disabled={busy || invitations.loading} onClick={() => void create()}><Link2 aria-hidden="true" />Crear enlace de invitación</Button>
    {url && <div className="community-invite-link"><label htmlFor="community-invite-link">Comparte este enlace con quien quieras invitar</label><div><Input ref={linkRef} id="community-invite-link" value={url} readOnly /><Button type="button" variant="secondary" className="h-11" onClick={() => {
      if (!navigator.clipboard) { linkRef.current?.focus(); linkRef.current?.select(); setNotice('El enlace está seleccionado. Cópialo para compartirlo.'); return }
      void navigator.clipboard.writeText(url).then(() => setNotice('Enlace copiado.')).catch(() => { linkRef.current?.focus(); linkRef.current?.select(); setNotice('Copia el enlace seleccionado.'); })
    }}><Copy aria-hidden="true" />Copiar</Button></div><p className="forum-hint">Se muestra solo ahora. Si lo pierdes, revócalo y crea otro.</p></div>}
    {invitations.loading && <p className="forum-hint" role="status">Cargando invitaciones…</p>}
    {(error || invitations.error) && <p className="forum-error" role="alert">{error ?? invitations.error}</p>}
    {invitations.error && <Button type="button" variant="secondary" className="h-11" onClick={invitations.retry}>Volver a cargar</Button>}
    {notice && <p className="forum-success" role="status">{notice}</p>}
    {invitations.data && invitations.data.length > 0 && <ul className="community-invitation-list" aria-label="Invitaciones recientes">{invitations.data.map(item => <li key={item.id}>
      <div><strong>{item.revokedAt ? 'Revocada' : item.usedAt ? 'Utilizada' : 'Invitación de un solo uso'}</strong><span>Vencimiento: {new Date(item.expiresAt).toLocaleString('es')}</span></div>
      {!item.usedAt && !item.revokedAt && <Button type="button" variant="ghost" className="h-11" disabled={busy} onClick={() => void revoke(item.id)}><X aria-hidden="true" />Revocar</Button>}
    </li>)}</ul>}
  </section>
}

export function CommunityManagement({ community, onChanged }: { community: Community; onChanged: (value: Community) => void }) {
  const [open, setOpen] = useState(false)
  return <details className="community-management" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Administrar comunidad</summary>
    {open && <div className="community-management-content"><section><h3>Imagen de la comunidad</h3><PortraitPicker mediaId={community.imageId} name={community.name} purpose="community" onChange={async mediaId => {
      const next = await accountRequest<Community>('communities/' + community.id + '/image', 'PATCH', { mediaId })
      onChanged(next)
    }} /></section>
    {community.visibility === 'private' && <CommunityInvitations id={community.id} />}</div>}
  </details>
}
