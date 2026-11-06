export const AUTH_EVENT = 'foris:session-changed'
export const SESSION_SIGNAL = 'foris.session-signal'

export class AccountApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'AccountApiError'
    this.status = status
    this.code = code
  }
}
export async function accountRequest<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  try {
    const response = await fetch('/api/' + path, {
      method, credentials: 'same-origin', cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      if (response.status === 401) window.dispatchEvent(new Event(AUTH_EVENT))
      const error = data && typeof data === 'object' && 'error' in data ? data.error : null
      const fields = error && typeof error === 'object' ? error as Record<string, unknown> : {}
      throw new AccountApiError(response.status,
        typeof fields.code === 'string' ? fields.code : 'UNAVAILABLE',
        typeof fields.message === 'string' ? fields.message : 'No pudimos completar la solicitud. Inténtalo de nuevo.')
    }
    if (!data || typeof data !== 'object') throw new AccountApiError(502, 'INVALID_RESPONSE', 'No pudimos leer la respuesta de Foris.')
    return data as T
  } catch (error) {
    if (error instanceof AccountApiError) throw error
    throw new AccountApiError(0, 'NETWORK', 'No pudimos conectar con Foris. Revisa tu conexión e inténtalo de nuevo.')
  }
}
export function accountError(error: unknown): string {
  return error instanceof Error ? error.message : 'No pudimos completar la solicitud.'
}
export async function startGoogle(intent: 'login' | 'link' | 'reauth', currentPassword?: string, returnTo?: string) {
  const result = await accountRequest<{ url: string }>('auth/google/start', 'POST', { intent, currentPassword, returnTo })
  const url = new URL(result.url)
  if (url.origin !== 'https://accounts.google.com') throw new AccountApiError(502, 'INVALID_RESPONSE', 'No pudimos abrir Google.')
  window.location.assign(url.toString())
}
