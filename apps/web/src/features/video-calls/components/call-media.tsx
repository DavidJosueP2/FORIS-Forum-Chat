import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

export function CallVideo({ stream, name, local = false, state }: { stream: MediaStream; name: string; local?: boolean; state?: RTCPeerConnectionState }) {
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
    <video ref={ref} autoPlay playsInline muted aria-label={local ? 'Tu cámara' : 'Vídeo de ' + name} />
    <figcaption><span>{name}{local ? ' · Tú' : ''}</span><span role="status">{problem ? 'No conecta; sal y vuelve a entrar' : state === 'connected' ? 'Conectado' : local ? 'Tu vista previa' : 'Conectando…'}</span></figcaption>
    {blocked && <Button type="button" variant="secondary" className="h-11" onClick={() => { void ref.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true)) }}>Reproducir vídeo</Button>}
  </figure>
}

/** Permanece montado al minimizar la vista; los vídeos nunca duplican este audio. */
export function RemoteCallAudio({ id, stream, register, onBlocked }: {
  id: string; stream: MediaStream;
  register: (id: string, audio: HTMLAudioElement | null) => void;
  onBlocked: (id: string, blocked: boolean) => void;
}) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const audio = ref.current
    if (!audio) return
    let active = true
    register(id, audio)
    audio.srcObject = stream
    const playing = () => onBlocked(id, false)
    const play = () => {
      if (stream.getAudioTracks().length) void audio.play().catch(() => { if (active) onBlocked(id, true) })
    }
    audio.addEventListener('playing', playing)
    stream.addEventListener('addtrack', play)
    play()
    return () => {
      active = false
      audio.removeEventListener('playing', playing)
      stream.removeEventListener('addtrack', play)
      audio.srcObject = null
      register(id, null)
      onBlocked(id, false)
    }
  }, [id, stream, register, onBlocked])
  return <audio ref={ref} autoPlay />
}
