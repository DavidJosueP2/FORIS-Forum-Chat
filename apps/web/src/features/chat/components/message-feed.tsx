import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Message } from '@messages/contracts'
import { ArrowDown, LoaderCircle } from 'lucide-react'

import { ForisCharacter } from '@/components/brand/foris-character'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { isSameDay, messageDay, messageTime } from '../lib/messages'

interface MessageFeedProps {
  messages: Message[]
  senderId: string
  accountId?: string
  historyStatus: 'loading' | 'ready' | 'error'
  historyError: string | null
  hasOlder: boolean
  loadingOlder: boolean
  olderError: string | null
  loadOlder: () => Promise<boolean>
  reconnect: () => void
  onSuggestion: (body: string) => void
}

export function MessageFeed({
  messages, senderId, accountId, historyStatus, historyError, hasOlder,
  loadingOlder, olderError, loadOlder, reconnect, onSuggestion,
}: MessageFeedProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const lastSeenId = useRef<string | undefined>(undefined)
  const anchor = useRef<{
    firstId: string
    element: HTMLElement
    top: number
    scrollTop: number
  } | null>(null)
  const [atBottom, setAtBottom] = useState(true)

  useEffect(() => {
    const viewport = viewportRef.current
    const bottom = bottomRef.current
    if (!viewport || !bottom) return
    const observer = new IntersectionObserver(([entry]) => {
      setAtBottom(entry.isIntersecting)
    }, { root: viewport, threshold: 0 })
    observer.observe(bottom)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const saved = anchor.current
    if (saved && messages[0]?.id !== saved.firstId) {
      // Anclar un mensaje existente excluye los añadidos al final. El desplazamiento
      // que hizo el lector durante la solicitud también forma parte de su posición.
      const expectedTop = saved.top - (viewport.scrollTop - saved.scrollTop)
      viewport.scrollTop += saved.element.getBoundingClientRect().top - expectedTop
      anchor.current = null
    } else {
      const latest = messages.at(-1)
      const own = accountId ? latest?.accountId === accountId : !latest?.accountId && latest?.senderId === senderId
      const newOwnMessage = latest?.id !== lastSeenId.current && own
      if (stickToBottom.current || newOwnMessage) viewport.scrollTop = viewport.scrollHeight
    }
    lastSeenId.current = messages.at(-1)?.id
  }, [messages, senderId, accountId, historyStatus])

  async function showOlder() {
    const viewport = viewportRef.current
    const first = messages[0]
    if (anchor.current || loadingOlder || !viewport || !first) return
    const bounds = viewport.getBoundingClientRect()
    const elements = Array.from(viewport.querySelectorAll<HTMLElement>('[data-message-id]'))
    const element = elements.find(node => node.getBoundingClientRect().bottom > bounds.top) ?? elements[0]
    if (!element) return
    anchor.current = {
      firstId: first.id,
      element,
      top: element.getBoundingClientRect().top,
      scrollTop: viewport.scrollTop,
    }
    if (!await loadOlder()) anchor.current = null
  }

  const hasMessages = messages.length > 0
  return (
    <div className="feed-container">
      <div
        ref={viewportRef}
        className="message-viewport"
        onScroll={event => {
          const element = event.currentTarget
          stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100
        }}
        tabIndex={0}
        role="region"
        aria-label="Historial de General"
      >
        <div className={'feed-content' + (!hasMessages ? ' feed-content-empty' : '')}>
          {historyError && (
            <div className="history-error" role="alert">
              <p>{historyError}</p>
              <Button variant="secondary" className="h-11" onClick={reconnect}>Volver a conectar</Button>
            </div>
          )}
          {historyStatus === 'loading' && !hasMessages && (
            <div className="history-loading" role="status">
              <span className="sr-only">Cargando la conversación</span>
              {[0, 1, 2].map(index => (
                <div className="message-skeleton" key={index} aria-hidden="true">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="flex flex-1 flex-col gap-3">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className={index === 1 ? 'h-4 w-2/3' : 'h-4 w-5/6'} />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {historyStatus === 'ready' && !hasMessages && (
            <div className="chat-empty">
              <ForisCharacter mood="welcome" width={116} height={116} />
              <h2>Rompe el hielo.</h2>
              <p>General es un espacio abierto. Comparte una idea, una pregunta o simplemente saluda.</p>
              <div className="empty-suggestions">
                <Button variant="secondary" className="h-11 px-5" onClick={() => onSuggestion('Hola, soy nuevo por aquí. ¿Cómo están?')}>
                  Decir hola
                </Button>
                <Button variant="secondary" className="h-11 px-5" onClick={() => onSuggestion('¿Qué están aprendiendo estos días?')}>
                  Hacer una pregunta
                </Button>
              </div>
            </div>
          )}
          {hasOlder && (
            <div className="older-messages">
              <Button variant="secondary" className="h-11 px-5" disabled={loadingOlder} onClick={() => void showOlder()}>
                {loadingOlder && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                {loadingOlder ? 'Cargando' : 'Ver mensajes anteriores'}
              </Button>
            </div>
          )}
          {olderError && <p role="alert" className="older-error">{olderError}</p>}
          <ol
            className="message-list"
            role="log"
            aria-label="Mensajes"
            aria-live={historyStatus === 'loading' || loadingOlder ? 'off' : 'polite'}
            aria-relevant="additions"
            aria-atomic="false"
            aria-busy={historyStatus === 'loading' || loadingOlder}
          >
            {messages.map((message, index) => {
              const own = accountId ? message.accountId === accountId : !message.accountId && message.senderId === senderId
              const previous = messages[index - 1]
              const startDay = !previous || !isSameDay(previous, message)
              return (
                <li key={message.id}>
                  {startDay && <p className="message-day">{messageDay(message)}</p>}
                  <article data-message-id={message.id} className={'message-row' + (own ? ' message-own' : '')}>
                    <span className="message-avatar" aria-hidden="true">
                      {Array.from(message.author)[0].toLocaleUpperCase('es')}
                    </span>
                    <div className="message-text">
                      <header className="message-meta">
                        <span className="message-author">{message.author}</span>
                        <span className="message-kind">{own ? 'Tú, ' : ''}{message.accountId ? 'Miembro' : 'Invitado'}</span>
                        <time dateTime={message.createdAt} title={new Date(message.createdAt).toLocaleString('es')}>
                          {messageTime(message)}
                        </time>
                      </header>
                      <p className="message-body">{message.body}</p>
                    </div>
                  </article>
                </li>
              )
            })}
          </ol>
          <div ref={bottomRef} className="feed-bottom" aria-hidden="true" />
        </div>
      </div>
      {!atBottom && hasMessages && (
        <Button
          variant="secondary"
          className="jump-to-bottom h-11 gap-2 px-5"
          onClick={() => {
            const viewport = viewportRef.current
            if (!viewport) return
            stickToBottom.current = true
            viewport.scrollTo({
              top: viewport.scrollHeight,
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            })
          }}
        >
          <ArrowDown aria-hidden="true" /> Volver al final
        </Button>
      )}
    </div>
  )
}
