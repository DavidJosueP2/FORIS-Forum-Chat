import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, MessageCircle, Moon, Sun, UserRound, Wifi, WifiOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'
import { AccountDialog } from '@/features/account/components/account-dialog'
import { useChat, type ConnectionState } from '../hooks/use-chat'
import { readDraft, readGuestProfile, storeDraft, storeGuestProfile } from '../lib/guest-session'
import { CommunityNotes, GuestNameDialog, RoomInfoDialog } from './chat-dialogs'
import { MessageComposer } from './message-composer'
import { MessageFeed } from './message-feed'
import '../chat.css'

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const label = resolvedTheme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-11 w-11"
      aria-label={label}
      title={label}
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      {resolvedTheme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  )
}

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
  const chat = useChat()
  const [profile, setProfile] = useState(readGuestProfile)
  const [draft, setDraft] = useState(readDraft)
  const draftRef = useRef(draft)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
      <aside className="chat-sidebar" aria-label="Navegación de Foris">
        <a href="#conversation" className="foris-wordmark" aria-label="Foris, conversación General">Foris</a>
        <p className="sidebar-intro">Un lugar para encontrarnos.</p>
        <nav aria-label="Conversaciones" className="room-navigation">
          <h2>Conversaciones</h2>
          <a href="#conversation" aria-current="page" className="room-link">
            <MessageCircle aria-hidden="true" />
            <span>General</span>
            <ArrowUpRight aria-hidden="true" className="room-link-arrow" />
          </a>
          <p>La conversación está abierta.<br />Tú también tienes lugar aquí.</p>
        </nav>
        <div className="sidebar-bottom">
          <RoomInfoDialog />
          <div className="sidebar-profile">
            <span className="sidebar-profile-avatar" aria-hidden="true"><UserRound /></span>
            <div>
              <GuestNameDialog profile={profile} onNameChange={changeName} />
              <p>Participas como invitado</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="chat-workspace">
        <header className="chat-header">
          <div className="room-heading">
            <h1><span className="mobile-wordmark">Foris <span aria-hidden="true">/</span> </span>General</h1>
            <ConnectionStatus state={chat.connection} connections={chat.connections} />
          </div>
          <div className="header-actions">
            <span className="mobile-room-info"><RoomInfoDialog compact /></span>
            <ThemeToggle />
            <AccountDialog />
          </div>
        </header>

        <div className="conversation-layout">
          <main id="conversation" tabIndex={-1} className="conversation-main" aria-label="Conversación General">
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
              senderId={profile.senderId}
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
              profile={profile}
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
              <p>Ahora, como invitado.</p>
              <p>Siempre puedes elegir un nombre. No necesitas una cuenta para empezar.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
