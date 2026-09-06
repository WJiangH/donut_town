const ALLOWED_SCENES = new Set(["town", "chemPod"]);
const ALLOWED_DIRECTIONS = new Set(["up", "down", "left", "right"]);

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

    const previousScene = client.state?.scene || null;
    client.state = nextState;
    client.lastAcceptedAt = now;

    if (previousScene && previousScene !== nextState.scene) {
      this.broadcast(previousScene, { type: "leave", userId: client.userId }, client.socket);
    }
    if (previousScene !== nextState.scene) this.sendSnapshot(client);
    this.broadcast(nextState.scene, { type: "state", userId: client.userId, ...nextState }, client.socket);
  }

  sendSnapshot(client) {
    const players = [];
    for (const peer of this.clients.values()) {
      if (peer === client || peer.state?.scene !== client.state.scene) continue;
      players.push({ userId: peer.userId, ...peer.state });
    }
    send(client.socket, { type: "snapshot", scene: client.state.scene, players });
  }

  broadcast(scene, message, exceptSocket = null) {
    for (const peer of this.clients.values()) {
      if (peer.socket === exceptSocket || peer.state?.scene !== scene) continue;
      send(peer.socket, message);
    }
  }

  disconnect(client) {
    if (!this.clients.has(client.socket)) return;
    this.clients.delete(client.socket);
    if (this.clientsByUser.get(client.userId) === client.socket) this.clientsByUser.delete(client.userId);
    if (client.state) this.broadcast(client.state.scene, { type: "leave", userId: client.userId }, client.socket);
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
