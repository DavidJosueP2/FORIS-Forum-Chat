import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { ForumCategory, ForumTag } from '@messages/contracts'
import { ArrowRight, Check, ChevronLeft, ChevronRight, Compass, Cpu, FolderTree, GraduationCap, LayoutGrid, MessagesSquare, Palette, PanelLeft, Search, Tags, Wrench, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useResource } from '../hooks/use-forum'
import type { DiscoveryQuery } from './discovery-query'

export interface FilterResource<T> { data: T | null; loading: boolean; error: string | null; retry: () => void }
interface Props {
  query: DiscoveryQuery; categories: FilterResource<ForumCategory[]>; tags: FilterResource<ForumTag[]>; selectedTags: FilterResource<ForumTag[]>;
  onCategory: (id: string | null) => void; onTag: (id: string) => void; onClear: () => void; onSearchClear: () => void; onAuthorClear: () => void;
  resourceScope: string;
}
const searchable = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es')
const categoryIcons: Record<string, LucideIcon> = { general: MessagesSquare, tecnologia: Cpu, aprendizaje: GraduationCap, creatividad: Palette, proyectos: Wrench }
function CategoryIcon({ category, categories }: { category: ForumCategory; categories: ForumCategory[] }) {
  const root = categories.find(item => item.id === category.rootId) ?? category
  const Icon = categoryIcons[root.slug] ?? FolderTree
  return <Icon aria-hidden="true" />
}
function ResourceIssue({ resource }: { resource: FilterResource<unknown> }) {
  return <div className="discovery-filter-error"><p role="alert">{resource.error}</p><Button type="button" variant="ghost" className="h-11" onClick={resource.retry}>Reintentar</Button></div>
}
function CategoryFilter({ query, categories, onCategory }: Pick<Props, 'query' | 'categories' | 'onCategory'>) {
  const [branch, setBranch] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const id = useId()
  const items = categories.data ?? []
  const selected = query.category || items.find(item => !item.parentId && item.slug === query.topic)?.id
  const parent = items.find(item => item.id === branch)
  const visible = search.trim() ? items.filter(item => searchable(item.name).includes(searchable(search.trim()))) : items.filter(item => item.parentId === branch).sort((a, b) => a.position - b.position)
  return <section className="discovery-filter-section" aria-labelledby={id + '-heading'}><h3 id={id + '-heading'}><FolderTree aria-hidden="true" />Temáticas</h3>
    <label className="discovery-filter-search"><Search aria-hidden="true" /><input type="search" aria-label="Buscar temáticas" placeholder="Buscar temática" value={search} onChange={event => setSearch(event.target.value)} maxLength={80} /></label>
    <button type="button" className="discovery-filter-all" aria-pressed={!selected} onClick={() => { setBranch(null); setSearch(''); onCategory(null) }}><LayoutGrid aria-hidden="true" /><span>Todas las temáticas</span>{!selected && <Check aria-hidden="true" />}</button>
    {parent && !search && <div className="discovery-filter-branch"><button type="button" className="discovery-branch-back" onClick={() => setBranch(parent.parentId)}><ChevronLeft aria-hidden="true" />{parent.parentId ? 'Volver un nivel' : 'Ver temáticas'}</button><span>{parent.name}</span></div>}
    {categories.loading ? <p className="forum-hint" role="status">Cargando temáticas…</p> : categories.error ? <ResourceIssue resource={categories} /> : <div className="discovery-category-list">{visible.slice(0, 30).map(item => <div className="discovery-category-row" key={item.id}>
      <button type="button" className="discovery-category-select" aria-pressed={selected === item.id} onClick={() => onCategory(item.id)}><CategoryIcon category={item} categories={items} /><span>{item.name}{search && item.parentId && <small>{item.path.slice(0, -1).map(id => items.find(category => category.id === id)?.name).join(' / ')}</small>}</span>{selected === item.id && <Check aria-hidden="true" />}</button>
      {items.some(child => child.parentId === item.id) && <button type="button" className="discovery-category-expand" title={'Explorar ' + item.name} aria-label={'Explorar subtemáticas de ' + item.name} onClick={() => { setBranch(item.id); setSearch('') }}><ChevronRight aria-hidden="true" /></button>}
    </div>)}{!visible.length && <p className="forum-hint">No encontramos esa temática.</p>}{visible.length > 30 && <p className="forum-hint">Afina la búsqueda para ver más coincidencias.</p>}</div>}
    {selected && <p className="discovery-filter-note">Incluye las subtemáticas de tu selección.</p>}
  </section>
}
function TagFilter({ query, tags, selectedTags, onTag, resourceScope }: Pick<Props, 'query' | 'tags' | 'selectedTags' | 'onTag' | 'resourceScope'>) {
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const id = useId()
  useEffect(() => { const timer = setTimeout(() => setSearch(draft.trim()), 300); return () => clearTimeout(timer) }, [draft])
  const searched = useResource<ForumTag[]>(search ? 'taxonomy/tags?limit=30&search=' + encodeURIComponent(search) : null, resourceScope)
  const resource = search ? searched : tags
  const choices = [...(selectedTags.data ?? []), ...(resource.data ?? [])].filter((item, index, all) => all.findIndex(other => other.id === item.id) === index)
  return <section className="discovery-filter-section" aria-labelledby={id + '-heading'}><h3 id={id + '-heading'}><Tags aria-hidden="true" />Etiquetas</h3><label className="discovery-filter-search"><Search aria-hidden="true" /><input type="search" aria-label="Buscar etiquetas" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Buscar etiqueta" maxLength={64} /></label>
    {resource.loading && <p className="forum-hint" role="status">Cargando etiquetas…</p>}{resource.error && <ResourceIssue resource={resource} />}
    <div className="discovery-tag-options">{choices.map(tag => <button type="button" key={tag.id} aria-pressed={query.tags.includes(tag.id)} onClick={() => {
      if (!query.tags.includes(tag.id) && query.tags.length >= 8) { setError('Puedes combinar hasta ocho etiquetas. Quita una para elegir otra.'); return }
      setError(''); onTag(tag.id)
    }}>{query.tags.includes(tag.id) && <Check aria-hidden="true" />}<span><span aria-hidden="true">#</span>{tag.name}</span></button>)}</div>
    {!resource.loading && !resource.error && !choices.length && <p className="forum-hint">{search ? 'No encontramos esa etiqueta.' : 'Las etiquetas aparecerán aquí cuando se usen en publicaciones.'}</p>}
    {error && <p className="forum-error" role="alert">{error}</p>}
    {query.tags.length > 0 && <p className="discovery-filter-note">Las publicaciones incluyen todas las etiquetas seleccionadas.</p>}
  </section>
}
function FilterPanel(props: Props) {
  return <div className="discovery-filter-panel" data-discovery-control><CategoryFilter {...props} /><TagFilter {...props} /></div>
}
function ExploreLink({ to, onNavigate }: { to: string; onNavigate?: () => void }) {
  const { pathname, search, hash } = useLocation()
  return <Link to={to} className="discovery-explore-link" onClick={event => {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    if (pathname + search + hash === to) window.scrollTo({ top: 0, left: 0 })
    onNavigate?.()
  }}>
    <Compass aria-hidden="true" />Explorar<ArrowRight aria-hidden="true" />
  </Link>
}

export function DiscoveryFilters({ navigation, footer, feedHref, ...props }: Props & {
  navigation?: ReactNode; footer?: ReactNode; feedHref: (following: boolean) => string
}) {
  return (
    <aside className="discovery-sidebar" aria-label="Explorar y filtrar publicaciones">
      <div className="discovery-sidebar-inner">
        {navigation}
        <ExploreLink to={feedHref(false)} />
        <FilterPanel {...props} />
      </div>
      {footer}
    </aside>
  )
}
export function MobileDiscoveryFilters({ navigation, footer, feedHref, ...props }: Props & {
  navigation?: (close: () => void) => ReactNode; footer?: (close: () => void) => ReactNode; feedHref: (following: boolean) => string
}) {
  const location = useLocation()
  const currentLocation = location.pathname + location.search
  const [open, setOpen] = useState(false)
  const [openedQuery, setOpenedQuery] = useState(props.query.path)
  const [openedLocation, setOpenedLocation] = useState(currentLocation)
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)')
    const close = () => { if (wide.matches) setOpen(false) }
    wide.addEventListener('change', close)
    return () => wide.removeEventListener('change', close)
  }, [])
  const count = Number(Boolean(props.query.category || props.query.topic)) + props.query.tags.length
  const closeSheet = () => setOpen(false)
  return <Sheet open={open} onOpenChange={next => { if (next) { setOpenedQuery(props.query.path); setOpenedLocation(currentLocation) } setOpen(next) }}><SheetTrigger asChild><Button type="button" variant="ghost" className="platform-explore-trigger h-11 w-11" aria-label={count ? 'Abrir menú y filtros, ' + count + ' filtros seleccionados' : 'Abrir menú y filtros'} title="Menú y filtros"><PanelLeft aria-hidden="true" /></Button></SheetTrigger><SheetContent className="discovery-filter-sheet platform-filter-sheet" side="left" onCloseAutoFocus={event => {
    if (openedQuery !== props.query.path || openedLocation !== currentLocation) {
      event.preventDefault()
      const heading = document.getElementById('discovery-heading')
      const results = heading ?? document.querySelector<HTMLElement>('main')
      results?.focus({ preventScroll: true })
      if (heading) window.scrollTo({ top: 0, left: 0 })
      else results?.scrollIntoView({ block: 'start' })
    } else if (window.matchMedia('(min-width: 1024px)').matches) {
      event.preventDefault()
      const selected = document.querySelector<HTMLElement>('.discovery-sidebar .discovery-filter-panel [aria-pressed="true"]')
      const explore = document.querySelector<HTMLElement>('.discovery-sidebar .discovery-explore-link')
      const focusTarget = selected ?? explore
      focusTarget?.focus({ preventScroll: true })
    }
  }}>
    <SheetHeader><SheetTitle className="discovery-explore-title"><PanelLeft aria-hidden="true" />Menú y filtros</SheetTitle><SheetDescription className="sr-only">Navega por Foris y encuentra publicaciones por temática y etiquetas.</SheetDescription></SheetHeader>
    <div className="discovery-filter-sheet-body">
      {navigation?.(closeSheet)}
      <ExploreLink to={feedHref(false)} onNavigate={closeSheet} />
      <FilterPanel {...props} />
    </div>
    <SheetFooter><SheetClose asChild><Button type="button" className="h-11">Continuar</Button></SheetClose>{props.query.filtered && <Button type="button" variant="ghost" className="h-11" onClick={props.onClear}>Quitar filtros</Button>}{footer?.(closeSheet)}</SheetFooter>
  </SheetContent></Sheet>
}
export function ActiveDiscoveryFilters(props: Props) {
  const { query } = props
  if (!query.filtered) return null
  const category = props.categories.data?.find(item => item.id === query.category || (!query.category && !item.parentId && item.slug === query.topic))
  return <div className="discovery-active-filters" role="group" aria-label="Filtros activos" data-discovery-control>
    {query.search && <span className="discovery-active-filter">«{query.search}»<button type="button" aria-label="Quitar búsqueda" title="Quitar búsqueda" onClick={props.onSearchClear}><X aria-hidden="true" /></button></span>}
    {(query.category || query.topic) && <span className="discovery-active-filter">{category?.name ?? 'Temática seleccionada'}<button type="button" aria-label="Quitar filtro de temática" title="Quitar temática" onClick={() => props.onCategory(null)}><X aria-hidden="true" /></button></span>}
    {query.author && <span className="discovery-active-filter">De este perfil<button type="button" aria-label="Quitar filtro de autor" title="Quitar autor" onClick={props.onAuthorClear}><X aria-hidden="true" /></button></span>}
    {query.tags.map(id => {
      const name = props.selectedTags.data?.find(tag => tag.id === id)?.name
      return <span className="discovery-active-filter discovery-active-tag" key={id}>
        {name ? <span><span aria-hidden="true">#</span>{name}</span> : props.selectedTags.loading ? 'Cargando etiqueta…' : 'Etiqueta seleccionada'}
        <button type="button" aria-label={'Quitar etiqueta ' + (name ?? 'seleccionada')} title="Quitar etiqueta" onClick={() => props.onTag(id)}><X aria-hidden="true" /></button>
      </span>
    })}
    <Button type="button" variant="ghost" className="h-11" onClick={props.onClear}>Quitar filtros</Button>
    {props.selectedTags.error && <div className="discovery-selected-tags-error"><p className="forum-error" role="alert">No pudimos cargar los nombres de las etiquetas seleccionadas.</p><Button type="button" variant="ghost" className="h-11" onClick={props.selectedTags.retry}>Volver a cargar etiquetas</Button></div>}
  </div>
}
