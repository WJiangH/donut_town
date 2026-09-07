let residents = [];
// Feet positions on paved gathering places, spread across town before filling gaps.
const residentSlots = [
  { x: 40, y: 38, activity: "plaza" },
  { x: 57, y: 49, activity: "plaza" },
  { x: 35, y: 30, activity: "cafe" },
  { x: 51, y: 25, activity: "path" },
  { x: 64, y: 34, activity: "path" },
  { x: 24, y: 48, activity: "path" },
  { x: 49, y: 63, activity: "plaza" },
  { x: 65, y: 66, activity: "path" },
  { x: 17, y: 87, activity: "path" },
  { x: 85, y: 80, activity: "plaza" }
];
const chemPodResidentSlots = [
  { x: 29, y: 36 }, { x: 40, y: 36 }, { x: 52, y: 36 }, { x: 65, y: 36 }, { x: 76, y: 36 },
  { x: 28, y: 75 }, { x: 35, y: 84 }, { x: 49, y: 78 }, { x: 51, y: 86 },
  { x: 63, y: 78 }, { x: 71, y: 84 }, { x: 87, y: 82 }
];

const donutStations = [
  { x: 31, y: 31, left: { x: 28.4, y: 33 }, right: { x: 33.6, y: 33 } },
  { x: 42, y: 40, left: { x: 39.4, y: 42 }, right: { x: 44.6, y: 42 } },
  { x: 61, y: 40, left: { x: 58.4, y: 42 }, right: { x: 63.6, y: 42 } },
  { x: 42, y: 53, left: { x: 39.4, y: 55 }, right: { x: 44.6, y: 55 } },
  { x: 61, y: 53, left: { x: 58.4, y: 55 }, right: { x: 63.6, y: 55 } },
  { x: 50, y: 67, left: { x: 47.4, y: 69 }, right: { x: 52.6, y: 69 } },
  { x: 24, y: 51, left: { x: 21.4, y: 53 }, right: { x: 26.6, y: 53 } },
  { x: 78, y: 51, left: { x: 75.4, y: 53 }, right: { x: 80.6, y: 53 } },
  { x: 29, y: 69, left: { x: 26.4, y: 71 }, right: { x: 31.6, y: 71 } },
  { x: 73, y: 70, left: { x: 70.4, y: 72 }, right: { x: 75.6, y: 72 } }
];

const walkCorridors = [
  { from: [50, 8], to: [50, 70], width: 5.2 },
  { from: [43, 35], to: [27, 25], width: 5 },
  { from: [59, 34], to: [91, 28], width: 5 },
  { from: [43, 44], to: [10, 55], width: 5 },
  { from: [60, 44], to: [94, 52], width: 5 },
  { from: [50, 68], to: [46, 82], width: 5.2 },
  { from: [46, 82], to: [43, 94], width: 5.2 },
  { from: [46, 82], to: [28, 89], width: 4.8 },
  { from: [28, 89], to: [8, 87], width: 4.8 },
  { from: [54, 67], to: [75, 70], width: 5 },
  { from: [75, 70], to: [92, 88], width: 5 },
  { from: [75, 70], to: [92, 76], width: 4.5 }
];

const townPlazas = [
  { x: 51, y: 44, rx: 16, ry: 13 },
  { x: 50, y: 68, rx: 9, ry: 7 },
  { x: 50, y: 13, rx: 7, ry: 6 },
  { x: 24, y: 22, rx: 10, ry: 8 },
  { x: 82, y: 83, rx: 12, ry: 9 }
];
const mapObstacles = [
  { x: 51, y: 43, rx: 5.4, ry: 6.6 },
  { x: 50, y: 13, rx: 3.2, ry: 3.7 }
];

const chemPodObstacles = [
  { left: 7, right: 27, top: 40, bottom: 69 },
  { left: 31, right: 66, top: 40, bottom: 68 },
  { left: 67, right: 94, top: 40, bottom: 70 },
  { left: 16, right: 82, top: 15, bottom: 37 },
  { left: 24, right: 46, top: 69, bottom: 88 },
  { left: 54, right: 62, top: 69, bottom: 89 },
  { left: 64, right: 85, top: 68, bottom: 90 }
];

let outgoingInvitations = [];
let selectedResident = null;
let currentFilter = "all";
let invitesOpen = true;
const player = { id: 11, name: "You", x: 50, y: 59 };
const scenePlayerPositions = {
  town: { x: player.x, y: player.y },
  chemPod: { x: 50, y: 86 }
};
let currentScene = "town";
let sceneTransitioning = false;
let currentUser = null;
let currentPairId = null;
let pairActivities = [];
const previewPairUserId = new URLSearchParams(window.location.search).get("previewPair");
const pressedKeys = new Set();
let clickPath = [];
let playerDirection = "down";
let playerFrame = 1;
let playerAction = null;
let pendingActionSpot = null;
let lastFrameChange = 0;

const actionSpots = [
  { id: "coffee", scene: "town", x: 32, y: 26, facing: "down", label: "Coffee" },
  { id: "sitChair", scene: "town", x: 50, y: 36, facing: "down", label: "Sit" },
  { id: "sitGrass", scene: "town", x: 40, y: 52, facing: "down", label: "Lawn" },
  { id: "garden", scene: "town", x: 81, y: 28, facing: "down", label: "Garden" },
  { id: "lookout", scene: "town", x: 84, y: 51, facing: "right", label: "View" },
  { id: "read", scene: "town", x: 22, y: 24, facing: "down", label: "Read" },
  { id: "experiment", scene: "chemPod", x: 50, y: 71, facing: "up", label: "Lab" },
  { id: "read", scene: "chemPod", x: 41, y: 75, facing: "down", label: "Read" },
  { id: "coffee", scene: "chemPod", x: 70, y: 79, facing: "down", label: "Coffee" }
];
let lastGameTime = performance.now();
const remotePlayers = new Map();
const remotePlayerElements = new Map();
let realtimeSocket = null;
let realtimeReconnectTimer = null;
let realtimeReconnectDelay = 1000;
let lastPresenceSentAt = 0;
let lastPresenceSignature = "";
const townCamera = { x: 0, y: 0, scale: 1, ready: false };
let townCameraMetrics = null;
let cameraMode = "overview";
// World pixels, independent of the viewport and total map extent.
const overviewCenter = { x: 1536, y: 1004 };
let mapDrag = null;
let suppressMapClick = false;

function clampCameraOffset(offset, viewportSize, worldSize) {
  return Math.max(viewportSize - worldSize, Math.min(0, offset));
}

const layer = document.querySelector("#residentsLayer");
const drawer = document.querySelector("#residentDrawer");
const drawerScrim = document.querySelector("#drawerScrim");
const inviteButton = document.querySelector("#inviteButton");
const pendingInviteList = document.querySelector("#pendingInviteList");
const pendingInviteEmpty = document.querySelector("#pendingInviteEmpty");
const toast = document.querySelector("#toast");
const sceneCurtain = document.querySelector("#sceneCurtain");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initialsFor(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || "?").toUpperCase();
}

function setSlackAvatar(element, person) {
  element.replaceChildren();
  element.classList.toggle("has-photo", Boolean(person?.avatarUrl));
  if (!person?.avatarUrl) {
    element.textContent = initialsFor(person?.displayName || person?.name || "Slack member");
    return;
  }
  const image = document.createElement("img");
  image.className = "slack-avatar-image";
  image.src = person.avatarUrl;
  image.alt = "";
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => {
    element.classList.remove("has-photo");
    element.textContent = initialsFor(person?.displayName || person?.name || "Slack member");
  }, { once: true });
  element.append(image);
}

function slackFacts(person) {
  return [
    ["Time zone", person?.timezoneLabel || person?.timezone],
    ["Pronouns", person?.pronouns],
    ["Slack status", person?.statusText]
  ].filter(([, value]) => value);
}

function factsMarkup(facts, emptyCopy = "No additional Slack profile details have been added.") {
  return facts.length
    ? facts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")
    : `<div class="empty-fact">${escapeHtml(emptyCopy)}</div>`;
}

// Personal art is enabled only after its versioned PNG has loaded successfully.
const characterImages = new Map();
function characterAssetUrlOk(url) {
  return /^\/assets\/residents\/[a-z0-9-]+\/(?:wardrobe-v1\/)?[a-z0-9-]+\.png$/.test(url);
}

function loadCharacterImage(url, width, height) {
  const key = `${url}@${width}x${height}`;
  if (!characterImages.has(key)) {
    characterImages.set(key, new Promise(resolve => {
      const image = new Image();
      const finish = ok => { clearTimeout(timeout); image.onload = image.onerror = null; resolve(ok); };
      const timeout = setTimeout(() => finish(false), 20000);
      image.onload = () => finish(image.naturalWidth === width && image.naturalHeight === height);
      image.onerror = () => finish(false);
      image.src = url;
    }));
  }
  return characterImages.get(key).then(ok => {
    if (!ok) characterImages.delete(key);
    return ok;
  });
}

