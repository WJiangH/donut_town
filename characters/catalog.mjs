import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

// Public bindings contain only domain-separated keyed hashes, never Slack IDs.
const assignments = new Map(Object.entries(JSON.parse(readFileSync(new URL('./assignments.json', import.meta.url), 'utf8'))));
if ([...assignments].some(([key, id]) => !/^[a-f0-9]{64}$/.test(key) || !/^r-[a-z0-9-]+$/.test(id))) {
  throw new Error('Invalid hashed character assignment');
}

export function memberCharacterKey(userId, secret) {
  if (typeof userId !== 'string' || !userId || typeof secret !== 'string' || !secret) return null;
  return createHmac('sha256', secret).update('donut-town:character:v1\0' + userId).digest('hex');
}

export function createCharacterResolver(bindings, characters) {
  return (userId, secret) => {
    const key = memberCharacterKey(userId, secret);
    return key ? characters.get(bindings.get(key)) || null : null;
  };
}

const catalog = new Map([...new Set(assignments.values())].map(id => {
  const character = JSON.parse(readFileSync(new URL(`./${id}.json`, import.meta.url), 'utf8'));
  if (!/^\/assets\/residents\/[a-z0-9-]+\/[a-z0-9-]+\.png$/.test(character.url)
    || !Number.isInteger(character.imageWidth) || character.imageWidth <= 0
    || !Number.isInteger(character.imageHeight) || character.imageHeight <= 0
    || !Number.isFinite(character.frameHeight) || character.frameHeight <= 0
    || character.frames?.length !== 9
    || !character.frames.every(frame => Array.isArray(frame) && frame.length === 4 && frame.every(Number.isFinite)
      && frame[0] >= 0 && frame[1] >= 0 && frame[2] > 0 && frame[3] > 0
      && frame[0] + frame[2] <= character.imageWidth && frame[1] + frame[3] <= character.imageHeight)) {
    throw new Error(`Invalid character manifest: ${id}`);
  }
  return [id, Object.freeze(character)];
}));

export const characterForMember = createCharacterResolver(assignments, catalog);
