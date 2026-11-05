import { useEffect, useRef, useState } from 'react'
import type { AccountUser, VideoCallStatus } from '@messages/contracts'
import { Link } from 'react-router-dom'
import { Mic, MicOff, PhoneOff, Video, VideoOff, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { accountError, accountRequest } from '@/features/account/api/account-api'
import { VideoCallClient } from '../lib/video-call-client'
import type { CallView } from '../lib/video-call-client'
import '../video-call.css'

const empty: CallView = { local: null, peers: [] }
function CallVideo({ stream, name, local = false, state }: { stream: MediaStream; name: string; local?: boolean; state?: RTCPeerConnectionState }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [blocked, setBlocked] = useState(false)
  useEffect(() => {
    const video = ref.current
    if (!video) return
    let active = true
    video.srcObject = stream
    void video.play().catch(() => { if (active) setBlocked(true) })
    return () => { active = false; video.srcObject = null }
  }, [stream])
  const problem = state === 'failed' || state === 'closed'
  return <figure className="call-participant">
    <video ref={ref} autoPlay playsInline muted={local} aria-label={local ? 'Tu cámara' : 'Vídeo de ' + name} />
    <figcaption><span>{name}{local ? ' · Tú' : ''}</span><span role="status">{problem ? 'No conecta; sal y vuelve a entrar' : state === 'connected' ? 'Conectado' : local ? 'Tu vista previa' : 'Conectando…'}</span></figcaption>
    {blocked && <Button type="button" variant="secondary" className="h-11" onClick={() => { void ref.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true)) }}>Reproducir vídeo y audio</Button>}
  </figure>
}
export function GlobalVideoCall({ user }: { user: AccountUser | null }) {
  const [status, setStatus] = useState<VideoCallStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [joining, setJoining] = useState(false)
  const [view, setView] = useState<CallView>(empty)
  const [error, setError] = useState<string | null>(null)
  const [audio, setAudio] = useState(true)
  const [video, setVideo] = useState(true)
  const client = useRef<VideoCallClient | null>(null)
  const mounted = useRef(false)
  const userId = user?.id
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
        const result = await accountRequest<VideoCallStatus>('video-call', 'GET', undefined, abort.signal)
        if (!abort.signal.aborted) { setStatus(result); setStatusError(null) }
      } catch (cause) { if (!abort.signal.aborted) setStatusError(accountError(cause)) }
      if (!abort.signal.aborted) timer = setTimeout(() => void refresh(), 10000)
    }
    void refresh()
    return () => { abort.abort(); clearTimeout(timer) }
  }, [userId])
  function join() {
    if (client.current || !user || !status?.enabled) return
    setJoining(true); setError(null); setAudio(true); setVideo(true)
    const instance = new VideoCallClient(next => {
      if (mounted.current) { setView(next); setJoining(false) }
    }, message => {
      if (client.current === instance) client.current = null
      if (mounted.current) { setView(empty); setJoining(false); setError(message) }
    })
    client.current = instance
    void instance.start()
  }
  const active = Boolean(view.local)
  return <section className="global-call" aria-label="Videollamada del chat global">
    <div className="call-bar"><div><h2>Videollamada</h2><p>{user ? statusError ?? (status ? (status.enabled ? status.participants + ' de ' + status.capacity + ' personas' : 'No disponible en este entorno') : 'Consultando disponibilidad…') : 'Conversa también con cámara.'}</p></div>
      {user ? <Button type="button" variant="secondary" className="h-11" aria-expanded={open} aria-controls="global-call-panel" onClick={() => setOpen(true)}><Video aria-hidden="true" />{active ? 'En la llamada' : status && status.participants > 0 ? 'Unirse a la llamada' : 'Iniciar videollamada'}</Button>
        : <Button asChild variant="secondary" className="h-11"><Link to="/login?next=%2Fchat"><Video aria-hidden="true" />Entrar para llamar</Link></Button>}
    </div>
    {open && user && <div id="global-call-panel" className="call-panel">
      <div className="call-panel-heading"><h3>Nos vemos en el chat global</h3><Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label="Cerrar videollamada" onClick={() => { client.current?.stop(); setOpen(false) }}><X aria-hidden="true" /></Button></div>
      {error && <p className="call-error" role="alert">{error}</p>}
      {!active && <><p>Cualquier cuenta verificada puede unirse. Al entrar compartirás cámara y micrófono con hasta otras tres personas. Foris no graba la llamada.</p>
        {status && !status.relay && <p className="call-help">La conexión directa puede revelar tu dirección IP a los participantes.</p>}
        <Button type="button" className="h-11" disabled={joining || !status?.enabled || Boolean(statusError)} onClick={join}>{joining ? 'Preparando cámara y micrófono…' : 'Entrar con cámara y micrófono'}</Button>
        {joining && <Button type="button" variant="ghost" className="h-11" onClick={() => client.current?.stop()}>Cancelar</Button>}</>}
      {active && <><div className="call-videos"><CallVideo stream={view.local!} name={user.displayName} local />{view.peers.map(peer => <CallVideo key={peer.id} stream={peer.stream} name={peer.displayName} state={peer.state} />)}</div>
        {view.peers.length === 0 && <p className="call-help" role="status">Estás en la llamada. Esperando a que alguien se una.</p>}
        <div className="call-controls"><Button type="button" variant="secondary" className="h-11" aria-pressed={!audio} onClick={() => { client.current?.setAudio(!audio); setAudio(!audio) }}>{audio ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />}{audio ? 'Silenciar' : 'Activar micrófono'}</Button>
          <Button type="button" variant="secondary" className="h-11" aria-pressed={!video} onClick={() => { client.current?.setVideo(!video); setVideo(!video) }}>{video ? <Video aria-hidden="true" /> : <VideoOff aria-hidden="true" />}{video ? 'Apagar cámara' : 'Activar cámara'}</Button>
          <Button type="button" variant="destructive" className="h-11" onClick={() => client.current?.stop()}><PhoneOff aria-hidden="true" />Salir de la llamada</Button></div>
        <p className="call-help">Puedes participar hasta treinta minutos. Al salir se cierran tu cámara y tu micrófono.</p></>}
    </div>}
  </section>
}