async function loadCharacterArt(character) {
  if (!character || !characterAssetUrlOk(character.url)) return null;
  const urls = [character.url, ...(character.layers || [])];
  if (urls.some(url => !characterAssetUrlOk(url))) return null;
  const walkOk = await Promise.all(urls.map(url => loadCharacterImage(url, character.imageWidth, character.imageHeight)));
  if (!walkOk.every(Boolean)) return null;
  for (const action of Object.values(character.actions || {})) {
    if (!characterAssetUrlOk(action.url) || !await loadCharacterImage(action.url, action.imageWidth, action.imageHeight)) return null;
  }
  return character;
}

function wardrobeManifestUrl(character) {
  const id = character?.url?.match(/^\/assets\/residents\/(r-[a-z0-9-]+)\//)?.[1];
  return id ? `/characters/wardrobe/${id}.json` : null;
}

function personalCharacterMarkup(character, className) {
  return `<div class="${className} personal-character" aria-hidden="true"><span class="personal-art"></span></div>`;
}

function paintPersonalCharacter(element, character, direction = "down", frame = 1, actionId = null) {
  if (!element || !character) return;
  const action = actionId && character.actions?.[actionId];
  const facing = action?.facing || direction;
  const source = action || character;
  const index = action ? frame % action.frames.length : (facing === "up" ? 2 : (facing === "left" || facing === "right") ? 1 : 0) * 3 + frame;
  const urls = action ? [action.url] : (character.layers || [character.url]);
  const signature = `${urls.join("|")}:${actionId || "walk"}:${index}:${facing}`;
  if (element.dataset.pose === signature) return;
  element.dataset.pose = signature;
  const [x, y, width, height] = source.frames[index];
  const scale = 88 / source.frameHeight;
  const art = element.querySelector(".personal-art");
  art.style.width = `${width * scale}px`;
  art.style.height = `${height * scale}px`;
  art.style.backgroundImage = [...urls].reverse().map(url => `url("${url}")`).join(",");
  art.style.backgroundSize = `${source.imageWidth * scale}px ${source.imageHeight * scale}px`;
  art.style.backgroundPosition = `${-x * scale}px ${-y * scale}px`;
  element.classList.toggle("facing-left", facing === "left");
}

// One shared clock makes every seated neighbour turn their head at the same
// moment, which reads as a glitch rather than as a town. Each character gets
// its own phase and a slightly different tempo, fixed to who they are.
const characterPhases = new Map();
function characterPhase(id) {
  const key = String(id ?? "anon");
  if (!characterPhases.has(key)) {
    const seed = [...key].reduce((total, letter) => (total * 31 + letter.charCodeAt(0)) >>> 0, 7);
    characterPhases.set(key, { offset: seed % 4000, tempo: 0.8 + (seed % 45) / 100 });
  }
  return characterPhases.get(key);
}

function actionFrame(action, id) {
  const loop = action?.loop;
  if (!loop || loop.length < 2) return 1;
  const { offset, tempo } = characterPhase(id);
  return loop[Math.floor((performance.now() + offset) / ((action.frameMs || 240) * tempo)) % loop.length];
}

// A neighbour standing on a tagged spot takes up what that spot is for. The
// choice is fixed per person, so the same neighbour always reads the same way.
function residentPose(person) {
  const actions = person.character?.actions;
  if (!actions || person.status === "booked" || person.pairFacing) return null;
  const match = window.TownZones?.zoneFor(person, person.scene || "town", actions, []);
  if (!match) return null;
  const poses = [match.zone.action].flat().filter(pose => actions[pose]);
  if (!poses.length) return null;
  const seed = String(person.slackId || person.id).split("").reduce((total, letter) => total + letter.charCodeAt(0), 0);
  return poses[seed % poses.length];
}

let residentPosesAnimate = false;
function refreshResidentPoses() {
  residentPosesAnimate = false;
  for (const person of residents) {
    person.pose = residentPose(person);
    const action = person.pose ? person.character?.actions?.[person.pose] : null;
    if (action?.loop?.length > 1) residentPosesAnimate = true;
  }
}

function paintResidentCharacters(container) {
  container.querySelectorAll(".resident-pin[data-id]").forEach(pin => {
    const person = residents.find(item => item.id === Number(pin.dataset.id));
    if (!person?.character) return;
    const action = person.pose ? person.character.actions?.[person.pose] : null;
    const frame = actionFrame(action, person.slackId || person.id);
    paintPersonalCharacter(pin.querySelector(".personal-character"), person.character, person.pairFacing || "down", frame, person.pose || null);
  });
}

function setCharacterPortrait(element, person) {
  if (!person?.character) { setSlackAvatar(element, person); return; }
  element.classList.remove("has-photo");
  element.innerHTML = personalCharacterMarkup(person.character, "portrait-character");
  paintPersonalCharacter(element.firstElementChild, person.character);
}

function personMarkup(person, compact = false) {
  const atlasIndex = person.spriteIndex ?? ((person.id - 1) % 12);
  const columnPositions = [0, 33.333, 66.667, 100];
  const rowPositions = [0, 50, 100];
  const spriteX = columnPositions[atlasIndex % 4];
  const spriteY = rowPositions[Math.floor(atlasIndex / 4)];
  const facingClass = person.pairFacing ? ` pair-facing-${person.pairFacing}` : "";
  const custom = person.character ? personalCharacterMarkup(person.character, "pixel-person") : null;
  return `${custom || `<div class="pixel-person${facingClass}" style="--sprite-x:${spriteX}%;--sprite-y:${spriteY}%" aria-hidden="true"></div>`}${compact ? "" : `<span class="resident-state"></span><span class="resident-label">${escapeHtml(person.name.split(" ")[0])}</span>`}`;
}

function playerMarkup() {
  const directionRows = { down: 0, right: 33.333, left: 33.333, up: 100 };
  const framePositions = [0, 50, 100];
  const facingClass = playerDirection === "left" ? " facing-left" : "";
  const custom = currentUser?.character ? personalCharacterMarkup(currentUser.character, "player-character") : null;
  return `${custom || `<div class="player-character${facingClass}" style="--frame-x:${framePositions[playerFrame]}%;--direction-y:${directionRows[playerDirection]}%" aria-hidden="true"></div>`}
    <span class="resident-state"></span><span class="resident-label">You</span>`;
}

function residentIsVisible(person) {
  return currentFilter === "all" || (currentFilter === "other" && person.group === "other") || (currentFilter === "new" && person.donuts !== null && person.donuts <= 2);
}

// Cached pin markup: the sync loop calls the renderers on a timer whether or
// not anything moved, and rebuilding identical DOM makes the town flicker.
let lastTownMarkup = null;
let lastChemPodMarkup = null;

function renderResidents() {
  const residentsMarkup = residents.map(person => {
    const visible = (person.scene || "town") === "town" && residentIsVisible(person) && !remotePlayers.has(person.slackId);
    return `<button class="resident-pin ${person.status} ${person.status === "booked" ? "making-donut" : ""} ${person.activity || "path"} ${visible ? "" : "hidden"}" style="left:${person.x}%;top:${person.y}%;z-index:${Math.round(person.y * 10)}" data-id="${person.id}" aria-label="Open ${escapeHtml(person.name)}'s profile">
      ${personMarkup(person)}
    </button>`;
  }).join("");
  const activityMarkup = pairActivities.map(activity => `<div class="donut-workstation" style="left:${activity.x}%;top:${activity.y}%;z-index:${Math.round(activity.y * 10) - 1}" role="img" aria-label="${escapeHtml(activity.label)}">
    <span class="workstation-copy">Making donuts</span>
    <span class="workstation-flour flour-one" aria-hidden="true"></span>
    <span class="workstation-flour flour-two" aria-hidden="true"></span>
    <span class="workstation-flour flour-three" aria-hidden="true"></span>
    <span class="workstation-rolling-pin" aria-hidden="true"></span>
    <span class="workstation-dough" aria-hidden="true"></span>
    <span class="workstation-counter" aria-hidden="true"><i></i></span>
  </div>`).join("");
  const playerClass = `player-pin ${currentUser?.status || "open"} ${currentUser?.status === "booked" ? "making-donut" : ""}`;
  const playerBody = playerMarkup();
  // Replacing the pins with identical markup restarts every idle animation and
  // reloads the layered sprite art, which reads as the town flickering on each
  // five second sync, so only touch the DOM when something actually changed.
  const signature = [activityMarkup, residentsMarkup, playerClass, playerBody].join("\u0000");
  if (signature !== lastTownMarkup || !layer.querySelector("#townPlayerPin")) {
    lastTownMarkup = signature;
    layer.innerHTML = `${activityMarkup}${residentsMarkup}<div class="${playerClass}" id="townPlayerPin" style="left:${player.x}%;top:${player.y}%;z-index:${Math.round(player.y * 10)}">
    ${playerBody}
  </div>`;
    layer.querySelectorAll(".resident-pin").forEach(pin => pin.addEventListener("click", () => openResident(Number(pin.dataset.id))));
  }
  document.querySelector("#mapEmpty").hidden = layer.querySelectorAll(".resident-pin:not(.hidden)").length > 0;
  paintResidentCharacters(currentScene === "chemPod" ? document.querySelector("#chemPodResidentsLayer") : layer);
  updatePlayerElement(false);
  renderLivePlayers(0);
}

function renderChemPod() {
  const roomLayer = document.querySelector("#chemPodResidentsLayer");
  const residentsMarkup = residents.filter(person => person.scene === "chemPod" && !remotePlayers.has(person.slackId)).map(person => `<button class="resident-pin ${person.status} ${person.activity || "path"}" style="left:${person.x}%;top:${person.y}%;z-index:${Math.round(person.y * 10)}" data-id="${person.id}" aria-label="Open ${escapeHtml(person.name)}'s profile">
    ${personMarkup(person)}
  </button>`).join("");
  const playerClass = `player-pin ${currentUser?.status || "open"}`;
  const playerBody = playerMarkup();
  const signature = [residentsMarkup, playerClass, playerBody].join("\u0000");
  if (signature !== lastChemPodMarkup || !roomLayer.querySelector("#chemPodPlayerPin")) {
    lastChemPodMarkup = signature;
    roomLayer.innerHTML = `${residentsMarkup}<div class="${playerClass}" id="chemPodPlayerPin" style="left:${player.x}%;top:${player.y}%;z-index:${Math.round(player.y * 10)}">
    ${playerBody}
  </div>`;
    roomLayer.querySelectorAll(".resident-pin").forEach(pin => pin.addEventListener("click", () => openResident(Number(pin.dataset.id))));
  }
  renderChemPodTeamWall();
  paintResidentCharacters(currentScene === "chemPod" ? document.querySelector("#chemPodResidentsLayer") : layer);
  updatePlayerElement(false);
  renderLivePlayers(0);
}

function renderCurrentScene() {
  if (currentScene === "chemPod") renderChemPod();
  else renderResidents();
}

function liveLayerFor(scene) {
  return document.querySelector(scene === "chemPod" ? "#chemPodLivePlayersLayer" : "#townLivePlayersLayer");
}

function removeRemotePlayer(userId) {
  remotePlayers.delete(userId);
  remotePlayerElements.get(userId)?.remove();
  remotePlayerElements.delete(userId);
}

function clearRemotePlayers() {
  remotePlayers.clear();
  remotePlayerElements.forEach(element => element.remove());
  remotePlayerElements.clear();
  renderCurrentScene();
}

function replaceRemotePlayers(players) {
  const nextIds = new Set();
  for (const state of Array.isArray(players) ? players : []) {
    if (!state?.userId || state.userId === currentUser?.id) continue;
    nextIds.add(state.userId);
    upsertRemotePlayer(state, false);
  }
  for (const userId of remotePlayers.keys()) {
    if (!nextIds.has(userId)) removeRemotePlayer(userId);
  }
  renderCurrentScene();
}

function upsertRemotePlayer(state, refreshResidents = true) {
  if (!state?.userId || state.userId === currentUser?.id) return;
  const x = Number(state.x);
  const y = Number(state.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const previous = remotePlayers.get(state.userId);
  remotePlayers.set(state.userId, {
    userId: state.userId,
    scene: state.scene,
    x: previous?.x ?? x,
    y: previous?.y ?? y,
    targetX: x,
    targetY: y,
    direction: ["up", "down", "left", "right"].includes(state.direction) ? state.direction : "down",
    moving: state.moving === true,
    action: typeof state.action === "string" && state.action ? state.action : null
  });
  if (refreshResidents && !previous) renderCurrentScene();
}

function renderLivePlayers(deltaSeconds) {
  const expectedIds = new Set();
  for (const remote of remotePlayers.values()) {
    const person = residents.find(resident => resident.slackId === remote.userId);
    if (!person || remote.scene !== currentScene || !residentIsVisible(person)) continue;
    expectedIds.add(remote.userId);
    const smoothing = deltaSeconds > 0 ? 1 - Math.exp(-14 * deltaSeconds) : 1;
    remote.x += (remote.targetX - remote.x) * smoothing;
    remote.y += (remote.targetY - remote.y) * smoothing;

    let pin = remotePlayerElements.get(remote.userId);
    if (!pin) {
      pin = document.createElement("button");
      pin.type = "button";
      pin.className = `resident-pin remote-player ${person.status || "open"}`;
      pin.dataset.userId = remote.userId;
      pin.innerHTML = `${personMarkup(person)}<span class="online-badge" aria-hidden="true"></span>`;
      pin.addEventListener("click", () => openResident(person.id));
      remotePlayerElements.set(remote.userId, pin);
    }
    const targetLayer = liveLayerFor(remote.scene);
    if (pin.parentElement !== targetLayer) targetLayer.append(pin);
    pin.style.left = `${remote.x}%`;
    pin.style.top = `${remote.y}%`;
    pin.style.zIndex = String(Math.round(remote.y * 10));
    pin.classList.toggle("walking", remote.moving);
    pin.classList.toggle("pending", person.status === "pending");
    pin.classList.toggle("booked", person.status === "booked");
    pin.dataset.direction = remote.direction;
    if (person.character) {
      const action = !remote.moving && remote.action ? person.character.actions?.[remote.action] : null;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const movingFrame = action
        ? actionFrame(action, remote.userId)
        : remote.moving && !reduced ? [0, 1, 2, 1][Math.floor(performance.now() / 135) % 4] : 1;
      paintPersonalCharacter(pin.querySelector(".personal-character"), person.character, remote.direction, movingFrame, action ? remote.action : null);
    }
    pin.setAttribute("aria-label", `Open ${person.name}'s profile, online now`);
  }
  for (const [userId, element] of remotePlayerElements) {
    if (!expectedIds.has(userId)) {
      element.remove();
      remotePlayerElements.delete(userId);
    }
  }
}

function publishPresence(force = false, moving = false) {
  if (!realtimeSocket || realtimeSocket.readyState !== WebSocket.OPEN || !currentUser?.id) return;
  const now = performance.now();
  const signature = `${currentScene}|${playerDirection}|${moving}|${playerAction || ""}`;
  const stateChanged = signature !== lastPresenceSignature;
  if (!force && !stateChanged && (!moving || now - lastPresenceSentAt < 125)) return;
  realtimeSocket.send(JSON.stringify({
    type: "state",
    scene: currentScene,
    x: player.x,
    y: player.y,
    direction: playerDirection,
    moving,
    action: moving ? null : playerAction
  }));
  lastPresenceSentAt = now;
  lastPresenceSignature = signature;
}

function disconnectRealtime({ reconnect = false } = {}) {
  window.clearTimeout(realtimeReconnectTimer);
  realtimeReconnectTimer = null;
  const socket = realtimeSocket;
  realtimeSocket = null;
  if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "Leaving Donut Town");
  clearRemotePlayers();
  if (reconnect && currentUser?.id && !document.hidden) scheduleRealtimeReconnect();
}

function scheduleRealtimeReconnect() {
  if (realtimeReconnectTimer || document.hidden || !currentUser?.id) return;
  realtimeReconnectTimer = window.setTimeout(() => {
    realtimeReconnectTimer = null;
    connectRealtime();
  }, realtimeReconnectDelay);
  realtimeReconnectDelay = Math.min(realtimeReconnectDelay * 2, 10000);
}

function connectRealtime() {
  if (!currentUser?.id || document.hidden || realtimeSocket?.readyState < WebSocket.CLOSING) return;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${window.location.host}/realtime`);
  realtimeSocket = socket;
  socket.addEventListener("open", () => {
    realtimeReconnectDelay = 1000;
  });
  socket.addEventListener("message", event => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.type === "ready") {
      publishPresence(true, false);
      return;
    }
    if (message.type === "snapshot") {
      replaceRemotePlayers(message.players);
      return;
    }
    if (message.type === "state") {
      upsertRemotePlayer(message);
      return;
    }
    if (message.type === "leave" && remotePlayers.has(message.userId)) {
      removeRemotePlayer(message.userId);
      renderCurrentScene();
    }
  });
  socket.addEventListener("close", () => {
    if (realtimeSocket !== socket) return;
    realtimeSocket = null;
    clearRemotePlayers();
    scheduleRealtimeReconnect();
  });
  socket.addEventListener("error", () => socket.close());
}

function renderChemPodTeamWall() {
  const wall = document.querySelector("#chemPodTeamFaces");
  if (!wall) return;
  const people = [
    ...(currentUser ? [currentUser] : []),
    ...residents.filter(person => person.homeScene === "chemPod"),
    ...residents.filter(person => person.homeScene !== "chemPod")
  ].slice(0, 12);
  wall.innerHTML = people.map(person => {
    const name = person.displayName || person.name || "Slack member";
    return person.avatarUrl
      ? `<img src="${escapeHtml(person.avatarUrl)}" alt="" title="${escapeHtml(name)}" />`
      : `<span title="${escapeHtml(name)}">${escapeHtml(initialsFor(name))}</span>`;
  }).join("");
}

async function loadRoomContent() {
  try {
    const response = await fetch("/content/rooms.json", { cache: "no-store" });
    if (!response.ok) return;
    const announcement = (await response.json())?.chemPod?.announcement;
    if (!announcement) return;
    document.querySelector("#chemPodNoticeKicker").textContent = announcement.kicker || "This week";
    document.querySelector("#chemPodNoticeTitle").textContent = announcement.title || "Chem Pod news";
  } catch {
    // Keep the built-in room copy when optional content is unavailable.
  }
}

function layoutBookedPairs() {
  residents.forEach(person => {
    person.x = person.baseX;
    person.y = person.baseY;
    person.activity = person.baseActivity;
    person.scene = person.homeScene || "town";
    person.pairFacing = null;
  });

  const people = [...residents, ...(currentUser ? [{ ...currentUser, isPlayer: true }] : [])];
  const bookedPairs = new Map();
  people.filter(person => person.status === "booked" && person.pairId).forEach(person => {
    if (!bookedPairs.has(person.pairId)) bookedPairs.set(person.pairId, []);
    bookedPairs.get(person.pairId).push(person);
  });
  pairActivities = [];
  [...bookedPairs.entries()].sort(([left], [right]) => left.localeCompare(right)).forEach(([pairId, pair], index) => {
    if (pair.length < 2) return;
    const station = donutStations[index % donutStations.length];
    pair.sort((left, right) => (left.slackId || left.id).localeCompare(right.slackId || right.id));
    pair.forEach((person, personIndex) => {
      const spot = personIndex === 0 ? station.left : station.right;
      if (person.isPlayer) {
        if (currentPairId !== pairId) {
          const townPosition = currentScene === "town" ? player : scenePlayerPositions.town;
          townPosition.x = spot.x;
          townPosition.y = spot.y;
          clickPath = [];
        }
        if (currentScene === "town") playerDirection = personIndex === 0 ? "right" : "left";
      } else {
        const resident = residents.find(item => item.slackId === person.slackId);
        resident.x = spot.x;
        resident.y = spot.y;
        resident.activity = "donut-station";
        resident.scene = "town";
        resident.pairFacing = personIndex === 0 ? "right" : "left";
      }
    });
    pairActivities.push({
      pairId,
      x: station.x,
      y: station.y,
      label: `${pair.map(person => person.displayName || person.name).join(" and ")} are making a donut`
    });
  });
  currentPairId = currentUser?.pairId || null;
  refreshResidentPoses();
}

function applyPairPreview() {
  if (!previewPairUserId || !currentUser) return false;
  const partner = residents.find(person => person.slackId === previewPairUserId);
  if (!partner) return false;
  const pairId = `preview:${[currentUser.id, partner.slackId].sort().join(":")}`;
  Object.assign(currentUser, { status: "booked", partnerId: partner.slackId, pairId });
  Object.assign(partner, { status: "booked", partnerId: currentUser.id, pairId });
  return true;
}

function isInsideEllipse(x, y, ellipse) {
  const dx = (x - ellipse.x) / ellipse.rx;
  const dy = (y - ellipse.y) / ellipse.ry;
  return dx * dx + dy * dy < 1;
}

function distanceToSegment(x, y, segment) {
  const [x1, y1] = segment.from;
  const [x2, y2] = segment.to;
  const lengthSquared = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lengthSquared));
  return Math.hypot(x - (x1 + t * (x2 - x1)), y - (y1 + t * (y2 - y1)));
}

// The baked mask follows the painted roads, lawns and bridges; the corridors
// below stay as a fallback for when the mask file is missing.
function isTownWalkable(x, y) {
  if (window.TownCollision?.ready) return window.TownCollision.isWalkable(x, y);
  const plaza = townPlazas.some(item => isInsideEllipse(x, y, item));
  const corridor = walkCorridors.some(segment => distanceToSegment(x, y, segment) <= segment.width);
  const obstacle = mapObstacles.some(item => isInsideEllipse(x, y, item));
  return (plaza || corridor) && !obstacle;
}

// The baked floor follows the aisles between the benches; the rectangles below
// stay as a fallback for when the mask file is missing.
function isChemPodWalkable(x, y) {
  if (window.ChemPodCollision?.ready) return window.ChemPodCollision.isWalkable(x, y);
  const insideFloor = x >= 10 && x <= 90 && y >= 34 && y <= 89;
  const blocked = chemPodObstacles.some(obstacle => x >= obstacle.left && x <= obstacle.right && y >= obstacle.top && y <= obstacle.bottom);
  return insideFloor && !blocked;
}

function isWalkable(x, y) {
  return currentScene === "chemPod" ? isChemPodWalkable(x, y) : isTownWalkable(x, y);
}

function activeSceneBounds() {
  return currentScene === "chemPod"
    ? { minX: 8, maxX: 92, minY: 30, maxY: 92 }
    : { minX: 5, maxX: 95, minY: 5, maxY: 94 };
}

function refreshTownCameraMetrics() {
  const viewport = document.querySelector("#mapWrap");
  const world = document.querySelector("#mapWorld");
  townCameraMetrics = {
    viewportWidth: viewport.clientWidth,
    viewportHeight: viewport.clientHeight,
    worldWidth: world.offsetWidth,
    worldHeight: world.offsetHeight
  };
}

function updateTownCamera(deltaSeconds = 0, immediate = false) {
  if (currentScene !== "town") return;
  if (!townCameraMetrics) refreshTownCameraMetrics();
  const { viewportWidth, viewportHeight, worldWidth, worldHeight } = townCameraMetrics;
  const coverScale = Math.max(viewportWidth / worldWidth, viewportHeight / worldHeight);
  const targetScale = Math.max(cameraMode === "overview" ? 0.65 : 1, coverScale);
  const centerX = cameraMode === "overview" ? overviewCenter.x : worldWidth * player.x / 100;
  const centerY = cameraMode === "overview" ? overviewCenter.y : worldHeight * player.y / 100;
  const targetX = clampCameraOffset(viewportWidth / 2 - centerX * targetScale, viewportWidth, worldWidth * targetScale);
  const targetY = clampCameraOffset(viewportHeight / 2 - centerY * targetScale, viewportHeight, worldHeight * targetScale);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const blend = immediate || reducedMotion || !townCamera.ready ? 1 : 1 - Math.exp(-8 * deltaSeconds);
  townCamera.x += (targetX - townCamera.x) * blend;
  townCamera.y += (targetY - townCamera.y) * blend;
  townCamera.scale += (targetScale - townCamera.scale) * blend;
  // Clamp even during zoom transitions and viewport changes: never reveal empty space.
  townCamera.scale = Math.max(townCamera.scale, coverScale);
  townCamera.x = clampCameraOffset(townCamera.x, viewportWidth, worldWidth * townCamera.scale);
  townCamera.y = clampCameraOffset(townCamera.y, viewportHeight, worldHeight * townCamera.scale);
  townCamera.ready = true;
  document.querySelector("#mapWorld").style.transform = `translate3d(${townCamera.x}px, ${townCamera.y}px, 0) scale(${townCamera.scale})`;
}

function setCameraMode(nextMode, announce = false) {
  if (!['overview', 'follow'].includes(nextMode)) return;
  finishMapDrag();
  cameraMode = nextMode;
  document.querySelector("#mapWrap").dataset.cameraMode = cameraMode;
  document.querySelector("#townMovementHelp").textContent = cameraMode === "overview"
    ? "Drag to explore · Click a yellow label to sit, sip, or garden"
    : "Click a yellow label or a path · WASD / arrows to walk";
  document.querySelectorAll("[data-camera-mode]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.cameraMode === cameraMode));
  });
  if (announce) showToast(cameraMode === "overview" ? "Drag to explore. Your view stays where you leave it." : "The camera is following you.");
}

// A seat with somebody already on it is taken, so look for another one.
function actionSpotOccupants() {
  const occupants = [];
  for (const remote of remotePlayers.values()) {
    if (remote.scene === currentScene) occupants.push({ x: remote.x, y: remote.y, action: remote.action });
  }
  for (const person of residents) {
    if ((person.scene || "town") === currentScene && !remotePlayers.has(person.slackId)) {
      occupants.push({ x: person.x, y: person.y, action: person.activity || null });
    }
  }
  return occupants;
}

function nearestActionSpot(point, radius = 1.6) {
  let best = null;
  for (const spot of actionSpots) {
    if (spot.scene !== currentScene) continue;
    const distance = Math.hypot(spot.x - point.x, spot.y - point.y);
    if (distance <= radius && (!best || distance < best.distance)) best = { ...spot, distance };
  }
  return best;
}

function walkToActionSpot(spot) {
  pendingActionSpot = spot;
  playerAction = null;
  const destination = nearestWalkable(spot.x, spot.y);
  clickPath = findWalkPath(player, destination);
}

function renderActionSpots() {
  for (const [scene, rootId] of [["town", "townActionSpots"], ["chemPod", "chemPodActionSpots"]]) {
    const root = document.querySelector(`#${rootId}`);
    if (!root) continue;
    root.innerHTML = actionSpots.filter(spot => spot.scene === scene).map(spot =>
      `<button class="action-spot" type="button" style="left:${spot.x}%;top:${spot.y}%" data-index="${actionSpots.indexOf(spot)}" aria-label="${escapeHtml(spot.label)}">${escapeHtml(spot.label)}</button>`
    ).join("");
    root.querySelectorAll(".action-spot").forEach(button => button.addEventListener("click", event => {
      event.stopPropagation();
      const spot = actionSpots[Number(button.dataset.index)];
      if (!spot || currentScene !== spot.scene) return;
      walkToActionSpot(spot);
    }));
  }
}

