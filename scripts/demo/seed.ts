import { resolve } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import type { AppConfig } from '../../apps/api/src/config/app-config.js';
import { LocalStorageAdapter } from '../../apps/api/src/modules/media/adapters/local-storage.adapter.js';
import { hashPassword } from '../../apps/api/src/modules/auth/auth-crypto.js';
import { assertLocalPath, demoTransaction, DemoError, ensureDemoMarker } from './local-target.js';
import { seedCatalogs } from './catalogs.js';
import { demoId } from './plan.js';
import type { DemoAsset, DemoPlan } from './plan.js';

const day = 86400000;
const minute = 60000;

function memberList(people: DemoPlan['people'], author: DemoPlan['people'][number], index: number) {
  const members = [author];
  const size = Math.min(people.length, 4 + index % 5);
  for (let offset = 0; members.length < size; offset++) {
    const person = people[(index * 3 + offset) % people.length];
    if (!members.includes(person)) members.push(person);
  }
  return members;
}

interface AssetLink {
  asset: DemoAsset;
  owner: string;
  purpose: 'post' | 'community' | 'avatar';
  postId?: string;
  position?: number;
  communityId?: string;
  avatarId?: string;
}

async function saveAssets(client: PoolClient, config: AppConfig, links: AssetLink[]): Promise<void> {
  const { media } = config;
  const storage = new LocalStorageAdapter(media, config.auth?.secret ?? '');
  const amounts = new Map<string, bigint>();
  let total = 0n;
  for (const { asset, owner } of links) {
    const amount = BigInt(asset.image.bytes.length);
    amounts.set(owner, (amounts.get(owner) ?? 0n) + amount);
    total += amount;
  }
  const budgets: [string, bigint][] = [['global', total], ...amounts];
  for (const [owner, amount] of budgets) {
    const scope = owner === 'global' ? 'global' : 'user:' + owner;
    const limit = owner === 'global' ? media.globalBytes : media.userBytes;
    await client.query('INSERT INTO public.media_quotas(scope) VALUES($1) ON CONFLICT DO NOTHING', [scope]);
    const updated = await client.query(`UPDATE public.media_quotas SET used_bytes=used_bytes+$2::bigint
      WHERE scope=$1 AND used_bytes+reserved_bytes+$2::bigint<=$3::bigint RETURNING scope`, [scope, amount.toString(), limit]);
    if (updated.rows.length !== 1) throw new DemoError('La demo no cabe en la cuota de imágenes configurada.');
  }

  for (const { asset, owner, purpose, postId, position, communityId, avatarId } of links) {
    const { image } = asset;
    await assertLocalPath(resolve(media.localRoot, asset.objectKey));
    // Si hubo una interrupción, put reutiliza el archivo únicamente si su contenido coincide.
    await storage.put(asset.objectKey, image.bytes, image.mime);
    await client.query(`INSERT INTO public.media(
        id,owner_id,request_id,storage_profile,provider,staging_key,object_key,original_name,
        declared_mime,declared_bytes,validated_mime,actual_bytes,accounted_bytes,reserved_bytes,width,height,checksum,
        state,upload_expires_at,cleanup_after,staging_deleted_at,confirmed_at,post_id,position,purpose,community_id,avatar_user_id
      ) VALUES($1,$2,$3,$4,'local',$5,$6,$7,'image/webp',$8,'image/webp',$8,$8,0,$9,$10,$11,
        'READY',CURRENT_TIMESTAMP-INTERVAL '2 days',CURRENT_TIMESTAMP+INTERVAL '2 days',
        CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,$12,$13,$14,$15,$16)`,
    [asset.id, owner, demoId('media-request/' + asset.key), media.profile, asset.stagingKey, asset.objectKey, asset.key + '.webp',
      image.bytes.length, image.width, image.height, image.checksum, postId ?? null, position ?? null, purpose, communityId ?? null, avatarId ?? null]);
  }
}

