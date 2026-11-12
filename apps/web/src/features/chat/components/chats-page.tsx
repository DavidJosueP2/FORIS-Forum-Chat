import { Link, useNavigate, useParams } from 'react-router-dom'
import { Globe } from 'lucide-react'
import type { Conversation } from '@messages/contracts'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { usePageTitle } from '@/hooks/use-page-title'
import { useAuth } from '@/features/account/hooks/use-auth'
import { loginLink } from '@/features/account/lib/return-target'
import { ForumError } from '@/features/forum/components/forum-states'
import { useResource } from '@/features/forum/hooks/use-forum'
import { IdentityImage } from '@/features/media/components/identity-image'
import { LegalEntry } from '@/features/legal/legal-page'
import { ChatHome } from './chat-home'
import { MessageHistorySkeleton } from './message-feed'
import { ScopedChat } from './scoped-chat'
import '../chat.css'

const chatSections = [{ kind: 'community', label: 'Mis comunidades', empty: 'Únete a una comunidad para chatear con sus miembros.' },
  { kind: 'direct', label: 'Mensajes directos', empty: 'Abre el perfil de alguien para enviarle un mensaje.' }] as const

function roomId(room: Conversation) { return `${room.kind}:${room.id}` }
function chatHref(room = '') { return room ? '/chat/' + room : '/chat' }

function ChatRoomSkeleton() {
  return <div className="chat-workspace scoped-chat">
    <div className="chat-header scoped-chat-header" aria-hidden="true">
      <Skeleton className="size-11 shrink-0 rounded-full" />
      <div className="room-heading grid gap-2">
        <Skeleton className="h-6 w-3/4 max-w-48" />
        <Skeleton className="h-3.5 w-1/2 max-w-32" />
      </div>
    </div>
    <main id="conversation" tabIndex={-1} className="conversation-main">
      <div className="feed-content"><MessageHistorySkeleton label="Abriendo conversación…" /></div>
    </main>
  </div>
}

export function ChatsPage() {
  const room = useParams().room?.toLowerCase() ?? ''
  const auth = useAuth()
  const user = auth.session.user
  const navigate = useNavigate()
  const directory = useResource<{ rooms: Conversation[] }>(user ? 'conversations' : null, user?.id, 15000)
  const listed = directory.data?.rooms ?? []
  const listedRoom = listed.find(item => roomId(item) === room)
  const peer = /^direct:([\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12})$/iu.exec(room)?.[1]
  const direct = useResource<Conversation>(user && peer && !listedRoom ? 'conversations/direct/' + peer : null, user?.id)
  const selected = listedRoom ?? direct.data
  const rooms = direct.data ? [...listed, direct.data] : listed
  const groups = chatSections.map(section => ({ ...section, rooms: rooms.filter(item => item.kind === section.kind) }))
  usePageTitle(selected?.name ?? (room ? 'Conversación' : 'Chats'))
  const pending = auth.status === 'loading' || directory.loading
  const error = auth.error ?? directory.error
  const retry = auth.error ? () => void auth.refresh() : directory.retry

  return <div className="foris-app chats-page">
    <nav className="chat-directory" aria-label="Conversaciones">
      <div className="chat-directory-list">
        <h2>Chats</h2>
        <Link to="/chat" className="chat-directory-link" aria-current={room ? undefined : 'page'}>
          <span className="chat-directory-icon"><Globe aria-hidden="true" /></span><span>Chat global</span>
        </Link>
        {pending ? <p className="chat-directory-guest" role="status">Cargando tus chats…</p> : error ? <ForumError message={error} retry={retry} /> : user ? groups.map(group => <section key={group.kind} className="chat-directory-group" aria-label={group.label}>
          <h3>{group.label}</h3>
          {group.rooms.length ? <ul>{group.rooms.map(item => <li key={item.id}>
            <Link className="chat-directory-link" to={chatHref(roomId(item))} aria-current={roomId(item) === room ? 'page' : undefined}>
              <IdentityImage mediaId={item.imageId} fallbackKey={(group.kind === 'community' ? 'community:' : 'user:') + item.id} name={item.name} className="chat-directory-avatar" />
              <span>{item.name}</span>
            </Link>
          </li>)}</ul> : <p>{group.empty} {group.kind === 'community' && <Link to="/comunidades">Ver comunidades</Link>}</p>}
        </section>) : <p className="chat-directory-guest"><Link to={loginLink('/chat')}>Entra a Foris</Link> para ver tus comunidades y mensajes.</p>}
      </div>
      <div className="chat-directory-mobile">
        <label className="sr-only" htmlFor="chat-room-picker">Chats</label>
        <NativeSelect id="chat-room-picker" value={selected ? room : room ? 'unavailable' : ''} onChange={event => navigate(chatHref(event.target.value))}>
          {room && !selected && <option value="unavailable" disabled>Conversación</option>}
          <option value="">Chat global</option>
          {groups.filter(group => group.rooms.length).map(group => <optgroup label={group.label} key={group.kind}>
            {group.rooms.map(item => <option key={item.id} value={roomId(item)}>{item.name}</option>)}
          </optgroup>)}
        </NativeSelect>
        {user && error && !room && <Button variant="ghost" type="button" className="h-11" onClick={retry}>Recargar chats</Button>}
      </div>
      <div className="chat-directory-footer"><LegalEntry /></div>
    </nav>
    {!room ? <ChatHome /> : selected && user ? <ScopedChat key={user.id + '/' + room} room={room} conversation={selected} user={user} />
      : pending || direct.loading ? <ChatRoomSkeleton />
      : <main id="conversation" tabIndex={-1} className="chat-unavailable">
        {direct.error ? <ForumError message={direct.error} retry={direct.retry} /> : error ? <ForumError message={error} retry={retry} /> : <>
          <h1>{user ? 'Esta conversación no está disponible' : 'Entra para abrir esta conversación'}</h1>
          {user ? <Link to="/chat">Volver al chat global</Link> : <Button asChild className="h-11"><Link to={loginLink(chatHref(room))}>Entrar</Link></Button>}
        </>}
      </main>}
  </div>
}