function sceneCollision() {
  return currentScene === "chemPod" ? window.ChemPodCollision : window.TownCollision;
}

function nearestWalkable(x, y) {
  const bounds = activeSceneBounds();
  x = Math.max(bounds.minX, Math.min(bounds.maxX, x));
  y = Math.max(bounds.minY, Math.min(bounds.maxY, y));
  if (isWalkable(x, y)) return { x, y };
  // The masks are far finer than a one percent grid, so search them directly.
  const mask = sceneCollision();
  if (mask?.ready) return mask.nearestWalkable(x, y, player);
  let best = { x: player.x, y: player.y, distance: Infinity };
  for (let px = bounds.minX; px <= bounds.maxX; px += 1) {
    for (let py = bounds.minY; py <= bounds.maxY; py += 1) {
      if (!isWalkable(px, py)) continue;
      const distance = (px - x) ** 2 + (py - y) ** 2;
      if (distance < best.distance) best = { x: px, y: py, distance };
    }
  }
  return best;
}

function findWalkPath(start, goal) {
  const mask = sceneCollision();
  if (mask?.ready) return mask.findPath(start, goal);
  const from = nearestWalkable(Math.round(start.x), Math.round(start.y));
  const to = nearestWalkable(Math.round(goal.x), Math.round(goal.y));
  const startKey = `${from.x},${from.y}`;
  const goalKey = `${to.x},${to.y}`;
  const open = [{ ...from, score: Math.hypot(to.x - from.x, to.y - from.y) }];
  const openKeys = new Set([startKey]);
  const cameFrom = new Map();
  const cost = new Map([[startKey, 0]]);
  const visited = new Set();

  while (open.length) {
    open.sort((left, right) => left.score - right.score);
    const current = open.shift();
    const currentKey = `${current.x},${current.y}`;
    openKeys.delete(currentKey);
    if (currentKey === goalKey) {
      const path = [to];
      let key = goalKey;
      while (cameFrom.has(key)) {
        const previous = cameFrom.get(key);
        if (previous.key !== startKey) path.push({ x: previous.x, y: previous.y });
        key = previous.key;
      }
      return path.reverse();
    }
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);

    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const x = current.x + dx;
      const y = current.y + dy;
      if (!isWalkable(x, y)) return;
      const key = `${x},${y}`;
      const nextCost = cost.get(currentKey) + 1;
      if (nextCost >= (cost.get(key) ?? Infinity)) return;
      cost.set(key, nextCost);
      cameFrom.set(key, { key: currentKey, x: current.x, y: current.y });
      if (!openKeys.has(key)) {
        open.push({ x, y, score: nextCost + Math.hypot(to.x - x, to.y - y) });
        openKeys.add(key);
      }
    });
  }
  return [];
}

