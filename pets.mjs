// Pets follow their owner: they walk the ground their owner walked, a step or
// two behind, and settle beside them when the walking stops.
const FALLBACK_SPRITE = { url: null, frames: 3, frameMs: 150, height: 34 };
let sprites = null;

// Where each pet's walk strip lives. Loaded once; real art replaces the
// placeholders by editing content/pets.json, not this file.
export async function loadPetSprites(fetchImpl = fetch) {
  if (sprites) return sprites;
  try {
    const response = await fetchImpl("/content/pets.json", { signal: AbortSignal.timeout(10000) });
    sprites = response.ok ? (await response.json()).pets || {} : {};
  } catch {
    sprites = {};
  }
  return sprites;
}

function spriteFor(petId) {
  const sprite = sprites?.[petId];
  return sprite?.url ? { ...FALLBACK_SPRITE, ...sprite } : { ...FALLBACK_SPRITE, url: `/assets/pets/${petId}-placeholder-v1.png` };
}
const FOLLOW_GAP = 2.0;     // how far behind, in map percent
const CATCH_UP = 3.2;       // beyond this the pet hurries
const HEEL_GAP = 1.3;       // where it waits once its owner stops
const SETTLE = 0.35;        // close enough to stop fussing

const pets = new Map();

function makePin(layer, petId) {
  const sprite = spriteFor(petId);
  const pin = document.createElement("div");
  pin.className = "pet-pin";
  pin.style.backgroundImage = `url("${sprite.url}")`;
  pin.style.backgroundSize = `${sprite.frames * 100}% 100%`;
  pin.style.width = `${sprite.height}px`;
  pin.style.height = `${sprite.height}px`;
  pin.setAttribute("aria-hidden", "true");
  layer.appendChild(pin);
  return pin;
}

// One owner's pet: a short memory of where its owner has been, and a walk
// along it. Keeping the trail means the pet rounds corners rather than
// cutting across the flowerbeds.
function updatePet(state, owner, deltaSeconds, isWalkable) {
  const head = state.trail[state.trail.length - 1];
  if (!head || Math.hypot(owner.x - head.x, owner.y - head.y) > 0.5) {
    state.trail.push({ x: owner.x, y: owner.y });
    if (state.trail.length > 40) state.trail.shift();
  }

  // Aim at the point on the trail that is FOLLOW_GAP behind the owner.
  let travelled = 0;
  let target = state.trail[0];
  for (let i = state.trail.length - 1; i > 0; i--) {
    const step = Math.hypot(state.trail[i].x - state.trail[i - 1].x, state.trail[i].y - state.trail[i - 1].y);
    travelled += step;
    if (travelled >= FOLLOW_GAP) { target = state.trail[i - 1]; break; }
  }
  // Once its owner has stood still for a moment, a pet closes in and waits at
  // their heel rather than loitering a walk behind.
  state.stillFor = owner.moving === false || Math.hypot(owner.x - state.lastOwnerX ?? 0, owner.y - state.lastOwnerY ?? 0) < 0.05
    ? (state.stillFor || 0) + deltaSeconds
    : 0;
  state.lastOwnerX = owner.x;
  state.lastOwnerY = owner.y;
  if (state.stillFor > 0.6) {
    const away = Math.hypot(state.x - owner.x, state.y - owner.y) || 1;
    target = {
      x: owner.x + ((state.x - owner.x) / away) * HEEL_GAP,
      y: owner.y + ((state.y - owner.y) / away) * HEEL_GAP
    };
  }
  const gap = Math.hypot(target.x - state.x, target.y - state.y);
  const ownerGap = Math.hypot(owner.x - state.x, owner.y - state.y);
  const moving = gap > SETTLE;
  if (moving) {
    const speed = (ownerGap > CATCH_UP ? 9 : 5.5) * deltaSeconds;
    const stride = Math.min(speed, gap);
    const nextX = state.x + ((target.x - state.x) / gap) * stride;
    const nextY = state.y + ((target.y - state.y) / gap) * stride;
    // Never let a pet stand in the river, even if its owner took a bridge.
    if (!isWalkable || isWalkable(nextX, nextY) || ownerGap > CATCH_UP * 2) {
      state.facing = nextX < state.x ? "left" : nextX > state.x ? "right" : state.facing;
      state.x = nextX;
      state.y = nextY;
    }
  }
  state.moving = moving;
  return state;
}

export function updatePets(owners, { deltaSeconds, layerFor, isWalkable }) {
  const seen = new Set();
  for (const owner of owners) {
    if (!owner.pet || !owner.id) continue;
    seen.add(owner.id);
    let state = pets.get(owner.id);
    if (!state || state.pet !== owner.pet || state.scene !== owner.scene) {
      state?.pin?.remove();
      state = { pet: owner.pet, scene: owner.scene, x: owner.x, y: owner.y, facing: "right", trail: [], pin: null, moving: false };
      pets.set(owner.id, state);
    }
    updatePet(state, owner, deltaSeconds, isWalkable);
    const layer = layerFor(owner.scene);
    if (!layer) continue;
    if (!state.pin || state.pin.parentElement !== layer) {
      state.pin?.remove();
      state.pin = makePin(layer, owner.pet);
    }
    const sprite = spriteFor(owner.pet);
    const frame = state.moving && sprite.frames > 1
      ? Math.floor(performance.now() / sprite.frameMs) % sprite.frames
      : Math.min(1, sprite.frames - 1);
    state.pin.style.left = `${state.x}%`;
    state.pin.style.top = `${state.y}%`;
    state.pin.style.zIndex = String(Math.round(state.y * 10) - 1);
    state.pin.style.backgroundPosition = sprite.frames > 1 ? `${(frame / (sprite.frames - 1)) * 100}% 0` : "0 0";
    state.pin.classList.toggle("facing-left", state.facing === "left");
  }
  for (const [id, state] of pets) {
    if (seen.has(id)) continue;
    state.pin?.remove();
    pets.delete(id);
  }
}

export function forgetPets() {
  for (const state of pets.values()) state.pin?.remove();
  pets.clear();
}
