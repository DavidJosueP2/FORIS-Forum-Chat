import { Inject, Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import type { CommunityNotification, ForumPage } from '@messages/contracts';
import { DatabaseService } from '../../database/database.service.js';
import { HttpError } from '../../common/errors/http-error.js';
import { resultPage } from '../../common/validation/input.js';
import type { AuthContext } from '../auth/auth.types.js';
import { CommunityRepository } from './community.repository.js';

interface NotificationRow extends QueryResultRow {
  id: string; community_id: string; community_name: string; post_id: string; title: string;
  display_name: string; created_at: Date; read_at: Date | null;
}
@Injectable()
export class NotificationRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService, @Inject(CommunityRepository) private readonly communities: CommunityRepository) {}
  async count(userId: string): Promise<{ unreadCount: number }> {
    const result = await this.database.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM community_notifications WHERE recipient_id=$1 AND read_at IS NULL', [userId]);
    return { unreadCount: Number(result.rows[0].total) };
  }
  async list(userId: string, before: string | undefined, limit: number): Promise<ForumPage<CommunityNotification>> {
    const rows = await this.database.query<NotificationRow>(`SELECT n.*,c.name AS community_name,p.title,u.display_name
      FROM community_notifications n JOIN communities c ON c.id=n.community_id
      JOIN forum_posts p ON p.id=n.post_id JOIN users u ON u.id=p.author_id
      WHERE n.recipient_id=$1` + (before ? ' AND n.id<$3' : '') + ' ORDER BY n.id DESC LIMIT $2', before ? [userId, limit + 1, before] : [userId, limit + 1]);
    return resultPage(rows.rows.map(row => ({
      id: String(row.id), community: { id: String(row.community_id), name: row.community_name },
      post: { id: String(row.post_id), title: row.title }, authorName: row.display_name,
      createdAt: new Date(row.created_at).toISOString(), readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    })), limit);
  }
  async read(id: string, actor: AuthContext): Promise<{ ok: true }> {
    return this.database.transaction(async client => {
      await this.communities.actor(client, actor);
      const result = await client.query('UPDATE community_notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE id=$1 AND recipient_id=$2 RETURNING id', [id, actor.user.id]);
      if (!result.rows[0]) throw new HttpError(404, 'NOTIFICATION_NOT_FOUND', 'Este aviso no existe.');
      return { ok: true };
    });
  }
  async readThrough(id: string, actor: AuthContext): Promise<{ ok: true }> {
    return this.database.transaction(async client => {
      await this.communities.actor(client, actor);
      await client.query('UPDATE community_notifications SET read_at=CURRENT_TIMESTAMP WHERE recipient_id=$1 AND id<=$2 AND read_at IS NULL', [actor.user.id, id]);
      return { ok: true };
    });
  }
}
