import { resolve } from 'node:path';
import type { Pool } from 'pg';
import type { MediaConfig } from '../../apps/api/src/config/media-config.js';
import { LocalStorageAdapter } from '../../apps/api/src/modules/media/adapters/local-storage.adapter.js';
import { assertObjectKey } from '../../apps/api/src/modules/media/storage.port.js';
import { assertLocalPath, demoMarkerExists, demoTransaction, DemoError, localStat } from './local-target.js';

const tables = [
  'messages', 'users', 'user_google_identities', 'auth_sessions', 'auth_otp_challenges',
  'auth_google_flows', 'auth_mail_outbox', 'auth_login_attempts', 'forum_categories', 'forum_tags',
  'forum_posts', 'forum_post_tags', 'forum_replies', 'forum_post_edits', 'forum_post_votes',
  'forum_reply_votes', 'author_follows', 'communities', 'community_memberships', 'community_preferences',
  'community_notifications', 'community_invitations', 'media', 'media_quotas', 'media_events', 'media_metrics',
  'video_call_room', 'video_call_members', 'video_call_signals', 'chat_presence_rooms', 'chat_presence_leases',
].map(name => 'public.' + name).join(', ');

export function resetLocalDatabase(pool: Pool, database: string, media: MediaConfig, apply: boolean) {
  return demoTransaction(pool, database, async client => {
    if (apply) await client.query('LOCK TABLE ' + tables + ' IN ACCESS EXCLUSIVE MODE NOWAIT');
    const mismatch = (await client.query<{ found: boolean }>(`SELECT EXISTS (
      SELECT 1 FROM public.media WHERE storage_profile<>$1 OR provider<>'local'
    ) AS found`, [media.profile])).rows[0];
    if (mismatch?.found !== false) throw new DemoError('La base registra medios de otro almacenamiento.');
    await assertLocalPath(media.localRoot);
    const mediaRows = (await client.query<{ object_key: string; staging_key: string }>(
      'SELECT object_key,staging_key FROM public.media',
    )).rows;
    const keys = new Set(mediaRows.flatMap(row => [row.object_key, row.staging_key]));
    const files: string[] = [];
    for (const key of keys) {
      assertObjectKey(key);
      const path = resolve(media.localRoot, key);
      await assertLocalPath(path);
      const stat = await localStat(path);
      if (stat && !stat.isFile()) throw new DemoError('Una clave registrada no corresponde a un archivo regular.');
      if (stat) files.push(key);
    }
    const totals = (await client.query<{ users: string; posts: string; communities: string; media: string }>(`SELECT
      (SELECT COUNT(*)::text FROM public.users) AS users,
      (SELECT COUNT(*)::text FROM public.forum_posts) AS posts,
      (SELECT COUNT(*)::text FROM public.communities) AS communities,
      (SELECT COUNT(*)::text FROM public.media) AS media`)).rows[0];
    console.info('Inventario de ' + database, { ...totals, archivos: files.length });
    if (!apply) return;

    // PostgreSQL valida las dependencias del TRUNCATE antes de tocar archivos. Se
    // revierte todo el SQL si la limpieza falla y el siguiente reset puede continuar.
    await client.query('TRUNCATE TABLE ' + tables + ' RESTART IDENTITY');
    await client.query("INSERT INTO public.media_quotas(scope) VALUES('global')");
    await client.query("INSERT INTO public.video_call_room(id) VALUES('global')");
    const storage = new LocalStorageAdapter(media, '');
    for (const key of files) {
      await assertLocalPath(resolve(media.localRoot, key));
      await storage.remove(key);
    }
    for (const key of files) {
      if (await localStat(resolve(media.localRoot, key))) throw new DemoError('Todavía quedan archivos registrados. Reintenta con la API detenida.');
    }
    if (await demoMarkerExists(client)) {
      await client.query('UPDATE public.foris_demo_installation SET seeded_at=NULL,storage_profile=$1', [media.profile]);
    }
  }, apply ? 'exclusive' : 'read');
}
