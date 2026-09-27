import { createHmac, randomUUID } from 'node:crypto';

export function mapOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash ? url.origin : null;
  } catch { return null; }
}

export function createMapLaunchTicket({ userId, townOrigin, secret, now = Date.now() }) {
  if (!/^[UW][A-Z0-9]+$/.test(userId || '') || !mapOrigin(townOrigin) || typeof secret !== 'string' || secret.length < 32) {
    throw new Error('Map SSO configuration is incomplete');
  }
  const seconds = Math.floor(now / 1000);
  const payload = { type: 'launch', aud: 'stemm-map', iss: mapOrigin(townOrigin), sub: userId,
    iat: seconds, exp: seconds + 60, jti: randomUUID() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(`stemm-map:launch:v1:${encoded}`).digest('base64url');
  return `v1.${encoded}.${signature}`;
}
