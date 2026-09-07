import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { normalizePresenceState, PresenceHub } from "../realtime/presence.mjs";

class FakeSocket extends EventEmitter {
  readyState = 1;
  sent = [];

  send(message) {
    this.sent.push(JSON.parse(message));
  }

  close() {
    this.readyState = 3;
    this.emit("close");
  }

  state(message) {
    this.emit("message", JSON.stringify({ type: "state", ...message }));
  }
}

test("presence coordinates and enums are normalized", () => {
  assert.deepEqual(normalizePresenceState({ type: "state", scene: "town", x: -3, y: 100.126, direction: "sideways", moving: true }, 123), {
    scene: "town",
    x: 0,
    y: 100,
    direction: "down",
    moving: true,
    action: null,
    pet: null,
    updatedAt: 123
  });
  assert.equal(normalizePresenceState({ type: "state", scene: "secret", x: 1, y: 2 }), null);
});

test("presence updates retain online members across town scenes", () => {
  let now = 1000;
  const hub = new PresenceHub({ now: () => now, minUpdateIntervalMs: 0 });
  const a = new FakeSocket();
  const b = new FakeSocket();
  const c = new FakeSocket();
  hub.connect(a, "UAAA111");
  hub.connect(b, "UBBB222");
  hub.connect(c, "UCCC333");

  a.state({ scene: "town", x: 10, y: 20, direction: "right", moving: true });
  b.state({ scene: "town", x: 30, y: 40, direction: "left", moving: false });
  c.state({ scene: "chemPod", x: 50, y: 60, direction: "up", moving: true });

  assert.ok(a.sent.some(message => message.type === "state" && message.userId === "UBBB222"));
  assert.ok(a.sent.some(message => message.type === "state" && message.userId === "UCCC333" && message.scene === "chemPod"));
  assert.ok(c.sent.some(message => message.type === "snapshot" && message.players.some(player => player.userId === "UAAA111" && player.scene === "town")));

  now += 100;
  b.state({ scene: "chemPod", x: 44, y: 55, direction: "up", moving: true });
  assert.ok(a.sent.some(message => message.type === "state" && message.userId === "UBBB222" && message.scene === "chemPod"));
  assert.ok(c.sent.some(message => message.type === "state" && message.userId === "UBBB222" && message.scene === "chemPod"));
});

test("disconnect removes a player from peers in every scene", () => {
  const hub = new PresenceHub({ minUpdateIntervalMs: 0 });
  const a = new FakeSocket();
  const b = new FakeSocket();
  hub.connect(a, "UAAA111");
  hub.connect(b, "UBBB222");
  a.state({ scene: "town", x: 10, y: 20 });
  b.state({ scene: "chemPod", x: 30, y: 40 });
  b.close();
  assert.ok(a.sent.some(message => message.type === "leave" && message.userId === "UBBB222"));
});

test("a newer session replaces the old socket without leaving a ghost player", () => {
  const hub = new PresenceHub({ minUpdateIntervalMs: 0 });
  const observer = new FakeSocket();
  const oldSocket = new FakeSocket();
  const newSocket = new FakeSocket();
  hub.connect(observer, "UOBSERVER");
  observer.state({ scene: "town", x: 50, y: 50 });
  hub.connect(oldSocket, "UMEMBER");
  oldSocket.state({ scene: "town", x: 20, y: 20 });

  hub.connect(newSocket, "UMEMBER");
  newSocket.state({ scene: "town", x: 22, y: 20, moving: true });

  assert.equal(oldSocket.readyState, 3);
  assert.equal(hub.clients.has(oldSocket), false);
  assert.equal(hub.clientsByUser.get("UMEMBER"), newSocket);
  assert.ok(observer.sent.some(message => message.type === "state" && message.userId === "UMEMBER" && message.x === 22));
});

test('a pet is relayed when it looks like one, and dropped when it does not', () => {
  const base = { type: 'state', scene: 'town', x: 10, y: 10 };
  assert.equal(normalizePresenceState({ ...base, pet: 'pet-cat' }).pet, 'pet-cat');
  for (const forged of ['deco-rug', '../../etc/passwd', 'pet-' + 'x'.repeat(40), 42, null, undefined]) {
    assert.equal(normalizePresenceState({ ...base, pet: forged }).pet, null);
  }
});

test('a member can be seen in the shop as well as the town and the pod', () => {
  for (const scene of ['town', 'chemPod', 'donutShop']) {
    assert.equal(normalizePresenceState({ type: 'state', scene, x: 5, y: 5 })?.scene, scene);
  }
  assert.equal(normalizePresenceState({ type: 'state', scene: 'somewhere-else', x: 5, y: 5 }), null);
});
