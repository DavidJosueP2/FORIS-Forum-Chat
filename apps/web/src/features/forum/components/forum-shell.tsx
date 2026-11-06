import { useLayoutEffect, useRef } from 'react'
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AccountEntry } from '@/features/account/components/account-entry'
import { NotificationEntry } from '@/features/communities/components/notification-entry'
import { DiscoveryProvider } from '../discovery/discovery-provider'
import { useDiscovery } from '../discovery/use-discovery'
import { DiscoverySearch } from '../discovery/discovery-search'
import { DiscoveryFilters, MobileDiscoveryFilters } from '../discovery/discovery-filters'
import '../forum.css'
import '@/features/communities/communities.css'
import '../discovery/discovery.css'
import './platform-shell.css'

function PlatformNavigation({ onNavigate }: { onNavigate?: () => void }) {
  return <nav className="forum-navigation" aria-label="Navegación principal">
    <NavLink to="/" end onClick={onNavigate}>Foros</NavLink>
    <NavLink to="/comunidades" onClick={onNavigate}>Comunidades</NavLink>
    <NavLink to="/chat" onClick={onNavigate}>Chat global</NavLink>
  </nav>
}
function PlatformFrame() {
  const discovery = useDiscovery()
  const { pathname, search } = useLocation()
  const shell = useRef<HTMLDivElement>(null)
  const header = useRef<HTMLElement>(null)
  const account = pathname === '/login' || pathname === '/profile'
  const chat = pathname === '/chat'
  const contentId = chat ? 'conversation' : account ? 'account-content' : 'forum-content'
  const community = /^\/comunidades\/([1-9]\d{0,18})$/u.exec(pathname)?.[1] ?? (pathname === '/publicar' ? new URLSearchParams(search).get('comunidad') : null)
  const create = '/publicar' + (community && /^[1-9]\d{0,18}$/u.test(community) ? '?comunidad=' + encodeURIComponent(community) : '')
  useLayoutEffect(() => {
    if (!header.current) return
    const element = header.current
    const measure = () => {
      const height = Math.ceil(element.getBoundingClientRect().height)
      shell.current?.style.setProperty('--platform-header-height', height + 'px')
      shell.current?.style.setProperty('--discovery-header-offset', height + 16 + 'px')
    }
    measure()
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure) }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return <div ref={shell} className="forum-app forum-platform">
    <a href={'#' + contentId} className="forum-skip">Ir al contenido</a>
    <header ref={header} className="forum-header platform-header">
      <div className="platform-brand"><MobileDiscoveryFilters {...discovery} navigation={close => <PlatformNavigation onNavigate={close} />} /><Link to="/" className="forum-wordmark" aria-label="Foris, inicio">Foris</Link></div>
      <div className="platform-top-navigation"><PlatformNavigation /></div>
      <div className="platform-navbar-tools"><DiscoverySearch key={discovery.searchReset} navigationKey={pathname} applied={discovery.query.search} onSearch={discovery.onSearch} /><Button asChild className="platform-create h-11 px-4"><Link to={create} aria-label="Crear publicación"><Plus aria-hidden="true" /><span className="platform-create-label">Crear publicación</span><span className="platform-create-short">Crear</span></Link></Button></div>
      <div className="forum-account"><NotificationEntry /><AccountEntry /></div>
    </header>
    <DiscoveryFilters {...discovery} navigation={<div className="platform-side-navigation"><PlatformNavigation /></div>} />
    <div className={'platform-content' + (chat ? ' platform-content-chat' : '')}><Outlet /></div>
  </div>
}
export function ForumShell() {
  return <DiscoveryProvider><PlatformFrame /></DiscoveryProvider>
}
