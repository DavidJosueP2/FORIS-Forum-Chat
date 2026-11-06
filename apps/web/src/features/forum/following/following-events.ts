export const FOLLOWING_CHANGED = 'foris:following-changed'
export interface FollowingChange { viewer: string; kind: 'author'; id: string; isFollowing: boolean }
export function followingChange(event: Event, viewer: string | null): FollowingChange | null {
  if (!(event instanceof CustomEvent) || !event.detail || typeof event.detail !== 'object') return null
  const value = event.detail as Partial<FollowingChange>
  return value.viewer === viewer && value.kind === 'author' && typeof value.id === 'string' && typeof value.isFollowing === 'boolean' ? value as FollowingChange : null
}
