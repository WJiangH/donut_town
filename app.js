let residents = [];
let activeThemeId = 'classic';
let themeController = null;
let assignTownActivities=null;
let activeTownZones=[];
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
  { x: 30, y: 73 }, { x: 67, y: 73 }, { x: 50, y: 45 },
  { x: 74, y: 45 }, { x: 18, y: 65 }, { x: 80, y: 65 },
  { x: 27, y: 45 }, { x: 52, y: 74 }
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



let outgoingInvitations = [];
let incomingInvitations = [];
let invitationNotices = [];
let invitationNoticeMarkupCache = null;
let respondingInvitation = null;
let incomingMarkupCache = null;
let selectedResident = null;
let currentFilter = "all";
let invitesOpen = true;
const player = { id: 11, name: "You", x: 50, y: 59 };
const scenePlayerPositions = {
  town: { x: player.x, y: player.y },
  chemPod: { x: 50, y: 86 },
  donutShop: { x: 50, y: 84 },
  donutFactory: { x: 50, y: 88 }
};
let currentScene = "town";
let sceneTransitioning = false;
let currentUser = null;
let headwearPrototype = null;
let headwearPrototypeLoad = null;
let currentPairId = null;
let factoryPairs = [];
let factoryPage = 0;
let lastFactoryMarkup = null;
let requestedFactory = null;
const previewPairUserId = new URLSearchParams(window.location.search).get("previewPair");
const pressedKeys = new Set();
let clickPath = [];
let playerDirection = "down";
let playerFrame = 1;
let playerAction = null;
// The pet a member has taken out with them, learned from the shop.
let equippedPet = null;
// A pose a member has chosen to hold anywhere, instead of what the map suggests.
let chosenPose = null;
try { chosenPose = window.localStorage?.getItem("donut-town:pose") || null; } catch { chosenPose = null; }
let lastFrameChange = 0;

let lastGameTime = performance.now();
const remotePlayers = new Map();
const onlineRoster = new window.OnlineRoster();
const remotePlayerElements = new Map();
let realtimeSocket = null;
let realtimeReconnectTimer = null;
let realtimeReconnectDelay = 1000;
let lastPresenceSentAt = 0;
let lastPresenceSignature = "";
const townCamera = { x: 0, y: 0, scale: 1, ready: false };
let townCameraMetrics = null;
let cameraMode = "overview";

// Where a member was last standing, kept in their browser so a refresh puts
// them back rather than at the fountain.
const POSITION_KEY = "donut-town:position";
let positionSaveTimer = null;

function rememberPosition() {
  clearTimeout(positionSaveTimer);
  positionSaveTimer = setTimeout(() => {
    try {
      const spots = { ...scenePlayerPositions, [currentScene]: { x: player.x, y: player.y } };
      window.localStorage?.setItem(`${POSITION_KEY}:${activeThemeId}`, JSON.stringify({ scene: currentScene, spots }));
    } catch {
      // A browser that refuses storage simply starts from the fountain again.
    }
  }, 600);
}

// Only ground the town still allows: the map may have changed under a saved spot.
function restorePosition() {
  let saved;
  try { saved = JSON.parse(window.localStorage?.getItem(`${POSITION_KEY}:${activeThemeId}`) || (activeThemeId === 'classic' && window.localStorage?.getItem(POSITION_KEY)) || "null"); } catch { return; }
  if (!saved?.spots) return;
  for (const [scene, spot] of Object.entries(saved.spots)) {
    if (!scenePlayerPositions[scene] || !Number.isFinite(spot?.x) || !Number.isFinite(spot?.y)) continue;
    const collision = scene === "chemPod" ? window.ChemPodCollision : scene === "donutFactory" ? window.FactoryCollision : window.TownCollision;
    const landing = collision?.ready ? collision.nearestWalkable(spot.x, spot.y) : spot;
    scenePlayerPositions[scene] = { x: landing.x, y: landing.y };
  }
  if (saved.scene && scenePlayerPositions[saved.scene] && saved.scene === currentScene) {
    Object.assign(player, scenePlayerPositions[currentScene]);
  }
}

function clampCameraOffset(offset, viewportSize, worldSize) {
  return worldSize <= viewportSize ? (viewportSize-worldSize)/2 : Math.max(viewportSize - worldSize, Math.min(0, offset));
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

function setSlackAvatar(element, person, lazy = false) {
  element.replaceChildren();
  element.classList.toggle("has-photo", Boolean(person?.avatarUrl));
  if (!person?.avatarUrl) {
    element.textContent = initialsFor(person?.displayName || person?.name || "Slack member");
    return;
  }
  const image = document.createElement("img");
  image.className = "slack-avatar-image";
  image.loading = lazy ? "lazy" : "eager";
  image.decoding = "async";
  image.alt = "";
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => {
    element.classList.remove("has-photo");
    element.textContent = initialsFor(person?.displayName || person?.name || "Slack member");
  }, { once: true });
  image.src = person.avatarUrl;
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
  // ponytail: load only the outfit we paint; actions load when first used.
  const urls = character.layers || [character.url];
  if (urls.some(url => !characterAssetUrlOk(url))) return null;
  if (Object.values(character.actions || {}).some(action => !characterAssetUrlOk(action.url))) return null;
  const walkOk = await Promise.all(urls.map(url => loadCharacterImage(url, character.imageWidth, character.imageHeight)));
  if (!walkOk.every(Boolean)) return null;
  return character;
}