function updatePlayerElement(isMoving) {
  const pin = document.querySelector(currentScene === "chemPod" ? "#chemPodPlayerPin" : "#townPlayerPin");
  if (!pin) return;
  pin.style.left = `${player.x}%`;
  pin.style.top = `${player.y}%`;
  pin.style.zIndex = String(Math.round(player.y * 10));
  pin.classList.toggle("walking", isMoving);
  const sprite = pin.querySelector(".player-character");
  if (currentUser?.character) {
    const action = !isMoving && playerAction ? currentUser.character.actions?.[playerAction] : null;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = action
      ? actionFrame(action, currentUser.id || "you")
      : isMoving && !reduced ? [0, 1, 2, 1][Math.floor(performance.now() / 135) % 4] : 1;
    paintPersonalCharacter(sprite, currentUser.character, playerDirection, frame, action ? playerAction : null);
    return;
  }
  const rowByDirection = { down: 0, left: 33.333, right: 33.333, up: 100 };
  const columnPositions = [0, 50, 100];
  sprite.style.setProperty("--frame-x", `${columnPositions[isMoving ? playerFrame : 1]}%`);
  sprite.style.setProperty("--direction-y", `${rowByDirection[playerDirection]}%`);
  sprite.classList.toggle("facing-left", playerDirection === "left");
}

