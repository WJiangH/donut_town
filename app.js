let residents = [
  { id: 1, name: "Maya Chen", team: "Materials", status: "open", donuts: 12, topics: ["coffee", "new projects", "hiking"], group: "other", x: 27, y: 31, skin: "#d9a47f", hair: "#352a27", shirt: "#c15362", note: "You have not had a Donut chat yet." },
  { id: 2, name: "Luis Ortega", team: "Process", status: "open", donuts: 4, topics: ["music", "process tools", "food"], group: "other", x: 47, y: 22, skin: "#b97953", hair: "#252927", shirt: "#497f74", note: "New face from another team." },
  { id: 3, name: "Priya Nair", team: "Device", status: "booked", donuts: 9, topics: ["books", "mentoring", "travel"], group: "other", x: 63, y: 34, skin: "#9a5c3c", hair: "#242020", shirt: "#b56577", note: "Already booked for this week." },
  { id: 4, name: "Noah Williams", team: "Your group", status: "open", donuts: 2, topics: ["simulation", "running", "movies"], group: "same", x: 77, y: 62, skin: "#7d4c36", hair: "#171a18", shirt: "#5576a1", note: "You last matched 11 weeks ago." },
  { id: 5, name: "Emi Takahashi", team: "Integration", status: "open", donuts: 7, topics: ["design", "gardening", "new tools"], group: "other", x: 61, y: 59, skin: "#ecc3a0", hair: "#2a2528", shirt: "#9e6cad", note: "New face from another team." },
  { id: 6, name: "Omar Haddad", team: "Your group", status: "pending", donuts: 15, topics: ["AI", "soccer", "career paths"], group: "same", x: 36, y: 59, skin: "#bc805d", hair: "#29211f", shirt: "#d18d45", note: "Someone has already invited Omar this week." },
  { id: 7, name: "Sofia Rossi", team: "Reliability", status: "open", donuts: 1, topics: ["photography", "first projects", "baking"], group: "other", x: 23, y: 61, skin: "#e1ae88", hair: "#8a533a", shirt: "#467a57", note: "Sofia joined the channel recently." },
  { id: 8, name: "Jon Bell", team: "Your group", status: "open", donuts: 6, topics: ["hardware", "cycling", "team culture"], group: "same", x: 48, y: 73, skin: "#d4a27f", hair: "#d6c0a5", shirt: "#735b91", note: "You last matched 20 weeks ago." },
  { id: 9, name: "Amina Yusuf", team: "Packaging", status: "open", donuts: 10, topics: ["community", "science", "local food"], group: "other", x: 67, y: 59, skin: "#70462f", hair: "#292021", shirt: "#bc5d49", note: "New face from another team." },
  { id: 10, name: "Evan Brooks", team: "Analytics", status: "booked", donuts: 3, topics: ["data", "baseball", "podcasts"], group: "other", x: 50, y: 13, skin: "#e2b08d", hair: "#704f35", shirt: "#4b7888", note: "Already booked for this week." }
];
const residentSlots = [
  { x: 48, y: 25, activity: "path" },
  { x: 39, y: 38, activity: "bench" },
  { x: 59, y: 38, activity: "bench" },
  { x: 29, y: 47, activity: "path" },
  { x: 71, y: 47, activity: "path" },
  { x: 37, y: 62, activity: "bench" },
  { x: 62, y: 62, activity: "bench" },
  { x: 49, y: 74, activity: "path" },
  { x: 29, y: 33, activity: "cafe" },
  { x: 51, y: 13, activity: "path" }
];

const donutStations = [
  { x: 29, y: 29.7, left: { x: 25.7, y: 32.4 }, right: { x: 32.3, y: 32.4 } },
  { x: 39, y: 43.8, left: { x: 35.7, y: 46.5 }, right: { x: 42.3, y: 46.5 } },
  { x: 61, y: 43.8, left: { x: 57.7, y: 46.5 }, right: { x: 64.3, y: 46.5 } },
  { x: 50, y: 66.7, left: { x: 46.7, y: 69.4 }, right: { x: 53.3, y: 69.4 } }
];

