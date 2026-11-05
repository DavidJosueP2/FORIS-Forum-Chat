import type { ReactNode } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { AccountEntry } from '@/features/account/components/account-entry'
import { NotificationEntry } from '@/features/communities/components/notification-entry'
import '../forum.css'
import '@/features/communities/communities.css'

export function ForumShell({ children, contentId = 'forum-content' }: { children: ReactNode; contentId?: string }) {
  return <div className="forum-app">
    <a href={'#' + contentId} className="forum-skip">Ir al contenido</a>
    <header className="forum-header">
      <Link to="/" className="forum-wordmark" aria-label="Foris, inicio">Foris</Link>
      <nav className="forum-navigation" aria-label="Navegación principal">
        <NavLink to="/" end>Foros</NavLink>
        <NavLink to="/comunidades">Comunidades</NavLink>
        <NavLink to="/chat">Chat global</NavLink>
      </nav>
      <div className="forum-account"><NotificationEntry /><AccountEntry /></div>
    </header>
    {children}
  </div>
}