async function seedDiscussion(client: PoolClient, post: DemoPlan['posts'][number], members: DemoPlan['people'], created: number, spacing: number, index: number) {
  const others = members.filter(member => member.id !== post.author.id);
  const votes = (index * 5 + 3) % members.length;
  for (const member of others.slice(0, votes)) {
    await client.query('INSERT INTO public.forum_post_votes(post_id,user_id,value) VALUES($1,$2,1)', [post.id, member.id]);
  }
  let previous: { id: string; depth: number } | undefined;
  for (const [offset, reply] of post.replies.entries()) {
    const parent: { id: string; depth: number } | undefined =
      post.replies.length >= 3 && (offset === 1 || offset === 2) ? previous : undefined;
    const depth = parent ? parent.depth + 1 : 0;
    const author = offset === 2 && parent ? post.author : others[offset % others.length];
    const date = new Date(created + (offset + 1) * spacing);
    const row = (await client.query<{ id: string }>(`INSERT INTO public.forum_replies(
        post_id,author_id,body,request_id,created_at,parent_id,depth
      ) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [post.id, author.id, reply, demoId('reply/' + post.key + '/' + offset), date, parent?.id ?? null, depth])).rows[0];
    previous = { id: row.id, depth };
    if ((index + offset) % 3 !== 0) {
      const voter = members.find(member => member.id !== author.id)!;
      await client.query('INSERT INTO public.forum_reply_votes(reply_id,user_id,value) VALUES($1,$2,1)', [row.id, voter.id]);
    }
  }
}

export async function seedDemo(pool: Pool, database: string, config: AppConfig, plan: DemoPlan, password?: string): Promise<boolean> {
  const passwordHash = password ? await hashPassword(password) : null;
  return demoTransaction(pool, database, async client => {
    if (await ensureDemoMarker(client, config.media.profile)) return false;
    await assertLocalPath(config.media.localRoot);
    await seedCatalogs(client);
    const anchor = new Date((await client.query<{ now: Date }>('SELECT CURRENT_TIMESTAMP AS now')).rows[0].now).getTime();
    const joined = new Date(anchor - 40 * day);
    const links: AssetLink[] = [];
    for (const [index, person] of plan.people.entries()) {
      await client.query(`INSERT INTO public.users(id,email,display_name,bio,password_hash,email_verified_at,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$6,$6)`, [person.id, person.email, person.name, person.bio, index === 0 ? passwordHash : null, joined]);
      links.push({ asset: person.avatar, owner: person.id, purpose: 'avatar', avatarId: person.id });
    }
    const tagRows = (await client.query<{ id: string; name: string }>("SELECT id,name FROM public.forum_tags WHERE name IN ('pregunta','inspiración','experiencia')")).rows;
    const tags = new Map(tagRows.map(row => [row.name, row.id]));

    for (const [index, post] of plan.posts.entries()) {
      const owner = post.author.id;
      const members = memberList(plan.people, post.author, index);
      const nameKey = post.name.normalize('NFC').toLocaleLowerCase('es');
      const community = (await client.query<{ id: string }>(`INSERT INTO public.communities(
          name,name_key,description,owner_id,request_id,member_count,post_count,created_at,visibility,image_request_id
        ) VALUES($1,$2,$3,$4,$5,$6,1,$7,$8,$9) RETURNING id`,
      [post.name, nameKey, post.description, owner, demoId('community/' + post.key), members.length,
        joined, post.private ? 'private' : 'public', post.cover.id])).rows[0];
      links.push({ asset: post.cover, owner, purpose: 'community', communityId: community.id });
      for (const member of members) {
        await client.query('INSERT INTO public.community_memberships(community_id,user_id,joined_at) VALUES($1,$2,$3)', [community.id, member.id, joined]);
      }
      const created = anchor - post.daysAgo * day;
      const spacing = Math.min((50 + index * 3) * minute, (anchor - created) / (post.replies.length + 1));
      const activeAt = new Date(created + post.replies.length * spacing);
      const tag = post.title.includes('¿') ? 'pregunta' : index % 2 ? 'experiencia' : 'inspiración';
      const tagId = tags.get(tag);
      if (!tagId) throw new DemoError('Falta la etiqueta de catálogo: ' + tag + '.');
      await client.query(`INSERT INTO public.forum_posts(
          id,category_id,author_id,title,body,request_id,tag_request_names,reply_count,created_at,
          last_activity_at,community_id,content,media_request_ids
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [post.id, post.categoryId, owner, post.title, post.intro, demoId('post-request/' + post.key), [tag], post.replies.length,
        new Date(created), activeAt, community.id, JSON.stringify(post.document), post.images.map(image => image.id)]);
      await client.query('INSERT INTO public.forum_post_tags(post_id,tag_id,position) VALUES($1,$2,0)', [post.id, tagId]);
      post.images.forEach((asset, position) => links.push({ asset, owner, purpose: 'post', postId: post.id, position }));
      await seedDiscussion(client, post, members, created, spacing, index);
    }
    await saveAssets(client, config, links);
    await client.query('UPDATE public.foris_demo_installation SET seeded_at=CURRENT_TIMESTAMP');
    return true;
  });
}
