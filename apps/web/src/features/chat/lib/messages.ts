import type { Message } from '@messages/contracts'

export function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map(message => [message.id, message]))
  for (const message of incoming) byId.set(message.id, message)
  return [...byId.values()].sort((a, b) => {
    const left = BigInt(a.id)
    const right = BigInt(b.id)
    return left < right ? -1 : left > right ? 1 : 0
  })
}

const dayFormat = new Intl.DateTimeFormat('es', {
  weekday: 'long', day: 'numeric', month: 'long',
})
const timeFormat = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })

export function messageTime(message: Message): string {
  return timeFormat.format(new Date(message.createdAt))
}

export function messageDay(message: Message): string {
  return dayFormat.format(new Date(message.createdAt))
}

export function isSameDay(a: Message, b: Message): boolean {
  return new Date(a.createdAt).toDateString() === new Date(b.createdAt).toDateString()
}
