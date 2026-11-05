import { UserRound } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '../hooks/use-auth'
import { loginLink } from '../lib/return-target'

export function AccountEntry() {
  const { session, status } = useAuth()
  const location = useLocation()
  const next = location.pathname + (location.pathname === '/publicar' ? location.search : '')
  const label = session.user ? 'Tu perfil' : 'Entrar'
  if (status === 'loading') return <Button disabled variant="secondary" className="account-trigger h-11 px-4" aria-label="Cargando tu cuenta"><UserRound aria-hidden="true" /><span>Cuenta</span></Button>
  return (
    <Button asChild variant="secondary" className="account-trigger h-11 px-4" aria-label={label}>
      <Link to={session.user ? '/profile' : loginLink(next)}><UserRound aria-hidden="true" /><span>{label}</span></Link>
    </Button>
  )
}
