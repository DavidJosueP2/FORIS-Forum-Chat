export const MAX_MESSAGE_LENGTH = 2000
export const MAX_AUTHOR_LENGTH = 32

const PROFILE_KEY = 'foris.guest'
const DRAFT_KEY = 'foris.draft'
const UUID = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i

export interface GuestProfile {
  senderId: string
  name: string
  accountId?: string
}

export function readGuestProfile(): GuestProfile {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null')
    if (data && typeof data === 'object' && 'senderId' in data && 'name' in data
      && typeof data.senderId === 'string' && UUID.test(data.senderId)
      && typeof data.name === 'string' && data.name.trim().length <= MAX_AUTHOR_LENGTH
      && ![...data.name].some(character => {
        const point = character.codePointAt(0) ?? 0
        return point < 32 || point === 127
      })) {
      return { senderId: data.senderId, name: data.name.trim() || 'Invitado' }
    }
  } catch {
    // El acceso invitado también funciona sin almacenamiento local.
  }
  return { senderId: crypto.randomUUID(), name: 'Invitado' }
}

export function storeGuestProfile(profile: GuestProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    // La elección se conserva en memoria durante esta visita.
  }
}

export function readDraft(): string {
  try {
    return (localStorage.getItem(DRAFT_KEY) ?? '').slice(0, MAX_MESSAGE_LENGTH)
  } catch {
    return ''
  }
}

export function storeDraft(body: string): void {
  try {
    if (body) localStorage.setItem(DRAFT_KEY, body)
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    // Un navegador con almacenamiento bloqueado no impide escribir.
  }
}
