import { readableCommunity, readablePost } from '../communities/community-access.js';

/** El alias u y el marcador del visitante se definen en las consultas de Foris. */
export function visibleAuthor(viewer: '$1' | '$2'): string {
  return `(u.id=${viewer}::uuid
    OR EXISTS(SELECT 1 FROM forum_posts p WHERE p.author_id=u.id AND ${readablePost(viewer)})
    OR EXISTS(SELECT 1 FROM forum_replies r JOIN forum_posts p ON p.id=r.post_id WHERE r.author_id=u.id AND r.deleted_at IS NULL AND ${readablePost(viewer)})
    OR EXISTS(SELECT 1 FROM community_memberships pm JOIN communities c ON c.id=pm.community_id WHERE pm.user_id=u.id AND ${readableCommunity('c', viewer)})
    OR EXISTS(SELECT 1 FROM messages public_message WHERE public_message.user_id=u.id)
    OR EXISTS(SELECT 1 FROM community_notifications n WHERE n.recipient_id=${viewer}::uuid AND n.follower_id=u.id)
    OR EXISTS(SELECT 1 FROM direct_conversations d
      WHERE (d.first_id=${viewer}::uuid AND d.second_id=u.id) OR (d.second_id=${viewer}::uuid AND d.first_id=u.id)))`;
}
