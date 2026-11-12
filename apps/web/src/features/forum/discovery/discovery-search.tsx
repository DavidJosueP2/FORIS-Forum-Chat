import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { SearchResult } from '@messages/contracts'
import { ArrowRight, LoaderCircle, MessageSquare, Search, UserRound, UsersRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { publicProfileLink } from '@/features/account/lib/public-profile'
import { useResource } from '../hooks/use-forum'
import { normalizeSearch, searchIssue } from './discovery-query'

const resultTypes = {
  user: { label: 'Usuario', icon: UserRound, href: publicProfileLink },
  community: { label: 'Comunidad', icon: UsersRound, href: (id: string) => '/comunidades/' + id },
  post: { label: 'Foro', icon: MessageSquare, href: (id: string) => '/publicaciones/' + id },
} satisfies Record<SearchResult['kind'], { label: string; icon: typeof Search; href: (id: string) => string }>

export function DiscoverySearch({ applied, onSearch, resourceScope }: { applied: string; onSearch: (value: string) => void; resourceScope: string }) {
  const [input, setInput] = useState({ applied, value: applied })
  const [open, setOpen] = useState(false)
  const [composing, setComposing] = useState(false)
  const [active, setActive] = useState(-1)
  const [debounced, setDebounced] = useState('')
  const id = useId()
  const listId = id + '-results'
  const field = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  if (input.applied !== applied) setInput({ applied, value: applied })
  const { value } = input
  const setValue = (next: string) => setInput({ applied, value: next })
  const issue = searchIssue(value)
  const term = normalizeSearch(value)
  const expanded = open && !composing && !issue && Array.from(term).length >= 2
  useEffect(() => {
    if (!expanded) return
    const timer = setTimeout(() => setDebounced(term), 250)
    return () => clearTimeout(timer)
  }, [expanded, term])
  const matches = useResource<{ results: SearchResult[] }>(expanded && term === debounced ? 'search?q=' + encodeURIComponent(term) : null, resourceScope)
  const results = matches.data?.results ?? []
  const selected = results[active]
  const pending = expanded && (term !== debounced || matches.loading)
  const status = pending ? 'Buscando…' : matches.error ? 'No pudimos cargar las sugerencias.' : results.length ? '' : 'Sin coincidencias.'

  function close() { setOpen(false); setActive(-1) }
  function submit() {
    if (issue || composing) return
    close()
    if (selected) navigate(resultTypes[selected.kind].href(selected.id))
    else onSearch(term)
  }

  return <form className="discovery-search" role="search" data-discovery-control onSubmit={event => { event.preventDefault(); submit() }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close() }}>
    <div className="discovery-search-field"><Search aria-hidden="true" /><label className="sr-only" htmlFor={id}>Buscar usuarios, comunidades y publicaciones</label>
      <input ref={field} id={id} type="search" role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined} aria-activedescendant={expanded && selected ? listId + '-' + active : undefined}
        value={value} placeholder="Buscar en Foris" aria-invalid={Boolean(issue)} aria-describedby={issue ? id + '-error' : undefined}
        onFocus={() => setOpen(true)} onChange={event => { setValue(event.target.value); setOpen(true); setActive(-1) }}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={event => { setValue(event.currentTarget.value); setComposing(false); setActive(-1) }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return
          if (event.key === 'Escape' && open) { event.preventDefault(); close() }
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
          if (!open) { event.preventDefault(); setOpen(true); return }
          if (!results.length) return
          event.preventDefault()
          const next = event.key === 'ArrowDown' ? (active + 1) % results.length : active <= 0 ? results.length - 1 : active - 1
          setActive(next)
          document.getElementById(listId + '-' + next)?.scrollIntoView({ block: 'nearest' })
        }} />
      {value && <Button type="button" variant="ghost" size="icon" className="discovery-search-clear" aria-label="Limpiar búsqueda" title="Limpiar búsqueda"
        onClick={() => { setValue(''); setActive(-1); if (applied) onSearch(''); field.current?.focus() }}><X aria-hidden="true" /></Button>}
    </div>
    {issue && <p id={id + '-error'} className="discovery-search-error" role="alert">{issue}</p>}
    {expanded && <div className="discovery-search-panel">
      {status && <p className="discovery-search-status" role="status">{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}{status}</p>}
      <ul id={listId} role="listbox" aria-label="Coincidencias en Foris" className="discovery-search-results">
        {results.map((item, index) => {
          const type = resultTypes[item.kind]
          return <li key={item.kind + ':' + item.id} role="presentation">
            <Link id={listId + '-' + index} role="option" aria-selected={active === index} tabIndex={-1} className="discovery-search-result"
              to={type.href(item.id)} onMouseDown={event => { if (event.button === 0) event.preventDefault() }} onClick={close}>
              <type.icon aria-hidden="true" /><span>{item.title}</span><small>{type.label}</small>
            </Link>
          </li>
        })}
      </ul>
      <button className="discovery-search-all" type="button" onClick={() => { close(); onSearch(term) }}>Buscar en Foros<ArrowRight aria-hidden="true" /></button>
    </div>}
  </form>
}
