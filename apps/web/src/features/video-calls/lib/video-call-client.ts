import type { VideoCallJoin, VideoCallPeer, VideoCallSync, VideoSignal } from '@messages/contracts'
import { AccountApiError, accountRequest } from '@/features/account/api/account-api'

export interface CallView { local: MediaStream | null; peers: { id: string; displayName: string; stream: MediaStream; state: RTCPeerConnectionState }[] }
interface Peer { profile: VideoCallPeer; connection: RTCPeerConnection; stream: MediaStream; queue: Promise<void> }

function waitForIce(connection: RTCPeerConnection, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new Error('Llamada cerrada.'))
  if (connection.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer)
      connection.removeEventListener('icegatheringstatechange', changed)
      signal.removeEventListener('abort', aborted)
      if (error) reject(error); else resolve()
    }
    const changed = () => { if (connection.iceGatheringState === 'complete') finish() }
    const aborted = () => finish(new Error('Llamada cerrada.'))
    const timer = setTimeout(() => finish(new Error('No pudimos preparar la conexión. Sal y vuelve a entrar.')), 15000)
    connection.addEventListener('icegatheringstatechange', changed)
    signal.addEventListener('abort', aborted, { once: true })
    changed()
  })
}
async function sendSignal(path: string, body: unknown, signal: AbortSignal) {
  try { await accountRequest(path, 'POST', body, signal) }
  catch (error) {
    if (signal.aborted || !(error instanceof AccountApiError) || ![0, 503].includes(error.status)) throw error
    // La misma solicitud permite recuperar una respuesta perdida sin duplicar señales.
    await accountRequest(path, 'POST', body, signal)
  }
}
function deviceError(error: unknown): string {
  if (error instanceof DOMException) {
    if (['NotAllowedError', 'SecurityError'].includes(error.name)) return 'Permite el acceso a cámara y micrófono en tu navegador para entrar.'
    if (error.name === 'NotFoundError') return 'No encontramos una cámara y un micrófono disponibles.'
    if (error.name === 'NotReadableError') return 'Otra aplicación está usando tu cámara o micrófono. Ciérrala y vuelve a intentar.'
  }
  return error instanceof AccountApiError ? error.message : 'No pudimos iniciar la videollamada. Revisa tus dispositivos y vuelve a intentar.'
}

/** Una instancia por participación: no guarda SDP, pistas ni credenciales en almacenamiento del navegador. */
export class VideoCallClient {
  private readonly abort = new AbortController()
  private readonly peers = new Map<string, Peer>()
  private local: MediaStream | null = null
  private member: VideoCallJoin | null = null
  private stopped = false
  private pollTimer: ReturnType<typeof setTimeout> | undefined
  private watchdog: ReturnType<typeof setTimeout> | undefined
  private duration: ReturnType<typeof setTimeout> | undefined
  private cursor = '0'
  private readonly changed: (view: CallView) => void;
  private readonly ended: (message: string | null) => void;
  private readonly joinPath: string