const walkCorridors = [
  { from: [49.5, 0], to: [49.5, 33], width: 5.5 },
  { from: [49.5, 62], to: [49.5, 100], width: 5.4 },
  { from: [9, 39], to: [36, 47], width: 5.2 },
  { from: [12, 61], to: [37, 56], width: 4.8 },
  { from: [63, 46], to: [91, 34], width: 4.8 },
  { from: [62, 55], to: [92, 63], width: 4.8 },
  { from: [79, 42], to: [82, 25], width: 3.4 },
  { from: [22, 61], to: [18, 51], width: 3.5 }
];

const mapObstacles = [
  { x: 50, y: 47, rx: 12.6, ry: 15.4 },
  { x: 38.5, y: 36.5, rx: 3.1, ry: 4.1 },
  { x: 60.3, y: 36.5, rx: 3.1, ry: 4.1 },
  { x: 32.4, y: 48.5, rx: 2.5, ry: 5.1 },
  { x: 67.5, y: 49, rx: 2.5, ry: 5.1 },
  { x: 39.8, y: 63.5, rx: 3.6, ry: 3.4 },
  { x: 59.8, y: 63.5, rx: 3.6, ry: 3.4 }
];

const chemPodObstacles = [
  { left: 8, right: 22, top: 40, bottom: 70 },
  { left: 31, right: 66, top: 40, bottom: 67 },
  { left: 78, right: 92, top: 40, bottom: 70 },
  { left: 16, right: 82, top: 15, bottom: 37 }
];

let outgoingInvitations = [];
let selectedResident = null;
let currentFilter = "all";
let invitesOpen = true;
const player = { id: 11, name: "You", x: 50, y: 80 };
const scenePlayerPositions = {
  town: { x: player.x, y: player.y },
  chemPod: { x: 50, y: 86 }
};
let currentScene = "town";
let pendingSceneTransition = null;
let sceneTransitioning = false;
let currentUser = null;
let currentPairId = null;
let pairActivities = [];
const previewPairUserId = new URLSearchParams(window.location.search).get("previewPair");
const pressedKeys = new Set();
let clickPath = [];
let playerDirection = "down";
let playerFrame = 1;
let lastFrameChange = 0;
let lastGameTime = performance.now();

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

function personMarkup(person, compact = false) {
  const atlasIndex = person.spriteIndex ?? ((person.id - 1) % 12);
  const columnPositions = [0, 33.333, 66.667, 100];
  const rowPositions = [0, 50, 100];
  const spriteX = columnPositions[atlasIndex % 4];
  const spriteY = rowPositions[Math.floor(atlasIndex / 4)];
  const facingClass = person.pairFacing ? ` pair-facing-${person.pairFacing}` : "";
  return `<div class="pixel-person${facingClass}" style="--sprite-x:${spriteX}%;--sprite-y:${spriteY}%" aria-hidden="true"></div>${compact ? "" : `<span class="resident-state"></span><span class="resident-label">${escapeHtml(person.name.split(" ")[0])}</span>`}`;
}

function playerMarkup() {
  const directionRows = { down: 0, right: 33.333, left: 33.333, up: 100 };
  const framePositions = [0, 50, 100];
  const facingClass = playerDirection === "left" ? " facing-left" : "";
  return `<div class="player-character${facingClass}" style="--frame-x:${framePositions[playerFrame]}%;--direction-y:${directionRows[playerDirection]}%" aria-hidden="true"></div>
    <span class="resident-state"></span><span class="resident-label">You</span>`;
}

