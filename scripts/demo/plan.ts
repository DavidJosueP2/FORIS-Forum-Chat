import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { ForumContentNode } from '@messages/contracts';
import type { MediaConfig } from '../../apps/api/src/config/media-config.js';
import { forumCatalog } from '../../apps/api/src/database/seeds/forum-catalog.js';
import { normalizeImage } from '../../apps/api/src/modules/media/image-validator.js';
import { postDocument } from '../../apps/api/src/modules/forum/forum-content.js';
import { profiles, topics } from './fixtures.js';
import { DemoError } from './local-target.js';

interface Credit {
  title: string;
  alt?: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
}
export interface DemoAsset {
  id: string;
  key: string;
  objectKey: string;
  stagingKey: string;
  image: Awaited<ReturnType<typeof normalizeImage>>;
}
const directory = new URL('./assets/', import.meta.url);

export function demoId(value: string): string {
  const bytes = createHash('sha256').update('foris:demo:v1:' + value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 128;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

function creditNodes(credit: Credit): ForumContentNode[] {
  return [
    { type: 'text', text: credit.author, marks: [{ type: 'link', attrs: { href: credit.source } }] },
    { type: 'text', text: ' · ' },
    { type: 'text', text: credit.license, marks: [{ type: 'link', attrs: { href: credit.licenseUrl } }] },
  ];
}

export async function prepareDemo(media: MediaConfig, storageNamespace: string) {
  const credits = JSON.parse(await readFile(new URL('credits.json', directory), 'utf8')) as Record<string, Credit>;
  const assets = new Map<string, DemoAsset>();
  const checksums = new Set<string>();
  const sources = new Set<string>();

  async function asset(key: string, photo: boolean): Promise<DemoAsset> {
    if (!/^[a-z0-9-]{1,72}$/u.test(key) || assets.has(key)) throw new DemoError('Una imagen de demo se asignó más de una vez: ' + key);
    const credit = credits[key];
    if (photo && (!credit?.author || !credit.license || !credit.source || !credit.licenseUrl || sources.has(credit.source))) {
      throw new DemoError('Una fotografía de demo carece de crédito o repite su fuente: ' + key);
    }
    if (photo) sources.add(credit.source);
    const bytes = await readFile(new URL(key + '.webp', directory)).catch(() => { throw new DemoError('Falta la imagen WebP ' + key + '.'); });
    const image = await normalizeImage(bytes, 'image/webp', media).catch(() => {
      throw new DemoError('El WebP ' + key + ' no cumple los límites de imágenes de Foris.');
    });
    if (checksums.has(image.checksum)) throw new DemoError('Hay imágenes de demo con píxeles repetidos.');
    checksums.add(image.checksum);
    const id = demoId('media/' + key);
    const result = {
      key, id, image, objectKey: 'foris/images/' + id + '/' + demoId('object/' + storageNamespace + '/' + key) + '.webp',
      stagingKey: 'foris/staging/' + id + '/' + demoId('staging/' + storageNamespace + '/' + key) + '.bin',
    };
    assets.set(key, result);
    return result;
  }

  const people = [];
  if (profiles.length < 2) throw new DemoError('La demo necesita al menos dos perfiles para los hilos.');
  for (const [key, name, bio] of profiles) {
    people.push({ key, name, bio, id: demoId('user/' + key), email: key + '@foris-demo.test', avatar: await asset('avatar-' + key, false) });
  }
  const posts = [];
  for (const topic of topics) {
    const author = people.find(person => person.key === topic.author);
    const category = forumCatalog.find(item => item.slug === topic.category);
    if (!author || !category || !topic.photos.length || topic.photos.length > media.maxPerPost) {
      throw new DemoError('Revisa autor, categoría y límite de imágenes en ' + topic.key + '.');
    }
    if (!Number.isFinite(topic.daysAgo) || topic.daysAgo < 1 || topic.daysAgo > 3650
      || !topic.title.trim() || topic.title.length > 160
      || topic.name.trim().length < 3 || topic.name.length > 80
      || !topic.description.trim() || topic.description.length > 500
      || topic.replies.some(reply => !reply.trim() || reply.length > 5000)) {
      throw new DemoError('Revisa las fechas y los límites de texto en ' + topic.key + '.');
    }
    const cover = await asset('portada-' + topic.key, true);
    const images: DemoAsset[] = [];
    const content: ForumContentNode[] = [];
    for (const key of topic.photos) {
      const photo = await asset(key, true);
      images.push(photo);
      content.push({ type: 'mediaImage', attrs: {
        mediaId: photo.id,
        alt: credits[key].alt ?? credits[key].title,
      } });
    }
    content.push({ type: 'paragraph', content: [{ type: 'text', text: topic.intro }] });
    const attributions: ForumContentNode[] = [{ type: 'text', text: 'Créditos de fotos y portada · ' }];
    for (const [index, item] of [...images, cover].entries()) {
      if (index) attributions.push({ type: 'text', text: ' | ' });
      attributions.push(...creditNodes(credits[item.key]));
    }
    content.push({ type: 'paragraph', content: attributions });
    let document: ReturnType<typeof postDocument>['document'];
    try { ({ document } = postDocument({ version: 1, content })); }
    catch { throw new DemoError('El documento de la publicación ' + topic.key + ' no es válido. Revisa el texto y los créditos.'); }
    posts.push({ ...topic, id: demoId('post/' + topic.key), categoryId: category.id, author, cover, images, document });
  }
  const bytes = [...assets.values()].reduce((sum, item) => sum + BigInt(item.image.bytes.length), 0n);
  if (bytes > BigInt(media.globalBytes)) throw new DemoError('La demo supera la cuota global de imágenes.');
  return { people, posts, assets, bytes };
}
export type DemoPlan = Awaited<ReturnType<typeof prepareDemo>>;
