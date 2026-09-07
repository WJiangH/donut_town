// Places on the map that suggest what a character does when they stop there.
// Furniture zones name the object (a bench, a table); the stand-point beside it
// is derived from the walk mask at load. Area zones name a patch of ground.
(function () {
  const ZONES = [
    // Benches: sit down when the seat is free.
    { action: ["sitChair", "sitChair", "read"], scene: "town", x: 43.5, y: 47.0, note: "fountain west bench" },
    { action: ["sitChair", "sitChair", "read"], scene: "town", x: 56.4, y: 47.1, note: "fountain east bench" },
    { action: ["sitChair", "sitChair", "read"], scene: "town", x: 57.2, y: 34.3, note: "fountain north-east bench" },
    { action: ["sitChair", "sitChair", "read"], scene: "town", x: 57.4, y: 54.5, note: "fountain south-east bench" },
    { action: ["sitChair", "sitChair", "read"], scene: "town", x: 54.3, y: 61.3, note: "south plaza bench" },
    { action: ["sitChair", "sitChair", "read"], scene: "town", x: 62.1, y: 63.4, note: "east lane bench" },
    { action: ["sitChair", "sitChair", "read"], scene: "town", x: 63.1, y: 66.9, note: "east lane lower bench" },
    { action: ["sitChair", "sitChair", "read"], scene: "town", x: 53.6, y: 73.1, note: "south lane bench" },
    { action: ["sitChair", "sitChair", "read"], scene: "town", x: 33.5, y: 67.8, note: "science lane bench" },
    { action: ["sitChair", "sitChair", "read"], scene: "town", x: 45.6, y: 72.4, note: "mid south bench" },
    { action: ["sitChair", "sitChair", "read"], scene: "town", x: 43.1, y: 26.1, note: "north lane bench" },
    { action: ["sitChair", "sitChair", "read"], scene: "town", x: 76.3, y: 78.2, note: "fire pit bench" },
    { action: ["sitChair", "sitChair", "read"], scene: "town", x: 79.4, y: 77.0, note: "fire pit bench" },

    // Cafe terrace and picnic tables: have a coffee.
    { action: "coffee", scene: "town", x: 29.3, y: 26.4, seats: 2, note: "cafe terrace table" },
    { action: "coffee", scene: "town", x: 33.1, y: 26.0, seats: 2, note: "cafe terrace table" },
    { action: "coffee", scene: "town", x: 35.3, y: 23.0, seats: 2, note: "cafe upper table" },
    { action: "coffee", scene: "town", x: 10.3, y: 88.2, seats: 2, note: "orchard picnic table" },
    { action: "coffee", scene: "town", x: 80.6, y: 88.0, seats: 3, note: "south-east umbrella table" },
    { action: "coffee", scene: "town", x: 88.0, y: 85.6, seats: 4, note: "pergola banquet table" },

    // Quiet corners: read a book.
    { action: "read", scene: "town", x: 10.1, y: 25.0, seats: 2, note: "picnic blanket" },
    { action: "read", scene: "town", x: 51.0, y: 8.0, seats: 2, note: "gazebo" },

    // Bridges and the waterfall: stop and take in the view.
    { action: "lookout", scene: "town", x: 13.5, y: 31.5, radius: 1.4, seats: 2, facing: "down", note: "west footbridge" },
    { action: "lookout", scene: "town", x: 81.0, y: 60.3, radius: 1.7, seats: 2, facing: "down", note: "east arch bridge" },
    { action: "lookout", scene: "town", x: 61.5, y: 72.0, radius: 1.7, seats: 2, facing: "down", note: "south-east plank bridge" },
    { action: "lookout", scene: "town", x: 43.0, y: 93.5, radius: 1.4, seats: 2, facing: "down", note: "south stone bridge" },
    { action: "lookout", scene: "town", x: 48.6, y: 11.0, radius: 1.4, seats: 2, facing: "down", note: "north bridge" },
    { action: "lookout", scene: "town", x: 90.5, y: 44.5, seats: 2, note: "waterfall" },

    // Planted beds: do some gardening.
    { action: "garden", scene: "town", x: 76.6, y: 22.0, seats: 2, note: "farm plots" },
    { action: "garden", scene: "town", x: 18.2, y: 88.5, seats: 2, note: "village garden" },

    // Open lawn, measured off the map art: sit on the grass.
    { action: "sitGrass", scene: "town", x: 62.8, y: 90.2, radius: 3.0, seats: 4, note: "south-east meadow" },
    { action: "sitGrass", scene: "town", x: 26.3, y: 52.7, radius: 2.6, seats: 3, note: "west green" },
    { action: "sitGrass", scene: "town", x: 38.8, y: 75.4, radius: 2.4, seats: 3, note: "south green" },
    { action: "sitGrass", scene: "town", x: 34.1, y: 33.2, radius: 2.2, seats: 3, note: "cafe green" },
    { action: "sitGrass", scene: "town", x: 47.7, y: 27.0, radius: 2.2, seats: 3, note: "north green" },
    { action: "sitGrass", scene: "town", x: 29.9, y: 90.2, radius: 2.2, seats: 3, note: "orchard green" },
    { action: "sitGrass", scene: "town", x: 77.9, y: 48.8, radius: 2.0, seats: 2, note: "east green" },
    { action: "sitGrass", scene: "town", x: 18.0, y: 45.7, radius: 2.0, seats: 2, note: "cottage green" },
    { action: "sitGrass", scene: "town", x: 59.6, y: 33.2, radius: 2.0, seats: 2, note: "fountain green" },
    { action: "sitGrass", scene: "town", x: 69.5, y: 33.2, radius: 2.0, seats: 2, note: "east cottage green" },
    { action: "sitGrass", scene: "town", x: 51.8, y: 82.4, radius: 2.0, seats: 2, note: "south lane green" },

    // Chem Pod interior, where the floor plan is fixed rather than painted.
    { action: "experiment", scene: "chemPod", x: 50, y: 71, radius: 2.4, seats: 2, facing: "up", note: "lab bench" },
    { action: "read", scene: "chemPod", x: 41, y: 75, radius: 2.0, seats: 2, facing: "down", note: "reading corner" },
    { action: "coffee", scene: "chemPod", x: 70, y: 79, radius: 2.0, seats: 2, facing: "down", note: "coffee counter" }
  ];

  // How close you have to stop, and how long you have to stay, before a pose starts.
  const REACH = 3.2;
  const AT_SPOT = 0.8;
  const SEAT_TAKEN = 1.3;
  const DWELL_FURNITURE = 1600;
  const DWELL_AREA = 900;
  const DWELL_JITTER = 700;

  // Lawn, riverbank and planted-bed tags measured off the map art.
  for (const measured of window.TOWN_ZONES_AUTO || []) ZONES.push({ ...measured, measured: true });

  const zones = { ready: false, list: ZONES };
  window.TownZones = zones;

  function distance(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  // Stand beside the furniture, on ground the walk mask allows, facing it.
  function resolveAnchor(zone) {
    if (zone.radius) {
      const centre = zone.scene === "town" && window.TownCollision?.ready
        ? window.TownCollision.nearestWalkable(zone.x, zone.y)
        : { x: zone.x, y: zone.y };
      zone.anchor = { x: Math.round(centre.x * 10) / 10, y: Math.round(centre.y * 10) / 10 };
      zone.facing = zone.facing || "down";
      return;
    }
    const walkable = zone.scene === "town" && window.TownCollision?.ready
      ? (x, y) => window.TownCollision.isWalkable(x, y)
      : () => true;
    // Benches and tables sit on ground you can stand on, so settle right on them.
    if (walkable(zone.x, zone.y)) {
      zone.anchor = { x: zone.x, y: zone.y };
      zone.reachable = true;
      zone.facing = zone.facing || "down";
      return;
    }
    let best = null;
    let bestScore = Infinity;
    for (let dy = -4; dy <= 4.001; dy += 0.25) {
      for (let dx = -4; dx <= 4.001; dx += 0.25) {
        const gap = Math.hypot(dx, dy);
        if (gap < 0.4 || gap > 4) continue;
        const x = zone.x + dx;
        const y = zone.y + dy;
        if (!walkable(x, y)) continue;
        // Sprites stand on their feet, so the near side of a bench or table
        // reads as sitting at it; behind it reads as standing in the flowerbed.
        const score = gap * (dy >= 0.2 ? 1 : dy > -0.2 ? 1.3 : 1.9);
        if (score >= bestScore) continue;
        bestScore = score;
        best = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
      }
    }
    zone.anchor = best || { x: zone.x, y: zone.y };
    zone.reachable = Boolean(best);
    if (!zone.facing) {
      const dx = zone.x - zone.anchor.x;
      const dy = zone.y - zone.anchor.y;
      zone.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    }
  }

  zones.prepare = function () {
    if (zones.ready) return;
    ZONES.forEach(zone => {
      zone.seats = zone.seats || 1;
      resolveAnchor(zone);
    });
    zones.ready = true;
  };

  function poses(zone) {
    return Array.isArray(zone.action) ? zone.action : [zone.action];
  }

  function seatIsFree(zone, occupants) {
    const limit = zone.radius ? zone.radius : SEAT_TAKEN;
    let taken = 0;
    for (const occupant of occupants || []) {
      if (distance(occupant.x, occupant.y, zone.anchor.x, zone.anchor.y) <= limit) taken++;
    }
    return taken < zone.seats;
  }

  // The zone a character standing here would drift into, nearest first.
  zones.zoneFor = function (point, scene, actions, occupants) {
    let best = null;
    for (const zone of ZONES) {
      if (zone.scene !== scene) continue;
      if (!actions || !poses(zone).some(pose => actions[pose])) continue;
      const reach = zone.radius || REACH;
      const gap = distance(point.x, point.y, zone.anchor.x, zone.anchor.y);
      if (gap > reach) continue;
      if (!seatIsFree(zone, occupants)) continue;
      if (!best || gap < best.gap) best = { zone, gap };
    }
    return best;
  };

  let pending = null;

  zones.reset = function () {
    pending = null;
  };

  // Called every frame while the character is standing still. Returns the pose
  // to strike, or a spot to stroll over to first, once they have settled.
  zones.settle = function (point, scene, now, actions, occupants) {
    const match = zones.zoneFor(point, scene, actions, occupants);
    if (!match) {
      pending = null;
      return null;
    }
    const { zone, gap } = match;
    if (!pending || pending.zone !== zone) {
      // Pick which of the zone's poses this visit gets, so a bench is
      // sometimes a place to sit and sometimes a place to read.
      const available = poses(zone).filter(pose => actions[pose]);
      pending = {
        zone,
        since: now,
        delay: (zone.radius ? DWELL_AREA : DWELL_FURNITURE) + Math.random() * DWELL_JITTER,
        pose: available[Math.floor(Math.random() * available.length)],
        walked: false
      };
    }
    if (now - pending.since < pending.delay) return null;
    if (!zone.radius && gap > AT_SPOT) {
      if (pending.walked) return null;
      pending.walked = true;
      // Take the last step to the bench, then settle on the next pass.
      pending.since = now;
      return { walkTo: { x: zone.anchor.x, y: zone.anchor.y }, zone };
    }
    return { action: pending.pose, facing: zone.facing, zone };
  };

  // ?zones=1 marks every tagged spot so the map tags can be checked by eye.
  zones.showOverlay = function () {
    const world = document.querySelector("#mapWorld");
    if (!world || world.querySelector(".zone-overlay")) return;
    const overlay = document.createElement("div");
    overlay.className = "zone-overlay";
    Object.assign(overlay.style, { position: "absolute", inset: "0", pointerEvents: "none", zIndex: "6" });
    overlay.innerHTML = ZONES.filter(zone => zone.scene === "town").map(zone => {
      const size = (zone.radius || 1) * 2;
      return `<div style="position:absolute;left:${zone.anchor.x}%;top:${zone.anchor.y}%;width:${size}%;height:${size * 1.5}%;transform:translate(-50%,-50%);border:2px solid rgba(255,90,220,.9);border-radius:50%"></div>
        <div style="position:absolute;left:${zone.x}%;top:${zone.y}%;transform:translate(-50%,-50%);color:#fff;background:rgba(20,20,30,.75);font:10px/1.2 monospace;padding:1px 3px;white-space:nowrap">${poses(zone)[0]}</div>`;
    }).join("");
    world.appendChild(overlay);
  };

  zones.prepare();

  if (new URLSearchParams(window.location.search).get("zones") === "1") {
    document.addEventListener("DOMContentLoaded", () => zones.showOverlay());
  }
})();
