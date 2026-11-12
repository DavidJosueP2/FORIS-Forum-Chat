import { useLayoutEffect, useRef } from 'react'
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import { Menu, MessageCircle, MessagesSquare, Plus, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AccountEntry } from '@/features/account/components/account-entry'
import { ForisCharacter } from '@/components/brand/foris-character'
import { NotificationEntry } from '@/features/communities/components/notification-entry'
import { LegalEntry } from '@/features/legal/legal-page'
import { DiscoveryProvider } from '../discovery/discovery-provider'
import { useDiscovery } from '../discovery/use-discovery'
import { DiscoverySearch } from '../discovery/discovery-search'
import { DiscoveryFilters, MobileDiscoveryFilters } from '../discovery/discovery-filters'
import '../forum.css'
import '@/features/communities/communities.css'
import '../discovery/discovery.css'
import './platform-shell.css'

const navigation = [{ to: '/', label: 'Foros', end: true, icon: MessagesSquare }, { to: '/comunidades', label: 'Comunidades', end: false, icon: UsersRound }, { to: '/chat', label: 'Chats', end: false, icon: MessageCircle }]
function PlatformNavigation({ onNavigate, icons = false }: { onNavigate?: () => void; icons?: boolean }) {
  return <nav className="forum-navigation" aria-label="Navegación principal">
    {navigation.map(item => <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate}>{icons && <item.icon className="platform-navigation-icon" aria-hidden="true" />}{item.label}</NavLink>)}
  </nav>
}
function CompactNavigation() {
  return <div className="platform-compact-navigation"><DropdownMenu modal={false}><DropdownMenuTrigger asChild><Button type="button" variant="ghost" className="h-11 w-11" aria-label="Navegar por Foris" title="Navegación"><Menu aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="start" className="min-w-44">{navigation.map(item => <DropdownMenuItem key={item.to} asChild className="min-h-11"><NavLink to={item.to} end={item.end}>{item.label}</NavLink></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div>
}
function PlatformFrame() {
  const discovery = useDiscovery()
  const { pathname, search } = useLocation()
  const shell = useRef<HTMLDivElement>(null)
  const header = useRef<HTMLElement>(null)
  const account = pathname === '/login' || pathname === '/profile'
  const access = pathname === '/login'
  const chat = pathname === '/chat' || pathname.startsWith('/chat/')
  const legal = pathname === '/legal' || pathname.startsWith('/legal/')
  const compact = access || chat || legal
  const showSidebarLegal = pathname === '/' || pathname === '/publicar' || pathname.startsWith('/publicaciones/') || pathname === '/comunidades' || pathname.startsWith('/comunidades/')
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
  return <div ref={shell} className={'forum-app forum-platform' + (access ? ' platform-access' : chat ? ' platform-chat' : legal ? ' platform-legal' : '')}>
    <a href={'#' + contentId} className="forum-skip">Ir al contenido</a>
    <header ref={header} className="forum-header platform-header">
      <div className="platform-brand">{compact ? <CompactNavigation /> : <MobileDiscoveryFilters {...discovery} navigation={close => <PlatformNavigation icons onNavigate={close} />} footer={showSidebarLegal ? close => <LegalEntry onNavigate={close} /> : undefined} />}<Link to="/" className="forum-wordmark" aria-label="Foris, inicio"><ForisCharacter scene="brand" width={32} height={32} className="platform-brand-mark" /><span>Foris</span></Link></div>
      <div className="platform-top-navigation"><PlatformNavigation /></div>
      {!chat && !legal && <div className="platform-navbar-tools">
        <DiscoverySearch key={discovery.searchReset} navigationKey={pathname} applied={discovery.query.search} onSearch={discovery.onSearch} />
        <Button asChild className="platform-create h-11 px-4"><Link to={create} aria-label="Crear publicación"><Plus aria-hidden="true" /><span className="platform-create-label">Crear publicación</span><span className="platform-create-short">Crear</span></Link></Button>
      </div>}
      <div className="forum-account"><NotificationEntry /><AccountEntry /></div>
    </header>
    {!compact && <DiscoveryFilters {...discovery} navigation={<div className="platform-side-navigation"><PlatformNavigation icons /></div>}
      footer={showSidebarLegal ? <div className={pathname === '/' ? 'discovery-sidebar-footer discovery-sidebar-footer-compact' : 'discovery-sidebar-footer'}><LegalEntry /></div> : undefined} />}
    <div className={'platform-content' + (chat ? ' platform-content-chat' : '')}><Outlet /></div>
  </div>
}
export function ForumShell() {
  return <DiscoveryProvider><PlatformFrame /></DiscoveryProvider>
}
