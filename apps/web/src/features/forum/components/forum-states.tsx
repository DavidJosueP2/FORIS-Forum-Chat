import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ForisCharacter } from '@/components/brand/foris-character'
import { useAuth } from '@/features/account/hooks/use-auth'
import { loginLink } from '@/features/account/lib/return-target'

export function ForumLoading({ label = 'Cargando publicaciones…' }: { label?: string }) {
  return <p className="forum-loading" role="status"><LoaderCircle className="animate-spin" aria-hidden="true" />{label}</p>
}
export function ForumError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="forum-error" role="alert"><p>{message}</p><Button variant="secondary" className="h-11" onClick={retry}>Volver a intentar</Button></div>
}
export function ForumEmpty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="forum-empty"><ForisCharacter mood="curious" width={96} height={96} /><h2>{title}</h2><div>{children}</div></div>
}
export function ParticipationGate({ next, children, description = 'Puedes leer el foro sin cuenta. Para publicar o responder, entra con Google o crea una cuenta con tu correo.' }: { next: string; children: ReactNode; description?: string }) {
  const auth = useAuth()
  if (auth.status === 'loading') return <ForumLoading label="Comprobando tu sesión…" />
  if (auth.status === 'error') return <ForumError message={auth.error ?? 'No pudimos comprobar tu sesión.'} retry={() => void auth.refresh()} />
  if (auth.session.user) return children
  return <section className="forum-join" aria-labelledby="join-heading">
    <h2 id="join-heading">Tu voz también tiene lugar</h2>
    <p>{description}</p>
    <div className="forum-actions">
      <Button asChild className="h-11 px-6"><Link to={loginLink(next, true)}>Crear cuenta</Link></Button>
      <Button asChild variant="secondary" className="h-11 px-6"><Link to={loginLink(next)}>Ya tengo cuenta</Link></Button>
    </div>
    <p className="forum-hint">Si quieres conversar como invitado, te esperamos en el <Link to="/chat">chat global</Link>.</p>
  </section>
}
export function ForumTime({ value }: { value: string }) {
  return <time dateTime={value} title={new Date(value).toLocaleString('es-EC')}>{new Date(value).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
}
