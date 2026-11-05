export const NOTIFICATIONS_CHANGED = 'foris:notifications-changed'
export function notifyInboxChanged() { window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED)) }
export function validCommunityId(value: string): boolean {
  return /^[1-9]\d{0,18}$/u.test(value) && BigInt(value) <= 9223372036854775807n
}
