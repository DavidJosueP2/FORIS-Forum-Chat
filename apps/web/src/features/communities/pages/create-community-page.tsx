import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Globe2, LoaderCircle, LockKeyhole } from 'lucide-react'
import type { Community } from '@messages/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/account/hooks/use-auth'
import { accountError, accountRequest } from '@/features/account/api/account-api'
import { ForumShell } from '@/features/forum/components/forum-shell'
import { ParticipationGate } from '@/features/forum/components/forum-states'
import { useDraft } from '@/features/forum/hooks/use-draft'
import { PortraitPicker } from '@/features/media/components/portrait-picker'

function CommunityForm({ userId }: { userId: string }) {
  const { draft, change, stored, clear, alive } = useDraft('foris.community.create.' + userId, 'public')
  const [busy, setBusy] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const guard = useRef(false)
  const navigate = useNavigate()
  const visibility = draft.topicId === 'private' ? 'private' : 'public'
  async function submit() {
    if (guard.current || imageBusy) return
    if (draft.title.trim().length < 3 || !draft.body.trim()) { setError('Elige un nombre de al menos 3 caracteres y describe tu comunidad.'); return }
    guard.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await accountRequest<{ community: Community; created: boolean }>('communities', 'POST', { name: draft.title, description: draft.body, requestId: draft.requestId, visibility, imageId: draft.mediaIds[0] ?? null })
      if (!alive.current) return
      clear()
      navigate('/comunidades/' + result.community.id, { replace: true })
    } catch (cause) { if (alive.current) setError(accountError(cause)) }
    finally { guard.current = false; if (alive.current) setBusy(false) }
  }
  return <form className="forum-form community-builder" aria-busy={busy || imageBusy} onSubmit={event => { event.preventDefault(); void submit() }}>
    <fieldset disabled={busy || imageBusy}>
      <div className="community-identity-editor"><PortraitPicker mediaId={draft.mediaIds[0] ?? null} name={draft.title || 'Comunidad'} purpose="community" onChange={id => change({ mediaIds: id ? [id] : [] })} onBusyChange={setImageBusy} /><p>Empieza por darle una cara.<br /><span>La imagen es opcional.</span></p></div>
      <div className="forum-field"><label htmlFor="community-name">¿Cómo se llama?</label><div className="community-field-with-limit"><Input id="community-name" name="name" autoComplete="off" required minLength={3} maxLength={80} value={draft.title} onChange={event => change({ title: event.target.value })} placeholder="El nombre de tu comunidad" aria-describedby="community-name-limit" /><span className="community-field-limit" aria-hidden="true" title={'Quedan ' + (80 - draft.title.length) + ' caracteres'}>{80 - draft.title.length}</span></div><span id="community-name-limit" className="sr-only">Nombre único, entre 3 y 80 caracteres.</span></div>
      <div className="forum-field"><label htmlFor="community-description">¿Qué los reúne?</label><div className="community-field-with-limit community-description-field"><Textarea id="community-description" name="description" rows={3} required maxLength={500} value={draft.body} onChange={event => change({ body: event.target.value })} placeholder="Una idea, un interés o algo que quieran compartir." aria-describedby="community-description-limit" /><span className="community-field-limit" aria-hidden="true" title={'Quedan ' + (500 - draft.body.length) + ' caracteres'}>{500 - draft.body.length}</span></div><span id="community-description-limit" className="sr-only">Máximo 500 caracteres.</span></div>
      <fieldset className="community-access"><legend>¿Quién puede entrar?</legend><div className="community-access-switch">
        <label data-selected={visibility === 'public'}><input className="sr-only" type="radio" name="visibility" value="public" checked={visibility === 'public'} onChange={() => change({ topicId: 'public' })} /><Globe2 aria-hidden="true" />Pública</label>
        <label data-selected={visibility === 'private'}><input className="sr-only" type="radio" name="visibility" value="private" checked={visibility === 'private'} onChange={() => change({ topicId: 'private' })} /><LockKeyhole aria-hidden="true" />Privada</label>
      </div><p className="forum-hint">{visibility === 'private' ? 'Solo quienes invites podrán unirse y ver lo que se comparte. Tú administras los enlaces de invitación.' : 'Cualquiera puede descubrirla y leerla. Para unirse y participar se necesita una cuenta.'}</p></fieldset>
      {!stored && <p className="forum-error" role="status">No pudimos guardar el borrador en esta pestaña. Conserva una copia antes de salir.</p>}
      {error && <p className="forum-error" role="alert">{error} Tu borrador sigue aquí.</p>}
      <div className="forum-actions"><Button type="submit" disabled={imageBusy} className="h-12 px-6">{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? 'Creando…' : 'Crear comunidad'}</Button><Button asChild variant="ghost" className="h-12 px-6"><Link to="/comunidades">Volver a comunidades</Link></Button></div>
    </fieldset>
  </form>
}
export function CreateCommunityPage() {
  const auth = useAuth()
  return <ForumShell><main id="forum-content" className="forum-main forum-editor" tabIndex={-1}>
    <Link to="/comunidades" className="forum-back"><ArrowLeft aria-hidden="true" />Comunidades</Link>
    <header className="forum-page-heading"><h1>Crea tu comunidad</h1><p>Dale una identidad y elige con quién compartirla.</p></header>
    <ParticipationGate next="/comunidades/crear" description="Crea una cuenta o inicia sesión para formar tu comunidad y reunir a otras personas.">{auth.session.user && <CommunityForm key={auth.session.user.id} userId={auth.session.user.id} />}</ParticipationGate>
  </main></ForumShell>
}
