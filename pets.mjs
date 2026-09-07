// Pets follow their owner: they walk the ground their owner walked, a step or
// two behind, and settle beside them when the walking stops.
// Pet art: one index, then a manifest per pet with measured frame rectangles.
// Walk sheets are three rows - down, right, up - and three columns; the left
// facing is the right row mirrored. Sit sheets hold one frame per direction.
import {updatePet,petSpawn} from './pets-motion.mjs';
export {updatePet} from './pets-motion.mjs';

// One entry per owner who has a pet out.
const pets = new Map();
const ROWS = { down: 0, right: 1, left: 1, up: 2 };
let catalogue = null;

let cataloguePromise;
const artLoads = new Map();
export function loadPetSprites(fetchImpl = fetch) {
  if (cataloguePromise) return cataloguePromise;
  cataloguePromise = (async () => {
    const index = await (await fetchImpl('/pets/index.json', {signal:AbortSignal.timeout(10000)})).json();
    const loaded = await Promise.all((index.items || []).map(async entry => {
      const manifest = await (await fetchImpl(entry.manifest, {signal:AbortSignal.timeout(10000)})).json();
      return [entry.id, {...manifest,walkUrl:entry.walk,sitUrl:entry.sit,portrait:entry.portrait}];
    }));
    catalogue = new Map(loaded.filter(([,manifest])=>manifest?.walk?.frames?.length===9));
    return catalogue;
  })().catch(error=>{cataloguePromise=null;throw error;});
  return cataloguePromise;
}
// Warm both states only for visible pets. Switching pose never exposes an unloaded sheet.
function petArtReady(id) {
  const manifest=catalogue?.get(id);if(!manifest)return false;
  if(typeof Image==='undefined')return true;
  let entry=artLoads.get(id);
  if(!entry){
    entry={ready:false};artLoads.set(id,entry);
    entry.promise=Promise.all([...new Set([manifest.walkUrl,manifest.sitUrl].filter(Boolean))].map(async url=>{
      const image=new Image();image.src=url;await image.decode();return image;
    })).then(images=>{entry.images=images;entry.ready=true;}).catch(()=>{entry.failedAt=Date.now();});
  }
  if(entry.failedAt && Date.now()-entry.failedAt>10000)artLoads.delete(id);
  return entry.ready;
}

// Which rectangle of which sheet this pet is showing, and how big to draw it.
function poseFor(petId, { direction, moving }) {
  const manifest = catalogue?.get(petId);
  if (!manifest) return null;
  const row = ROWS[direction] ?? 0;
  const sheet = moving || !manifest.sit ? manifest.walk : manifest.sit;
  const url = moving || !manifest.sit ? manifest.walkUrl : manifest.sitUrl;
  const loop = manifest.walk.loop || [0, 1, 2, 1];
  const step = moving && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
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
  if (art.dataset.sheet !== pose.url) {art.style.backgroundImage = `url("${pose.url}")`;art.dataset.sheet=pose.url;}
  art.style.backgroundSize = `${pose.sheet.imageWidth * pose.scale}px ${pose.sheet.imageHeight * pose.scale}px`;
  art.style.backgroundPosition = `${-x * pose.scale}px ${-y * pose.scale}px`;
  art.classList.toggle("mirrored", pose.mirrored);
}

export function updatePets(owners, { deltaSeconds, layerFor, isWalkable, geometryFor = () => ({}) }) {
  const seen = new Set();
  for (const owner of owners) {
    if (!owner.pet || !owner.id) continue;
    seen.add(owner.id);
    const geometry=geometryFor(owner.scene);
    let state = pets.get(owner.id);
    if (!state || state.pet !== owner.pet || state.scene !== owner.scene || state.geometryKey !== geometry.key) {
      state?.pin?.remove();
      state = { geometryKey:geometry.key, pet: owner.pet, scene: owner.scene, x: owner.x, y: owner.y, facing: "down", trail: [], pin: null, moving: false };
      pets.set(owner.id, state);
    }
    const walkable=isWalkable ? (x,y)=>isWalkable(x,y,owner.scene) : null;
    if(!state.initialized){
      Object.assign(state,petSpawn(owner,walkable,geometry));
      state.initialized=true;
    }
    updatePet(state, owner, deltaSeconds, walkable, geometry);
    const layer = layerFor(owner.scene);
    if (!layer || !petArtReady(owner.pet)) continue;
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
