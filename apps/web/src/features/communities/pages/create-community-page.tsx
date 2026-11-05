import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import type { Community } from '@messages/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/account/hooks/use-auth'
import { accountError, accountRequest } from '@/features/account/api/account-api'
import { ForumShell } from '@/features/forum/components/forum-shell'
import { ParticipationGate } from '@/features/forum/components/forum-states'
import { useDraft } from '@/features/forum/hooks/use-draft'

function CommunityForm({ userId }: { userId: string }) {
  const { draft, change, stored, clear, alive } = useDraft('foris.community.create.' + userId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const guard = useRef(false)
  const navigate = useNavigate()
  async function submit() {
    if (guard.current) return
    if (draft.title.trim().length < 3 || !draft.body.trim()) { setError('Elige un nombre de al menos 3 caracteres y describe tu comunidad.'); return }
    guard.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await accountRequest<{ community: Community; created: boolean }>('communities', 'POST', { name: draft.title, description: draft.body, requestId: draft.requestId })
      if (!alive.current) return
      clear()
      navigate('/comunidades/' + result.community.id, { replace: true })
    } catch (cause) { if (alive.current) setError(accountError(cause)) }
    finally { guard.current = false; if (alive.current) setBusy(false) }
  }
  return <form className="forum-form" aria-busy={busy} onSubmit={event => { event.preventDefault(); void submit() }}>
    <fieldset disabled={busy}>
      <div className="forum-field"><label htmlFor="community-name">Nombre de tu comunidad</label><Input id="community-name" name="name" autoComplete="off" required minLength={3} maxLength={80} value={draft.title} onChange={event => change({ title: event.target.value })} placeholder="Un nombre que invite a encontrarse" /><span className="forum-hint">{draft.title.length}/80 caracteres. Cada comunidad tiene un nombre único.</span></div>
      <div className="forum-field"><label htmlFor="community-description">¿Qué los reúne?</label><Textarea id="community-description" name="description" rows={5} required maxLength={500} value={draft.body} onChange={event => change({ body: event.target.value })} placeholder="Cuéntanos de qué hablarán y para quién es este espacio." /><span className="forum-hint">{draft.body.length}/500 caracteres.</span></div>
      <p className="forum-hint">Tu comunidad será pública: cualquiera podrá leer y las personas con cuenta podrán unirse. Como creador formarás parte de ella y quedará guardada en tus favoritas.</p>
      {!stored && <p className="forum-error" role="status">No pudimos guardar el borrador en esta pestaña. Conserva una copia antes de salir.</p>}
      {error && <p className="forum-error" role="alert">{error} Tu borrador sigue aquí.</p>}
      <div className="forum-actions"><Button type="submit" className="h-12 px-6">{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? 'Creando…' : 'Crear comunidad'}</Button><Button asChild variant="ghost" className="h-12 px-6"><Link to="/comunidades">Volver a comunidades</Link></Button></div>
    </fieldset>
  </form>
}
export function CreateCommunityPage() {
  const auth = useAuth()
  return <ForumShell><main id="forum-content" className="forum-main forum-editor" tabIndex={-1}>
    <Link to="/comunidades" className="forum-back"><ArrowLeft aria-hidden="true" />Comunidades</Link>
    <header className="forum-page-heading"><h1>Hazle lugar a una idea.</h1><p>Las buenas comunidades empiezan con algo en común. Lo demás lo construyen quienes llegan.</p></header>
    <ParticipationGate next="/comunidades/crear" description="Crea una cuenta o inicia sesión para formar tu comunidad y reunir a otras personas.">{auth.session.user && <CommunityForm key={auth.session.user.id} userId={auth.session.user.id} />}</ParticipationGate>
  </main></ForumShell>
}
