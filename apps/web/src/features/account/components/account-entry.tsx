import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, LogOut, UserRound } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ThemeMenuOptions } from '@/components/theme-menu-options'
import { ThemeToggle } from '@/components/theme-toggle'
import { useAuth } from '../hooks/use-auth'
import { loginLink } from '../lib/return-target'
import { accountError } from '../api/account-api'
import { IdentityImage } from '@/features/media/components/identity-image'

function MemberAccountMenu() {
  const { logout, session } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const guard = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  async function signOut() {
    if (guard.current) return
    guard.current = true
    const startedAt = window.location.href
    setBusy(true)
    setError(null)
    try {
      await logout()
      if (window.location.href === startedAt) navigate('/', { replace: true })
    } catch (cause) {
      if (alive.current) setError(accountError(cause))
    } finally {
      guard.current = false
      if (alive.current) setBusy(false)
    }
  }

  return <DropdownMenu modal={false} open={open} onOpenChange={value => { setOpen(value); if (value) setError(null) }}>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" className="account-avatar-trigger h-11 w-11 p-0" aria-label={busy ? 'Cerrando sesión' : 'Abrir menú de tu cuenta: ' + session.user?.displayName} title="Tu perfil" aria-busy={busy} disabled={busy}>
        <IdentityImage fallbackKey={session.user ? 'user:' + session.user.id : undefined} mediaId={session.user?.avatarId} name={session.user?.displayName ?? 'Cuenta'} className="navbar-avatar" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={8} collisionPadding={12} className="w-64 max-w-[calc(100vw-1.5rem)] bg-secondary p-2 text-secondary-foreground dark:bg-popover dark:text-popover-foreground" aria-busy={busy}>
      <DropdownMenuItem asChild disabled={busy} className="min-h-11 rounded-full px-3 focus:bg-popover focus:text-popover-foreground dark:focus:bg-accent dark:focus:text-accent-foreground">
        <Link to="/profile"><UserRound aria-hidden="true" />Ver tu perfil</Link>
      </DropdownMenuItem>
      <ThemeMenuOptions disabled={busy} />
      <DropdownMenuItem disabled={busy} className="mt-2 min-h-11 rounded-full px-3 focus:bg-popover focus:text-popover-foreground dark:focus:bg-accent dark:focus:text-accent-foreground" onSelect={event => { event.preventDefault(); void signOut() }}>
        {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
        {busy ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </DropdownMenuItem>
      {error && <p className="px-3 py-2 text-sm leading-relaxed text-destructive" role="alert">{error}</p>}
    </DropdownMenuContent>
  </DropdownMenu>
}

export function AccountEntry() {
  const { session, status } = useAuth()
  const location = useLocation()
  const next = location.pathname + (location.pathname === '/publicar' ? location.search : '')
  if (session.user) return <MemberAccountMenu key={session.user.id} />
  if (status === 'loading') return <><ThemeToggle /><Button disabled variant="secondary" className="account-trigger h-11 px-4" aria-label="Cargando tu cuenta"><UserRound aria-hidden="true" /><span>Cuenta</span></Button></>
  return (
    <><ThemeToggle /><Button asChild variant="secondary" className="account-trigger h-11 px-4" aria-label="Entrar">
      <Link to={loginLink(next)}><UserRound aria-hidden="true" /><span>Entrar</span></Link>
    </Button></>
  )
}
