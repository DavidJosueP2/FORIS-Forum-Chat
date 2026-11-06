import { useEffect, useState } from 'react'
import type { Community, ForumCategory, ForumTag } from '@messages/contracts'
import { Check, ChevronRight, FolderTree, Globe2, LockKeyhole, Search, Tags, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useForumPage, useResource } from '../hooks/use-forum'

const searchable = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
function CategorySelection({ value, items, loading, error, retry, onChange, disabled }: {
  value: string | null; items: ForumCategory[]; loading: boolean; error: string | null; retry: () => void; onChange: (value: string | null) => void; disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [branch, setBranch] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const selected = items.find(item => item.id === value)
  const parent = items.find(item => item.id === branch)
  const visible = search.trim() ? items.filter(item => searchable(item.name).includes(searchable(search.trim()))) : items.filter(item => item.parentId === branch).sort((a, b) => a.position - b.position)
  function choose(id: string | null) { if (!disabled) onChange(id); setOpen(false) }
  return <Popover open={open && !disabled} onOpenChange={next => { setOpen(next && !disabled); if (next) { setBranch(selected?.parentId ?? null); setSearch('') } }}>
    <PopoverTrigger asChild><Button type="button" variant="secondary" className="canvas-setting"><FolderTree aria-hidden="true" />{selected?.name ?? 'Temática'}</Button></PopoverTrigger>
    <PopoverContent className="canvas-popover canvas-taxonomy" align="start" aria-label="Seleccionar temática"><label className="canvas-search"><Search aria-hidden="true" /><input type="search" aria-label="Buscar una temática" placeholder="Buscar una temática" value={search} onChange={event => setSearch(event.target.value)} /></label>
      {!search && <nav className="canvas-breadcrumbs" aria-label="Niveles de temáticas"><button type="button" onClick={() => setBranch(null)}>Todas</button>{parent?.path.map(id => { const item = items.find(entry => entry.id === id); return <span key={id}><ChevronRight aria-hidden="true" /><button type="button" onClick={() => setBranch(id)} aria-current={branch === id ? 'location' : undefined}>{item?.name}</button></span> })}</nav>}
      <div className="canvas-choice-list">{loading ? <p role="status">Cargando temáticas…</p> : error ? <><p className="forum-error" role="alert">{error}</p><Button type="button" variant="ghost" onClick={retry}>Reintentar</Button></> : visible.length ? visible.slice(0, 30).map(item => <div className="canvas-category-row" key={item.id}><button type="button" onClick={() => choose(item.id)} aria-pressed={value === item.id}><span>{item.name}{search && <small>{item.path.slice(0, -1).map(id => items.find(entry => entry.id === id)?.name).join(' / ')}</small>}</span>{value === item.id && <Check aria-hidden="true" />}</button>{items.some(child => child.parentId === item.id) && <button type="button" aria-label={'Explorar subtemáticas de ' + item.name} title={'Explorar ' + item.name} onClick={() => { setBranch(item.id); setSearch('') }}><ChevronRight aria-hidden="true" /></button>}</div>) : <p>No encontramos esa temática. Prueba con otro nombre.</p>}</div>
      {visible.length > 30 && <p className="forum-hint">Afina la búsqueda para ver las demás coincidencias.</p>}
      <Button type="button" variant="ghost" className="h-11" onClick={() => choose(null)}>Dejar sin temática</Button>
    </PopoverContent>
  </Popover>
}
function TagSuggestions({ search, selected, onChoose }: { search: string; selected: string[]; onChoose: (name: string) => void }) {
  const [query, setQuery] = useState(search)
  useEffect(() => { const timer = setTimeout(() => setQuery(search), 250); return () => clearTimeout(timer) }, [search])
  const suggestions = useResource<ForumTag[]>('taxonomy/tags?search=' + encodeURIComponent(query.trim()))
  return <div className="canvas-choice-list" aria-label="Sugerencias de etiquetas">{suggestions.loading && <p role="status">Buscando etiquetas…</p>}{suggestions.error && <><p className="forum-error" role="alert">{suggestions.error}</p><Button type="button" variant="ghost" onClick={suggestions.retry}>Volver a buscar</Button></>}{suggestions.data?.filter(item => !selected.includes(item.name)).map(item => <button type="button" key={item.id} onClick={() => onChoose(item.name)}>{item.name}</button>)}</div>
}
function TagSelection({ value, onChange, disabled }: { value: string[]; onChange: (value: string[]) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  function add(raw: string) {
    if (disabled) return
    const name = raw.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase().normalize('NFC')
    if (!name || name.length > 32 || /[\p{Cc}\p{Cf}]/u.test(raw) || !/^[\p{L}\p{N}][\p{L}\p{N}\p{M} .+#-]*$/u.test(name)) { setError('Usa una etiqueta de hasta 32 caracteres, sin símbolos de marcado.'); return }
    if (value.includes(name)) { setSearch(''); setError(''); return }
    if (value.length >= 8) { setError('Ya elegiste ocho etiquetas. Quita una para añadir otra.'); return }
    onChange([...value, name]); setSearch(''); setError('')
  }
  return <><Popover open={open && !disabled} onOpenChange={next => setOpen(next && !disabled)}><PopoverTrigger asChild><Button type="button" variant="secondary" className="canvas-setting"><Tags aria-hidden="true" />Añadir etiquetas</Button></PopoverTrigger><PopoverContent className="canvas-popover" align="start"><label htmlFor="canvas-tags">Etiquetas de tu publicación</label><input id="canvas-tags" value={search} placeholder="Busca o escribe una etiqueta" onChange={event => { setSearch(event.target.value); setError('') }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add(search) } }} />{search.trim() && <Button type="button" variant="ghost" className="canvas-new-tag" onClick={() => add(search)}>Usar «{search.trim()}»</Button>}{error && <p className="forum-error" role="alert">{error}</p>}<TagSuggestions search={search} selected={value} onChoose={add} /></PopoverContent></Popover>
    {value.map(tag => <span className="canvas-tag" key={tag}>{tag}<button type="button" aria-label={'Quitar etiqueta ' + tag} title={'Quitar ' + tag} onClick={() => { if (!disabled) onChange(value.filter(item => item !== tag)) }}><X aria-hidden="true" /></button></span>)}</>
}
function CommunityName({ id }: { id: string }) {
  const community = useResource<Community>('communities/' + id)
  return <>{community.data?.visibility === 'private' ? <LockKeyhole aria-hidden="true" /> : <Users aria-hidden="true" />}{community.data?.name ?? 'Comunidad seleccionada'}</>
}
function CommunityOptions({ search, selected, onChange }: { search: string; selected: string | null; onChange: (id: string | null) => void }) {
  const page = useForumPage<Community>('communities?scope=mine&search=' + encodeURIComponent(search))
  return <div className="canvas-choice-list"><button type="button" onClick={() => onChange(null)} aria-pressed={selected === null}><Globe2 aria-hidden="true" /><span>Sin comunidad<small>Publicación pública en Foris</small></span>{!selected && <Check aria-hidden="true" />}</button>
    {page.loading && <p role="status">Buscando tus comunidades…</p>}{page.error && <><p className="forum-error" role="alert">{page.error}</p><Button type="button" variant="ghost" onClick={page.retry}>Reintentar</Button></>}
    {page.items.map(item => <button type="button" key={item.id} aria-pressed={selected === item.id} onClick={() => onChange(item.id)}>{item.visibility === 'private' ? <LockKeyhole aria-hidden="true" /> : <Users aria-hidden="true" />}<span>{item.name}<small>{item.visibility === 'private' ? 'Solo miembros' : 'Comunidad pública'}</small></span>{selected === item.id && <Check aria-hidden="true" />}</button>)}
    {!page.loading && !page.error && !page.items.length && <p>{search ? 'No encontramos una comunidad con ese nombre.' : 'Aquí aparecerán las comunidades de las que formes parte.'}</p>}
    {page.moreError && <p className="forum-error" role="alert">{page.moreError}</p>}{page.hasMore && <Button type="button" variant="ghost" disabled={page.loadingMore} onClick={() => void page.loadMore()}>{page.loadingMore ? 'Cargando…' : 'Ver más comunidades'}</Button>}
  </div>
}
function CommunitySelection({ value, onChange, disabled }: { value: string | null; onChange: (value: string | null) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 250); return () => clearTimeout(timer) }, [search])
  return <Popover open={open && !disabled} onOpenChange={next => setOpen(next && !disabled)}><PopoverTrigger asChild><Button type="button" variant="secondary" className="canvas-setting">{value ? <CommunityName key={value} id={value} /> : <><Users aria-hidden="true" />Seleccionar comunidad</>}</Button></PopoverTrigger><PopoverContent className="canvas-popover" align="start"><label className="canvas-search"><Search aria-hidden="true" /><input type="search" placeholder="Buscar en mis comunidades" aria-label="Buscar en mis comunidades" value={search} onChange={event => setSearch(event.target.value)} /></label><CommunityOptions key={query} search={query} selected={value} onChange={id => { if (!disabled) onChange(id); setOpen(false) }} /></PopoverContent></Popover>
}
export function PublicationSettings({ categoryId, categories, communityId, tags, disabled, communityLocked = false, onCategory, onCommunity, onTags }: {
  categoryId: string | null; categories: ReturnType<typeof useResource<ForumCategory[]>>; communityId: string | null; tags: string[]; disabled: boolean;
  onCategory: (value: string | null) => void; onCommunity: (value: string | null) => void; onTags: (value: string[]) => void
  communityLocked?: boolean
}) {
  return <fieldset className="canvas-settings" disabled={disabled}><legend className="sr-only">Dónde y cómo compartir tu publicación</legend>{communityLocked ? <span className="canvas-fixed-community" title="La comunidad se conserva después de publicar">{communityId ? <CommunityName key={communityId} id={communityId} /> : <><Globe2 aria-hidden="true" />Sin comunidad</>}</span> : <CommunitySelection value={communityId} onChange={onCommunity} disabled={disabled} />}<CategorySelection value={categoryId} items={categories.data ?? []} loading={categories.loading} error={categories.error} retry={categories.retry} onChange={onCategory} disabled={disabled} /><TagSelection value={tags} onChange={onTags} disabled={disabled} /></fieldset>
}
