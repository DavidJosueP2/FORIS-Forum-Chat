export interface CommunityRef { id: string; name: string }
export interface Community extends CommunityRef {
  description: string;
  owner: { id: string; displayName: string };
  memberCount: number;
  postCount: number;
  createdAt: string;
  isFavorite: boolean;
  membership: { role: 'owner' | 'member'; notifyPosts: boolean } | null;
}
export interface CreateCommunity { name: string; description: string; requestId: string }
export interface CommunityPreferences { favorite?: boolean; notifyPosts?: boolean }
export interface CommunityNotification {
  id: string; community: CommunityRef; post: { id: string; title: string };
  authorName: string; createdAt: string; readAt: string | null;
}
