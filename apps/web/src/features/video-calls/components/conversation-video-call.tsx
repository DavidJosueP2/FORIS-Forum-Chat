import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AccountUser, VideoCallStatus } from '@messages/contracts'
import { Link } from 'react-router-dom'
import { Maximize2, Mic, MicOff, Minimize2, PhoneOff, Video, VideoOff, Volume2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { accountError, accountRequest } from '@/features/account/api/account-api'
import { VideoCallClient } from '../lib/video-call-client'
import type { CallView } from '../lib/video-call-client'
import { CallVideo, RemoteCallAudio } from './call-media'
import '../video-call.css'

const empty: CallView = { local: null, peers: [] }
export function ConversationVideoCall({ user, triggerContainer, room, title = 'Chat global' }: {
  user: AccountUser | null; triggerContainer: HTMLElement | null; room?: string; title?: string
}) {
  const [status, setStatus] = useState<VideoCallStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [joining, setJoining] = useState(false)
  const [view, setView] = useState<CallView>(empty)
  const [error, setError] = useState<string | null>(null)
  const [audio, setAudio] = useState(true)
  const [video, setVideo] = useState(true)
  const [blockedAudio, setBlockedAudio] = useState<Set<string>>(() => new Set())
  const audioElements = useRef<Map<string, HTMLAudioElement>>(new Map())
  const client = useRef<VideoCallClient | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const mounted = useRef(false)
  const userId = user?.id
  const capacity = status?.capacity ?? (room?.startsWith('direct:') ? 2 : 4)
  const registerAudio = useCallback((id: string, element: HTMLAudioElement | null) => {
    if (element) audioElements.current.set(id, element)
    else audioElements.current.delete(id)
  }, [])
  const onAudioBlocked = useCallback((id: string, blocked: boolean) => {
    if (!mounted.current) return
    setBlockedAudio(current => {
      if (current.has(id) === blocked) return current
      const next = new Set(current)
      if (blocked) next.add(id); else next.delete(id)
      return next
    })
  }, [])
  useEffect(() => {
    mounted.current = true
    const stop = () => client.current?.stop()
    window.addEventListener('pagehide', stop)
    window.addEventListener('offline', stop)
    return () => { mounted.current = false; stop(); window.removeEventListener('pagehide', stop); window.removeEventListener('offline', stop) }
  }, [])
  useEffect(() => {
    if (!userId) return
    const abort = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    async function refresh() {
      try {
        const result = await accountRequest<VideoCallStatus>('video-call' + (room ? '?room=' + encodeURIComponent(room) : ''), 'GET', undefined, abort.signal)
        if (!abort.signal.aborted) { setStatus(result); setStatusError(null) }
      } catch (cause) { if (!abort.signal.aborted) setStatusError(accountError(cause)) }
      if (!abort.signal.aborted) timer = setTimeout(() => void refresh(), 10000)
    }
    void refresh()
    return () => { abort.abort(); clearTimeout(timer) }
  }, [userId, room])
  function join() {
    if (client.current || !user || !status?.enabled) return
    setOpen(true); setJoining(true); setError(null); setAudio(true); setVideo(true)
    const instance = new VideoCallClient(next => {
      if (mounted.current) { setView(next); setJoining(false) }
    }, message => {
      if (client.current === instance) client.current = null
      if (mounted.current) { setView(empty); setJoining(false); setError(message); if (message) setOpen(true) }
    }, room)
    client.current = instance
    void instance.start()
  }
  const active = Boolean(view.local)
  const triggerLabel = active ? 'Volver a la videollamada' : status?.participants ? 'Unirse a la videollamada' : 'Abrir videollamada'
  const needsAudioPlayback = view.peers.some(peer => blockedAudio.has(peer.id))
  function changeOpen(next: boolean) {
    if (!next && !active) client.current?.stop()
    setOpen(next)
  }
  function leave() { client.current?.stop(); setOpen(false) }
  function resumeAudio() {
    for (const [id, element] of audioElements.current) void element.play().catch(() => onAudioBlocked(id, true))
  }
  const trigger = user
    ? <Button ref={triggerRef} type="button" variant={active || status?.participants ? 'secondary' : 'ghost'} className="call-entry h-11 px-3" aria-label={triggerLabel} title={triggerLabel} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? 'conversation-call-panel' : undefined} onClick={() => setOpen(true)}><Video aria-hidden="true" /><span className="call-entry-label">{active ? 'En llamada' : status?.participants ? 'Unirse a llamada' : 'Videollamada'}</span></Button>
    : <Button asChild variant="ghost" className="call-entry h-11 px-3"><Link to="/login?next=%2Fchat" aria-label="Iniciar sesión para una videollamada" title="Iniciar sesión para una videollamada"><Video aria-hidden="true" /><span className="call-entry-label">Videollamada</span></Link></Button>
  return <>
    {triggerContainer && createPortal(trigger, triggerContainer)}
    {active && !open && <section className="call-return-bar" aria-label="Videollamada en curso">
      <div><p><Video aria-hidden="true" />Sigues en la llamada</p><span>{title} · {view.peers.length + 1} de {capacity} personas</span></div>
      <div className="call-return-actions">
        {needsAudioPlayback && <Button type="button" variant="secondary" className="h-11" onClick={resumeAudio}><Volume2 aria-hidden="true" />Activar audio</Button>}
        <Button type="button" variant="secondary" className="h-11" onClick={() => setOpen(true)}><Maximize2 aria-hidden="true" />Volver a la llamada</Button>
        <Button type="button" variant="destructive" size="icon" className="h-11 w-11" aria-label="Salir de la llamada" title="Salir de la llamada" onClick={leave}><PhoneOff aria-hidden="true" /></Button>
      </div>
    </section>}
    {view.peers.map(peer => <RemoteCallAudio key={peer.id} id={peer.id} stream={peer.stream} register={registerAudio} onBlocked={onAudioBlocked} />)}
    {user && <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent id="conversation-call-panel" layout="fullscreen" className="call-stage" showCloseButton={false}
        onCloseAutoFocus={event => { event.preventDefault(); triggerRef.current?.focus() }}>
        <header className="call-stage-header">
          <div><DialogTitle className="call-stage-title">{title}</DialogTitle><DialogDescription>{active ? `Videollamada · ${view.peers.length + 1} de ${capacity} personas` : 'Videollamada'}</DialogDescription></div>
          <Button type="button" variant="secondary" className="h-11" onClick={() => changeOpen(false)}>
            {active ? <Minimize2 aria-hidden="true" /> : <X aria-hidden="true" />}{active ? 'Minimizar' : 'Cerrar'}
          </Button>
        </header>
        <div className="call-stage-body">
          {error && <p className="call-error" role="alert">{error}</p>}
          {!active && <div className="call-welcome">
            <h2>{status?.participants ? 'Hay una llamada en curso' : 'Entrar a la videollamada'}</h2>
            <p>{room ? 'Solo pueden entrar quienes tienen acceso a este chat.' : 'Cualquier cuenta verificada puede unirse.'} Al entrar compartirás cámara y micrófono. Foris no graba la llamada.</p>
            <p id="call-availability" className="call-help" role="status">{statusError ?? (status ? (status.enabled ? status.participants + ' de ' + status.capacity + ' personas en la sala' : 'Las videollamadas todavía no están habilitadas. Puedes seguir conversando en el chat.') : 'Consultando disponibilidad…')}</p>
            {status?.enabled && !status.relay && <p className="call-help">La conexión directa puede revelar tu dirección IP a los participantes.</p>}
            <div className="call-controls"><Button type="button" className="h-11" aria-describedby="call-availability" disabled={joining || !status?.enabled || Boolean(statusError)} onClick={join}>{joining ? 'Preparando cámara y micrófono…' : 'Entrar con cámara y micrófono'}</Button>
              {joining && <Button type="button" variant="ghost" className="h-11" onClick={() => client.current?.stop()}>Cancelar</Button>}</div>
          </div>}
          {active && <><div className="call-videos" data-count={view.peers.length + 1}><CallVideo stream={view.local!} name={user.displayName} local />{view.peers.map(peer => <CallVideo key={peer.id} stream={peer.stream} name={peer.displayName} state={peer.state} />)}</div>
            {view.peers.length === 0 && <p className="call-help" role="status">Estás en la llamada. Esperando a que alguien se una.</p>}</>}
        </div>
        <footer className="call-stage-footer">
          {active && <div className="call-controls"><Button type="button" variant="secondary" className="h-11" aria-pressed={!audio} onClick={() => { client.current?.setAudio(!audio); setAudio(!audio) }}>{audio ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />}{audio ? 'Silenciar' : 'Activar micrófono'}</Button>
            <Button type="button" variant="secondary" className="h-11" aria-pressed={!video} onClick={() => { client.current?.setVideo(!video); setVideo(!video) }}>{video ? <Video aria-hidden="true" /> : <VideoOff aria-hidden="true" />}{video ? 'Apagar cámara' : 'Activar cámara'}</Button>
            {needsAudioPlayback && <Button type="button" variant="secondary" className="h-11" onClick={resumeAudio}><Volume2 aria-hidden="true" />Activar audio</Button>}
            <Button type="button" variant="destructive" className="h-11" onClick={leave}><PhoneOff aria-hidden="true" />Salir de la llamada</Button></div>}
          <p className="call-help">{active ? 'Minimiza para seguir en el chat sin desconectarte. Máximo treinta minutos por participación.' : 'La cámara y el micrófono se activan únicamente al entrar.'}</p>
        </footer>
      </DialogContent>
    </Dialog>}
  </>
}