function renderResidents() {
  const residentsMarkup = residents.map(person => {
    const visible = currentFilter === "all" || (currentFilter === "other" && person.group === "other") || (currentFilter === "new" && person.donuts !== null && person.donuts <= 2);
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
  layer.innerHTML = `${activityMarkup}${residentsMarkup}<div class="player-pin ${currentUser?.status || "open"} ${currentUser?.status === "booked" ? "making-donut" : ""}" id="townPlayerPin" style="left:${player.x}%;top:${player.y}%;z-index:${Math.round(player.y * 10)}">
    ${playerMarkup()}
  </div>`;
  document.querySelector("#mapEmpty").hidden = layer.querySelectorAll(".resident-pin:not(.hidden)").length > 0;
  layer.querySelectorAll(".resident-pin").forEach(pin => pin.addEventListener("click", () => openResident(Number(pin.dataset.id))));
}

function renderChemPod() {
  const roomLayer = document.querySelector("#chemPodResidentsLayer");
  roomLayer.innerHTML = `<div class="player-pin ${currentUser?.status || "open"}" id="chemPodPlayerPin" style="left:${player.x}%;top:${player.y}%;z-index:${Math.round(player.y * 10)}">
    ${playerMarkup()}
  </div>`;
}

function layoutBookedPairs() {
  residents.forEach(person => {
    person.x = person.baseX;
    person.y = person.baseY;
    person.activity = person.baseActivity;
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

function isTownWalkable(x, y) {
  const plaza = isInsideEllipse(x, y, { x: 50, y: 48.5, rx: 23.5, ry: 20.5 });
  const corridor = walkCorridors.some(segment => distanceToSegment(x, y, segment) <= segment.width);
  const obstacle = mapObstacles.some(item => isInsideEllipse(x, y, item));
  return (plaza || corridor) && !obstacle;
}

function isChemPodWalkable(x, y) {
  const insideFloor = x >= 10 && x <= 90 && y >= 34 && y <= 89;
  const blocked = chemPodObstacles.some(obstacle => x >= obstacle.left && x <= obstacle.right && y >= obstacle.top && y <= obstacle.bottom);
  return insideFloor && !blocked;
}

function isWalkable(x, y) {
  return currentScene === "chemPod" ? isChemPodWalkable(x, y) : isTownWalkable(x, y);
}

function activeSceneBounds() {
  return currentScene === "chemPod"
    ? { minX: 10, maxX: 90, minY: 34, maxY: 89 }
    : { minX: 11, maxX: 89, minY: 5, maxY: 96 };
}

function nearestWalkable(x, y) {
  const bounds = activeSceneBounds();
  x = Math.max(bounds.minX, Math.min(bounds.maxX, x));
  y = Math.max(bounds.minY, Math.min(bounds.maxY, y));
  if (isWalkable(x, y)) return { x, y };
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
  clickPath = [];
  pendingSceneTransition = null;
  document.querySelector("#townView").hidden = currentScene !== "town";
  document.querySelector("#chemPodView").hidden = currentScene !== "chemPod";
  document.querySelector("#sceneTitle").textContent = currentScene === "chemPod" ? "Chem Pod" : "Town";
  if (currentScene === "chemPod") renderChemPod();
  else renderResidents();
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

function walkToScene(nextScene) {
  const doorway = nextScene === "chemPod" ? { x: 88, y: 59 } : { x: 50, y: 87 };
  pendingSceneTransition = nextScene;
  clickPath = findWalkPath(player, doorway);
  if (!clickPath.length) transitionToScene(nextScene);
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
    pendingSceneTransition = null;
  }
  if (!dx && !dy && clickPath.length) {
    const target = clickPath[0];
    const targetDx = target.x - player.x;
    const targetDy = target.y - player.y;
    const targetDistance = Math.hypot(targetDx, targetDy);
    if (targetDistance < 0.35) {
      clickPath.shift();
      if (!clickPath.length && pendingSceneTransition) {
        const nextScene = pendingSceneTransition;
        pendingSceneTransition = null;
        transitionToScene(nextScene);
      }
    }
    else {
      dx = targetDx / targetDistance;
      dy = targetDy / targetDistance;
    }
  }

  const isMoving = Boolean(dx || dy);
  if (isMoving) {
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    setPlayerDirection(dx, dy);
    const speed = 10;
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
        pendingSceneTransition = null;
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

async function syncSlackResidents() {
  try {
    const response = await fetch("/api/slack/members", { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("Slack sync unavailable");
    const data = await response.json();
    const summary = document.querySelector("#neighborSummary");
    outgoingInvitations = Array.isArray(data.outgoingInvitations) ? data.outgoingInvitations : [];
    currentUser = data.members.find(member => member.isCurrentUser) || null;
    const neighbors = data.members.filter(member => !member.isCurrentUser);
    renderCurrentProfile();
    if (neighbors.length > residentSlots.length) {
      summary.textContent = `${data.total} Slack neighbors synced · map layout pending`;
      return;
    }
    residents = neighbors.map((member, index) => ({
      id: index + 1,
      slackId: member.id,
      spriteIndex: member.appearanceIndex,
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
      x: residentSlots[index].x,
      y: residentSlots[index].y,
      activity: residentSlots[index].activity,
      baseX: residentSlots[index].x,
      baseY: residentSlots[index].y,
      baseActivity: residentSlots[index].activity,
      note: member.donutCount === null
        ? "Synced from Slack. Donut history is not connected yet."
        : member.donutCount > 0
          ? `${member.donutCount} completed Donut chats are recorded.`
          : "No completed Donut chats are recorded yet."
    }));
    selectedResident = null;
    currentFilter = "all";
    const filtersAvailable = residents.some(person => person.group !== "unknown" || person.donuts !== null);
    document.querySelectorAll(".filter-button").forEach(button => {
      button.classList.toggle("active", button.dataset.filter === "all");
      button.disabled = button.dataset.filter !== "all" && !filtersAvailable;
      if (button.disabled) button.title = "Team and participation data are not connected yet";
    });
    summary.textContent = currentUser
      ? `${data.total} Slack members · ${neighbors.length} neighbors + you`
      : `${data.total} Slack residents + local player (identity not linked)`;
    applyPairPreview();
    layoutBookedPairs();
    updateAvailabilityControl();
    renderResidents();
    if (currentScene === "chemPod") renderChemPod();
    renderInvitationDock();
  } catch {
    currentUser = null;
    residents = [];
    outgoingInvitations = [];
    renderResidents();
    renderInvitationDock();
    document.querySelector("#neighborSummary").textContent = "Slack sync temporarily unavailable · no demo residents shown";
    renderCurrentProfile();
  }
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

function openProfile() {
  closeDrawer();
  const profileDrawer = document.querySelector("#profileDrawer");
  profileDrawer.classList.add("open");
  profileDrawer.setAttribute("aria-hidden", "false");
  document.querySelector("#profileScrim").hidden = false;
  document.querySelector("#profileButton").setAttribute("aria-expanded", "true");
}

function closeProfile() {
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

function movePlayerFromMapClick(event) {
  if (event.target.closest("button")) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * 100;
  const y = ((event.clientY - bounds.top) / bounds.height) * 100;
  const destination = nearestWalkable(x, y);
  pendingSceneTransition = null;
  clickPath = findWalkPath(player, destination);
}

document.querySelector("#mapWorld").addEventListener("click", movePlayerFromMapClick);
document.querySelector("#chemPodWorld").addEventListener("click", movePlayerFromMapClick);
document.querySelector("#chemPodEntrance").addEventListener("click", () => walkToScene("chemPod"));
document.querySelector("#chemPodExit").addEventListener("click", () => walkToScene("town"));
document.querySelector("#leaveChemPod").addEventListener("click", () => transitionToScene("town"));

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
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
    pressedKeys.add(key);
  }
});

document.addEventListener("keyup", event => pressedKeys.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => pressedKeys.clear());

if (window.location.protocol === "file:") {
  residents = [];
  renderResidents();
  renderInvitationDock();
  document.querySelector("#neighborSummary").innerHTML = `Slack is unavailable in file mode · <a href="http://127.0.0.1:4173/">Open connected town</a>`;
  showToast("This file view cannot connect to Slack. Open the connected town link.");
} else {
  renderResidents();
  renderInvitationDock();
  syncSlackResidents().then(syncInvitationStates);
  window.setInterval(syncInvitationStates, 5000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncInvitationStates();
  });
}
if (window.matchMedia("(max-width: 760px)").matches) {
  document.querySelector(".dock-body").hidden = true;
  document.querySelector("#dockHandle").setAttribute("aria-expanded", "false");
}
window.setTimeout(() => document.querySelector("#loadingScreen").classList.add("done"), 650);
window.requestAnimationFrame(gameLoop);
