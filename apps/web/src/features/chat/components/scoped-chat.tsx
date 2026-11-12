import { useRef, useState } from 'react'
import type { AccountUser, Conversation } from '@messages/contracts'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { Link } from 'react-router-dom'
import { IdentityImage } from '@/features/media/components/identity-image'
import { ConversationVideoCall } from '@/features/video-calls/components/conversation-video-call'
import { useConversation } from '../hooks/use-conversation'
import { MAX_MESSAGE_LENGTH } from '../lib/guest-session'
import { MessageComposer } from './message-composer'
import { MessageFeed } from './message-feed'

export function ScopedChat({ user, room, conversation }: { user: AccountUser; room: string; conversation: Conversation }) {
  const chat = useConversation(room)
  const draftKey = `foris.conversation.draft.${user.id}.${room}`
  const [draft, setDraft] = useState(() => {
    try { return (sessionStorage.getItem(draftKey) ?? '').slice(0, MAX_MESSAGE_LENGTH) }
    catch { return '' }
  })
  const draftRef = useRef(draft)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [trigger, setTrigger] = useState<HTMLDivElement | null>(null)
  const community = conversation.kind === 'community'
  const identity = { accountId: user.id, senderId: user.id, name: user.displayName }

  function changeDraft(body: string) {
    draftRef.current = body
    setDraft(body)
    try {
      if (body) sessionStorage.setItem(draftKey, body)
      else sessionStorage.removeItem(draftKey)
    } catch { /* El borrador permanece en memoria durante esta visita. */ }
  }

  return <div className="chat-workspace scoped-chat">
    {!chat.accessLost && <a href="#message-body" className="skip-to-composer">Ir a escribir un mensaje</a>}
    <header className="chat-header scoped-chat-header">
      <IdentityImage mediaId={conversation.imageId} fallbackKey={(community ? 'community:' : 'user:') + conversation.id} name={conversation.name} className="chat-header-avatar" />
      <div className="room-heading">
        <h1>{conversation.name}</h1>
        <p className="chat-room-audience"><LockKeyhole aria-hidden="true" />{community ? 'Solo miembros de la comunidad' : 'Mensaje directo'}</p>
        {community && <Link to={'/comunidades/' + conversation.id} className="chat-community-back"><ArrowLeft aria-hidden="true" />Volver a la comunidad</Link>}
      </div>
      <div className="call-entry-slot" ref={setTrigger} />
    </header>
    <main id="conversation" tabIndex={-1} className="conversation-main" aria-label={conversation.name}>
      {!chat.accessLost && <ConversationVideoCall user={user} room={room} title={conversation.name} triggerContainer={trigger} />}
      <MessageFeed {...chat} senderId={user.id} accountId={user.id} roomName={conversation.name} />
      {!chat.accessLost && <MessageComposer profile={identity} draft={draft} onDraftChange={changeDraft}
        onSent={body => { if (draftRef.current.replaceAll('\r\n', '\n').trim() === body) changeDraft('') }}
        sendMessage={chat.sendMessage} inputRef={inputRef} roomName={conversation.name}
        audience={community ? 'Visible para miembros de la comunidad.' : 'Visible solo para ustedes dos.'} />}
    </main>
  </div>
}
