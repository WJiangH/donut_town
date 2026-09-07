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

function validFrames(frames, imageWidth, imageHeight, count = 1) {
  return Array.isArray(frames) && frames.length >= count
    && (count === 1 || frames.length === count)
    && frames.every(frame => Array.isArray(frame) && frame.length === 4 && frame.every(Number.isFinite)
      && frame[0] >= 0 && frame[1] >= 0 && frame[2] > 0 && frame[3] > 0
      && frame[0] + frame[2] <= imageWidth && frame[1] + frame[3] <= imageHeight);
}

function validAtlas(art, frameCount) {
  return art && /^\/assets\/residents\/[a-z0-9-]+\/[a-z0-9-]+\.png$/.test(art.url)
    && Number.isInteger(art.imageWidth) && art.imageWidth > 0
    && Number.isInteger(art.imageHeight) && art.imageHeight > 0
    && Number.isFinite(art.frameHeight) && art.frameHeight > 0
    && validFrames(art.frames, art.imageWidth, art.imageHeight, frameCount);
}

function validActions(actions) {
  if (!actions || typeof actions !== 'object' || Array.isArray(actions)) return false;
  return Object.entries(actions).every(([id, action]) => /^[a-zA-Z]+$/.test(id)
    && validAtlas(action, 1)
    && (!action.facing || ['down', 'right', 'left', 'up'].includes(action.facing))
    && (!action.loop || (Array.isArray(action.loop) && action.loop.length >= 1
      && action.loop.every(index => Number.isInteger(index) && index >= 0 && index < action.frames.length)))
    && (action.frameMs === undefined || (Number.isFinite(action.frameMs) && action.frameMs > 0)));
}

export function createCharacterResolver(bindings, characters) {
  return (userId, secret) => {
    const key = memberCharacterKey(userId, secret);
    return key ? characters.get(bindings.get(key)) || null : null;
  };
}

const catalog = new Map([...new Set(assignments.values())].map(id => {
  const character = JSON.parse(readFileSync(new URL(`./${id}.json`, import.meta.url), 'utf8'));
  if (!validAtlas(character, 9) || (character.actions && !validActions(character.actions))) {
    throw new Error(`Invalid character manifest: ${id}`);
  }
  return [id, Object.freeze(character)];
}));

export const characterForMember = createCharacterResolver(assignments, catalog);
