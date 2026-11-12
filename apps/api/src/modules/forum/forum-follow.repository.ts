import { Inject, Injectable } from '@nestjs/common';
import type { FollowState, ForumAuthorProfile } from '@messages/contracts';
import { DatabaseService } from '../../database/database.service.js';
import { HttpError } from '../../common/errors/http-error.js';
import type { AuthContext, SqlClient } from '../auth/auth.types.js';
import { ForumAccess } from './forum-access.service.js';
import { publicPost } from '../communities/community-access.js';
import { visibleAuthor } from './author-visibility.js';

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
      WHERE u.id=$1 AND ${visibleAuthor('$2')}`, [id, viewer])).rows[0];
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
        const created = await client.query('INSERT INTO author_follows(follower_id,author_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING author_id', [actor.user.id, id]);
        if (created.rows[0]) await client.query(`INSERT INTO community_notifications(recipient_id,follower_id)
          VALUES($2,$1) ON CONFLICT(recipient_id,follower_id) DO NOTHING`, [actor.user.id, id]);
      } else await client.query('DELETE FROM author_follows WHERE follower_id=$1 AND author_id=$2', [actor.user.id, id]);
      return { isFollowing: follow };
    });
  }
}
