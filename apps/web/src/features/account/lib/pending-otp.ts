import type { OtpChallenge } from '@messages/contracts'

export interface PendingOtp { kind: 'verify' | 'reset'; email: string; challenge: OtpChallenge; returnTo?: string; termsVersion?: string }
const key = 'foris.pending-otp'
export function readPendingOtp(): PendingOtp | null {
  try {
    const data: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    if (!data || typeof data !== 'object' || !('kind' in data) || !('email' in data) || !('challenge' in data)) return null
    const challenge = data.challenge
    if ((data.kind !== 'verify' && data.kind !== 'reset') || typeof data.email !== 'string'
      || !challenge || typeof challenge !== 'object'
      || !('challengeId' in challenge) || typeof challenge.challengeId !== 'string'
      || !('expiresAt' in challenge) || typeof challenge.expiresAt !== 'string'
      || !('resendAt' in challenge) || typeof challenge.resendAt !== 'string'
      || !Number.isFinite(Date.parse(challenge.expiresAt)) || Date.parse(challenge.expiresAt) + 20 * 60000 < Date.now()) return null
    return data as PendingOtp
  } catch { return null }
}
export function savePendingOtp(value: PendingOtp | null) {
  try {
    if (value) sessionStorage.setItem(key, JSON.stringify(value))
    else sessionStorage.removeItem(key)
  } catch { /* Solo se guarda la solicitud, nunca contraseñas ni códigos. */ }
}
