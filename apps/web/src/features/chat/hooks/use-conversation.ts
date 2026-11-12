import { useEffect, useRef, useState } from 'react'
import type { ConversationHistory, ConversationSend, ConversationState, Message, MessageInput } from '@messages/contracts'
import { AccountApiError, accountError, accountRequest } from '@/features/account/api/account-api'
import { mergeMessages } from '../lib/messages'

export function useConversation(room: string) {
  const path = 'conversations/' + encodeURIComponent(room) + '/messages'
  const [messages, setMessages] = useState<Message[]>([])
  const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [accessLost, setAccessLost] = useState(false)
  const [state, setState] = useState<ConversationState | null>(null)
  const [hasOlder, setHasOlder] = useState(false)
  const [olderError, setOlderError] = useState<string | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const olderRequest = useRef<AbortController | null>(null)
  const lifetime = useRef<AbortController | null>(null)
  const cursor = useRef<string | null>(null)
  const sends = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    let timer: ReturnType<typeof setTimeout> | undefined
    async function refresh() {
      let delay = 2500
      try {
        const after = cursor.current
        const version = sends.current
        const query = after === null ? '' : '?after=' + after
        const result = await accountRequest<ConversationHistory>(path + query, 'GET', undefined, controller.signal)
        if (controller.signal.aborted) return
        cursor.current = result.messages.at(-1)?.id ?? after ?? '0'
        if (after === null) setHasOlder(result.hasMore)
        else if (result.hasMore) delay = 0
        if (result.messages.length) setMessages(current => mergeMessages(current, result.messages))
        if (version === sends.current) setState(result.state)
        setHistoryStatus('ready'); setHistoryError(null); setAccessLost(false)
      } catch (error) {
        if (controller.signal.aborted) return
        setHistoryStatus('error'); setHistoryError(accountError(error))
        if (error instanceof AccountApiError && [401, 403, 404].includes(error.status)) {
          cursor.current = null
          controller.abort()
          olderRequest.current?.abort()
          setMessages([]); setHasOlder(false); setAccessLost(true)
          return
        }
        delay = 5000
      }
      timer = setTimeout(() => void refresh(), delay)
    }
    void refresh()
    return () => { controller.abort(); olderRequest.current?.abort(); clearTimeout(timer) }
  }, [path, attempt])

  async function loadOlder() {
    const first = messages[0]
    if (!first || !hasOlder || olderRequest.current) return false
    const controller = new AbortController()
    olderRequest.current = controller
    setLoadingOlder(true); setOlderError(null)
    try {
      const result = await accountRequest<ConversationHistory>(path + '?before=' + first.id, 'GET', undefined, controller.signal)
      if (controller.signal.aborted) return false
      setMessages(current => mergeMessages(current, result.messages)); setHasOlder(result.hasMore)
      return result.messages.length > 0
    } catch (error) {
      if (!controller.signal.aborted) setOlderError(accountError(error))
      return false
    } finally {
      olderRequest.current = null
      setLoadingOlder(false)
    }
  }

  async function sendMessage({ body, requestId }: MessageInput) {
    const signal = lifetime.current?.signal
    try {
      const result = await accountRequest<ConversationSend>(path, 'POST', { body, requestId }, signal)
      if (signal?.aborted) return
      sends.current++
      setState(result.state)
      setMessages(current => mergeMessages(current, [result.message]))
    } catch (cause) {
      if (!signal?.aborted && cause instanceof AccountApiError && cause.code === 'DIRECT_INTRO_PENDING') {
        sends.current++
        setState({ permission: 'awaiting', canCall: false })
      }
      throw cause
    }
  }

  return { messages, historyStatus, historyError, accessLost, state, hasOlder, loadingOlder, olderError, loadOlder, sendMessage,
    reconnect: () => setAttempt(current => current + 1) }
}
