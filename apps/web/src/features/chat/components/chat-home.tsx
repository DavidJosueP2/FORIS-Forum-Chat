import { useEffect, useRef, useState } from 'react'
import { Wifi, WifiOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { GlobalVideoCall } from '@/features/video-calls/components/global-video-call'
import { useAuth } from '@/features/account/hooks/use-auth'
import { useChat, type ConnectionState } from '../hooks/use-chat'
import { readDraft, readGuestProfile, storeDraft, storeGuestProfile } from '../lib/guest-session'
import { CommunityNotes, GuestNameDialog, RoomInfoDialog } from './chat-dialogs'
import { MessageComposer } from './message-composer'
import { MessageFeed } from './message-feed'
import '../chat.css'

const connectionLabels: Record<ConnectionState, string> = {
  connecting: 'Conectando',
  live: 'En directo',
  reconnecting: 'Reconectando',
  offline: 'Sin conexión',
}

function ConnectionStatus({ state, connections }: { state: ConnectionState; connections: number | null }) {
  return (
    <p className="connection-status" role="status" aria-live="polite">
      {state === 'offline' || state === 'reconnecting'
        ? <WifiOff aria-hidden="true" />
        : <Wifi aria-hidden="true" />}
      <span>{connectionLabels[state]}</span>
      {state === 'live' && connections !== null && (
        <span className="connection-count">
          {connections} {connections === 1 ? 'conexión abierta' : 'conexiones abiertas'}
        </span>
      )}
    </p>
  )
}

export function ChatHome() {
  const auth = useAuth()
  const { session } = auth
  const chat = useChat(session.user?.id)
  const [profile, setProfile] = useState(readGuestProfile)
  const [draft, setDraft] = useState(readDraft)
  const [videoCallTrigger, setVideoCallTrigger] = useState<HTMLDivElement | null>(null)
  const draftRef = useRef(draft)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const identity = session.user
    ? { senderId: session.user.id, name: session.user.displayName, accountId: session.user.id }
    : profile

  useEffect(() => { storeGuestProfile(profile) }, [profile])

  function changeDraft(body: string) {
    draftRef.current = body
    setDraft(body)
    storeDraft(body)
  }

  function changeName(name: string) {
    setProfile(current => ({ ...current, name }))
  }

  return (
    <div className="foris-app">
      <a href="#message-body" className="skip-to-composer">Ir a escribir un mensaje</a>
      <div className="chat-workspace">
        <header className="chat-header">
          <div className="room-heading">
            <div className="room-title-row">
              <h1>Chat global</h1>
              <div className="call-entry-slot" ref={setVideoCallTrigger} />
            </div>
            <ConnectionStatus state={chat.connection} connections={chat.connections} />
          </div>
          <div className="header-actions">
            {!session.user && <GuestNameDialog profile={profile} onNameChange={changeName} />}
            <RoomInfoDialog compact />
          </div>
        </header>

        <div className="conversation-layout">
          <main id="conversation" tabIndex={-1} className="conversation-main" aria-label="Chat global">
            <GlobalVideoCall key={session.user?.id ?? 'guest'} user={session.user} triggerContainer={videoCallTrigger} />
            {auth.status === 'error' && !session.user && (
              <div className="connection-notice" role="alert">
                <p>No pudimos comprobar tu sesión. Tu borrador sigue aquí.</p>
                <Button variant="secondary" className="h-11" onClick={() => void auth.refresh()}>Revisar sesión</Button>
              </div>
            )}
            {(chat.connection === 'offline' || chat.connection === 'reconnecting') && (
              <div className="connection-notice">
                <p>
                  {chat.connection === 'offline'
                    ? 'Estás sin conexión. Puedes seguir preparando tu mensaje.'
                    : 'Estamos recuperando la conexión. Tu borrador sigue aquí.'}
                </p>
                <Button variant="secondary" className="h-11" onClick={chat.reconnect}>Reconectar</Button>
              </div>
            )}
            <MessageFeed
              messages={chat.messages}
              senderId={identity.senderId}
              accountId={identity.accountId}
              historyStatus={chat.historyStatus}
              historyError={chat.historyError}
              hasOlder={chat.hasOlder}
              loadingOlder={chat.loadingOlder}
              olderError={chat.olderError}
              loadOlder={chat.loadOlder}
              reconnect={chat.reconnect}
              onSuggestion={body => {
                changeDraft(body)
                inputRef.current?.focus()
              }}
            />
            <MessageComposer
              identityPending={auth.status === 'loading' || (auth.status === 'error' && !session.user)}
              profile={identity}
              draft={draft}
              onDraftChange={changeDraft}
              onNameChange={changeName}
              onSent={body => {
                if (draftRef.current.replaceAll('\r\n', '\n').trim() === body) changeDraft('')
              }}
              sendMessage={chat.sendMessage}
              inputRef={inputRef}
            />
          </main>

          <aside className="community-aside" aria-label="Acerca de esta comunidad">
            <h2>Las buenas conversaciones empiezan por escuchar.</h2>
            <p className="community-intro">Este espacio lo hacemos entre todos. Dale lugar a otras voces y comparte la tuya.</p>
            <CommunityNotes />
            <div className="community-footnote">
              <p>{session.user ? 'Un espacio para tu voz.' : 'También como invitado.'}</p>
              <p>{session.user ? 'Participas con tu perfil. Cada mensaje forma parte de una conversación pública.' : 'Puedes elegir un nombre o crear una cuenta. No necesitas registrarte para empezar.'}</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
