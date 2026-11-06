import { useEffect, useId, useRef, useState } from 'react'
import { LoaderCircle, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { normalizeSearch, searchIssue } from './discovery-query'

/** Mantiene foco y texto al actualizar la URL; Atrás/Adelante siguen siendo una fuente externa válida. */
export function DiscoverySearch({ applied, onSearch }: { applied: string; onSearch: (value: string) => void }) {
  const [input, setInput] = useState({ value: applied, base: applied, requested: null as string | null, composing: false })
  const id = useId()
  const field = useRef<HTMLInputElement>(null)
  if (input.base !== applied) setInput({ ...input, base: applied, value: input.requested === applied ? input.value : applied, requested: null })
  const issue = searchIssue(input.value)
  const pending = !issue && normalizeSearch(input.value) !== applied
  useEffect(() => {
    if (input.composing || issue || !pending) return
    const value = normalizeSearch(input.value)
    const timer = setTimeout(() => {
      setInput(current => ({ ...current, requested: value }))
      onSearch(value)
    }, value ? 350 : 0)
    return () => clearTimeout(timer)
  }, [input.value, input.composing, issue, pending, onSearch])
  function clear() { setInput(current => ({ ...current, value: '', requested: '' })); onSearch(''); field.current?.focus() }
  return <form className="discovery-search" role="search" data-discovery-control onSubmit={event => {
    event.preventDefault()
    if (!issue && !input.composing) { const value = normalizeSearch(input.value); setInput(current => ({ ...current, requested: value })); onSearch(value) }
  }}>
    <div className="discovery-search-field"><Search aria-hidden="true" /><label className="sr-only" htmlFor={id}>Buscar publicaciones en Foris</label><input ref={field} id={id} type="search" autoComplete="off" value={input.value} placeholder="Buscar en Foris" aria-invalid={Boolean(issue)} aria-describedby={issue ? id + '-error' : undefined}
      onChange={event => setInput(current => ({ ...current, value: event.target.value }))}
      onCompositionStart={() => setInput(current => ({ ...current, composing: true }))}
      onCompositionEnd={event => { const value = event.currentTarget.value; setInput(current => ({ ...current, value, composing: false })) }} />
      {input.value && <Button type="button" variant="ghost" size="icon" className="discovery-search-clear" aria-label="Limpiar búsqueda" title="Limpiar búsqueda" onClick={clear}><X aria-hidden="true" /></Button>}
      {pending && <LoaderCircle className="discovery-search-pending animate-spin" aria-hidden="true" />}
    </div>
    {issue && <p id={id + '-error'} className="discovery-search-error" role="alert">{issue}</p>}
    <span className="sr-only" role="status">{pending ? 'Preparando búsqueda' : ''}</span>
  </form>
}
