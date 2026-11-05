import { test } from 'node:test';
import assert from 'node:assert/strict';
import { returnTarget } from '../../src/modules/auth/return-target.js';

test('el regreso tras entrar solo acepta rutas internas conocidas', () => {
  for (const path of ['/', '/chat', '/profile', '/comunidades', '/comunidades/crear', '/comunidades/12', '/notificaciones', '/publicar', '/publicar?topico=general', '/publicar?comunidad=12', '/publicar?topico=general&comunidad=12', '/publicaciones/12#responder']) assert.equal(returnTarget(path), path);
  for (const path of ['//evil.example', 'https://evil.example', '/\\evil.example', '/publicar?next=https://evil.example', '/publicar?comunidad=1&comunidad=2', '/publicar?comunidad=0', '/publicaciones/0', '/profile\r\nLocation: https://evil.example', undefined]) assert.equal(returnTarget(path), '/');
});
