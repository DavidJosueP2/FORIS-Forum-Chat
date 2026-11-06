import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import type { Community, InvitationPreview } from '@messages/contracts'
import { Button } from '@/components/ui/button'
import { ForisCharacter } from '@/components/brand/foris-character'
import { useAuth } from '@/features/account/hooks/use-auth'
import { accountError, accountRequest } from '@/features/account/api/account-api'
import { loginLink } from '@/features/account/lib/return-target'
import { ForumError, ForumLoading } from '@/features/forum/components/forum-states'

function InvitationContent({ token }: { token: string }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<InvitationPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const guard = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    const abort = new AbortController()
    void accountRequest<InvitationPreview>('community-invitations/preview', 'POST', { token }, abort.signal)
      .then(result => { if (!abort.signal.aborted) setPreview(result) })
      .catch(cause => { if (!abort.signal.aborted) setError(accountError(cause)) })
    return () => abort.abort()
  }, [token, attempt])
  async function accept() {
    if (guard.current) return
    guard.current = true; setBusy(true); setError(null)
    try {
      const community = await accountRequest<Community>('community-invitations/accept', 'POST', { token })
      if (alive.current) navigate('/comunidades/' + community.id, { replace: true })
    } catch (cause) { if (alive.current) setError(accountError(cause)) }
    finally { guard.current = false; if (alive.current) setBusy(false) }
  }
  if (error && !preview) return <ForumError message={error} retry={() => { setError(null); setAttempt(current => current + 1) }} />
  if (!preview) return <ForumLoading label="Comprobando invitación…" />
  return <section className="community-invitation-page" aria-busy={busy}>
    <header className="community-invitation-heading"><div><LockKeyhole aria-hidden="true" /><h1>Te invitaron a {preview.community.name}.</h1></div>{!error && <ForisCharacter scene="invitation" width={72} height={72} />}</header>
    <p>Un espacio privado para compartir con su gente. Al aceptar formarás parte de la comunidad y podrás leer y participar.</p>
    {error && <p className="forum-error" role="alert">{error}</p>}
    {preview.isMember ? <Button asChild className="h-12 px-6"><Link to={'/comunidades/' + preview.community.id}>Ir a mi comunidad</Link></Button>
      : auth.session.user ? <Button type="button" className="h-12 px-6" disabled={busy} onClick={() => void accept()}>{busy ? 'Entrando…' : 'Aceptar invitación y unirme'}</Button>
        : <div className="forum-actions"><Button asChild className="h-12 px-6"><Link to={loginLink('/invitaciones/' + token)}>Entrar para aceptar</Link></Button><Button asChild variant="secondary" className="h-12 px-6"><Link to={loginLink('/invitaciones/' + token, true)}>Crear una cuenta</Link></Button></div>}
    <p className="forum-hint">Válida hasta {new Date(preview.expiresAt).toLocaleString('es')}. El enlace se utiliza una sola vez.</p>
    <Link className="forum-back" to="/comunidades">Volver a comunidades</Link>
  </section>
}
export function InvitationPage() {
  const { token = '' } = useParams()
  const auth = useAuth()
  return <main id="forum-content" className="forum-main" tabIndex={-1}>
    {auth.status === 'loading' ? <ForumLoading label="Comprobando tu cuenta…" /> : <InvitationContent key={token + (auth.session.user?.id ?? 'guest')} token={token} />}
  </main>
}