function setPlayerDirection(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) playerDirection = dx < 0 ? "left" : "right";
  else if (Math.abs(dy) > 0) playerDirection = dy < 0 ? "up" : "down";
}

function setScene(nextScene) {
  if (nextScene === currentScene) return;
  scenePlayerPositions[currentScene] = { x: player.x, y: player.y };
  currentScene = nextScene;
  Object.assign(player, scenePlayerPositions[currentScene]);
  playerDirection = currentScene === "chemPod" ? "up" : "down";
  playerFrame = 1;
  playerAction = null;
  pendingActionSpot = null;
  clickPath = [];
  document.querySelector("#townView").hidden = currentScene !== "town";
  document.querySelector("#chemPodView").hidden = currentScene !== "chemPod";
  document.querySelector("#sceneTitle").textContent = currentScene === "chemPod" ? "Chem Pod" : "Town";
  if (currentScene === "chemPod") renderChemPod();
  else {
    renderResidents();
    townCameraMetrics = null;
    townCamera.ready = false;
    window.requestAnimationFrame(() => updateTownCamera(0, true));
  }
  publishPresence(true, false);
}

function transitionToScene(nextScene) {
  if (sceneTransitioning || nextScene === currentScene) return;
  sceneTransitioning = true;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  sceneCurtain.classList.add("active");
  window.setTimeout(() => {
    setScene(nextScene);
    showToast(nextScene === "chemPod" ? "Welcome to Chem Pod." : "Back in Donut Town.");
    window.setTimeout(() => {
      sceneCurtain.classList.remove("active");
      sceneTransitioning = false;
    }, reducedMotion ? 0 : 120);
  }, reducedMotion ? 0 : 130);
}

function gameLoop(timestamp) {
  const deltaSeconds = Math.min((timestamp - lastGameTime) / 1000, 0.05);
  lastGameTime = timestamp;
  let dx = 0;
  let dy = 0;

  if (pressedKeys.has("arrowup") || pressedKeys.has("w")) dy -= 1;
  if (pressedKeys.has("arrowdown") || pressedKeys.has("s")) dy += 1;
  if (pressedKeys.has("arrowleft") || pressedKeys.has("a")) dx -= 1;
  if (pressedKeys.has("arrowright") || pressedKeys.has("d")) dx += 1;

  if ((dx || dy) && clickPath.length) {
    clickPath = [];
  }
  if (!dx && !dy && clickPath.length) {
    const target = clickPath[0];
    const targetDx = target.x - player.x;
    const targetDy = target.y - player.y;
    const targetDistance = Math.hypot(targetDx, targetDy);
    if (targetDistance < 0.35) {
      clickPath.shift();
    }
    else {
      dx = targetDx / targetDistance;
      dy = targetDy / targetDistance;
    }
  }

  const isMoving = Boolean(dx || dy);
  if (isMoving) {
    playerAction = null;
    window.TownZones?.reset();
    if (pendingActionSpot && pressedKeys.size) pendingActionSpot = null;
  } else if (pendingActionSpot && pendingActionSpot.scene === currentScene && !clickPath.length) {
    if (currentUser?.character?.actions?.[pendingActionSpot.id]) {
      playerAction = pendingActionSpot.id;
      playerDirection = pendingActionSpot.facing;
    }
    pendingActionSpot = null;
  } else if (!pendingActionSpot && window.TownZones?.ready) {
    // Standing still somewhere tagged settles you into what that place is for:
    // a free bench, the lawn, a bridge railing, the cafe tables, a garden bed.
    if (!clickPath.length) {
      const settled = window.TownZones.settle(player, currentScene, timestamp, currentUser?.character?.actions, actionSpotOccupants());
      if (settled?.walkTo) clickPath = findWalkPath(player, settled.walkTo);
      else if (settled) {
        playerAction = settled.action;
        playerDirection = settled.facing;
      } else {
        playerAction = null;
      }
    }
  } else if (!pendingActionSpot) {
    const spot = nearestActionSpot(player, 1.6);
    if (spot && currentUser?.character?.actions?.[spot.id]) {
      playerAction = spot.id;
      playerDirection = spot.facing;
    }
  }
  if (isMoving) {
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    setPlayerDirection(dx, dy);
    const speed = currentScene === "town" ? 5 : 10;
    const nextX = player.x + dx * speed * deltaSeconds;
    const nextY = player.y + dy * speed * deltaSeconds;
    if (isWalkable(nextX, nextY)) {
      player.x = nextX;
      player.y = nextY;
    } else {
      const canMoveX = isWalkable(nextX, player.y);
      const canMoveY = isWalkable(player.x, nextY);
      if (canMoveX) player.x = nextX;
      else if (canMoveY) player.y = nextY;
      else {
        clickPath = [];
      }
    }
    if (timestamp - lastFrameChange > 135) {
      playerFrame = (playerFrame + 1) % 3;
      lastFrameChange = timestamp;
    }
  } else {
    playerFrame = 1;
  }

  updatePlayerElement(isMoving);
  // Only worth a frame of work when somebody's pose actually moves.
  if (residentPosesAnimate) paintResidentCharacters(currentScene === "chemPod" ? document.querySelector("#chemPodResidentsLayer") : layer);
  updateTownCamera(deltaSeconds);
  publishPresence(false, isMoving);
  renderLivePlayers(deltaSeconds);
  window.requestAnimationFrame(gameLoop);
}

