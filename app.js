const residents = [
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

let queue = [];
let selectedResident = null;
let currentFilter = "all";
let invitesOpen = true;
let planActive = false;
const player = { id: 11, name: "You", x: 50, y: 80 };
const pressedKeys = new Set();
let clickTarget = null;
let playerDirection = "down";
let playerFrame = 1;
let lastFrameChange = 0;
let lastGameTime = performance.now();

const layer = document.querySelector("#residentsLayer");
const drawer = document.querySelector("#residentDrawer");
const drawerScrim = document.querySelector("#drawerScrim");
const inviteButton = document.querySelector("#inviteButton");
const queueList = document.querySelector("#queueList");
const queueEmpty = document.querySelector("#queueEmpty");
const sendButton = document.querySelector("#sendInvites");
const toast = document.querySelector("#toast");

function personMarkup(person, compact = false) {
  const atlasIndex = (person.id - 1) % 12;
  const columnPositions = [0, 33.333, 66.667, 100];
  const rowPositions = [0, 50, 100];
  const spriteX = columnPositions[atlasIndex % 4];
  const spriteY = rowPositions[Math.floor(atlasIndex / 4)];
  return `<div class="pixel-person" style="--sprite-x:${spriteX}%;--sprite-y:${spriteY}%" aria-hidden="true"></div>${compact ? "" : `<span class="resident-state"></span><span class="resident-label">${person.name.split(" ")[0]}</span>`}`;
}

function playerMarkup() {
  return `<div class="player-character" style="--frame-x:50%;--direction-y:0%" aria-hidden="true"></div>
    <span class="resident-state"></span><span class="resident-label">You</span>`;
}

function renderResidents() {
  const residentsMarkup = residents.map(person => {
    const visible = currentFilter === "all" || (currentFilter === "other" && person.group === "other") || (currentFilter === "new" && person.donuts <= 2);
    return `<button class="resident-pin ${person.status} ${visible ? "" : "hidden"}" style="left:${person.x}%;top:${person.y}%" data-id="${person.id}" aria-label="Open ${person.name}'s profile">
      ${personMarkup(person)}
    </button>`;
  }).join("");
  layer.innerHTML = `${residentsMarkup}<div class="player-pin" id="playerPin" style="left:${player.x}%;top:${player.y}%">
    ${playerMarkup()}
  </div>`;
  document.querySelector("#mapEmpty").hidden = layer.querySelectorAll(".resident-pin:not(.hidden)").length > 0;
  layer.querySelectorAll(".resident-pin").forEach(pin => pin.addEventListener("click", () => openResident(Number(pin.dataset.id))));
}

function isInsideFountain(x, y) {
  const dx = (x - 50) / 10.5;
  const dy = (y - 47) / 12.5;
  return dx * dx + dy * dy < 1;
}

function isWalkable(x, y) {
  const verticalPath = x >= 43 && x <= 57 && y >= 5 && y <= 96;
  const horizontalPath = x >= 11 && x <= 89 && y >= 30 && y <= 64;
  const plaza = x >= 32 && x <= 68 && y >= 24 && y <= 70;
  return (verticalPath || horizontalPath || plaza) && !isInsideFountain(x, y);
}

function nearestWalkable(x, y) {
  x = Math.max(11, Math.min(89, x));
  y = Math.max(5, Math.min(96, y));
  if (isWalkable(x, y)) return { x, y };
  let best = { x: player.x, y: player.y, distance: Infinity };
  for (let px = 11; px <= 89; px += 1) {
    for (let py = 5; py <= 96; py += 1) {
      if (!isWalkable(px, py)) continue;
      const distance = (px - x) ** 2 + (py - y) ** 2;
      if (distance < best.distance) best = { x: px, y: py, distance };
    }
  }
  return best;
}

function updatePlayerElement(isMoving) {
  const pin = document.querySelector("#playerPin");
  if (!pin) return;
  pin.style.left = `${player.x}%`;
  pin.style.top = `${player.y}%`;
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

function gameLoop(timestamp) {
  const deltaSeconds = Math.min((timestamp - lastGameTime) / 1000, 0.05);
  lastGameTime = timestamp;
  let dx = 0;
  let dy = 0;

  if (pressedKeys.has("arrowup") || pressedKeys.has("w")) dy -= 1;
  if (pressedKeys.has("arrowdown") || pressedKeys.has("s")) dy += 1;
  if (pressedKeys.has("arrowleft") || pressedKeys.has("a")) dx -= 1;
  if (pressedKeys.has("arrowright") || pressedKeys.has("d")) dx += 1;

  if ((dx || dy) && clickTarget) clickTarget = null;
  if (!dx && !dy && clickTarget) {
    const targetDx = clickTarget.x - player.x;
    const targetDy = clickTarget.y - player.y;
    const targetDistance = Math.hypot(targetDx, targetDy);
    if (targetDistance < 0.4) clickTarget = null;
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
      else clickTarget = null;
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
  selectedResident = residents.find(person => person.id === id);
  document.querySelector("#residentName").textContent = selectedResident.name;
  document.querySelector("#residentTeam").textContent = selectedResident.team;
  document.querySelector("#residentDonuts").textContent = selectedResident.donuts;
  document.querySelector("#residentTopics").innerHTML = selectedResident.topics.map(topic => `<span class="topic">${topic}</span>`).join("");
  document.querySelector("#connectionNote").textContent = selectedResident.note;
  document.querySelector("#drawerPortrait").innerHTML = personMarkup(selectedResident, true);
  const statusLabel = selectedResident.status === "open" ? "Open to invitations" : selectedResident.status === "pending" ? "Invitation pending" : "Booked this week";
  document.querySelector("#drawerStatus").textContent = statusLabel;

  const inQueue = queue.some(person => person.id === selectedResident.id);
  inviteButton.disabled = planActive || selectedResident.status !== "open" || (!inQueue && queue.length >= 3) || !invitesOpen;
  inviteButton.classList.toggle("remove", inQueue);
  inviteButton.textContent = planActive ? "Invitation plan is active" : inQueue ? "Remove from queue" : selectedResident.status === "open" ? (queue.length >= 3 ? "Queue is full" : "Add to invite queue") : "Not available this week";
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  drawerScrim.hidden = false;
}

function closeDrawer() {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  drawerScrim.hidden = true;
}

function toggleSelected() {
  if (!selectedResident) return;
  const index = queue.findIndex(person => person.id === selectedResident.id);
  if (index >= 0) queue.splice(index, 1);
  else if (queue.length < 3 && selectedResident.status === "open") queue.push(selectedResident);
  renderQueue();
  openResident(selectedResident.id);
}

function renderQueue() {
  document.querySelector("#queueCount").textContent = queue.length;
  queueEmpty.hidden = queue.length > 0;
  sendButton.disabled = queue.length === 0 || planActive;
  sendButton.textContent = planActive ? "Invitation plan active" : "Send invitations";
  queueList.innerHTML = queue.map((person, index) => `<li class="queue-item">
    <span class="priority-number">${index + 1}</span>
    <span class="queue-name">${person.name}</span>
    <span class="queue-actions">
      <button data-move="up" data-id="${person.id}" aria-label="Move ${person.name} up" ${planActive ? "disabled" : ""}>↑</button>
      <button data-move="down" data-id="${person.id}" aria-label="Move ${person.name} down" ${planActive ? "disabled" : ""}>↓</button>
      <button data-move="remove" data-id="${person.id}" aria-label="Remove ${person.name}" ${planActive ? "disabled" : ""}>×</button>
    </span>
  </li>`).join("");
  queueList.querySelectorAll("button").forEach(button => button.addEventListener("click", () => updateQueue(Number(button.dataset.id), button.dataset.move)));
}

function updateQueue(id, action) {
  const index = queue.findIndex(person => person.id === id);
  if (action === "remove") queue.splice(index, 1);
  if (action === "up" && index > 0) [queue[index - 1], queue[index]] = [queue[index], queue[index - 1]];
  if (action === "down" && index < queue.length - 1) [queue[index + 1], queue[index]] = [queue[index], queue[index + 1]];
  renderQueue();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3200);
}

document.querySelector("#closeDrawer").addEventListener("click", closeDrawer);
drawerScrim.addEventListener("click", closeDrawer);
inviteButton.addEventListener("click", toggleSelected);

document.querySelectorAll(".filter-button").forEach(button => button.addEventListener("click", () => {
  currentFilter = button.dataset.filter;
  document.querySelectorAll(".filter-button").forEach(item => item.classList.toggle("active", item === button));
  renderResidents();
}));

document.querySelectorAll(".nav-button").forEach(button => button.addEventListener("click", () => {
  const town = button.dataset.view === "town";
  document.querySelector("#townView").hidden = !town;
  document.querySelector("#historyView").hidden = town;
  document.querySelector("#inviteDock").hidden = !town;
  document.querySelectorAll(".nav-button").forEach(item => item.classList.toggle("active", item === button));
}));

document.querySelector("#availabilityButton").addEventListener("click", () => {
  invitesOpen = !invitesOpen;
  const button = document.querySelector("#availabilityButton");
  button.classList.toggle("paused", !invitesOpen);
  button.setAttribute("aria-pressed", String(invitesOpen));
  document.querySelector("#availabilityText").textContent = invitesOpen ? "Open to invites" : "Paused this week";
  showToast(invitesOpen ? "You are open to invitations again." : "Invitations paused for this week.");
});

document.querySelector("#dockHandle").addEventListener("click", () => {
  const body = document.querySelector(".dock-body");
  body.hidden = !body.hidden;
  document.querySelector("#dockHandle").setAttribute("aria-expanded", String(!body.hidden));
});

document.querySelector("#mapWorld").addEventListener("click", event => {
  if (event.target.closest("button")) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * 100;
  const y = ((event.clientY - bounds.top) / bounds.height) * 100;
  clickTarget = nearestWalkable(x, y);
});

sendButton.addEventListener("click", () => document.querySelector("#modalScrim").hidden = false);
document.querySelector("#cancelSend").addEventListener("click", () => document.querySelector("#modalScrim").hidden = true);
document.querySelector("#confirmSend").addEventListener("click", () => {
  document.querySelector("#modalScrim").hidden = true;
  const first = queue[0];
  first.status = "pending";
  first.note = "Donut Bot sent your private invitation.";
  planActive = true;
  renderQueue();
  renderResidents();
  closeDrawer();
  showToast(`Donut Bot privately invited ${first.name}.`);
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeDrawer();
    document.querySelector("#modalScrim").hidden = true;
  }
  if (drawer.classList.contains("open") || !document.querySelector("#modalScrim").hidden) return;
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
    pressedKeys.add(key);
  }
});

document.addEventListener("keyup", event => pressedKeys.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => pressedKeys.clear());

renderResidents();
renderQueue();
if (window.matchMedia("(max-width: 760px)").matches) {
  document.querySelector(".dock-body").hidden = true;
  document.querySelector("#dockHandle").setAttribute("aria-expanded", "false");
}
window.setTimeout(() => document.querySelector("#loadingScreen").classList.add("done"), 650);
window.requestAnimationFrame(gameLoop);
