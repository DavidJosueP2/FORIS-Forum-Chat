import type { Presence } from '@messages/contracts'

export const PRESENCE_STALE_MS = 45000

export function parsePresence(value: unknown): Presence | null {
  if (!value || typeof value !== 'object' || !('status' in value)) return null
  if (value.status === 'unavailable') return null
  if (value.status !== 'available' || !('accounts' in value) || !('guestBrowsers' in value)
    || !('observedAt' in value) || !('leaseSeconds' in value)
    || typeof value.accounts !== 'number' || !Number.isSafeInteger(value.accounts) || value.accounts < 0
    || typeof value.guestBrowsers !== 'number' || !Number.isSafeInteger(value.guestBrowsers) || value.guestBrowsers < 0
    || typeof value.observedAt !== 'string' || !Number.isFinite(Date.parse(value.observedAt))
    || value.leaseSeconds !== 90) return null
  return { status: 'available', accounts: value.accounts, guestBrowsers: value.guestBrowsers, observedAt: value.observedAt, leaseSeconds: value.leaseSeconds }
}

export async function preparePresence(signal: AbortSignal): Promise<void> {
  // Primera visita simultánea: todas las pestañas deben recibir LA MISMA cookie.
  // Sin Web Locks no se emiten cookies competidoras; el servidor marcará al invitado desconocido.
  if (!navigator.locks) return
  const timeout = AbortSignal.any([signal, AbortSignal.timeout(5000)])
  await navigator.locks.request('foris-presence-cookie-v1', { signal: timeout }, async () => {
    const response = await fetch('/api/chat/presence/identity', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: timeout,
      headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    if (!response.ok) throw new Error('Presencia no disponible')
  })
}