  constructor(
    changed: (view: CallView) => void,
    ended: (message: string | null) => void,
    room?: string,
  ) {
    this.changed = changed;
    this.ended = ended;
    this.joinPath = 'video-call/join' + (room ? '?room=' + encodeURIComponent(room) : '')
  }
  private publish() {
    if (!this.stopped) this.changed({ local: this.local, peers: [...this.peers.values()].map(peer => ({ ...peer.profile, stream: peer.stream, state: peer.connection.connectionState })) })
  }
  async start() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      this.stop('Tu navegador necesita HTTPS o localhost y soporte de cámara para hacer videollamadas.'); return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 30 } } })
      // getUserMedia no es cancelable: si la persona sale mientras responde al permiso, liberar igualmente.
      if (this.stopped) { stream.getTracks().forEach(track => track.stop()); return }
      this.local = stream
      stream.getTracks().forEach(track => track.addEventListener('ended', () => this.stop('La cámara o el micrófono se desconectó. Puedes volver a entrar.'), { once: true }))
      const requestId = crypto.randomUUID()
      try { this.member = await accountRequest<VideoCallJoin>(this.joinPath, 'POST', { requestId }, this.abort.signal) }
      catch (error) {
        if (this.abort.signal.aborted || !(error instanceof AccountApiError) || ![0, 503].includes(error.status)) throw error
        this.member = await accountRequest<VideoCallJoin>(this.joinPath, 'POST', { requestId }, this.abort.signal)
      }
      if (this.stopped) { this.leave(); return }
      this.duration = setTimeout(() => this.stop('Se cumplieron los treinta minutos de esta participación. Puedes volver a entrar.'), Math.max(0, Date.parse(this.member.expiresAt) - Date.now()))
      this.refreshWatchdog()
      this.reconcile(this.member.peers)
      this.publish()
      void this.poll()
    } catch (error) { if (!this.stopped) this.stop(deviceError(error)) }
  }
  private refreshWatchdog() {
    clearTimeout(this.watchdog)
    this.watchdog = setTimeout(() => this.stop('Perdimos la conexión con Foris. Cerramos la cámara y el micrófono; puedes volver a entrar.'), 30000)
  }
  private reconcile(profiles: VideoCallPeer[]) {
    for (const [id, peer] of this.peers) if (!profiles.some(profile => profile.id === id)) { peer.connection.close(); peer.stream.getTracks().forEach(track => track.stop()); this.peers.delete(id) }
    for (const profile of profiles) {
      if (this.peers.has(profile.id) || !this.member || !this.local) continue
      const connection = new RTCPeerConnection({ iceServers: this.member.iceServers, iceTransportPolicy: this.member.iceTransportPolicy, bundlePolicy: 'max-bundle' })
      const peer: Peer = { profile, connection, stream: new MediaStream(), queue: Promise.resolve() }
      this.peers.set(profile.id, peer)
      for (const track of this.local.getTracks()) connection.addTrack(track, this.local)
      connection.ontrack = event => { if (!this.stopped) { peer.stream.addTrack(event.track); this.publish() } }
      connection.onconnectionstatechange = () => this.publish()
      if (this.member.memberId < profile.id) peer.queue = this.offer(peer).catch(() => this.failed(peer))
    }
    this.publish()
  }
  private failed(peer: Peer) {
    if (this.stopped || this.peers.get(peer.profile.id) !== peer) return
    peer.connection.close()
    this.publish()
  }
  private async description(peer: Peer) {
    await waitForIce(peer.connection, this.abort.signal)
    if (this.stopped || peer.connection.signalingState === 'closed') return
    const local = peer.connection.localDescription
    if (!local || (local.type !== 'offer' && local.type !== 'answer')) throw new Error('Descripción de conexión ausente')
    await sendSignal('video-call/' + this.member!.memberId + '/signals', { to: peer.profile.id, requestId: crypto.randomUUID(), description: { type: local.type, sdp: local.sdp } }, this.abort.signal)
  }
  private async offer(peer: Peer) {
    await peer.connection.setLocalDescription(await peer.connection.createOffer())
    await this.description(peer)
  }
  private async receive(signal: VideoSignal, peer: Peer) {
    if (this.stopped || peer.connection.signalingState === 'closed') return
    const isOffer = signal.description.type === 'offer'
    if (isOffer !== (signal.from < this.member!.memberId)) throw new Error('Iniciador inesperado')
    if (!isOffer && peer.connection.signalingState !== 'have-local-offer') throw new Error('Respuesta inesperada')
    if (isOffer && peer.connection.signalingState !== 'stable') throw new Error('Oferta inesperada')
    await peer.connection.setRemoteDescription(signal.description)
    if (isOffer) {
      await peer.connection.setLocalDescription(await peer.connection.createAnswer())
      await this.description(peer)
    }
  }
  private async poll() {
    if (this.stopped || !this.member) return
    let delay = 1500
    try {
      const result = await accountRequest<VideoCallSync>('video-call/' + this.member.memberId + '/sync', 'POST', { after: this.cursor }, this.abort.signal)
      if (this.stopped) return
      this.refreshWatchdog()
      this.reconcile(result.peers)
      for (const signal of result.signals) {
        const peer = this.peers.get(signal.from)
        if (peer) peer.queue = peer.queue.then(() => this.receive(signal, peer)).catch(() => this.failed(peer))
      }
      this.cursor = result.nextCursor
      if (result.hasMore) delay = 0
    } catch (error) {
      if (this.stopped) return
      if (error instanceof AccountApiError && ![0, 503].includes(error.status)) { this.stop(error.message); return }
      delay = 3000
    }
    if (!this.stopped) this.pollTimer = setTimeout(() => void this.poll(), delay)
  }
  setAudio(enabled: boolean) { this.local?.getAudioTracks().forEach(track => { track.enabled = enabled }) }
  setVideo(enabled: boolean) { this.local?.getVideoTracks().forEach(track => { track.enabled = enabled }) }
  private leave() {
    if (!this.member) return
    const url = '/api/video-call/' + this.member.memberId + '/leave'
    // sendBeacon conserva la cookie y el JSON al abandonar la página. El lease cubre su posible pérdida.
    const sent = typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url, new Blob(['{}'], { type: 'application/json' }))
    if (!sent) void fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}', keepalive: true }).catch(() => {})
    this.member = null
  }
  stop(message: string | null = null) {
    if (this.stopped) return
    this.stopped = true
    this.abort.abort()
    clearTimeout(this.pollTimer); clearTimeout(this.watchdog); clearTimeout(this.duration)
    this.local?.getTracks().forEach(track => track.stop()); this.local = null
    for (const peer of this.peers.values()) { peer.connection.close(); peer.stream.getTracks().forEach(track => track.stop()) }
    this.peers.clear()
    this.leave()
    this.ended(message)
  }
}
