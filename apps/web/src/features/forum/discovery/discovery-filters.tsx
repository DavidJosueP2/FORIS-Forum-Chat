import { useEffect, useId, useState } from 'react'
import type { ForumCategory, ForumTag } from '@messages/contracts'
import { Check, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useResource } from '../hooks/use-forum'
import type { DiscoveryQuery } from './discovery-query'

export interface FilterResource<T> { data: T | null; loading: boolean; error: string | null; retry: () => void }
interface Props {
  query: DiscoveryQuery; categories: FilterResource<ForumCategory[]>; tags: FilterResource<ForumTag[]>; selectedTags: FilterResource<ForumTag[]>;
  onCategory: (id: string | null) => void; onTag: (id: string) => void; onClear: () => void; onSearchClear: () => void; onAuthorClear: () => void;
}
const searchable = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es')
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
  return <section className="discovery-filter-section" aria-labelledby={id + '-heading'}><h3 id={id + '-heading'}>Temáticas</h3>
    <label className="discovery-filter-search"><Search aria-hidden="true" /><input type="search" aria-label="Buscar temáticas" placeholder="Buscar temática" value={search} onChange={event => setSearch(event.target.value)} maxLength={80} /></label>
    <button type="button" className="discovery-filter-all" aria-pressed={!selected} onClick={() => { setBranch(null); setSearch(''); onCategory(null) }}>Todas las temáticas{!selected && <Check aria-hidden="true" />}</button>
    {parent && !search && <div className="discovery-filter-branch"><button type="button" className="discovery-branch-back" onClick={() => setBranch(parent.parentId)}><ChevronLeft aria-hidden="true" />{parent.parentId ? 'Volver un nivel' : 'Ver temáticas'}</button><span>{parent.name}</span></div>}
    {categories.loading ? <p className="forum-hint" role="status">Cargando temáticas…</p> : categories.error ? <ResourceIssue resource={categories} /> : <div className="discovery-category-list">{visible.slice(0, 30).map(item => <div className="discovery-category-row" key={item.id}>
      <button type="button" className="discovery-category-select" aria-pressed={selected === item.id} onClick={() => onCategory(item.id)}><span>{item.name}{search && item.parentId && <small>{item.path.slice(0, -1).map(id => items.find(category => category.id === id)?.name).join(' / ')}</small>}</span>{selected === item.id && <Check aria-hidden="true" />}</button>
      {items.some(child => child.parentId === item.id) && <button type="button" className="discovery-category-expand" title={'Explorar ' + item.name} aria-label={'Explorar subtemáticas de ' + item.name} onClick={() => { setBranch(item.id); setSearch('') }}><ChevronRight aria-hidden="true" /></button>}
    </div>)}{!visible.length && <p className="forum-hint">No encontramos esa temática.</p>}{visible.length > 30 && <p className="forum-hint">Afina la búsqueda para ver más coincidencias.</p>}</div>}
    {selected && <p className="discovery-filter-note">Incluye las subtemáticas de tu selección.</p>}
  </section>
}
function TagFilter({ query, tags, selectedTags, onTag }: Pick<Props, 'query' | 'tags' | 'selectedTags' | 'onTag'>) {
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const id = useId()
  useEffect(() => { const timer = setTimeout(() => setSearch(draft.trim()), 300); return () => clearTimeout(timer) }, [draft])
  const searched = useResource<ForumTag[]>(search ? 'taxonomy/tags?limit=30&search=' + encodeURIComponent(search) : null)
  const resource = search ? searched : tags
  const choices = [...(selectedTags.data ?? []), ...(resource.data ?? [])].filter((item, index, all) => all.findIndex(other => other.id === item.id) === index)
  return <section className="discovery-filter-section" aria-labelledby={id + '-heading'}><h3 id={id + '-heading'}>Etiquetas</h3><label className="discovery-filter-search"><Search aria-hidden="true" /><input type="search" aria-label="Buscar etiquetas" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Buscar etiqueta" maxLength={64} /></label>
    {resource.loading && <p className="forum-hint" role="status">Cargando etiquetas…</p>}{resource.error && <ResourceIssue resource={resource} />}
    <div className="discovery-tag-options">{choices.map(tag => <button type="button" key={tag.id} aria-pressed={query.tags.includes(tag.id)} onClick={() => {
      if (!query.tags.includes(tag.id) && query.tags.length >= 8) { setError('Puedes combinar hasta ocho etiquetas. Quita una para elegir otra.'); return }
      setError(''); onTag(tag.id)
    }}>{query.tags.includes(tag.id) && <Check aria-hidden="true" />}{tag.name}</button>)}</div>
    {!resource.loading && !resource.error && !choices.length && <p className="forum-hint">{search ? 'No encontramos esa etiqueta.' : 'Las etiquetas aparecerán aquí cuando se usen en publicaciones.'}</p>}
    {error && <p className="forum-error" role="alert">{error}</p>}
    {query.tags.length > 0 && <p className="discovery-filter-note">Las publicaciones incluyen todas las etiquetas seleccionadas.</p>}
  </section>
}
function FilterPanel(props: Props) {
  return <div className="discovery-filter-panel" data-discovery-control><CategoryFilter {...props} /><TagFilter {...props} /></div>
}
export function DiscoveryFilters(props: Props) {
  return <aside className="discovery-sidebar" aria-label="Explorar y filtrar publicaciones"><div className="discovery-sidebar-inner"><h2>Explorar</h2><FilterPanel {...props} /></div></aside>
}
export function MobileDiscoveryFilters(props: Props) {
  const [open, setOpen] = useState(false)
  const [openedQuery, setOpenedQuery] = useState(props.query.path)
  const count = Number(Boolean(props.query.category || props.query.topic)) + props.query.tags.length
  return <Sheet open={open} onOpenChange={next => { if (next) setOpenedQuery(props.query.path); setOpen(next) }}><SheetTrigger asChild><Button type="button" variant="secondary" className="discovery-filter-trigger h-11"><SlidersHorizontal aria-hidden="true" />Filtrar{count > 0 && <span aria-label={count + ' filtros seleccionados'}>{count}</span>}</Button></SheetTrigger><SheetContent className="discovery-filter-sheet" side="right" onCloseAutoFocus={event => {
    if (openedQuery !== props.query.path) { event.preventDefault(); const results = document.getElementById('discovery-heading'); results?.focus({ preventScroll: true }); results?.scrollIntoView({ block: 'start' }) }
  }}><SheetHeader><SheetTitle>Filtrar publicaciones</SheetTitle><SheetDescription>Explora temáticas y combina etiquetas.</SheetDescription></SheetHeader><div className="discovery-filter-sheet-body"><FilterPanel {...props} /></div><SheetFooter><SheetClose asChild><Button type="button" className="h-11">Ver publicaciones</Button></SheetClose>{props.query.filtered && <Button type="button" variant="ghost" className="h-11" onClick={props.onClear}>Quitar filtros</Button>}</SheetFooter></SheetContent></Sheet>
}
export function ActiveDiscoveryFilters(props: Props) {
  const { query } = props
  if (!query.filtered) return null
  const category = props.categories.data?.find(item => item.id === query.category || (!query.category && !item.parentId && item.slug === query.topic))
  return <div className="discovery-active-filters" role="group" aria-label="Filtros activos" data-discovery-control>
    {query.search && <span className="discovery-active-filter">«{query.search}»<button type="button" aria-label="Quitar búsqueda" title="Quitar búsqueda" onClick={props.onSearchClear}><X aria-hidden="true" /></button></span>}
    {(query.category || query.topic) && <span className="discovery-active-filter">{category?.name ?? 'Temática seleccionada'}<button type="button" aria-label="Quitar filtro de temática" title="Quitar temática" onClick={() => props.onCategory(null)}><X aria-hidden="true" /></button></span>}
    {query.author && <span className="discovery-active-filter">De este perfil<button type="button" aria-label="Quitar filtro de autor" title="Quitar autor" onClick={props.onAuthorClear}><X aria-hidden="true" /></button></span>}
    {query.tags.map(id => <span className="discovery-active-filter discovery-active-tag" key={id}>{props.selectedTags.data?.find(tag => tag.id === id)?.name ?? (props.selectedTags.loading ? 'Cargando etiqueta…' : 'Etiqueta seleccionada')}<button type="button" aria-label={'Quitar etiqueta ' + (props.selectedTags.data?.find(tag => tag.id === id)?.name ?? 'seleccionada')} title="Quitar etiqueta" onClick={() => props.onTag(id)}><X aria-hidden="true" /></button></span>)}
    <Button type="button" variant="ghost" className="h-11" onClick={props.onClear}>Quitar filtros</Button>
    {props.selectedTags.error && <div className="discovery-selected-tags-error"><p className="forum-error" role="alert">No pudimos cargar los nombres de las etiquetas seleccionadas.</p><Button type="button" variant="ghost" className="h-11" onClick={props.selectedTags.retry}>Volver a cargar etiquetas</Button></div>}
  </div>
}
