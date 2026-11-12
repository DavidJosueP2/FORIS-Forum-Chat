import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ForumVotes } from '@messages/contracts'
import { ArrowDown, ArrowUp, Check, Mail, MessageCircle, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SocialFeedback } from '@/components/ui/social-feedback'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { accountError, accountRequest } from '@/features/account/api/account-api'

export interface Participation { userId: string | null; href: string | null; pending: boolean }
export function VoteButtons({ votes, path, participation, onChange, disabled = false, onBusyChange }: { votes: ForumVotes; path: string; participation: Participation; onChange: (votes: ForumVotes) => void; disabled?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false)
  const [pulse, setPulse] = useState({ up: 0, down: 0 })
  const [error, setError] = useState<string | null>(null)
  const guard = useRef(false)
  const alive = useRef(true)
  const navigate = useNavigate()
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  async function vote(value: -1 | 1) {
    if (guard.current) return
    if (participation.href) { navigate(participation.href); return }
    guard.current = true; setBusy(true); onBusyChange?.(true); setError(null)
    try {
      const saved = await accountRequest<ForumVotes>(path + '/vote', 'PUT', { value: votes.value === value ? 0 : value })
      if (alive.current) {
        setPulse(current => value === 1 ? { ...current, up: current.up + 1 } : { ...current, down: current.down + 1 })
        onChange(saved)
      }
    } catch (cause) { if (alive.current) setError(accountError(cause)) }
    finally { guard.current = false; if (alive.current) { setBusy(false); onBusyChange?.(false) } }
  }
  return <span className="reading-vote-wrap"><span className="reading-votes" role="group" aria-label="Votos" aria-busy={busy}>
    <Button type="button" variant="ghost" className="reading-icon social-action" aria-label={votes.value === 1 ? 'Quitar voto positivo' : 'Votar positivo'} aria-pressed={votes.value === 1} disabled={disabled || busy || participation.pending} onClick={() => void vote(1)}><SocialFeedback pulse={pulse.up}><ArrowUp /></SocialFeedback></Button>
    <span className="reading-score" role="status"><span className="sr-only">Puntuación: </span>{votes.score}</span>
    <Button type="button" variant="ghost" className="reading-icon social-action" aria-label={votes.value === -1 ? 'Quitar voto negativo' : 'Votar negativo'} aria-pressed={votes.value === -1} disabled={disabled || busy || participation.pending} onClick={() => void vote(-1)}><SocialFeedback pulse={pulse.down}><ArrowDown /></SocialFeedback></Button>
  </span>{error && <span className="reading-action-error forum-error" role="alert">{error}</span>}</span>
}

export function ShareLink({ path, title, compact = false, className, fallback = 'copy' }: {
  path: string; title: string; compact?: boolean; className?: string; fallback?: 'copy' | 'channels';
}) {
  const [copied, setCopied] = useState(false)
  const [pulse, setPulse] = useState(0)
  const [manual, setManual] = useState(false)
  const [busy, setBusy] = useState(false)
  const guard = useRef(false)
  const alive = useRef(true)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()
  const url = new URL(path, window.location.origin).href
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  async function share() {
    if (guard.current) return
    if (!navigator.share && fallback === 'channels') { setManual(true); return }
    guard.current = true; setBusy(true)
    try {
      if (navigator.share) await navigator.share({ title, url })
      else {
        if (!navigator.clipboard?.writeText) throw new Error('Manual copy required')
        await navigator.clipboard.writeText(url)
        if (alive.current) setCopied(true)
      }
      if (alive.current) setPulse(current => current + 1)
    } catch (cause) { if (alive.current && !(cause instanceof DOMException && cause.name === 'AbortError')) setManual(true) }
    finally { guard.current = false; if (alive.current) setBusy(false) }
  }
  return <Popover open={manual} onOpenChange={setManual}><PopoverAnchor asChild><Button ref={button} type="button" variant="ghost" className={'social-action ' + (className ?? (compact ? 'reading-icon' : 'reading-action'))} disabled={busy} aria-haspopup="dialog" aria-expanded={manual} aria-label={copied ? 'Enlace copiado' : 'Compartir'} title={copied ? 'Enlace copiado' : 'Compartir'} onClick={() => void share()}><SocialFeedback pulse={pulse}>{copied ? <Check /> : <Share2 />}</SocialFeedback>{!compact && <span>{copied ? 'Copiado' : 'Compartir'}</span>}</Button></PopoverAnchor>
    <PopoverContent className={fallback === 'channels' ? 'w-56 gap-1' : 'reading-share-panel'} aria-label="Opciones para compartir" align="end" onCloseAutoFocus={event => { event.preventDefault(); button.current?.focus() }}>
      {fallback === 'channels' ? <>
        <Button asChild variant="ghost" className="h-11 justify-start"><a href={'https://wa.me/?text=' + encodeURIComponent(title + '\n' + url)} target="_blank" rel="noopener noreferrer" onClick={() => setManual(false)}><MessageCircle aria-hidden="true" />WhatsApp</a></Button>
        <Button asChild variant="ghost" className="h-11 justify-start"><a href={'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(url)} onClick={() => setManual(false)}><Mail aria-hidden="true" />Correo electrónico</a></Button>
      </> : <><label htmlFor={id}>Copiar enlace</label><input id={id} readOnly value={url} onFocus={event => event.currentTarget.select()} /></>}
    </PopoverContent>
  </Popover>
}
