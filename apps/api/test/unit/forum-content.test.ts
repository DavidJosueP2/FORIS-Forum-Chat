import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { postDocument } from '../../src/modules/forum/forum-content.js';
import { createPostInput, updatePostInput } from '../../src/modules/forum/forum-validation.js';

test('el documento conserva formato, deriva texto buscable y referencias de imagen en orden', () => {
  const id = randomUUID();
  const result = postDocument({ version: 1, content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Una idea', marks: [{ type: 'bold' }] }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'El proceso', marks: [{ type: 'link', attrs: { href: 'https://example.com', target: '_self', rel: 'opener' } }] }] },
    { type: 'mediaImage', attrs: { mediaId: id, alt: 'Una ilustración', caption: 'El resultado' } },
  ] });
  assert.equal(result.body, 'Una idea\nEl proceso\nEl resultado');
  assert.deepEqual(result.mediaIds, [id]);
  assert.deepEqual(result.document.content[1]!.content![0]!.marks, [{ type: 'link', attrs: { href: 'https://example.com/' } }]);
  const imageOnly = postDocument({ version: 1, content: [{ type: 'mediaImage', attrs: { mediaId: id } }] });
  assert.equal(imageOnly.body, '');
  assert.deepEqual(imageOnly.mediaIds, [id]);
});

test('rechaza HTML, URLs ejecutables, imágenes externas, contenido vacío, atributos arbitrarios y exceso', () => {
  const paragraph = { type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] };
  const cases = [
    { version: 2, content: [paragraph] }, { version: 1, content: [{ type: 'paragraph' }] },
    { version: 1, content: [{ type: 'image', attrs: { src: 'https://example.com/a.jpg' } }] },
    { version: 1, content: [{ ...paragraph, attrs: { style: 'position:fixed' } }] },
    { version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] },
    { version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola', marks: [{ type: 'link', attrs: { href: 'https://user:password@example.com' } }] }] }] },
    { version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(10001) }] }] },
    { version: 1, content: [{ type: 'table', content: [{ type: 'tableRow', content: [] }] }] },
  ];
  for (const value of cases) assert.throws(() => postDocument(value));
  const input = { title: 'Una idea', requestId: randomUUID(), content: { version: 1, content: [paragraph] } };
  assert.throws(() => createPostInput({ ...input, body: 'Un texto distinto' }));
  assert.throws(() => createPostInput({ ...input, mediaIds: [randomUUID()] }));
  let nested: unknown = paragraph;
  for (let depth = 0; depth < 22; depth++) nested = { type: 'blockquote', content: [nested] };
  assert.throws(() => postDocument({ version: 1, content: [nested] }));
});

test('tablas combinadas requieren una cuadrícula completa y las imágenes no se duplican', () => {
  const cell = { type: 'tableCell', content: [{ type: 'paragraph' }] };
  const table = { type: 'table', content: [
    { type: 'tableRow', content: [{ ...cell, attrs: { rowspan: 2 } }, cell] },
    { type: 'tableRow', content: [cell] },
  ] };
  const paragraph = { type: 'paragraph', content: [{ type: 'text', text: 'Una comparación' }] };
  assert.equal(postDocument({ version: 1, content: [paragraph, table] }).document.content[1]!.type, 'table');
  assert.throws(() => postDocument({ version: 1, content: [paragraph, { type: 'table', content: [{ type: 'tableRow', content: [cell, cell] }, { type: 'tableRow', content: [cell] }] }] }));
  const image = { type: 'mediaImage', attrs: { mediaId: randomUUID() } };
  assert.throws(() => postDocument({ version: 1, content: [image, image] }));
});

test('editar exige versión y documento; no admite cambiar autor, comunidad o contador', () => {
  const input = { title: 'Actualizada', requestId: randomUUID(), revision: 1, content: { version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Una idea' }] }] } };
  assert.equal(updatePostInput(input).body, 'Una idea');
  for (const extra of [{ revision: 0 }, { revision: 1.5 }, { revision: '1' }, { authorId: randomUUID() }, { communityId: '12' }, { replyCount: 5 }, { body: 'Otro texto' }]) {
    assert.throws(() => updatePostInput({ ...input, ...extra }));
  }
  assert.throws(() => updatePostInput({ ...input, content: undefined }));
});
