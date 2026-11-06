import { Inject, Injectable } from '@nestjs/common';
import type { AuthContext, SqlClient } from '../auth/auth.types.js';
import { SessionService } from '../auth/session.service.js';
import { CommunityRepository } from '../communities/community.repository.js';
import { HttpError } from '../../common/errors/http-error.js';
import { readablePost } from '../communities/community-access.js';

@Injectable()
export class ForumAccess {
  constructor(@Inject(SessionService) private readonly sessions: SessionService,
    @Inject(CommunityRepository) private readonly communities: CommunityRepository) {}

  async member(client: SqlClient, actor: AuthContext): Promise<void> {
    const user = await client.query('SELECT id FROM users WHERE id=$1 AND email_verified_at IS NOT NULL FOR NO KEY UPDATE', [actor.user.id]);
    if (!user.rows[0]) throw new HttpError(401, 'SESSION_REQUIRED', 'Inicia sesión para participar.');
    await this.sessions.assertCurrent(client, actor);
  }

  async writablePost(client: SqlClient, actor: AuthContext, id: string) {
    await this.member(client, actor);
    const parent = (await client.query<{ community_id: string | null }>('SELECT p.community_id FROM forum_posts p WHERE p.id=$1 AND ' + readablePost('$2'), [id, actor.user.id])).rows[0];
    if (!parent) throw new HttpError(404, 'POST_NOT_FOUND', 'Esta publicación no existe.');
    if (parent.community_id) await this.communities.authorizePublication(client, String(parent.community_id), actor.user.id);
    // Orden compartido con edición: usuario, comunidad y publicación; serializa los cambios del hilo.
    const post = (await client.query<{ id: string; author_id: string; reply_count: number }>('SELECT id,author_id,reply_count FROM forum_posts WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!post) throw new HttpError(404, 'POST_NOT_FOUND', 'Esta publicación no existe.');
    return post;
  }
}
