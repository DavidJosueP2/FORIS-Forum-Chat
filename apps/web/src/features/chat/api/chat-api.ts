import type { Message, MessageInput, MessagePage } from '@messages/contracts'

export class ChatApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ChatApiError'
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isMessage(value: unknown): value is Message {
  return isRecord(value)
    && typeof value.id === 'string' && /^[1-9]\d{0,18}$/.test(value.id)
    && typeof value.author === 'string' && value.author.length > 0
    && typeof value.body === 'string'
    && typeof value.senderId === 'string'
    && typeof value.requestId === 'string'
    && typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt))
}

async function request(path: string, options: RequestInit = {}): Promise<unknown> {
  const timeout = AbortSignal.timeout(15_000)
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
  })
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = isRecord(data) && isRecord(data.error) ? data.error : null
    const message = error && typeof error.message === 'string'
      ? error.message
      : 'No pudimos completar la solicitud. Inténtalo de nuevo.'
    throw new ChatApiError(response.status, message)
  }
  return data
}

export async function fetchMessages(
  cursor: { before?: string; after?: string } = {},
  signal?: AbortSignal,
): Promise<MessagePage> {
  const query = new URLSearchParams({ limit: '50' })
  if (cursor.before) query.set('before', cursor.before)
  if (cursor.after) query.set('after', cursor.after)
  const data = await request('/api/messages?' + query.toString(), { signal })
  if (!isRecord(data) || !Array.isArray(data.messages)
    || !data.messages.every(isMessage) || typeof data.hasMore !== 'boolean') {
    throw new ChatApiError(502, 'No pudimos leer la conversación. Vuelve a intentarlo.')
  }
  return { messages: data.messages, hasMore: data.hasMore }
}

export async function postMessage(input: MessageInput): Promise<Message> {
  const data = await request('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!isRecord(data) || !isMessage(data.message)) {
    throw new ChatApiError(502, 'No pudimos confirmar el envío. Puedes reintentarlo.')
  }
  return data.message
}

export function describeChatError(error: unknown): string {
  return error instanceof ChatApiError
    ? error.message
    : 'No pudimos conectar con Foris. Revisa tu conexión y vuelve a intentarlo.'
}