const characterActionLoads = new WeakMap();
function characterActionReady(action) {
  if (!characterActionLoads.has(action)) {
    const state = { ready: false };
    characterActionLoads.set(action, state);
    void loadCharacterImage(action.url, action.imageWidth, action.imageHeight).then(ok => {
      state.ready = ok;
      if (ok) paintResidentCharacters(sceneLayer("residents") || layer);
    });
  }
  return characterActionLoads.get(action).ready;
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
  let action = actionId && character.actions?.[actionId];
  if (action && !characterActionReady(action)) { action = null; actionId = null; frame = 1; }
  const facing = action?.facing || direction;
  const source = action || character;
  const index = action ? frame % action.frames.length : (facing === "up" ? 2 : (facing === "left" || facing === "right") ? 1 : 0) * 3 + frame;
  if (element.classList.contains("player-character")) headwearPrototype?.paint(element, character, facing, index, actionId);
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
  container.querySelectorAll(".resident-pin[data-id]:not(.hidden)").forEach(pin => {
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
  return `${custom || `<div class="pixel-person${facingClass}" style="--sprite-x:${spriteX}%;--sprite-y:${spriteY}%" aria-hidden="true"></div>`}${compact ? "" : `<span class="resident-state"></span><span class="resident-label">${escapeHtml(person.name.split(" ")[0])}</span><span class="roster-online-dot" aria-hidden="true"></span>`}`;
}

function playerMarkup() {
  const directionRows = { down: 0, right: 33.333, left: 33.333, up: 100 };
  const framePositions = [0, 50, 100];
  const facingClass = playerDirection === "left" ? " facing-left" : "";
  const custom = currentUser?.character ? personalCharacterMarkup(currentUser.character, "player-character") : null;
  return `${custom || `<div class="player-character${facingClass}" style="--frame-x:${framePositions[playerFrame]}%;--direction-y:${directionRows[playerDirection]}%" aria-hidden="true"></div>`}
    <span class="resident-state"></span><span class="resident-label">You</span><span class="self-online-dot" aria-hidden="true"></span>`;
}

function residentIsVisible(person) {
  return currentFilter === "all" || (currentFilter === "other" && person.group === "other") || (currentFilter === "new" && person.donuts !== null && person.donuts <= 2);
}

// Cached pin markup: the sync loop calls the renderers on a timer whether or
// not anything moved, and rebuilding identical DOM makes the town flicker.
let lastTownMarkup = null;
let lastChemPodMarkup = null;
let lastDirectoryMarkup = null;

function paintPresence(element,status){
  element.className=`member-presence ${status.state}`;
  element.textContent=status.label;
}
function refreshOnlineStatus(){
  document.body.classList.toggle('presence-connected',onlineRoster.ready);
  renderNeighborDirectory();
  if(selectedResident)paintPresence(document.querySelector('#residentPresence'),onlineRoster.status(selectedResident.slackId));
  document.querySelectorAll('.resident-pin[data-id]').forEach(pin=>{
    const person=residents.find(p=>p.id===Number(pin.dataset.id));
    const online=onlineRoster.status(person?.slackId).state==='online';
    pin.classList.toggle('member-online',online);
    if(person)pin.setAttribute('aria-label',`Open ${person.name}'s profile${online?', online now':''}`);
  });
  window.dispatchEvent(new Event('town-presence'));
}

function renderNeighborDirectory() {
  const query=document.querySelector('#neighborSearch').value.trim().toLocaleLowerCase();
  const onlineOnly=document.querySelector('#onlineNeighbors').checked;
  const matches=residents.filter(person=>(!onlineOnly||onlineRoster.status(person.slackId).state==='online')&&residentIsVisible(person)&&`${person.name} ${person.title||''}`.toLocaleLowerCase().includes(query))
    .sort((a,b)=>a.name.localeCompare(b.name));
  document.querySelector('#directoryCount').textContent=onlineRoster.ready?`${residents.filter(p=>onlineRoster.status(p.slackId).state==='online').length} online · ${matches.length}`:String(matches.length);
  const markup=matches.map(person=>`<button type="button" class="directory-person" data-resident="${person.id}" aria-label="View ${escapeHtml(person.name)}"><span class="directory-face"><span class="directory-initials" data-avatar="${escapeHtml(person.avatarUrl || '')}" aria-hidden="true">${escapeHtml(initialsFor(person.name))}</span><i class="presence-dot unknown" aria-hidden="true"></i></span><span class="directory-copy"><strong>${escapeHtml(person.name)}</strong><small class="directory-presence"></small></span><span class="directory-state ${escapeHtml(person.status)}" title="${person.status==='booked'?'Booked this week':person.status==='pending'?'Invitation pending':'Open to invitations'}"><span class="sr-only">${person.status==='booked'?'Booked':person.status==='pending'?'Pending':'Open'}</span></span></button>`).join('')||'<p class="directory-empty">No neighbors found.</p>';
  if(markup!==lastDirectoryMarkup){
    const directory=document.querySelector('#neighborDirectory');
    directory.innerHTML=markup;lastDirectoryMarkup=markup;
    directory.querySelectorAll('.directory-initials').forEach((avatar,index)=>setSlackAvatar(avatar,matches[index],true));
  }
  document.querySelectorAll('#neighborDirectory .directory-person').forEach((row,index)=>{
    const status=onlineRoster.status(matches[index].slackId);
    const label=row.querySelector('.directory-presence'),dot=row.querySelector('.presence-dot');
    if(label.textContent!==status.label)label.textContent=status.label;
    dot.className='presence-dot '+status.state;
    row.setAttribute('aria-label',`View ${matches[index].name}, ${status.label}`);
  });
}

function renderResidents() {
  renderNeighborDirectory();
  const residentsMarkup = residents.map(person => {
    const visible = (person.scene || "town") === "town" && residentIsVisible(person) && !remotePlayers.has(person.slackId);
    return `<button class="resident-pin ${onlineRoster.status(person.slackId).state==='online'?'member-online':''} ${person.status} ${person.activity || "path"} ${visible ? "" : "hidden"}" style="left:${person.x}%;top:${person.y}%;z-index:${Math.round(person.y * 10)}" data-id="${person.id}" aria-label="Open ${escapeHtml(person.name)}'s profile">
      ${personMarkup(person)}
    </button>`;
  }).join("");
  const playerClass = `player-pin ${currentUser?.status || "open"} `;
  const playerBody = playerMarkup();
  // Replacing the pins with identical markup restarts every idle animation and
  // reloads the layered sprite art, which reads as the town flickering on each
  // five second sync, so only touch the DOM when something actually changed.
  const signature = [residentsMarkup, playerClass, playerBody].join("\u0000");
  if (signature !== lastTownMarkup || !layer.querySelector("#townPlayerPin")) {
    lastTownMarkup = signature;
    layer.innerHTML = `${residentsMarkup}<div class="${playerClass}" id="townPlayerPin" style="left:${player.x}%;top:${player.y}%;z-index:${Math.round(player.y * 10)}">
    ${playerBody}
  </div>`;
    layer.querySelectorAll(".resident-pin").forEach(pin => pin.addEventListener("click", () => openResident(Number(pin.dataset.id))));
  }
  document.querySelector("#mapEmpty").hidden = layer.querySelectorAll(".resident-pin:not(.hidden)").length > 0;
  paintResidentCharacters(sceneLayer("residents") || layer);
  updatePlayerElement(false);
  renderLivePlayers(0);
}

function renderChemPod() {
  const roomLayer = document.querySelector("#chemPodResidentsLayer");
  const residentsMarkup = residents.filter(person => person.scene === "chemPod" && !remotePlayers.has(person.slackId)).map(person => `<button class="resident-pin ${onlineRoster.status(person.slackId).state==='online'?'member-online':''} ${person.status} ${person.activity || "path"}" style="left:${person.x}%;top:${person.y}%;z-index:${Math.round(person.y * 10)};--feet-depth:${Math.round(person.y * 10)}" data-id="${person.id}" aria-label="Open ${escapeHtml(person.name)}'s profile">
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
  paintResidentCharacters(sceneLayer("residents") || layer);
  updatePlayerElement(false);
  renderLivePlayers(0);
}

let factoryBakingReady=false;
const factoryBakingAtlas=new Image();
factoryBakingAtlas.onload=()=>{factoryBakingReady=true;if(currentScene==='donutFactory')renderFactory();};
function paintFactoryBaker(pin, person, position, moving=false) {
  const spot=currentScene==='donutFactory' && window.DonutFactory.stationFor(factoryPairs,person.slackId||person.id,factoryPage,position,moving);
  const baking=Boolean(spot && factoryBakingReady);
  const wasBaking=pin.classList.contains('factory-baking');
  pin.classList.toggle('factory-baking',baking);
  if(!baking){
    pin.style.setProperty('--feet-depth',String(Math.round(position.y*10)));
    if(wasBaking){const sprite=pin.querySelector('.personal-character');if(sprite){delete sprite.dataset.pose;const art=sprite.querySelector('.personal-art');art.style.removeProperty('top');art.style.removeProperty('bottom');}}
    return false;
  }
  let torso=pin.querySelector('.factory-baking-torso');
  if(!torso){torso=document.createElement('span');torso.className='factory-baking-torso';torso.setAttribute('aria-hidden','true');pin.append(torso);}
  torso.classList.toggle('icing',spot.side===1);
  const phase=characterPhase(person.slackId||person.id);
  torso.style.animationDelay=`-${phase.offset}ms`;
  torso.style.animationDuration=`${Math.round(1400*phase.tempo)}ms`;
  const depth=String(Math.round(spot.station.bottom*10)+1);
  pin.style.zIndex=depth;pin.style.setProperty('--feet-depth',depth);
  if(person.character){
    const sprite=pin.querySelector('.personal-character'),ch=person.character;
    paintPersonalCharacter(sprite,ch,'down',1);
    // Crop the existing neutral front frame at its reviewed collar and fit it
    // onto the shared workwear. No new face, saved appearance, or per-user atlas.
    const [x,y,w,h]=ch.frames[1],scale=32/(h*window.DonutFactory.headFraction(ch));
    const art=sprite.querySelector('.personal-art');
    art.style.width=`${w*scale}px`;art.style.height='32px';art.style.top='12px';art.style.bottom='auto';
    art.style.backgroundSize=`${ch.imageWidth*scale}px ${ch.imageHeight*scale}px`;
    art.style.backgroundPosition=`${-x*scale}px ${-y*scale}px`;
  }
  return true;
}

function renderFactory() {
  if(!factoryBakingAtlas.src)factoryBakingAtlas.src='/assets/factory-baking-v1.png';
  const roomLayer=document.querySelector('#factoryResidentsLayer');
  const foreground=document.querySelector('#factoryForeground');
  if(!foreground.children.length)foreground.innerHTML=window.DonutFactory.stations.map(s=>`<img class="factory-counter-front" src="assets/donut-factory-interior-v2.webp" alt="" style="z-index:${Math.round(s.bottom*10)};clip-path:polygon(${s.x-6.6}% ${s.top}%,${s.x+6.6}% ${s.top}%,${s.x+6.6}% ${s.bottom}%,${s.x-6.6}% ${s.bottom}%)">`).join('');
  const pairs=factoryPairs.filter(pair=>pair.page===factoryPage);
  const people=pairs.flatMap(pair=>pair.members).filter(person=>!person.isPlayer && !(remotePlayers.get(person.slackId)?.scene==='donutFactory' && remotePlayers.get(person.slackId)?.workshop===factoryPage));
  const markup=people.map(person=>`<button class="resident-pin booked ${onlineRoster.status(person.slackId).state==='online'?'member-online':''}" data-id="${person.id}" style="left:${person.x}%;top:${person.y}%;z-index:${Math.round(person.y*10)}" aria-label="Open ${escapeHtml(person.name)}'s profile">${personMarkup(person)}</button>`).join('')+
    pairs.map(pair=>`<div class="factory-pair-label" style="left:${pair.station.x}%;top:${pair.station.bottom-3.3}%">${pair.members.map(p=>escapeHtml(p.displayName||p.name)).join(' + ')}</div>`).join('')+
    `<div class="player-pin ${currentUser?.status||'open'}" id="factoryPlayerPin">${playerMarkup()}</div>`;
  if(markup!==lastFactoryMarkup){
    roomLayer.innerHTML=markup;lastFactoryMarkup=markup;
    roomLayer.querySelectorAll('[data-id]').forEach(pin=>pin.onclick=()=>openResident(Number(pin.dataset.id)));
  }
  const pages=Math.max(1,Math.ceil(factoryPairs.length/window.DonutFactory.stations.length));
  document.querySelector('#factoryCount').textContent=`${pairs.length} / ${window.DonutFactory.stations.length} pairs this week`;
  document.querySelector('#factoryChoice').value=String(factoryPage%2);
  const shifts=Math.max(1,Math.ceil((pages-factoryPage%2)/2));
  document.querySelector('#factoryWorkshop').textContent=`Shift ${Math.floor(factoryPage/2)+1} / ${shifts}`;
  document.querySelector('#factoryPrevious').disabled=factoryPage<2;
  document.querySelector('#factoryNext').disabled=factoryPage+2>=pages;
  document.querySelector('#factoryPaging').hidden=shifts===1;
  document.querySelector('#factoryEmpty').hidden=pairs.length>0;
  paintResidentCharacters(roomLayer);
  roomLayer.querySelectorAll('.resident-pin[data-id]').forEach(pin=>{const person=residents.find(p=>p.id===Number(pin.dataset.id));if(person)paintFactoryBaker(pin,person,person);});
  updatePlayerElement(false);renderLivePlayers(0);
}

function changeFactoryWorkshop(delta) {
  factoryPage=Math.max(0,Math.min(Math.max(1,Math.ceil(factoryPairs.length/window.DonutFactory.stations.length)-1),factoryPage+delta));
  Object.assign(player,{x:50,y:88});clickPath=[];pressedKeys.clear();playerAction=null;
  const own=factoryPairs.find(p=>p.page===factoryPage&&p.members.some(m=>m.isPlayer));
  if(own){Object.assign(player,own.members[0].isPlayer?own.station.left:own.station.right);playerDirection='down';}
  renderFactory();publishPresence(true,false);
}

let shopRoom = null;
function renderShopRoom() {
  const layer = document.querySelector("#shopResidentsLayer");
  if (!layer) return;
  if (!layer.querySelector("#shopPlayerPin")) {
    layer.innerHTML = `<div class="player-pin ${currentUser?.status || "open"}" id="shopPlayerPin" style="left:${player.x}%;top:${player.y}%;z-index:${Math.round(player.y * 10)}">
      ${playerMarkup()}
    </div>`;
  }
  if (!shopRoom) {
    shopRoom = import("./shop-room.mjs")
      .then(module => module.mountShopRoom(document.querySelector("#shopView"), {
        onOwnedChange: owned => { ownedShopItems = owned; },
        onPetChange: setEquippedPet
      }))
      .catch(() => {
        document.querySelector('#shopView [data-shop="status"]').textContent = "Shop unavailable. Step outside and back in.";
        shopRoom = null;
        return null;
      });
  }
  updatePlayerElement(false);
  renderLivePlayers(0);
}

function renderCurrentScene() {
  if (currentScene === "chemPod") renderChemPod();
  else if (currentScene === "donutShop") renderShopRoom();
  else if (currentScene === "donutFactory") renderFactory();
  else renderResidents();
  refreshOnlineStatus();
}

function liveLayerFor(name) {
  return sceneLayer("players", name);
}

function removeRemotePlayer(userId) {
  remotePlayers.delete(userId);
  remotePlayerElements.get(userId)?.remove();
  remotePlayerElements.delete(userId);
}

function clearRemotePlayers() {
  onlineRoster.reset();
  refreshOnlineStatus();
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
  if (state.inHome || (state.scene === 'town' && (state.themeId || 'classic') !== activeThemeId)) {
    const wasRendered=remotePlayers.has(state.userId);
    removeRemotePlayer(state.userId);
    if(wasRendered&&refreshResidents)renderCurrentScene();
    return;
  }
  const x = Number(state.x);
  const y = Number(state.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const previous = remotePlayers.get(state.userId);
  remotePlayers.set(state.userId, {
    userId: state.userId,
    scene: state.scene,
    workshop: state.workshop || 0,
    x: previous?.scene===state.scene && previous.workshop===(state.workshop||0) ? previous.x : x,
    y: previous?.scene===state.scene && previous.workshop===(state.workshop||0) ? previous.y : y,
    targetX: x,
    targetY: y,
    direction: ["up", "down", "left", "right"].includes(state.direction) ? state.direction : "down",
    moving: state.moving === true,
    action: typeof state.action === "string" && state.action ? state.action : null,
    pet: typeof state.pet === "string" && state.pet ? state.pet : null
  });
  if (refreshResidents && (!previous || previous.scene!==state.scene || previous.workshop!==(state.workshop||0))) renderCurrentScene();
}

function renderLivePlayers(deltaSeconds) {
  const expectedIds = new Set();
  for (const remote of remotePlayers.values()) {
    const person = residents.find(resident => resident.slackId === remote.userId);
    if (!person || remote.scene !== currentScene || (currentScene==='donutFactory' && remote.workshop!==factoryPage) || (currentScene==='town' && !residentIsVisible(person))) continue;
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
    if (paintFactoryBaker(pin,person,remote,remote.moving)) {
      pin.setAttribute("aria-label", `Open ${person.name}'s profile, baking donuts`);
      continue;
    }
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
  const signature = `${Boolean(window.townHouseOpen)}|${currentScene}|${factoryPage}|${playerDirection}|${moving}|${playerAction || ""}|${equippedPet || ""}`;
  const stateChanged = signature !== lastPresenceSignature;
  if (!force && !stateChanged && (!moving || now - lastPresenceSentAt < 125)) return;
  realtimeSocket.send(JSON.stringify({
    type: "state",
    inHome: Boolean(window.townHouseOpen),
    themeId: activeThemeId,
    scene: currentScene,
    workshop: currentScene==='donutFactory'?factoryPage:0,
    x: player.x,
    y: player.y,
    direction: playerDirection,
    moving,
    action: moving ? null : playerAction,
    pet: equippedPet
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
    if(realtimeSocket!==socket)return;
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
    if (message.type === 'invitations-changed') { void syncInvitationStates(); void refreshWallet(); return; }
    if (message.type === 'town-theme') { themeController?.check(); return; }
    if(onlineRoster.receive(message))refreshOnlineStatus();
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
  const previousOwn=factoryPairs.find(p=>p.members.some(m=>m.isPlayer));
  const previousSpot=previousOwn && (previousOwn.members[0].isPlayer?previousOwn.station.left:previousOwn.station.right);
  const atOwnStation=previousSpot && currentScene==='donutFactory' && factoryPage===previousOwn.page && Math.hypot(player.x-previousSpot.x,player.y-previousSpot.y)<.5;
  residents.forEach(person => {
    person.x = person.baseX;
    person.y = person.baseY;
    person.activity = person.baseActivity;
    person.scene = person.homeScene || "town";
    person.pairFacing = null;
  });

  factoryPairs = window.DonutFactory.pairsFor([...residents, ...(currentUser ? [{...currentUser,isPlayer:true}] : [])]);
  const lastPage=Math.max(1,Math.ceil(factoryPairs.length/window.DonutFactory.stations.length)-1);
  if(factoryPage>lastPage)factoryPage=Math.max(factoryPage%2,lastPage-(lastPage%2!==factoryPage%2?1:0));
  for (const pair of factoryPairs) pair.members.forEach((person,index)=>{
    const spot=index===0?pair.station.left:pair.station.right;
    if(person.isPlayer){
      const stationChanged=atOwnStation && (previousOwn.page!==pair.page || previousSpot.x!==spot.x || previousSpot.y!==spot.y);
      if(currentPairId!==pair.pairId || stationChanged){
        scenePlayerPositions.donutFactory={...spot};
        if(currentScene==='donutFactory'){factoryPage=pair.page;Object.assign(player,spot);clickPath=[];}
      }
    } else Object.assign(person,{...spot,scene:'donutFactory',factoryPage:pair.page,activity:'donut-station',pairFacing:'down'});
  });
  document.querySelector('#neighborSummary').textContent=`${residents.length+(currentUser?1:0)} Slack members · ${factoryPairs.length} matched pairs · ${residents.filter(p=>p.scene==='chemPod').length} in Chem Pod`;
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

// Collision and its rectangular fallback come from the same room geometry.
function isChemPodWalkable(x, y) {
  if (window.ChemPodCollision?.ready) return window.ChemPodCollision.isWalkable(x, y);
  const geometry = window.CHEMPOD_WALK_MASK?.geometry;
  if (!geometry) return false;
  const contains = rect => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  return geometry.floor.some(contains) && !geometry.blocked.some(contains);
}

// The shop floor: inside the four walls, and not through the counter.
const SHOP_COUNTER = { left: 38, right: 62, top: 48, bottom: 64 };
function isShopWalkable(x, y) {
  const bounds = SCENES.donutShop.bounds;
  const inside = x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
  const counter = x >= SHOP_COUNTER.left && x <= SHOP_COUNTER.right && y >= SHOP_COUNTER.top && y <= SHOP_COUNTER.bottom;
  const frontWall = y > 77 && (x < 40 || x > 60);
  return inside && !counter && !frontWall;
}

function isWalkable(x, y) {
  if (currentScene === "chemPod") return isChemPodWalkable(x, y);
  if (currentScene === "donutFactory") return window.FactoryCollision.isWalkable(x,y);
  if (currentScene === "donutShop") return isShopWalkable(x, y);
  return isTownWalkable(x, y);
}

function activeSceneBounds() {
  return scene().bounds;
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
  const {viewportWidth,viewportHeight,worldWidth,worldHeight}=townCameraMetrics;
  const fit=Math.min(viewportWidth/worldWidth,viewportHeight/worldHeight);
  const gutter=Math.max(0,(viewportWidth-worldWidth*fit)/2);
  const stage=document.querySelector('#townView');
  stage.style.setProperty('--overview-gutter',`${gutter}px`);
  const sideControls=cameraMode==='overview'&&gutter>=280&&viewportHeight>=600;
  stage.classList.toggle('overview-side-controls',sideControls);
  townCameraMetrics.labelToolbarBottom=sideControls ? 0 : Math.max(stage.querySelector('.camera-controls').getBoundingClientRect().bottom,stage.querySelector('.week-card').getBoundingClientRect().bottom)-viewport.getBoundingClientRect().top;
  document.querySelector('#townPlaces').open=sideControls;
  document.querySelector('#neighborListToggle').setAttribute('aria-expanded',String(sideControls||stage.classList.contains('directory-open')));
  document.documentElement.style.setProperty('--town-rail-width',`${gutter}px`);
  updateTownSidebar();
}

function updateTownCamera(deltaSeconds = 0, immediate = false) {
  if (currentScene !== "town") return;
  if (!townCameraMetrics) refreshTownCameraMetrics();
  const { viewportWidth, viewportHeight, worldWidth, worldHeight } = townCameraMetrics;
  const coverScale = Math.max(viewportWidth / worldWidth, viewportHeight / worldHeight);
  const targetScale = cameraMode === "overview" ? Math.max(.001,Math.min(viewportWidth/worldWidth,viewportHeight/worldHeight)) : Math.max(1,coverScale);
  const centerX = cameraMode === "overview" ? worldWidth/2 : worldWidth * player.x / 100;
  const centerY = cameraMode === "overview" ? worldHeight/2 : worldHeight * player.y / 100;
  const targetX = cameraMode === "overview" ? (viewportWidth-worldWidth*targetScale)/2 : clampCameraOffset(viewportWidth / 2 - centerX * targetScale, viewportWidth, worldWidth * targetScale);
  const targetY = cameraMode === "overview" ? (viewportHeight-worldHeight*targetScale)/2 : clampCameraOffset(viewportHeight / 2 - centerY * targetScale, viewportHeight, worldHeight * targetScale);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const blend = immediate || reducedMotion || !townCamera.ready ? 1 : 1 - Math.exp(-8 * deltaSeconds);
  townCamera.x += (targetX - townCamera.x) * blend;
  townCamera.y += (targetY - townCamera.y) * blend;
  townCamera.scale += (targetScale - townCamera.scale) * blend;
  // Overview always contains the whole map; Follow me retains close character framing.
  if(cameraMode === "overview")townCamera.scale=targetScale;
  else townCamera.scale=Math.max(townCamera.scale,coverScale);
  townCamera.x = cameraMode === "overview" ? targetX : clampCameraOffset(townCamera.x, viewportWidth, worldWidth * townCamera.scale);
  townCamera.y = cameraMode === "overview" ? targetY : clampCameraOffset(townCamera.y, viewportHeight, worldHeight * townCamera.scale);
  townCamera.ready = true;
  document.querySelector("#mapWorld").style.setProperty("--map-label-scale",1/townCamera.scale);
  document.querySelector("#mapWorld").style.setProperty("--map-label-top",`${Math.max(42,cameraMode==="overview"?townCameraMetrics.labelToolbarBottom-townCamera.y+42:42)/townCamera.scale}px`);
  document.querySelector("#mapWorld").style.transform = `translate3d(${townCamera.x}px, ${townCamera.y}px, 0) scale(${townCamera.scale})`;
}

function setCameraMode(nextMode) {
  if (!['overview', 'follow'].includes(nextMode)) return;
  document.querySelector("#townView").classList.remove("directory-open");
  cameraMode = nextMode;
  townCameraMetrics = null;
  document.querySelector("#mapWrap").dataset.cameraMode = cameraMode;
  document.querySelector("#townMovementHelp").textContent = cameraMode === "overview"
    ? "Whole town · Click to walk · Space to switch view"
    : "Click a path or use WASD · Space to switch view";
  document.querySelectorAll("button.camera-toggle[data-camera-mode]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.cameraMode === cameraMode));
  });
}

// A seat with somebody already on it is taken, so look for another one.
function actionSpotOccupants() {
  const occupants = [];
  for (const remote of remotePlayers.values()) {
    if (remote.scene === currentScene && (currentScene!=='donutFactory'||remote.workshop===factoryPage)) occupants.push({ x: remote.x, y: remote.y, action: remote.action });
  }
  for (const person of residents) {
    if ((person.scene || "town") === currentScene && (currentScene!=='donutFactory'||person.factoryPage===factoryPage) && !remotePlayers.has(person.slackId)) {
      occupants.push({ x: person.x, y: person.y, action: person.activity || null });
    }
  }
  return occupants;
}

// Every scene the town can be in, and what each one is made of. A new room is
// a row here plus its markup, not a ternary in a dozen places.
const SCENES = {
  town: {
    title: "Town",
    view: "#townView",
    residents: "#residentsLayer",
    players: "#townLivePlayersLayer",
    pets: "#townPetsLayer",
    pin: "#townPlayerPin",
    facing: "down",
    bounds: { minX: 5, maxX: 95, minY: 5, maxY: 94 },
    collision: () => window.TownCollision
  },
  chemPod: {
    title: "Chem Pod",
    view: "#chemPodView",
    residents: "#chemPodResidentsLayer",
    players: "#chemPodLivePlayersLayer",
    pets: "#chemPodPetsLayer",
    pin: "#chemPodPlayerPin",
    facing: "up",
    bounds: { minX: 8, maxX: 92, minY: 30, maxY: 92 },
    collision: () => window.ChemPodCollision
  },
  donutFactory: {
    title:'Donut Factory',view:'#factoryView',residents:'#factoryResidentsLayer',
    players:'#factoryLivePlayersLayer',pets:'#factoryPetsLayer',pin:'#factoryPlayerPin',
    facing:'up',bounds:{minX:11.5,maxX:89,minY:30,maxY:91},collision:()=>window.FactoryCollision
  },
  donutShop: {
    title: "Donut Shop",
    view: "#shopView",
    residents: "#shopResidentsLayer",
    players: "#shopLivePlayersLayer",
    pets: "#shopPetsLayer",
    pin: "#shopPlayerPin",
    facing: "up",
    bounds: { minX: 10, maxX: 90, minY: 42, maxY: 88 },
    collision: () => null
  }
};

function scene(name = currentScene) {
  return SCENES[name] || SCENES.town;
}

function sceneLayer(part, name = currentScene) {
  return document.querySelector(scene(name)[part]);
}

function sceneCollision() {
  return scene().collision();
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
  const pin = sceneLayer("pin");
  if (!pin) return;
  pin.style.left = `${player.x}%`;
  pin.style.top = `${player.y}%`;
  pin.style.zIndex = String(Math.round(player.y * 10));
  pin.classList.toggle("walking", isMoving);
  const sprite = pin.querySelector(".player-character");
  if (currentUser && paintFactoryBaker(pin,currentUser,player,isMoving)) return;
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
  if(currentScene==='donutFactory'){
    const own=factoryPairs.find(p=>p.members.some(m=>m.isPlayer));
    factoryPage=requestedFactory ?? own?.page ?? 0;
    requestedFactory=null;
    scenePlayerPositions.donutFactory={x:50,y:88};
    if(own && own.page===factoryPage){factoryPage=own.page;scenePlayerPositions.donutFactory={...(own.members[0].isPlayer?own.station.left:own.station.right)};}
  }
  Object.assign(player, scenePlayerPositions[currentScene]);
  playerDirection = scene().facing;
  if(currentScene==='donutFactory'){const own=factoryPairs.find(p=>p.page===factoryPage&&p.members.some(m=>m.isPlayer));if(own)playerDirection='down';}
  playerFrame = 1;
  playerAction = null;
  clickPath = [];
  for (const [name, definition] of Object.entries(SCENES)) {
    const view = document.querySelector(definition.view);
    if (view) view.hidden = name !== currentScene;
  }
  document.querySelector("#sceneTitle").textContent = scene().title;
  updateTownSidebar();
  if (currentScene !== "town") {
    renderCurrentScene();
    if (currentScene === "donutShop") shopRoom?.then(room => room?.load());
  }
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
    try {
      pressedKeys.clear();
      setScene(nextScene);
      showToast(nextScene === "town" ? "Back in Donut Town." : `Welcome to ${scene().title}.`);
    } finally {
      window.setTimeout(() => {
        sceneCurtain.classList.remove("active");
        sceneTransitioning = false;
      }, reducedMotion ? 0 : 120);
    }
  }, reducedMotion ? 0 : 130);
}

function gameLoop(timestamp) {
  const deltaSeconds = Math.max(0, Math.min((timestamp - lastGameTime) / 1000, 0.05));
  lastGameTime = timestamp;
  if (window.townSettingsOpen || window.townHouseOpen) {
    pressedKeys.clear(); clickPath = []; publishPresence(false, false);
    window.requestAnimationFrame(gameLoop); return;
  }
  if (currentScene === "donutShop") {
    publishPresence(false, false);
    window.requestAnimationFrame(gameLoop);
    return;
  }
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
    if (chosenPose) {
      chosenPose = null;
      try { window.localStorage?.removeItem("donut-town:pose"); } catch {}
      renderPosePicker();
    }
    playerAction = null;
    window.TownZones?.reset();
  } else if (!clickPath.length && chosenPose && currentUser?.character?.actions?.[chosenPose]) {
    // A pose the member picked themselves is held wherever they stand.
    playerAction = chosenPose;
    playerDirection = currentUser.character.actions[chosenPose].facing || playerDirection;
  } else if (!clickPath.length && window.TownZones?.ready) {
    // Standing still somewhere tagged settles you into what that place is for:
    // a free bench, the lawn, a bridge railing, the cafe tables, a garden bed.
    const settled = window.TownZones.settle(player, currentScene, timestamp, currentUser?.character?.actions, actionSpotOccupants());
    if (settled?.walkTo) clickPath = findWalkPath(player, settled.walkTo);
    else if (settled) {
      playerAction = settled.action;
      playerDirection = settled.facing;
    } else {
      playerAction = null;
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

  if (isMoving) rememberPosition();
  updatePlayerElement(isMoving);
  // Only worth a frame of work when somebody's pose actually moves.
  if (residentPosesAnimate) paintResidentCharacters(sceneLayer("residents") || layer);
  updateTownCamera(deltaSeconds);
  updatePetFollowers(deltaSeconds, isMoving);
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
  paintPresence(document.querySelector("#residentPresence"),onlineRoster.status(selectedResident.slackId));

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
  const homeLink=document.querySelector('#visitNeighborHome');
  homeLink.href='?home='+encodeURIComponent(selectedResident.characterKey||'');
  homeLink.hidden=!selectedResident.characterKey;
  document.querySelector('#messageNeighbor').disabled=!selectedResident.characterKey;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  // ponytail: the existing neighbor drawer replaces the existing own profile.
  document.querySelector("#profileDrawer").hidden=true;
  drawerScrim.hidden = document.body.classList.contains("town-sidebar-layout") || document.querySelector("#townView").classList.contains("directory-open");
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
// Keep the lab's deliberate station positions; additional occupants
// share the same reachable floor using the existing population allocator.
// After the anchors are settled, put the member back where they left off.
restorePosition();

residents.forEach((person, index) => Object.assign(person, populationSlot(residentSlots, index)));

async function syncSlackResidents(response) {
  try {
    response ||= await fetch("/api/slack/members", { headers: { accept: "application/json" }, signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error("Slack sync unavailable");
    const data = await response.json();
    if (!Array.isArray(data.members)) throw new Error("Invalid member response");
    document.querySelector("#loadingMessage").textContent = "Preparing resident characters…";
    await Promise.all(data.members.map(async member => { member.character = await loadCharacterArt(member.character); }));
    const summary = document.querySelector("#neighborSummary");
    incomingInvitations = Array.isArray(data.incomingInvitations) ? data.incomingInvitations : [];
    invitationNotices = Array.isArray(data.invitationNotices) ? data.invitationNotices : [];
    outgoingInvitations = Array.isArray(data.outgoingInvitations) ? data.outgoingInvitations : [];
    currentUser = data.members.find(member => member.isCurrentUser) || null;
    const neighbors = data.members
      .filter(member => !member.isCurrentUser)
      .sort((left, right) => stableMemberScore(left) - stableMemberScore(right) || left.id.localeCompare(right.id));
    renderCurrentProfile();
    const chemPodIds = assignedChemPodIds(neighbors);
    const townSlots=assignTownActivities?.(neighbors.filter(m=>!chemPodIds.has(m.id)),activeTownZones,residentSlots,window.TownCollision);
    let townIndex = 0;
    let chemPodIndex = 0;
    residents = neighbors.map((member, index) => {
      const homeScene = chemPodIds.has(member.id) ? "chemPod" : "town";
      const slot = homeScene === "chemPod"
        ? populationSlot(chemPodResidentSlots, chemPodIndex++)
        : (townIndex++,townSlots?.get(member.id)||populationSlot(residentSlots,townIndex-1));
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
    renderCurrentScene();
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
    if (changed) { renderResidents(); renderCurrentScene(); }
  } catch { /* Keep last confirmed outfit until the next sync. */ }
  finally { outfitSyncRunning = false; }
}

async function syncInvitationStates() {
  if (document.hidden || !residents.length) return;
  try {
    const response = await fetch("/api/slack/invitation-states", { headers: { accept: "application/json" } });
    if (!response.ok) return;
    const { states, incomingInvitations: incoming, invitationNotices: notices, outgoingInvitations: nextOutgoingInvitations } = await response.json();
    incomingInvitations = Array.isArray(incoming) ? incoming : [];
    invitationNotices = Array.isArray(notices) ? notices : [];
    outgoingInvitations = Array.isArray(nextOutgoingInvitations) ? nextOutgoingInvitations : [];
    residents.forEach(person => Object.assign(person, states[person.slackId] || { status: "open", partnerId: null, pairId: null }));
    if(currentUser && currentUser.pairId!==states[currentUser.id]?.pairId)void refreshWallet();
    if (currentUser) Object.assign(currentUser, states[currentUser.id] || { status: "open", partnerId: null, pairId: null });
    applyPairPreview();
    layoutBookedPairs();
    updateAvailabilityControl();
    renderResidents();
    renderCurrentScene();
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
  renderPosePicker();
  document.querySelector("#profileName").textContent = name;
  const ownFacts = [
    ["Role", currentUser?.title],
    ...slackFacts(currentUser)
  ].filter(([, value]) => value);
  document.querySelector("#currentProfileFacts").innerHTML = factsMarkup(ownFacts, "Add a title, status, or pronouns in Slack to see more here.");
  const donutCount = currentUser?.wallet?.balance;
  document.querySelector("#myDonutCount").textContent = Number.isInteger(donutCount) ? donutCount : "-";
  document.querySelector("#myDonutNote").textContent = Number.isInteger(donutCount)
    ? "Your Town balance · +5 when an invitation is accepted."
    : "Loading your Town balance…";
  updateTownSidebar();
}

let wardrobeMount = null;
let profileChatsMount = null;
let sidebarPanelsLoaded = false;
function updateTownSidebar() {
  const profile=document.querySelector('#profileDrawer');
  const docked=Boolean(currentUser && currentScene==='town' && !window.townHouseOpen && document.querySelector('#townView').classList.contains('overview-side-controls'));
  if(profile.classList.contains('docked')===docked)return;
  profile.classList.toggle('docked',docked);
  document.body.classList.toggle('town-sidebar-layout',docked);
  // Reuse the same profile node and state; a docked profile never blocks walking.
  profile.classList.remove('open');
  profile.setAttribute('aria-hidden',String(!docked));
  document.querySelector('#profileScrim').hidden=true;
  document.querySelector('#profileButton').setAttribute('aria-expanded',String(docked));
  if(docked && !sidebarPanelsLoaded){sidebarPanelsLoaded=true;loadProfilePanels();}
  if(!docked)document.querySelector('#profileWardrobe').dispatchEvent(new Event('wardrobe-close'));
}
function openProfile() {
  closeDrawer();
  const profileDrawer = document.querySelector('#profileDrawer');
  const docked=profileDrawer.classList.contains('docked');
  profileDrawer.classList.toggle('open',!docked);
  profileDrawer.setAttribute('aria-hidden','false');
  document.querySelector('#profileScrim').hidden=docked;
  document.querySelector('#profileButton').setAttribute('aria-expanded','true');
  if(docked)profileDrawer.scrollTo({top:0});
  loadProfilePanels();
}
let walletLoading=false;
function paintWallet(wallet){if(!currentUser)return;currentUser.wallet=wallet;document.querySelector('#myDonutCount').textContent=wallet.balance;document.querySelector('#myDonutNote').textContent='Your Town balance · +5 per accepted pair.';}
async function refreshWallet(){
  if(walletLoading||!currentUser)return;walletLoading=true;
  try{const response=await fetch('/api/shop',{signal:AbortSignal.timeout(15000)});if(response.ok)paintWallet((await response.json()).wallet);}
  catch{}finally{walletLoading=false;}
}
window.addEventListener('town-wallet',e=>{if(e.detail)paintWallet(e.detail);else void refreshWallet();});
function loadProfilePanels() {
  void refreshWallet();
  const profileDrawer = document.querySelector('#profileDrawer');
  if (!profileChatsMount) profileChatsMount = import("./profile-chats.mjs").then(module => module.mountProfileChats(document.querySelector("#profileChats"))).catch(() => {
    profileChatsMount = null;
    document.querySelector('[data-chats="status"]').textContent = "Chat history unavailable. Reopen to retry.";
  });
  profileChatsMount?.then(panel => panel?.load());
  const wardrobe = document.querySelector("#profileWardrobe");
  if (new URLSearchParams(location.search).get("accessories") === "1" && !headwearPrototypeLoad && currentUser?.character?.url === "/assets/residents/r-7f3a2c/walk-v1.png") {
    headwearPrototypeLoad = import("./prototypes/headwear.mjs").then(module => module.attachTownPrototype(profileDrawer, currentUser.character)).then(prototype => { headwearPrototype = prototype; }).catch(() => { headwearPrototypeLoad = null; });
  }
  if (!wardrobe.hidden && !wardrobeMount) {
    wardrobeMount = import("./profile-wardrobe.mjs").then(module => module.mountWardrobe(wardrobe, { manifestUrl: wardrobeManifestUrl(currentUser.character), initialOutfit: currentUser?.character?.outfit, onSaved: async character => {
      const loaded = await loadCharacterArt(character);
      if (!loaded) throw new Error("Character image unavailable");
      wardrobeRevision++;
      currentUser.character = loaded;
      renderResidents();
      renderCurrentScene();
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
  const docked=profileDrawer.classList.contains("docked");
  profileDrawer.setAttribute("aria-hidden", String(!docked));
  document.querySelector("#profileScrim").hidden = true;
  document.querySelector("#profileButton").setAttribute("aria-expanded", String(docked));
}

function closeDrawer() {
  document.querySelector("#profileDrawer").hidden=false;
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  drawerScrim.hidden = true;
}

function renderInvitationDock() {
  const incomingList=document.querySelector('#incomingInviteList');
  const incomingMarkup=incomingInvitations.map(i=>{const p=residents.find(r=>r.slackId===i.inviterId);return `<li><strong>${escapeHtml(p?.name||'Neighbor')}</strong><small>Invited you to a Donut Chat · +5 donuts each</small><div><button data-answer="accepted" data-invitation="${escapeHtml(i.id)}" ${respondingInvitation?'disabled':''}>Accept</button><button data-answer="declined" data-invitation="${escapeHtml(i.id)}" ${respondingInvitation?'disabled':''}>Decline</button></div></li>`;}).join('');
  if(incomingMarkupCache!==incomingMarkup){incomingList.innerHTML=incomingMarkup;incomingMarkupCache=incomingMarkup;}
  document.querySelector('#dockHandle>span').textContent=incomingInvitations.length?`${incomingInvitations.length} incoming invite${incomingInvitations.length===1?'':'s'}`:'My invitations';
  const noticeMarkup = invitationNotices.map(notice =>
    `<li class="invitation-notice">${escapeHtml(notice.message)}</li>`
  ).join('');
  if (invitationNoticeMarkupCache !== noticeMarkup) {
    document.querySelector('#invitationNoticeList').innerHTML = noticeMarkup;
    invitationNoticeMarkupCache = noticeMarkup;
  }
  renderPairBoard();
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

function movePlayerFromMapClick(event) {
  if (event.target.closest("button")) return;
  event.currentTarget.focus({preventScroll:true});
  const bounds = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * 100;
  const y = ((event.clientY - bounds.top) / bounds.height) * 100;
  const destination = nearestWalkable(x, y);
  clickPath = findWalkPath(player, destination);
}

document.querySelector("#mapWorld").addEventListener("click", movePlayerFromMapClick);
document.querySelector("#chemPodWorld").addEventListener("click", movePlayerFromMapClick);
document.querySelector("#factoryWorld").addEventListener("click", movePlayerFromMapClick);
// The donut in the middle of the plaza is the shop's front door.
let ownedShopItems = [];
document.querySelector("#shopEntrance").addEventListener("click", event => {
  event.stopPropagation();
  transitionToScene("donutShop");
});
document.querySelector("#leaveShop").addEventListener("click", () => transitionToScene("town"));
document.querySelector('.brand').addEventListener('click', async event => {
  event.preventDefault();closeDrawer();closeProfile();
  if(window.townHouseOpen){await closeHouse(true);return;}
  transitionToScene('town');
});

let petsModule = null;
function setEquippedPet(petId) {
  equippedPet = petId || null;
  publishPresence(true, false);
}

let petsApi = null;
let petsRetryAt = 0;
function updatePetFollowers(deltaSeconds, ownerMoving) {
  if (!petsApi) {
    if (petsModule || Date.now()<petsRetryAt || (!equippedPet && !remotePlayerHasPet())) return;
    petsModule = import("./pets.mjs").then(async module => { await module.loadPetSprites(); petsApi = module; }).catch(() => {petsModule=null;petsRetryAt=Date.now()+10000;});
    return;
  }
  const owners = [];
  if (equippedPet) owners.push({ id: "you", x: player.x, y: player.y, scene: currentScene, pet: equippedPet, moving: ownerMoving });
  for (const remote of remotePlayers.values()) {
    if (remote.pet && remote.scene === currentScene && (currentScene!=='donutFactory'||remote.workshop===factoryPage)) owners.push({ id: remote.userId, x: remote.x, y: remote.y, scene: remote.scene, pet: remote.pet, moving: remote.moving });
  }
  petsApi.updatePets(owners, {
    deltaSeconds,
    layerFor: name => sceneLayer("pets", name),
    geometryFor: name => {
      const collision=scene(name).collision(),world=sceneLayer('pets',name)?.parentElement;
      return {key:name==='town'?activeThemeId:name==='donutFactory'?`factory:${factoryPage}`:name,width:world?.offsetWidth,height:world?.offsetHeight,
        figureScale:name==='donutFactory'?(world?.offsetWidth||2100)/2100:name==='chemPod'?(world?.offsetWidth||1750)/1750:1,
        lineIsClear:collision?.lineIsClear,findPath:collision?.findPath};
    },
    isWalkable: (x, y, name) => name === "donutFactory" ? window.FactoryCollision.isWalkable(x,y) : name === "chemPod" ? isChemPodWalkable(x,y) : name === "donutShop" ? isShopWalkable(x,y) : isTownWalkable(x,y)
  });
}

function remotePlayerHasPet() {
  for (const remote of remotePlayers.values()) if (remote.pet) return true;
  return false;
}

const POSE_LABELS = {
  sitChair: "Sit down",
  sitGrass: "Sit on the grass",
  read: "Read",
  coffee: "Coffee",
  garden: "Gardening",
  lookout: "Take in the view",
  experiment: "Experiment",
  dance: "Dance",
  fish: "Fish"
};

function renderPosePicker() {
  const section = document.querySelector("#profilePoses");
  const actions = currentUser?.character?.actions;
  const poses = actions ? Object.keys(actions).filter(pose => POSE_LABELS[pose]) : [];
  section.hidden = poses.length === 0;
  if (section.hidden) return;
  const options = section.querySelector('[data-poses="options"]');
  options.innerHTML = [["", "Let the place decide"], ...poses.map(pose => [pose, POSE_LABELS[pose]])]
    .map(([pose, label]) => `<button type="button" data-pose="${escapeHtml(pose)}" aria-pressed="${String((chosenPose || "") === pose)}">${escapeHtml(label)}</button>`)
    .join("");
  options.querySelectorAll("[data-pose]").forEach(button => {
    button.onclick = () => setChosenPose(button.dataset.pose || null);
  });
}

// A chosen pose is a display preference, so it lives in this browser.
function setChosenPose(pose) {
  chosenPose = pose;
  try {
    if (pose) window.localStorage?.setItem("donut-town:pose", pose);
    else window.localStorage?.removeItem("donut-town:pose");
  } catch {
    // A browser that refuses storage still holds the pose for this visit.
  }
  window.TownZones?.reset();
  renderPosePicker();
  publishPresence(true, false);
}

// A member's own room, entered from their profile.
let housePanel = null;
function openHouse(owner=null) {
  if(typeof owner!=="string")owner=null;
  closeDrawer();
  const view = document.querySelector("#houseView");
  view.hidden = false;
  window.townHouseOpen = true;
  document.querySelector('.app-shell').inert = true;
  const back = document.querySelector('#leaveHouse');
  back.textContent = `Back to ${currentScene === 'town' ? 'town' : scene().title}`;
  back.focus({preventScroll:true});
  updateTownSidebar();
  pressedKeys.clear(); clickPath = [];
  closeProfile();
  if (!housePanel) {
    housePanel = import("./house.mjs")
      .then(module => module.mountHouse(view, {
        onVisit: openHouse,
        onMove: () => { if (chosenPose) setChosenPose(null); },
        paintCharacter: (element, direction = "down", frame = 1) => {
          if (currentUser?.character) {
            if (!element.firstElementChild) element.innerHTML = personalCharacterMarkup(currentUser.character, "house-character");
            paintPersonalCharacter(element.firstElementChild, currentUser.character, direction, frame);
          } else {
            if (!element.firstElementChild) element.innerHTML = playerMarkup();
            const sprite = element.querySelector('.player-character');
            if (sprite) {
              sprite.style.setProperty('--frame-x', `${[0,50,100][frame]}%`);
              sprite.style.setProperty('--direction-y', `${{down:0,left:33.333,right:33.333,up:100}[direction]}%`);
              sprite.classList.toggle('facing-left', direction === 'left');
            }
          }
        }
      }))
      .catch(() => {
        view.querySelector('[data-house="status"]').textContent = "House unavailable. Close and try again.";
        housePanel = null;
        return null;
      });
  }
  housePanel?.then(panel => panel?.load(owner));
}
async function closeHouse(returnToTown = false) {
  const panel = await housePanel;
  if (panel && !(await panel.flush())) return false;
  document.querySelector("#houseView").hidden = true;
  window.townHouseOpen = false;
  document.querySelector('.app-shell').inert = false;
  updateTownSidebar();
  panel?.pause();
  void themeController?.check();
  if (returnToTown && currentScene !== "town") transitionToScene("town");
  return true;
}
document.querySelector("#houseShop").addEventListener("click", async () => {
  if (await closeHouse(false)) transitionToScene("donutShop");
});
document.querySelector("#openHouse").addEventListener("click", openHouse);
document.querySelector('#neighborListToggle').addEventListener('click',()=>{
  const stage=document.querySelector('#townView'),directory=document.querySelector('#townDirectory');
  const open=stage.classList.contains('overview-side-controls')||stage.classList.toggle('directory-open');
  document.querySelector('#neighborListToggle').setAttribute('aria-expanded',String(open));
  directory.style.setProperty('--directory-top',`${document.querySelector('#neighborListToggle').getBoundingClientRect().bottom+8}px`);
  if(open)document.querySelector('#neighborSearch').focus();
});
document.querySelector('#neighborSearch').addEventListener('input',renderNeighborDirectory);
document.querySelector('#onlineNeighbors').onchange=renderNeighborDirectory;
document.querySelector('#neighborSearch').addEventListener('focus',()=>{pressedKeys.clear();clickPath=[];});
document.querySelector('#neighborDirectory').addEventListener('click',event=>{const button=event.target.closest('[data-resident]');if(button)openResident(Number(button.dataset.resident));});
document.querySelector('#railHome').addEventListener('click',openHouse);
document.querySelector('#railShop').addEventListener('click',()=>{closeProfile();closeDrawer();transitionToScene('donutShop');});
document.querySelector('#railChem').addEventListener('click',()=>{closeProfile();closeDrawer();transitionToScene('chemPod');});
document.querySelector("#shopHome").addEventListener("click", openHouse);
document.querySelector("#leaveHouse").addEventListener("click", () => closeHouse());
document.querySelector("#chemPodEntrance").addEventListener("click", () => transitionToScene("chemPod"));
document.querySelector("#chemPodExit").addEventListener("click", () => transitionToScene("town"));
document.querySelector('#factoryEntrance').onclick=()=>{requestedFactory=0;transitionToScene('donutFactory');};
document.querySelector('#factoryTwoEntrance').onclick=()=>{requestedFactory=1;transitionToScene('donutFactory');};
document.querySelector('#factoryChoice').onchange=event=>changeFactoryWorkshop(Number(event.target.value)-factoryPage);
document.querySelector('#railFactory').onclick=()=>{closeProfile();closeDrawer();transitionToScene('donutFactory');};
document.querySelector('#leaveFactory').onclick=document.querySelector('#factoryExit').onclick=()=>transitionToScene('town');
document.querySelector('#factoryPrevious').onclick=()=>changeFactoryWorkshop(-2);
document.querySelector('#factoryNext').onclick=()=>changeFactoryWorkshop(2);
document.querySelector("#leaveChemPod").addEventListener("click", () => transitionToScene("town"));
document.querySelectorAll("button.camera-toggle[data-camera-mode]").forEach(button => button.addEventListener("click", () => setCameraMode(button.dataset.cameraMode)));

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
  if (window.townHouseOpen || window.townSettingsOpen || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
  if (event.code==='Space' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing && currentScene==='town' && !event.target.closest('button:not([data-camera-mode]),a,summary,[role="button"]')) {
    event.preventDefault();
    if(!event.repeat)setCameraMode(cameraMode==='overview'?'follow':'overview');
    return;
  }
  if (event.key === "Escape") {
    closeDrawer();
    closeProfile();
    document.querySelector("#townView").classList.remove("directory-open");
    document.querySelector("#neighborListToggle").setAttribute("aria-expanded",String(document.querySelector("#townView").classList.contains("overview-side-controls")));
    if (currentScene === "donutShop") transitionToScene("town");
  }
  if (currentScene === "donutShop" || drawer.classList.contains("open") || document.querySelector("#profileDrawer").classList.contains("open")) return;
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
    pressedKeys.add(key);
  }
});

document.addEventListener("keyup", event => pressedKeys.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => { pressedKeys.clear(); });
// One complete-room view; an 88px resident paints at about 9% of room height.
new ResizeObserver(([entry]) => {
  if (entry.contentRect.width > 0) entry.target.style.setProperty("--pod-figure", entry.contentRect.width / 1750);
}).observe(document.querySelector("#chemPodWorld"));
new ResizeObserver(([entry])=>{
  if(entry.contentRect.width>0)entry.target.style.setProperty('--pod-figure',entry.contentRect.width/1500);
}).observe(document.querySelector('#factoryWorld'));

window.addEventListener("resize", () => {
  townCameraMetrics = null;
  townCamera.ready = false;
  updateTownCamera(0, true);
});

function applyTownTheme(theme) {
  activeThemeId = theme.id;
  activeTownZones=theme.zones;
  window.TownCollision = window.createTownCollision(theme.walkMask);
  window.TownZones.setTown(theme.zones);
  SCENES.town.bounds = theme.bounds;
  const world = document.querySelector('#mapWorld');
  world.style.width = `${theme.worldWidth}px`;
  world.style.aspectRatio = `${theme.imageSize.width} / ${theme.imageSize.height}`;
  world.dataset.theme = theme.id;
  const art = world.querySelector('.town-map');
  art.src = theme.image; art.alt = `${theme.name} pixel-art Donut Town`;
  for (const [id,selector] of [['chemPod','#chemPodEntrance'],['donutShop','#shopEntrance'],['donutFactory','#factoryEntrance'],['donutFactoryTwo','#factoryTwoEntrance']]) {
    const entry=theme.entrances[id], button=document.querySelector(selector);
    const label=entry.label || entry;
    button.style.setProperty("--label-x",`${label.x}%`);button.style.setProperty("--label-y",`${label.y}%`);
  }
  Object.assign(player, theme.spawn);
  scenePlayerPositions.town = {...theme.spawn};
  snapTownAnchors();
  spreadResidentSlots(residentSlots, window.TownCollision, 160, 4.2);
  restorePosition();
  townCameraMetrics=null; townCamera.ready=false;
  if (new URLSearchParams(location.search).get('collision')==='1') {
    world.querySelectorAll('canvas').forEach(canvas=>canvas.remove());
    window.TownCollision.showOverlay('#mapWorld');
  }
}

async function startTown() {
  const loading = document.querySelector("#loadingScreen");
  const message = document.querySelector("#loadingMessage");
  const retry = document.querySelector("#retryTown");
  retry.hidden = true;
  message.textContent = "Loading Slack residents…";
  const slow = setTimeout(() => { message.textContent = "Still connecting. The server may be waking up…"; }, 6000);
  let ready = false;
  try {
    // Fetch members while the map loads; place them only after its mask is ready.
    const [response] = await Promise.all([
      fetch("/api/slack/members", { headers: { accept: "application/json" }, signal: AbortSignal.timeout(45000) }),
      (async () => {
        if(!assignTownActivities)({assignTownActivities}=await import('./town-activity-slots.mjs'));
        if (!themeController) {
          const {mountThemes} = await import('./town-themes/client.mjs');
          themeController = await mountThemes({apply: applyTownTheme});
        }
      })()
    ]);
    ready = await syncSlackResidents(response);
  } catch { /* Keep the loading curtain until map and members are both ready. */ }
  clearTimeout(slow);
  if (ready) {
      loading.classList.add("done");
    document.querySelector(".app-shell").inert = false;
    if (new URLSearchParams(location.search).get("profile") === "1") openProfile();
    const homeKey=new URLSearchParams(location.search).get('home');
    if(/^[a-f0-9]{64}$/.test(homeKey||''))openHouse(homeKey);
    syncInvitationStates();
    // Restore the equipped pet without requiring a visit to the shop.
    const previousPet=equippedPet;
    void fetch('/api/shop',{signal:AbortSignal.timeout(20000)}).then(async response=>{
      if(response.ok){const data=await response.json();if(equippedPet===previousPet)setEquippedPet(data.pet);paintWallet(data.wallet);}
    }).catch(()=>{});
  } else {
    message.textContent = "Could not load the town. Please try again.";
    retry.hidden = false;
  }
}
document.querySelector("#retryTown").addEventListener("click", startTown);

if (window.location.protocol === "file:") {
  residents = [];
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

// A directory entry, a guestbook visitor and a shared URL all open the same room.
document.querySelector('#visitNeighborHome').onclick=e=>{e.preventDefault();if(selectedResident?.characterKey)openHouse(selectedResident.characterKey);};
let messagesMount;
async function openMessages(peer=null){
  pressedKeys.clear();clickPath=[];
  try{messagesMount ||= import('./social-client.mjs').then(m=>m.mountMessages(document.querySelector('#messagesPanel'),{presenceFor:key=>{const person=residents.find(p=>p.characterKey===key);return onlineRoster.status(person?.slackId);}}));(await messagesMount).open(peer);}
  catch{messagesMount=null;showToast('Messages unavailable. Try again.');}
}
document.querySelector('#messageNeighbor').onclick=()=>openMessages(selectedResident?.characterKey);
document.querySelector('#openMessages').onclick=()=>openMessages();
document.querySelector('#incomingInviteList').onclick=async event=>{
  const button=event.target.closest('[data-answer]');if(!button||button.disabled||respondingInvitation)return;
  respondingInvitation=button.dataset.invitation;
  const id=button.dataset.invitation,status=button.dataset.answer;
  button.parentElement.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{
    const r=await fetch('/api/slack/invitations/respond',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,status}),signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw Error();
    showToast(status==='accepted'?'Paired! You each earned 5 donuts.':'Invitation declined.');
  }catch{showToast('Could not update this invitation. Refreshing…');}
  finally{respondingInvitation=null;incomingMarkupCache=null;await syncInvitationStates();renderInvitationDock();}
};
function renderPairBoard(){
  const pairs=window.DonutFactory.pairsFor([...residents,...(currentUser?[currentUser]:[])]);
  document.querySelector('#pairBoardCount').textContent=`${pairs.length} pair${pairs.length===1?'':'s'}`;
  const list=document.querySelector('#pairBoardList');
  const html=pairs.map(p=>`<li><button data-workshop="${p.page}"><strong>${p.members.map(m=>escapeHtml(m.name||m.displayName||'Neighbor')).join(' &amp; ')}</strong><small>Factory ${p.page%2+1}${p.page>=2?' · Shift '+(Math.floor(p.page/2)+1):''} <span aria-hidden="true">→</span></small></button></li>`).join('')||'<li class="social-empty">Your next conversation starts with an invitation.</li>';
  if(list.innerHTML!==html)list.innerHTML=html;
}
document.querySelector('#pairBoardList').onclick=e=>{const b=e.target.closest('[data-workshop]');if(b){closeProfile();closeDrawer();requestedFactory=Number(b.dataset.workshop);transitionToScene('donutFactory');document.querySelector('#pairBoard').open=false;}};
