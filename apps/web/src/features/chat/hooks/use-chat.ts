import { useCallback, useEffect, useRef, useState } from 'react'
import type { Message, MessageInput, Presence } from '@messages/contracts'

import { describeChatError, fetchMessages, isMessage, postMessage } from '../api/chat-api'
import { mergeMessages } from '../lib/messages'
import { parsePresence, preparePresence, PRESENCE_STALE_MS } from '../lib/presence'

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline'

export function useChat(accountId?: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [connection, setConnection] = useState<ConnectionState>(() =>
    navigator.onLine ? 'connecting' : 'offline')
  const [presence, setPresence] = useState<Presence | null>(null)
  const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [hasOlder, setHasOlder] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [olderError, setOlderError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const controllerRef = useRef<AbortController | null>(null)
  const olderBusy = useRef(false)
  // Solo avanza con páginas consultadas: un evento nuevo no puede saltarse un hueco.
  const syncCursorRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    const controller = new AbortController()
    controllerRef.current = controller
    let stream: EventSource | null = null
    let syncing = false
    let syncAgain = false
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let presenceTimer: ReturnType<typeof setTimeout> | undefined
    let lastPresence = 0
    let generation = 0
    let reconnects = 0

    async function synchronize() {
      if (syncing) {
        syncAgain = true
        return
      }
      syncing = true
      try {
        do {
          syncAgain = false
          let more: boolean
          do {
            const cursor = syncCursorRef.current
            const page = await fetchMessages(cursor ? { after: cursor } : {}, controller.signal)
            if (controller.signal.aborted) return
            setMessages(current => mergeMessages(current, page.messages))
            if (!cursor) setHasOlder(page.hasMore)
            const latest = page.messages.at(-1)?.id
            if (latest) syncCursorRef.current = latest
            more = Boolean(cursor && page.hasMore && latest)
          } while (more && !controller.signal.aborted)
          setHistoryStatus('ready')
          setHistoryError(null)
        } while (syncAgain && !controller.signal.aborted)
      } catch (error) {
        if (!controller.signal.aborted) {
          setHistoryStatus('error')
          setHistoryError(describeChatError(error))
        }
      } finally {
        syncing = false
        if (syncAgain && !controller.signal.aborted) {
          syncAgain = false
          void synchronize()
        }
      }
    }

    async function connect() {
      if (controller.signal.aborted || !navigator.onLine) return
      const currentGeneration = ++generation
      stream?.close()
      clearTimeout(reconnectTimer)
      clearTimeout(presenceTimer)
      setPresence(null)
      try { await preparePresence(controller.signal) } catch {
        // La indisponibilidad de presencia no impide recuperar el texto del chat.
      }
      if (controller.signal.aborted || currentGeneration !== generation || !navigator.onLine) return
      const source = new EventSource('/api/events')
      stream = source

      source.onopen = () => {
        if (stream !== source || controller.signal.aborted) return
        setConnection('live')
        void synchronize()
      }
      source.addEventListener('message', (event: MessageEvent<string>) => {
        if (stream !== source || controller.signal.aborted) return
        try {
          const value: unknown = JSON.parse(event.data)
          if (isMessage(value)) setMessages(current => mergeMessages(current, [value]))
        } catch {
          // La siguiente sincronización recupera los datos si un frame no es válido.
        }
      })
      source.addEventListener('presence', (event: Event) => {
        if (stream !== source || controller.signal.aborted) return
        if (!(event instanceof MessageEvent) || typeof event.data !== 'string') return
        try {
          const value = parsePresence(JSON.parse(event.data))
          clearTimeout(presenceTimer)
          setPresence(value)
          if (value) {
            lastPresence = performance.now()
            presenceTimer = setTimeout(() => setPresence(null), PRESENCE_STALE_MS)
          }
        } catch {
          clearTimeout(presenceTimer)
          setPresence(null)
        }
      })
      source.onerror = () => {
        if (stream !== source || controller.signal.aborted) return
        setConnection(navigator.onLine ? 'reconnecting' : 'offline')
        clearTimeout(presenceTimer)
        setPresence(null)
        // Cierra el reintento nativo ilimitado. Tras cinco intentos queda Reconectar.
        source.close()
        clearTimeout(reconnectTimer)
        if (navigator.onLine && reconnects < 5) {
          const delay = [2000, 5000, 10000, 30000, 60000][reconnects++]
          reconnectTimer = setTimeout(() => void connect(), delay)
        }
      }
    }

    const onOnline = () => {
      reconnects = 0
      setConnection('connecting')
      void connect()
      void synchronize()
    }
    const onOffline = () => {
      stream?.close()
      stream = null
      generation++
      clearTimeout(reconnectTimer)
      clearTimeout(presenceTimer)
      setConnection('offline')
      setPresence(null)
    }
    const onVisible = () => {
      if (!document.hidden && performance.now() - lastPresence >= PRESENCE_STALE_MS) setPresence(null)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
    void connect()
    void synchronize()

    return () => {
      controller.abort()
      stream?.close()
      clearTimeout(reconnectTimer)
      clearTimeout(presenceTimer)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [attempt, accountId])

  const reconnect = useCallback(() => {
    setConnection(navigator.onLine ? 'connecting' : 'offline')
    setPresence(null)
    setHistoryError(null)
    setHistoryStatus(current => current === 'error' ? 'loading' : current)
    setAttempt(value => value + 1)
  }, [])

  const loadOlder = useCallback(async (): Promise<boolean> => {
    const before = messages[0]?.id
    const controller = controllerRef.current
    if (!before || !hasOlder || olderBusy.current || !controller) return false
    olderBusy.current = true
    setLoadingOlder(true)
    setOlderError(null)
    try {
      const page = await fetchMessages({ before }, controller.signal)
      if (controller.signal.aborted) return false
      setMessages(current => mergeMessages(current, page.messages))
      setHasOlder(page.hasMore)
      return page.messages.length > 0
    } catch (error) {
      if (!controller.signal.aborted) setOlderError(describeChatError(error))
      return false
    } finally {
      olderBusy.current = false
      setLoadingOlder(false)
    }
  }, [messages, hasOlder])

  const sendMessage = useCallback(async (input: MessageInput) => {
    const message = await postMessage(input, Boolean(accountId))
    setMessages(current => mergeMessages(current, [message]))
  }, [accountId])

  return {
    messages, connection, presence, historyStatus, historyError,
    hasOlder, loadingOlder, olderError, reconnect, loadOlder, sendMessage,
  }
}
