const ALLOWED_SCENES = new Set(["town", "chemPod"]);
const ALLOWED_DIRECTIONS = new Set(["up", "down", "left", "right"]);
const ALLOWED_ACTIONS = new Set(["sitChair", "sitGrass", "garden", "lookout", "read", "coffee", "experiment", "dance", "fish"]);
// A pet id is only ever relayed, never trusted as proof of ownership: the
// worst a forged one can do is show a sprite that does not exist.
const PET_ID = /^pet-[a-z0-9-]{2,30}$/;

export function normalizePresenceState(input, now = Date.now()) {
  if (!input || input.type !== "state" || !ALLOWED_SCENES.has(input.scene)) return null;
  const x = Number(input.x);
  const y = Number(input.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    scene: input.scene,
    x: roundCoordinate(Math.max(0, Math.min(100, x))),
    y: roundCoordinate(Math.max(0, Math.min(100, y))),
    direction: ALLOWED_DIRECTIONS.has(input.direction) ? input.direction : "down",
    moving: input.moving === true,
    action: ALLOWED_ACTIONS.has(input.action) ? input.action : null,
    pet: typeof input.pet === "string" && PET_ID.test(input.pet) ? input.pet : null,
    updatedAt: now
  };
}

export class PresenceHub {
  constructor({ now = () => Date.now(), minUpdateIntervalMs = 60 } = {}) {
    this.now = now;
    this.minUpdateIntervalMs = minUpdateIntervalMs;
    this.clients = new Map();
    this.clientsByUser = new Map();
  }

  connect(socket, userId) {
    const previous = this.clientsByUser.get(userId);
    if (previous && previous !== socket) {
      const previousClient = this.clients.get(previous);
      if (previousClient) this.disconnect(previousClient);
      previous.close(4001, "Replaced by a newer Donut Town session");
    }

    const client = { socket, userId, state: null, lastAcceptedAt: 0 };
    this.clients.set(socket, client);
    this.clientsByUser.set(userId, socket);
    send(socket, { type: "ready", selfId: userId });

    socket.on("message", raw => this.receive(client, raw));
    socket.on("close", () => this.disconnect(client));
    socket.on("error", () => this.disconnect(client));
  }

  receive(client, raw) {
    if (!this.clients.has(client.socket) || byteLength(raw) > 512) return;
    const now = this.now();
    if (client.lastAcceptedAt && now - client.lastAcceptedAt < this.minUpdateIntervalMs) return;

    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }
    const nextState = normalizePresenceState(message, now);
    if (!nextState) return;

    const isInitialState = !client.state;
    client.state = nextState;
    client.lastAcceptedAt = now;

    if (isInitialState) this.sendSnapshot(client);
    this.broadcast({ type: "state", userId: client.userId, ...nextState }, client.socket);
  }

  sendSnapshot(client) {
    const players = [];
    for (const peer of this.clients.values()) {
      if (peer === client || !peer.state) continue;
      players.push({ userId: peer.userId, ...peer.state });
    }
    send(client.socket, { type: "snapshot", players });
  }

  broadcast(message, exceptSocket = null) {
    for (const peer of this.clients.values()) {
      if (peer.socket === exceptSocket || !peer.state) continue;
      send(peer.socket, message);
    }
  }

  disconnect(client) {
    if (!this.clients.has(client.socket)) return;
    this.clients.delete(client.socket);
    if (this.clientsByUser.get(client.userId) === client.socket) this.clientsByUser.delete(client.userId);
    if (client.state) this.broadcast({ type: "leave", userId: client.userId }, client.socket);
  }
}

function send(socket, message) {
  if (socket.readyState === 1) socket.send(JSON.stringify(message));
}

function byteLength(value) {
  if (typeof value === "string") return Buffer.byteLength(value);
  return value?.byteLength ?? value?.length ?? Infinity;
}

function roundCoordinate(value) {
  return Math.round(value * 100) / 100;
}