function openResident(id) {
  closeProfile();
  selectedResident = residents.find(person => person.id === id);
  document.querySelector("#residentName").textContent = selectedResident.name;
  document.querySelector("#residentSummary").textContent = selectedResident.title || selectedResident.realName || "Slack member";
  document.querySelector("#residentFacts").innerHTML = factsMarkup(slackFacts(selectedResident));
  const donutCopy = document.querySelector("#donutCountCopy");
  donutCopy.innerHTML = selectedResident.donuts === null
    ? "Donut history not connected yet"
    : `<strong id="residentDonuts">${escapeHtml(selectedResident.donuts)}</strong> successful pairings`;
  document.querySelector("#connectionNote").textContent = "Profile details are synced from Slack.";
  setSlackAvatar(document.querySelector("#drawerPortrait"), selectedResident);
  const statusLabel = selectedResident.status === "open" ? "Open to invitations" : selectedResident.status === "pending" ? "Invitation pending" : "Booked this week";
  document.querySelector("#drawerStatus").textContent = statusLabel;

  const invitationSent = outgoingInvitations.some(invitation => invitation.inviteeId === selectedResident.slackId);
  const invitationLimitReached = outgoingInvitations.length >= 3;
  const currentUserBooked = currentUser?.status === "booked";
  inviteButton.classList.remove("remove");
  inviteButton.disabled = invitationSent || selectedResident.status !== "open" || invitationLimitReached || currentUserBooked || !invitesOpen;
  inviteButton.textContent = invitationSent
    ? "Invitation sent"
    : currentUserBooked
      ? "You are booked this week"
      : selectedResident.status === "pending"
        ? "Invitation already pending"
        : selectedResident.status === "booked"
          ? "Booked this week"
          : invitationLimitReached
            ? "All three invitations are in use"
            : !invitesOpen
              ? "Invitations are paused"
              : "Invite to a Donut chat";
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  drawerScrim.hidden = false;
}

