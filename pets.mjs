// Pets follow their owner: they walk the ground their owner walked, a step or
// two behind, and settle beside them when the walking stops.
// Pet art: one index, then a manifest per pet with measured frame rectangles.
// Walk sheets are three rows - down, right, up - and three columns; the left
// facing is the right row mirrored. Sit sheets hold one frame per direction.
const FOLLOW_GAP = 2.0;     // how far behind, in map percent
const CATCH_UP = 3.2;       // beyond this the pet hurries
const HEEL_GAP = 1.3;       // where it waits once its owner stops
const SETTLE = 0.35;        // close enough to stop fussing

// One entry per owner who has a pet out.
const pets = new Map();
const ROWS = { down: 0, right: 1, left: 1, up: 2 };
let catalogue = null;

export async function loadPetSprites(fetchImpl = fetch) {
  if (catalogue) return catalogue;
  catalogue = new Map();
  try {
    const index = await (await fetchImpl("/pets/index.json", { signal: AbortSignal.timeout(10000) })).json();
    const loaded = await Promise.all((index.items || []).map(async entry => {
      const manifest = await (await fetchImpl(entry.manifest, { signal: AbortSignal.timeout(10000) })).json();
      return [entry.id, { ...manifest, walkUrl: entry.walk, sitUrl: entry.sit, portrait: entry.portrait }];
    }));
    for (const [id, manifest] of loaded) if (manifest?.walk?.frames?.length === 9) catalogue.set(id, manifest);
  } catch {
    // A missing manifest simply means that pet cannot be drawn yet.
  }
  return catalogue;
}

// Which rectangle of which sheet this pet is showing, and how big to draw it.
function poseFor(petId, { direction, moving }) {
  const manifest = catalogue?.get(petId);
  if (!manifest) return null;
  const row = ROWS[direction] ?? 0;
  const sheet = moving || !manifest.sit ? manifest.walk : manifest.sit;
  const url = moving || !manifest.sit ? manifest.walkUrl : manifest.sitUrl;
  const loop = manifest.walk.loop || [0, 1, 2, 1];
  const step = moving
    ? loop[Math.floor(performance.now() / (manifest.walk.frameMs || 150)) % loop.length]
    : 0;
  const index = moving ? row * 3 + step : Math.min(row, sheet.frames.length - 1);
  const rect = sheet.frames[index];
  if (!rect) return null;
  // Scale each sheet by its own frame height, and sit on the rectangle's
  // bottom edge, so a frog mid-hop rises instead of sinking.
  const scale = (manifest.displayHeight || 42) / (sheet.frameHeight || rect[3]);
  return { url, rect, scale, sheet, mirrored: direction === "left" };
}

function makePin(layer) {
  const pin = document.createElement("div");
  pin.className = "pet-pin";
  pin.innerHTML = '<span class="pet-art"></span>';
  pin.setAttribute("aria-hidden", "true");
  layer.appendChild(pin);
  return pin;
}

function paintPin(pin, petId, state) {
  const pose = poseFor(petId, { direction: state.facing, moving: state.moving });
  if (!pose) return;
  const [x, y, width, height] = pose.rect;
  const art = pin.firstElementChild;
  const signature = `${pose.url}:${x},${y},${width},${height}:${pose.mirrored}`;
  if (art.dataset.pose === signature) return;
  art.dataset.pose = signature;
  art.style.width = `${width * pose.scale}px`;
  art.style.height = `${height * pose.scale}px`;
  art.style.backgroundImage = `url("${pose.url}")`;
  art.style.backgroundSize = `${pose.sheet.imageWidth * pose.scale}px ${pose.sheet.imageHeight * pose.scale}px`;
  art.style.backgroundPosition = `${-x * pose.scale}px ${-y * pose.scale}px`;
  art.classList.toggle("mirrored", pose.mirrored);
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
      const dx = nextX - state.x;
      const dy = nextY - state.y;
      state.facing = Math.abs(dx) > Math.abs(dy)
        ? (dx < 0 ? "left" : "right")
        : (dy < 0 ? "up" : "down");
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
      state = { pet: owner.pet, scene: owner.scene, x: owner.x, y: owner.y, facing: "down", trail: [], pin: null, moving: false };
      pets.set(owner.id, state);
    }
    updatePet(state, owner, deltaSeconds, isWalkable);
    const layer = layerFor(owner.scene);
    if (!layer) continue;
    if (!state.pin || state.pin.parentElement !== layer) {
      state.pin?.remove();
      state.pin = makePin(layer);
    }
    state.pin.style.left = `${state.x}%`;
    state.pin.style.top = `${state.y}%`;
    state.pin.style.zIndex = String(Math.round(state.y * 10) - 1);
    paintPin(state.pin, owner.pet, state);
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
