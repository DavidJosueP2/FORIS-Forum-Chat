import { useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { MessageInput } from '@messages/contracts'
import { Link } from 'react-router-dom'
import { ArrowUp, LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SocialFeedback } from '@/components/ui/social-feedback'
import { Textarea } from '@/components/ui/textarea'
import { describeChatError } from '../api/chat-api'
import { MAX_MESSAGE_LENGTH, type GuestProfile } from '../lib/guest-session'
import { GuestNameDialog } from './chat-dialogs'

interface MessageComposerProps {
  profile: GuestProfile
  draft: string
  onDraftChange: (body: string) => void
  onNameChange?: (name: string) => void
  onSent: (body: string) => void
  sendMessage: (input: MessageInput) => Promise<void>
  inputRef: RefObject<HTMLTextAreaElement | null>
  identityPending?: boolean
  roomName?: string
  audience?: string
  waiting?: boolean
  guidance?: string
}

export function MessageComposer({
  profile, draft, onDraftChange, onNameChange, onSent, sendMessage, inputRef, identityPending = false, roomName = 'General', audience, waiting = false, guidance,
}: MessageComposerProps) {
  const [sending, setSending] = useState(false)
  const [pulse, setPulse] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const attemptRef = useRef<MessageInput | null>(null)
  const busyRef = useRef(false)

  async function submit() {
    const body = draft.replaceAll('\r\n', '\n').trim()
    if (!body || busyRef.current || identityPending || waiting || body.length > MAX_MESSAGE_LENGTH) return
    const previous = attemptRef.current
    const input: MessageInput = previous
      && previous.body === body && (Boolean(profile.accountId) || previous.author === profile.name)
      && previous.senderId === profile.senderId
      ? previous
      : { body, author: profile.name, senderId: profile.senderId, requestId: crypto.randomUUID() }
    attemptRef.current = input
    busyRef.current = true
    setSending(true)
    setError(null)
    try {
      await sendMessage(input)
      setPulse(current => current + 1)
      attemptRef.current = null
      onSent(input.body)
      inputRef.current?.focus()
    } catch (cause) {
      setError(describeChatError(cause))
    } finally {
      busyRef.current = false
      setSending(false)
    }
  }

  return (
    <div className="composer-area">
      {guidance && <p id="composer-guidance" className="composer-guidance" role="status">{guidance}</p>}
      {!audience && <div className="composer-identity">
        <span>Escribes como</span>
        {profile.accountId
          ? <Button asChild variant="ghost" className="guest-name-trigger h-11"><Link to="/profile"><span>{profile.name}</span></Link></Button>
          : onNameChange && <GuestNameDialog profile={profile} onNameChange={onNameChange} />}
        <span className="guest-label">{profile.accountId ? 'Miembro' : profile.name !== 'Invitado' ? 'Invitado' : ''}</span>
      </div>}
      <form
        className="message-composer"
        aria-label={'Escribir en ' + roomName}
        aria-busy={sending}
        onSubmit={event => { event.preventDefault(); void submit() }}
      >
        <label htmlFor="message-body" className="sr-only">Mensaje para {roomName}</label>
        <Textarea
          ref={inputRef}
          id="message-body"
          name="message"
          value={draft}
          onChange={event => {
            onDraftChange(event.target.value)
            setError(null)
          }}
          onKeyDown={event => {
            // Ctrl/⌘ + Enter es explícito; Enter normal conserva los saltos y funciona en móvil.
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)
              && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void submit()
            }
          }}
          readOnly={sending || waiting}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={waiting ? 'Esperando respuesta…' : audience ? 'Escribe un mensaje…' : 'Comparte algo con General…'}
          aria-describedby={'composer-hint' + (error ? ' composer-error' : '') + (guidance ? ' composer-guidance' : '')}
          aria-invalid={Boolean(error)}
          className="composer-input"
          rows={2}
        />
        <div className="composer-actions">
          <span className="composer-count" aria-label={draft.length + ' de 2000 caracteres'}>
            {draft.length > 0 ? draft.length + ' / 2000' : 'Solo texto, muchas ideas'}
          </span>
          <Button
            type="submit"
            disabled={sending || identityPending || waiting || !draft.trim()}
            className="send-button social-action h-11 gap-2 px-5"
          >
            <SocialFeedback pulse={pulse}>{sending ? <LoaderCircle className="animate-spin" /> : <ArrowUp />}</SocialFeedback>
            <span>{waiting ? 'En espera' : identityPending ? 'Un momento' : sending ? 'Enviando' : error ? 'Reintentar' : 'Enviar'}</span>
          </Button>
        </div>
      </form>
      {error && (
        <p id="composer-error" className="composer-error" role="alert">
          {error} Tu texto sigue aquí.
        </p>
      )}
      <p id="composer-hint" className="composer-hint">
        <span>{audience ?? 'Lo que escribes es público.'}</span>
        <span className="keyboard-hint">Ctrl o ⌘ + Enter para enviar</span>
      </p>
    </div>
  )
}
