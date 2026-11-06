export function returnTarget(value: unknown): string {
  if (typeof value !== 'string' || value.length > 256) return '/'
  if (value === '/?vista=siguiendo') return value
  if (/^\/personas\/[\da-fA-F]{8}-(?:[\da-fA-F]{4}-){3}[\da-fA-F]{12}(?:\?vista=comunidades)?$/u.test(value)) return value
  if (/^\/(?:profile|chat|comunidades(?:\/crear)?|notificaciones)?$/u.test(value)) return value
  if (/^\/comunidades\/[1-9]\d{0,18}$/u.test(value)) return value
  if (/^\/invitaciones\/[A-Za-z0-9_-]{43}$/u.test(value)) return value
  const publication = /^\/publicar(?:\?([^#]*))?$/u.exec(value)
  if (publication) {
    const params = new URLSearchParams(publication[1])
    for (const [key, item] of params) {
      if (params.getAll(key).length !== 1) return '/'
      if (key === 'topico' && /^[a-z][a-z0-9-]{0,31}$/u.test(item)) continue
      if (key === 'comunidad' && /^[1-9]\d{0,18}$/u.test(item) && BigInt(item) <= 9223372036854775807n) continue
      return '/'
    }
    return '/publicar' + (params.size ? '?' + params.toString() : '')
  }
  if (/^\/publicaciones\/[\da-fA-F]{8}-(?:[\da-fA-F]{4}-){3}[\da-fA-F]{12}(?:\/editar|#responder)?$/u.test(value)) return value
  return '/'
}
export function loginLink(next: string, register = false): string {
  const params = new URLSearchParams({ next: returnTarget(next) })
  if (register) params.set('mode', 'register')
  return '/login?' + params.toString()
}
