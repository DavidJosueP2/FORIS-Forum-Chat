import { Inject, Injectable } from '@nestjs/common';
import type { FollowState, ForumAuthorProfile } from '@messages/contracts';
import { DatabaseService } from '../../database/database.service.js';
import { HttpError } from '../../common/errors/http-error.js';
import type { AuthContext, SqlClient } from '../auth/auth.types.js';
import { ForumAccess } from './forum-access.service.js';
import { publicPost, readableCommunity, readablePost } from '../communities/community-access.js';

@Injectable()
export class ForumFollowRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ForumAccess) private readonly access: ForumAccess) {}

  async author(id: string, viewer: string | null, client: SqlClient = this.database): Promise<ForumAuthorProfile> {
    const row = (await client.query<{ id: string; display_name: string; bio: string; avatar_id: string | null; following: boolean; created_at: Date; post_count: number; community_count: number }>(`SELECT u.id,u.display_name,u.bio,u.created_at,a.id AS avatar_id,
      EXISTS(SELECT 1 FROM author_follows f WHERE f.follower_id=$2 AND f.author_id=u.id) AS following,
      (SELECT COUNT(*)::int FROM forum_posts p WHERE p.author_id=u.id AND ` + publicPost() + `) AS post_count,
      (SELECT COUNT(*)::int FROM community_memberships pm JOIN communities pc ON pc.id=pm.community_id WHERE pm.user_id=u.id AND pc.visibility='public') AS community_count
      FROM users u LEFT JOIN media a ON a.avatar_user_id=u.id AND a.state='READY'
      WHERE u.id=$1 AND (u.id=$2::uuid
        OR EXISTS(SELECT 1 FROM forum_posts p WHERE p.author_id=u.id AND ` + readablePost('$2') + `)
        OR EXISTS(SELECT 1 FROM forum_replies r JOIN forum_posts p ON p.id=r.post_id WHERE r.author_id=u.id AND r.deleted_at IS NULL AND ` + readablePost('$2') + `)
        OR EXISTS(SELECT 1 FROM community_memberships pm JOIN communities c ON c.id=pm.community_id WHERE pm.user_id=u.id AND ` + readableCommunity('c', '$2') + `)
        OR EXISTS(SELECT 1 FROM messages public_message WHERE public_message.user_id=u.id))`, [id, viewer])).rows[0];
    if (!row) throw new HttpError(404, 'AUTHOR_NOT_FOUND', 'Este autor no está disponible.');
    return { id: row.id, displayName: row.display_name, bio: row.bio, ...(row.avatar_id ? { avatarId: row.avatar_id } : {}), isFollowing: row.following,
      createdAt: new Date(row.created_at).toISOString(), publicPostCount: row.post_count, publicCommunityCount: row.community_count };
  }
  async followAuthor(id: string, follow: boolean, actor: AuthContext): Promise<FollowState> {
    return this.database.transaction(async client => {
      await this.access.member(client, actor);
      if (id === actor.user.id) throw new HttpError(400, 'SELF_FOLLOW', 'No necesitas seguirte a ti mismo.');
      if (follow) {
        await this.author(id, actor.user.id, client);
        const target = await client.query('SELECT id FROM users WHERE id=$1 FOR KEY SHARE', [id]);
        if (!target.rows[0]) throw new HttpError(404, 'AUTHOR_NOT_FOUND', 'Este autor no está disponible.');
        await client.query('INSERT INTO author_follows(follower_id,author_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [actor.user.id, id]);
      } else await client.query('DELETE FROM author_follows WHERE follower_id=$1 AND author_id=$2', [actor.user.id, id]);
      return { isFollowing: follow };
    });
  }
  async followCommunity(id: string, follow: boolean, actor: AuthContext): Promise<FollowState> {
    return this.database.transaction(async client => {
      await this.access.member(client, actor);
      if (follow) {
        const target = await client.query('SELECT c.id FROM communities c WHERE c.id=$1 AND ' + readableCommunity('c', '$2') + ' FOR UPDATE OF c', [id, actor.user.id]);
        if (!target.rows[0]) throw new HttpError(404, 'COMMUNITY_NOT_FOUND', 'Esta comunidad no está disponible.');
        await client.query('INSERT INTO community_follows(user_id,community_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [actor.user.id, id]);
      } else await client.query('DELETE FROM community_follows WHERE user_id=$1 AND community_id=$2', [actor.user.id, id]);
      return { isFollowing: follow };
    });
  }
}
