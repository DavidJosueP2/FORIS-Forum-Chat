import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { forumCatalog } from '../../src/database/seeds/forum-catalog.js';
import { createPostInput, forumFilters, forumId } from '../../src/modules/forum/forum-validation.js';
import { encodePostCursor, decodePostCursor } from '../../src/modules/forum/forum-cursor.js';
import { postTags, tagFilters } from '../../src/modules/forum/taxonomy-validation.js';
import { pageInput } from '../../src/common/validation/input.js';

test('el catálogo tiene ramas profundas, rutas sin ciclos y padres de la misma raíz', () => {
  const categories = new Map(forumCatalog.map(item => [item.id, item]));
  assert.equal(categories.size, forumCatalog.length);
  assert.ok(forumCatalog.length > 80);
  assert.deepEqual(forumCatalog.filter(item => item.depth === 0).map(item => item.slug), ['general', 'tecnologia', 'aprendizaje', 'creatividad', 'proyectos']);
  const siblings = new Set<string>();
  for (const item of forumCatalog) {
    const key = (item.parentId ?? 'root') + '/' + item.slug;
    assert.equal(siblings.has(key), false);
    siblings.add(key);
    assert.equal(item.path.length, item.depth + 1);
    assert.equal(item.path[0], item.rootId);
    assert.equal(item.path.at(-1), item.id);
    assert.equal(new Set(item.path).size, item.path.length);
    if (item.parentId) {
      const parent = categories.get(item.parentId)!;
      assert.equal(parent.rootId, item.rootId);
      assert.equal(parent.depth + 1, item.depth);
      assert.deepEqual(item.path.slice(0, -1), parent.path);
    } else assert.equal(item.id, item.rootId);
  }
});

test('normaliza etiquetas equivalentes, conserva nombres Unicode y rechaza marcado, controles y exceso', () => {
  assert.deepEqual(postTags([' TypeScript ', 'ＴｙｐｅＳｃｒｉｐｔ', 'GUÍA', 'gui\u0301a', 'C++', 'Node.js']), ['c++', 'guía', 'node.js', 'typescript']);
  assert.deepEqual(postTags(undefined), []);
  for (const value of [null, 'tag', Array(9).fill('a'), ['<script>'], ['a\nb'], ['a\u200bb'], ['x'.repeat(33)], [12], ['']]) {
    assert.throws(() => postTags(value));
  }
  assert.throws(() => tagFilters({ search: ['a', 'b'] }));
  assert.throws(() => tagFilters({ limit: '31' }));
});

test('la publicación admite clasificación opcional y mantiene IDs de comunidad numéricos', () => {
  const input = { title: 'Hola', body: 'Una idea', requestId: randomUUID() };
  const post = createPostInput(input);
  assert.equal(post.categoryId, undefined);
  assert.deepEqual(post.tags, []);
  assert.equal(createPostInput({ ...input, categoryId: null }).categoryId, null);
  assert.equal(createPostInput({ ...input, communityId: '12' }).communityId, '12');
  assert.throws(() => createPostInput({ ...input, categoryId: '12' }));
  assert.throws(() => createPostInput({ ...input, communityId: randomUUID() }));
  assert.throws(() => createPostInput({ ...input, authorId: randomUUID() }));
  assert.throws(() => forumId('12'));
  assert.equal(forumId(input.requestId.toUpperCase()), input.requestId);
});

test('cursores cronológicos validan versión, fecha, UUID y formato; respuestas conservan cursor numérico', () => {
  const row = { createdAt: '2026-11-05T12:00:00.123Z', id: randomUUID() };
  const cursor = encodePostCursor(row);
  assert.deepEqual(decodePostCursor(cursor), row);
  assert.deepEqual(forumFilters({ before: cursor, limit: '2' }).before, row);
  assert.equal(pageInput({ before: '12' }).before, '12');
  for (const raw of [undefined, [], '12', 'a'.repeat(257), cursor + '=', row.id]) assert.throws(() => decodePostCursor(raw));
  const payload = { v: 1, t: row.createdAt, id: row.id };
  for (const altered of [{ ...payload, v: 2 }, { ...payload, t: '2026-02-30T12:00:00.123Z' }, { ...payload, t: 'invalid' }, { ...payload, id: '12' }, { ...payload, extra: true }]) {
    assert.throws(() => decodePostCursor(Buffer.from(JSON.stringify(altered)).toString('base64url')));
  }
});
