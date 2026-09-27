import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createMapLaunchTicket, mapOrigin } from '../map/sso.mjs';

test('Map launch uses a short signed ticket for the current Town member', () => {
  const secret = 'a'.repeat(64);
  const ticket = createMapLaunchTicket({ userId: 'U12345', townOrigin: 'https://town.example', secret, now: 1_000_000 });
  const [version, encoded, signature] = ticket.split('.');
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  assert.equal(version, 'v1');
  assert.deepEqual({ type: payload.type, aud: payload.aud, iss: payload.iss, sub: payload.sub, ttl: payload.exp - payload.iat },
    { type: 'launch', aud: 'stemm-map', iss: 'https://town.example', sub: 'U12345', ttl: 60 });
  assert.equal(signature, createHmac('sha256', secret).update(`stemm-map:launch:v1:${encoded}`).digest('base64url'));
  assert.notEqual(ticket, createMapLaunchTicket({ userId: 'U12345', townOrigin: 'https://town.example', secret, now: 1_000_000 }));
  assert.equal(mapOrigin('https://town.example/path'), null);
  assert.throws(() => createMapLaunchTicket({ userId: 'bad', townOrigin: 'https://town.example', secret }));
  assert.throws(() => createMapLaunchTicket({ userId: 'U12345', townOrigin: 'https://town.example', secret: 'weak' }));
});
