import { invalidInput, requestId, resourceId } from '../../common/validation/input.js';
import { HttpError } from '../../common/errors/http-error.js';
import type { SqlClient } from '../auth/auth.types.js';

export type ConversationScope = { kind: 'community' | 'direct'; id: string };

export function conversationScope(value: unknown): ConversationScope {
  if (typeof value !== 'string') invalidInput('La conversación no es válida.');
  if (value.startsWith('community:')) return { kind: 'community', id: resourceId(value.slice(10)) };
  if (value.startsWith('direct:')) return { kind: 'direct', id: requestId(value.slice(7)) };
  return invalidInput('La conversación no es válida.');
}

export function conversationNotFound(): never {
  throw new HttpError(404, 'CONVERSATION_NOT_FOUND', 'Esta conversación no está disponible para tu cuenta.');
}

export async function authorizeConversation(client: SqlClient, user: string, scope: ConversationScope): Promise<string> {
  if (scope.kind === 'community') {
    const membership = await client.query('SELECT 1 FROM community_memberships WHERE user_id=$1 AND community_id=$2 FOR KEY SHARE', [user, scope.id]);
    if (!membership.rows.length) conversationNotFound();
    return 'community:' + scope.id;
  }
  const mutual = await client.query(`SELECT 1 FROM author_follows f
    JOIN author_follows r ON r.follower_id=f.author_id AND r.author_id=f.follower_id
    JOIN users u ON u.id=f.author_id AND u.email_verified_at IS NOT NULL
    WHERE f.follower_id=$1 AND f.author_id=$2 FOR KEY SHARE OF f,r`, [user, scope.id]);
  if (!mutual.rows.length) conversationNotFound();
  return 'direct:' + [user, scope.id].sort().join(':');
}

export async function authorizeStoredConversation(client: SqlClient, user: string, key: string): Promise<void> {
  if (key === 'global') return;
  if (key.startsWith('community:')) {
    await authorizeConversation(client, user, conversationScope(key));
    return;
  }
  const [, first, second] = key.split(':');
  const peer = first === user ? second : second === user ? first : undefined;
  if (!peer) conversationNotFound();
  await authorizeConversation(client, user, { kind: 'direct', id: peer });
}
