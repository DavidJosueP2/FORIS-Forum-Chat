import type { ReactNode } from 'react'
import { useLayoutEffect, useRef } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AccountEntry } from '@/features/account/components/account-entry'
import { NotificationEntry } from '@/features/communities/components/notification-entry'
import '../forum.css'
import '@/features/communities/communities.css'

export function ForumShell({ children, contentId = 'forum-content', discovery }: { children: ReactNode; contentId?: string; discovery?: ReactNode }) {
  const shell = useRef<HTMLDivElement>(null)
  const header = useRef<HTMLElement>(null)
  const hasDiscovery = Boolean(discovery)
  useLayoutEffect(() => {
    if (!hasDiscovery || !header.current) return
    const element = header.current
    const measure = () => shell.current?.style.setProperty('--discovery-header-offset', Math.ceil(element.getBoundingClientRect().height) + 16 + 'px')
    measure()
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure) }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasDiscovery])
  return <div ref={shell} className={'forum-app' + (hasDiscovery ? ' forum-app-discovery' : '')}>
    <a href={'#' + contentId} className="forum-skip">Ir al contenido</a>
    <header ref={header} className={'forum-header' + (discovery ? ' forum-header-discovery' : '')}>
      <Link to="/" className="forum-wordmark" aria-label="Foris, inicio">Foris</Link>
      <nav className="forum-navigation" aria-label="Navegación principal">
        <NavLink to="/" end>Foros</NavLink>
        <NavLink to="/comunidades">Comunidades</NavLink>
        <NavLink to="/chat">Chat global</NavLink>
      </nav>
      {discovery && <><div className="discovery-mobile-navigation"><DropdownMenu modal={false}><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label="Navegación de Foris" title="Menú"><Menu aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem asChild className="min-h-11"><NavLink to="/" end>Foros</NavLink></DropdownMenuItem><DropdownMenuItem asChild className="min-h-11"><NavLink to="/comunidades">Comunidades</NavLink></DropdownMenuItem><DropdownMenuItem asChild className="min-h-11"><NavLink to="/chat">Chat global</NavLink></DropdownMenuItem></DropdownMenuContent></DropdownMenu></div><div className="discovery-navbar-tools">{discovery}</div></>}
      <div className="forum-account"><NotificationEntry /><AccountEntry /></div>
    </header>
    {children}
  </div>
}
