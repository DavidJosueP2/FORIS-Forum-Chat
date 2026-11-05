import { UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '../hooks/use-auth'

export function AccountEntry() {
  const { session, status } = useAuth()
  const label = session.user ? 'Tu perfil' : 'Entrar'
  if (status === 'loading') return <Button disabled variant="secondary" className="account-trigger h-11 px-4" aria-label="Cargando tu cuenta"><UserRound aria-hidden="true" /><span>Cuenta</span></Button>
  return (
    <Button asChild variant="secondary" className="account-trigger h-11 px-4" aria-label={label}>
      <Link to={session.user ? '/profile' : '/login'}><UserRound aria-hidden="true" /><span>{label}</span></Link>
    </Button>
  )
}
