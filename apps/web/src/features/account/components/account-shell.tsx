import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import '../account.css'

export function AccountShell({ children }: { children: ReactNode }) {
  return (
    <div className="account-page">
      <a href="#account-content" className="account-skip">Ir al contenido</a>
      <header className="account-header">
        <Link to="/" className="account-wordmark">Foris</Link>
        <nav aria-label="Navegación de la cuenta">
          <Button variant="ghost" asChild className="h-11 px-4"><Link to="/"><ArrowLeft aria-hidden="true" /><span>General</span></Link></Button>
          <ThemeToggle />
        </nav>
      </header>
      {children}
    </div>
  )
}