function stableMemberScore(member) {
  let hash = 2166136261;
  for (const character of String(member.id || member.displayName || "member")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function assignedChemPodIds(neighbors) {
  if (neighbors.length <= 20) return new Set();
  const count = Math.min(chemPodResidentSlots.length, Math.max(1, Math.round(neighbors.length * 0.2)));
  return new Set([...neighbors].sort((left, right) => {
    const leftMatch = /chem|material|lab|science|process/i.test(left.title || "") ? 0 : 1;
    const rightMatch = /chem|material|lab|science|process/i.test(right.title || "") ? 0 : 1;
    return leftMatch - rightMatch || stableMemberScore(left) - stableMemberScore(right);
  }).slice(0, count).map(member => member.id));
}

function populationSlot(slots, index) {
  const base = slots[index % slots.length];
  const lap = Math.floor(index / slots.length);
  if (!lap) return base;
  const angle = index * 2.399963;
  const offset = Math.min(2.4, lap * 0.8);
  const candidate = { ...base, x: base.x + Math.cos(angle) * offset, y: base.y + Math.sin(angle) * offset };
  const valid = slots === residentSlots ? isTownWalkable(candidate.x, candidate.y) : isChemPodWalkable(candidate.x, candidate.y);
  return valid ? candidate : base;
}

// Additional residents use the centers of visible paved paths, not a field grid.
const gatheringPaths = [
  { from: [49, 20], to: [49, 35] },
  { from: [52, 20], to: [52, 35] },
  { from: [40, 38], to: [40, 49] },
  { from: [59, 38], to: [59, 49] },
  { from: [49, 54], to: [49, 66] },
  { from: [52, 54], to: [52, 66] },
  { from: [35, 30], to: [39, 35] },
  { from: [61, 34], to: [70, 29] },
  { from: [24, 48], to: [38, 48] },
  { from: [62, 48], to: [70, 48] },
  { from: [55, 66], to: [72, 64] },
  { from: [46, 77], to: [46, 84] },
  { from: [10, 86], to: [27, 86] }
];
for (let step = 0; step <= 5; step++) {
  for (const path of gatheringPaths) {
    const x = path.from[0] + (path.to[0] - path.from[0]) * step / 5;
    const y = path.from[1] + (path.to[1] - path.from[1]) * step / 5;
    if (!isTownWalkable(x, y)) continue;
    if (residentSlots.some(spot => Math.hypot(spot.x - x, spot.y - y) < 3)) continue;
    if (donutStations.some(station => Math.hypot(station.x - x, station.y + 2 - y) < 4)) continue;
    residentSlots.push({ x, y, activity: "path" });
  }
}
// Hand-placed anchors predate the walk mask, so pull each one onto real ground.
function snapTownAnchors() {
  if (!window.TownCollision?.ready) return;
  const snap = point => {
    const spot = window.TownCollision.nearestWalkable(point.x, point.y);
    point.x = spot.x;
    point.y = spot.y;
  };
  donutStations.forEach(station => [station, station.left, station.right].forEach(snap));
  [player, scenePlayerPositions.town].forEach(snap);
}
snapTownAnchors();

// Give everyone their own patch of town rather than crowding the plaza: the
// mask knows every road, lawn, bridge and crop row, so spread over all of it.
function spreadResidentSlots(slots, collision, count, spacing) {
  if (!collision?.ready) return;
  const spots = collision.spreadPoints(count, spacing);
  if (spots.length < 8) return;
  slots.length = 0;
  for (const spot of spots) slots.push({ ...spot, activity: "path" });
}
spreadResidentSlots(residentSlots, window.TownCollision, 160, 4.2);
spreadResidentSlots(chemPodResidentSlots, window.ChemPodCollision, 26, 4.5);

residents.forEach((person, index) => Object.assign(person, populationSlot(residentSlots, index)));

async function syncSlackResidents() {
  try {
    const response = await fetch("/api/slack/members", { headers: { accept: "application/json" }, signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error("Slack sync unavailable");
    const data = await response.json();
    if (!Array.isArray(data.members)) throw new Error("Invalid member response");
    document.querySelector("#loadingMessage").textContent = "Preparing resident characters…";
    await Promise.all(data.members.map(async member => { member.character = await loadCharacterArt(member.character); }));
    const summary = document.querySelector("#neighborSummary");
    outgoingInvitations = Array.isArray(data.outgoingInvitations) ? data.outgoingInvitations : [];
    currentUser = data.members.find(member => member.isCurrentUser) || null;
    const neighbors = data.members
      .filter(member => !member.isCurrentUser)
      .sort((left, right) => stableMemberScore(left) - stableMemberScore(right) || left.id.localeCompare(right.id));
    renderCurrentProfile();
    const chemPodIds = assignedChemPodIds(neighbors);
    let townIndex = 0;
    let chemPodIndex = 0;
    residents = neighbors.map((member, index) => {
      const homeScene = chemPodIds.has(member.id) ? "chemPod" : "town";
      const slot = homeScene === "chemPod"
        ? populationSlot(chemPodResidentSlots, chemPodIndex++)
        : populationSlot(residentSlots, townIndex++);
      return {
      id: index + 1,
      slackId: member.id,
      characterKey: member.characterKey,
      spriteIndex: member.appearanceIndex,
      character: member.character,
      name: member.displayName,
      displayName: member.displayName,
      realName: member.realName,
      avatarUrl: member.avatarUrl,
      title: member.title,
      pronouns: member.pronouns,
      statusText: member.statusText,
      timezone: member.timezone,
      timezoneLabel: member.timezoneLabel,
      status: member.status || "open",
      partnerId: member.partnerId || null,
      pairId: member.pairId || null,
      donuts: member.donutCount,
      group: "unknown",
      scene: homeScene,
      homeScene,
      x: slot.x,
      y: slot.y,
      activity: slot.activity || "path",
      baseX: slot.x,
      baseY: slot.y,
      baseActivity: slot.activity || "path",
      note: member.donutCount === null
        ? "Synced from Slack. Donut history is not connected yet."
        : member.donutCount > 0
          ? `${member.donutCount} completed Donut chats are recorded.`
          : "No completed Donut chats are recorded yet."
      };
    });
    selectedResident = null;
    currentFilter = "all";
    const filtersAvailable = residents.some(person => person.group !== "unknown" || person.donuts !== null);
    document.querySelectorAll(".filter-button").forEach(button => {
      button.classList.toggle("active", button.dataset.filter === "all");
      button.disabled = button.dataset.filter !== "all" && !filtersAvailable;
      if (button.disabled) button.title = "Team and participation data are not connected yet";
    });
    summary.textContent = currentUser
      ? `${data.total} Slack members · ${townIndex} around town · ${chemPodIndex} in Chem Pod`
      : `${data.total} Slack residents + local player (identity not linked)`;
    applyPairPreview();
    layoutBookedPairs();
    updateAvailabilityControl();
    renderResidents();
    if (currentScene === "chemPod") renderChemPod();
    renderInvitationDock();
    connectRealtime();
    return true;
  } catch {
    disconnectRealtime();
    currentUser = null;
    residents = [];
    outgoingInvitations = [];
    renderResidents();
    renderInvitationDock();
    document.querySelector("#neighborSummary").textContent = "Slack sync temporarily unavailable · no demo residents shown";
    renderCurrentProfile();
    return false;
  }
}

let wardrobeRevision = 0;
let outfitSyncRunning = false;
async function syncWardrobeOutfits() {
  if (document.hidden || !currentUser || outfitSyncRunning) return;
  outfitSyncRunning = true;
  const revision = wardrobeRevision;
  try {
    const response = await fetch("/api/wardrobe", {signal: AbortSignal.timeout(10000)});
    if (!response.ok) return;
    const { characters } = await response.json();
    let changed = false;
    for (const person of [currentUser, ...residents]) {
      if (!person) continue;
      if (person === currentUser && (revision !== wardrobeRevision || document.querySelector("#profileWardrobe").dataset.saving)) continue;
      const next = characters?.[person.characterKey];
      if (!next || JSON.stringify(next.outfit) === JSON.stringify(person.character?.outfit)) continue;
      const loaded = await loadCharacterArt(next);
      if (!loaded) continue;
      if (person === currentUser && (revision !== wardrobeRevision || document.querySelector("#profileWardrobe").dataset.saving)) continue;
      person.character = loaded; changed = true;
      if (person === currentUser) document.querySelector("#profileWardrobe").dispatchEvent(new CustomEvent("wardrobe-outfit", {detail: next.outfit}));
    }
    if (changed) { renderResidents(); if (currentScene === "chemPod") renderChemPod(); }
  } catch { /* Keep last confirmed outfit until the next sync. */ }
  finally { outfitSyncRunning = false; }
}

async function syncInvitationStates() {
  if (document.hidden || !residents.length) return;
  try {
    const response = await fetch("/api/slack/invitation-states", { headers: { accept: "application/json" } });
    if (!response.ok) return;
    const { states, outgoingInvitations: nextOutgoingInvitations } = await response.json();
    outgoingInvitations = Array.isArray(nextOutgoingInvitations) ? nextOutgoingInvitations : [];
    residents.forEach(person => Object.assign(person, states[person.slackId] || { status: "open", partnerId: null, pairId: null }));
    if (currentUser) Object.assign(currentUser, states[currentUser.id] || { status: "open", partnerId: null, pairId: null });
    applyPairPreview();
    layoutBookedPairs();
    updateAvailabilityControl();
    renderResidents();
    if (currentScene === "chemPod") renderChemPod();
    renderInvitationDock();
    if (drawer.classList.contains("open") && selectedResident) openResident(selectedResident.id);
  } catch {
    // Keep the last known state during a temporary network interruption.
  }
}

function updateAvailabilityControl() {
  const button = document.querySelector("#availabilityButton");
  const booked = currentUser?.status === "booked";
  button.disabled = booked;
  button.classList.toggle("booked", booked);
  button.classList.toggle("paused", !booked && !invitesOpen);
  button.setAttribute("aria-pressed", String(!booked && invitesOpen));
  document.querySelector("#availabilityText").textContent = booked
    ? "Booked this week"
    : invitesOpen ? "Open to invites" : "Paused this week";
}

function renderCurrentProfile() {
  const name = currentUser?.displayName || "Slack member";
  const profileButton = document.querySelector("#profileButton");
  setSlackAvatar(profileButton, currentUser || { displayName: name });
  profileButton.setAttribute("aria-label", currentUser ? `Open ${name}'s Slack profile` : "Open your profile");
  setSlackAvatar(document.querySelector("#profileAvatar"), currentUser || { displayName: name });
  document.querySelector("#profileWardrobe").hidden = !currentUser?.character?.layers;
  document.querySelector("#profileName").textContent = name;
  const ownFacts = [
    ["Role", currentUser?.title],
    ...slackFacts(currentUser)
  ].filter(([, value]) => value);
  document.querySelector("#currentProfileFacts").innerHTML = factsMarkup(ownFacts, "Add a title, status, or pronouns in Slack to see more here.");
  const donutCount = currentUser?.donutCount;
  document.querySelector("#myDonutCount").textContent = Number.isInteger(donutCount) ? donutCount : "-";
  document.querySelector("#myDonutNote").textContent = Number.isInteger(donutCount)
    ? "Completed pairings recorded in the Donut Bot sheet."
    : "Donut history will appear after the Lottery history sync is connected.";
}

let wardrobeMount = null;
function openProfile() {
  closeDrawer();
  const profileDrawer = document.querySelector("#profileDrawer");
  profileDrawer.classList.add("open");
  profileDrawer.setAttribute("aria-hidden", "false");
  document.querySelector("#profileScrim").hidden = false;
  document.querySelector("#profileButton").setAttribute("aria-expanded", "true");
  const wardrobe = document.querySelector("#profileWardrobe");
  if (!wardrobe.hidden && !wardrobeMount) {
    wardrobeMount = import("./profile-wardrobe.mjs").then(module => module.mountWardrobe(wardrobe, { manifestUrl: wardrobeManifestUrl(currentUser.character), initialOutfit: currentUser?.character?.outfit, onSaved: async character => {
      const loaded = await loadCharacterArt(character);
      if (!loaded) throw new Error("Character image unavailable");
      wardrobeRevision++;
      currentUser.character = loaded;
      renderResidents();
      if (currentScene === "chemPod") renderChemPod();
    } })).catch(() => {
      wardrobe.querySelector('[role="status"]').textContent = "Wardrobe unavailable. Reopen to retry.";
      wardrobeMount = null;
    });
  }
}

function closeProfile() {
  document.querySelector("#profileWardrobe").dispatchEvent(new Event("wardrobe-close"));
  const profileDrawer = document.querySelector("#profileDrawer");
  profileDrawer.classList.remove("open");
  profileDrawer.setAttribute("aria-hidden", "true");
  document.querySelector("#profileScrim").hidden = true;
  document.querySelector("#profileButton").setAttribute("aria-expanded", "false");
}

function closeDrawer() {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  drawerScrim.hidden = true;
}

function renderInvitationDock() {
  const available = Math.max(0, 3 - outgoingInvitations.length);
  const booked = currentUser?.status === "booked";
  document.querySelector("#availableInviteCount").textContent = booked ? 0 : available;
  document.querySelector("#inviteDockHelp").textContent = booked
    ? "Your Donut chat is booked for this week."
    : "People waiting to answer your invitation appear here.";
  pendingInviteEmpty.hidden = outgoingInvitations.length > 0;
  pendingInviteEmpty.textContent = booked
    ? "Your pending invitations closed when a Donut chat was booked."
    : `You have ${available === 1 ? "one invitation" : `${available} invitations`} available. Choose a neighbor to begin.`;
  pendingInviteList.innerHTML = outgoingInvitations.map(invitation => {
    const person = residents.find(resident => resident.slackId === invitation.inviteeId);
    const name = person?.name || "Slack member";
    return `<li class="pending-invite-item">
      <span class="pending-avatar" aria-hidden="true">${escapeHtml(initialsFor(name))}</span>
      <span class="pending-copy"><strong>${escapeHtml(name)}</strong><small>Waiting for reply</small></span>
      <span class="pending-state">Pending</span>
    </li>`;
  }).join("");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3200);
}

document.querySelector("#closeDrawer").addEventListener("click", closeDrawer);
drawerScrim.addEventListener("click", closeDrawer);
inviteButton.addEventListener("click", sendSelectedInvitation);
document.querySelector("#profileButton").addEventListener("click", openProfile);
document.querySelector("#closeProfile").addEventListener("click", closeProfile);
document.querySelector("#profileScrim").addEventListener("click", closeProfile);
document.querySelectorAll(".filter-button").forEach(button => button.addEventListener("click", () => {
  currentFilter = button.dataset.filter;
  document.querySelectorAll(".filter-button").forEach(item => item.classList.toggle("active", item === button));
  renderResidents();
}));

document.querySelector("#availabilityButton").addEventListener("click", () => {
  if (currentUser?.status === "booked") return;
  invitesOpen = !invitesOpen;
  updateAvailabilityControl();
  showToast(invitesOpen ? "You are open to invitations again." : "Invitations paused for this week.");
});

document.querySelector("#dockHandle").addEventListener("click", () => {
  const body = document.querySelector(".dock-body");
  body.hidden = !body.hidden;
  document.querySelector("#dockHandle").setAttribute("aria-expanded", String(!body.hidden));
});

function finishMapDrag() {
  const viewport = document.querySelector("#mapWrap");
  if (mapDrag && viewport.hasPointerCapture(mapDrag.id)) viewport.releasePointerCapture(mapDrag.id);
  mapDrag = null;
  viewport.classList.remove("is-dragging");
}

const mapViewport = document.querySelector("#mapWrap");
mapViewport.addEventListener("pointerdown", event => {
  if (cameraMode !== "overview" || event.button !== 0 || !event.isPrimary || event.target.closest("button")) return;
  finishMapDrag();
  suppressMapClick = false;
  mapDrag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false };
});
mapViewport.addEventListener("pointermove", event => {
  if (!mapDrag || mapDrag.id !== event.pointerId) return;
  if (!event.buttons) { finishMapDrag(); return; }
  if (!mapDrag.active && Math.hypot(event.clientX - mapDrag.startX, event.clientY - mapDrag.startY) < 6) return;
  if (!mapDrag.active) {
    mapDrag.active = true;
    mapViewport.setPointerCapture(event.pointerId);
    mapViewport.classList.add("is-dragging");
  }
  suppressMapClick = true;
  const { viewportWidth, viewportHeight, worldWidth, worldHeight } = townCameraMetrics;
  const x = clampCameraOffset(townCamera.x + event.clientX - mapDrag.x, viewportWidth, worldWidth * townCamera.scale);
  const y = clampCameraOffset(townCamera.y + event.clientY - mapDrag.y, viewportHeight, worldHeight * townCamera.scale);
  overviewCenter.x = (viewportWidth / 2 - x) / townCamera.scale;
  overviewCenter.y = (viewportHeight / 2 - y) / townCamera.scale;
  mapDrag.x = event.clientX;
  mapDrag.y = event.clientY;
  updateTownCamera(0, true);
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
  mapViewport.addEventListener(type, event => {
    if (mapDrag?.id === event.pointerId) finishMapDrag();
  });
}
// A drag ends with a browser click; consume it before it can start a walk.
mapViewport.addEventListener("click", event => {
  if (!suppressMapClick) return;
  suppressMapClick = false;
  event.preventDefault();
  event.stopPropagation();
}, true);

function movePlayerFromMapClick(event) {
  if (event.target.closest("button")) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * 100;
  const y = ((event.clientY - bounds.top) / bounds.height) * 100;
  const destination = nearestWalkable(x, y);
  clickPath = findWalkPath(player, destination);
}

document.querySelector("#mapWorld").addEventListener("click", movePlayerFromMapClick);
document.querySelector("#chemPodWorld").addEventListener("click", movePlayerFromMapClick);
// The donut fountain is the shop counter: walk over, then the shelves open.
let shopPanel = null;
let ownedShopItems = [];
function openShop() {
  const drawer = document.querySelector("#shopDrawer");
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  document.querySelector("#shopScrim").hidden = false;
  if (!shopPanel) {
    shopPanel = import("./shop-panel.mjs")
      .then(module => module.mountShop(drawer, { onOwnedChange: owned => { ownedShopItems = owned; } }))
      .catch(() => {
        drawer.querySelector('[data-shop="status"]').textContent = "Shop unavailable. Close and try again.";
        shopPanel = null;
        return null;
      });
  }
  shopPanel?.then(panel => panel?.load());
}
function closeShop() {
  const drawer = document.querySelector("#shopDrawer");
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  document.querySelector("#shopScrim").hidden = true;
}
document.querySelector("#shopEntrance").addEventListener("click", event => {
  event.stopPropagation();
  if (currentScene === "town") clickPath = findWalkPath(player, { x: 51, y: 47 });
  openShop();
});
// A member's own room, entered from their profile.
let housePanel = null;
function openHouse() {
  const view = document.querySelector("#houseView");
  view.hidden = false;
  closeProfile();
  if (!housePanel) {
    housePanel = import("./house.mjs")
      .then(module => module.mountHouse(view, {
        paintCharacter: element => {
          if (!currentUser?.character) return;
          element.innerHTML = personalCharacterMarkup(currentUser.character, "house-character");
          paintPersonalCharacter(element.firstElementChild, currentUser.character, "down");
        }
      }))
      .catch(() => {
        view.querySelector('[data-house="status"]').textContent = "House unavailable. Close and try again.";
        housePanel = null;
        return null;
      });
  }
  housePanel?.then(panel => panel?.load());
}
function closeHouse() {
  document.querySelector("#houseView").hidden = true;
}
document.querySelector("#openHouse").addEventListener("click", openHouse);
document.querySelector("#leaveHouse").addEventListener("click", closeHouse);
document.querySelector("#closeShop").addEventListener("click", closeShop);
document.querySelector("#shopScrim").addEventListener("click", closeShop);
document.querySelector("#chemPodEntrance").addEventListener("click", () => transitionToScene("chemPod"));
document.querySelector("#chemPodExit").addEventListener("click", () => transitionToScene("town"));
document.querySelector("#leaveChemPod").addEventListener("click", () => transitionToScene("town"));
document.querySelectorAll("[data-camera-mode]").forEach(button => button.addEventListener("click", () => setCameraMode(button.dataset.cameraMode, true)));

async function sendSelectedInvitation() {
  const person = selectedResident;
  if (!person?.slackId) return;
  try {
    const result = await requestInvitation({ inviteeId: person.slackId, priority: outgoingInvitations.length + 1 }, inviteButton, "Invite to a Donut chat");
    if (result.dryRun) {
      showToast(`Safe preview passed for ${person.name}. Slack sending is still disabled.`);
      return;
    }
    outgoingInvitations.push({
      id: result.invitation.id,
      inviteeId: person.slackId,
      createdAt: result.invitation.createdAt
    });
    Object.assign(person, { status: "pending", partnerId: currentUser?.id || null, pairId: null });
    renderResidents();
    renderInvitationDock();
    openResident(person.id);
    showToast(`Donut Bot sent a private invitation to ${person.name}.`);
  } catch (error) {
    showToast(invitationErrorMessage(error));
    openResident(person.id);
  }
}

async function requestInvitation(payload, button, idleLabel) {
  button.disabled = true;
  button.textContent = "Sending…";
  try {
    const response = await fetch("/api/slack/invitations", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "invitation_failed");
    return result;
  } finally {
    button.disabled = false;
    button.textContent = idleLabel;
  }
}

function invitationErrorMessage(error) {
  const messages = {
    slack_login_required: "Please enter again from Slack before sending.",
    invitation_already_pending: "An invitation to this person is already pending.",
    pending_invitation_limit: "You already have three pending invitations.",
    inviter_already_booked: "You already have a Donut chat booked this week.",
    invitee_already_booked: "This person already has a Donut chat booked this week."
  };
  return messages[error.message] || "The invitation could not be sent. Please try again.";
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeDrawer();
    closeProfile();
  }
  if (drawer.classList.contains("open") || document.querySelector("#profileDrawer").classList.contains("open")) return;
  const key = event.key.toLowerCase();
  if (currentScene === "town" && cameraMode === "overview" && event.shiftKey && key.startsWith("arrow")) {
    event.preventDefault();
    const { viewportWidth, viewportHeight } = townCameraMetrics;
    overviewCenter.x = (viewportWidth / 2 - townCamera.x) / townCamera.scale + (key === "arrowright" ? 80 : key === "arrowleft" ? -80 : 0);
    overviewCenter.y = (viewportHeight / 2 - townCamera.y) / townCamera.scale + (key === "arrowdown" ? 80 : key === "arrowup" ? -80 : 0);
    return;
  }
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
    pressedKeys.add(key);
  }
});

