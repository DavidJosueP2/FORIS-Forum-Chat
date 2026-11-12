export interface CommunityRef { id: string; name: string }
export interface Community extends CommunityRef {
  visibility: 'public' | 'private';
  imageId: string | null;
  description: string;
  owner: { id: string; displayName: string };
  memberCount: number;
  postCount: number;
  createdAt: string;
  isFavorite: boolean;
  membership: { role: 'owner' | 'member'; notifyPosts: boolean } | null;
}
export interface CreateCommunity { name: string; description: string; requestId: string; visibility?: 'public' | 'private'; imageId?: string | null }
export interface CommunityInvitation { id: string; createdAt: string; expiresAt: string; usedAt: string | null; revokedAt: string | null }
export interface InvitationPreview { community: CommunityRef; expiresAt: string; isMember: boolean }
export interface CommunityPreferences { favorite?: boolean; notifyPosts?: boolean }
export interface CommunityNotification {
  kind: 'community';
  id: string; community: CommunityRef; post: { id: string; title: string };
  authorName: string; createdAt: string; readAt: string | null;
}
export interface FollowNotification {
  kind: 'follow';
  id: string; follower: { id: string; displayName: string };
  createdAt: string; readAt: string | null;
}
export type InboxNotification = CommunityNotification | FollowNotification;