document.addEventListener("keyup", event => pressedKeys.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => { pressedKeys.clear(); finishMapDrag(); });
window.addEventListener("resize", () => {
  finishMapDrag();
  townCameraMetrics = null;
  townCamera.ready = false;
  updateTownCamera(0, true);
});

async function startTown() {
  const loading = document.querySelector("#loadingScreen");
  const message = document.querySelector("#loadingMessage");
  const retry = document.querySelector("#retryTown");
  retry.hidden = true;
  message.textContent = "Loading Slack residents…";
  const slow = setTimeout(() => { message.textContent = "Still connecting. The server may be waking up…"; }, 6000);
  const ready = await syncSlackResidents();
  clearTimeout(slow);
  if (ready) {
    renderActionSpots();
    loading.classList.add("done");
    document.querySelector(".app-shell").inert = false;
    if (new URLSearchParams(location.search).get("profile") === "1") openProfile();
    syncInvitationStates();
  } else {
    message.textContent = "Could not load the town. Please try again.";
    retry.hidden = false;
  }
}
document.querySelector("#retryTown").addEventListener("click", startTown);

if (window.location.protocol === "file:") {
  residents = [];
  renderActionSpots();
  renderResidents();
  renderInvitationDock();
  document.querySelector("#neighborSummary").innerHTML = `Slack is unavailable in file mode · <a href="http://127.0.0.1:4173/">Open connected town</a>`;
  document.querySelector("#loadingMessage").textContent = "Open this town through its web server to connect to Slack.";
} else {
  renderInvitationDock();
  loadRoomContent();
  startTown();
  window.setInterval(() => { syncInvitationStates(); syncWardrobeOutfits(); }, 5000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) disconnectRealtime();
    else {
      syncInvitationStates();
      connectRealtime();
    }
  });
}
if (window.matchMedia("(max-width: 760px)").matches) {
  document.querySelector(".dock-body").hidden = true;
  document.querySelector("#dockHandle").setAttribute("aria-expanded", "false");
}
window.requestAnimationFrame(gameLoop);
