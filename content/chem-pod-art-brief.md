# Chem Pod · compact interior v3

Production asset: `assets/chem-pod-interior-v3.png`, 1536 × 1024 PNG,
2,267,937 bytes (previous v2: 2,603,140 bytes, new download about 13% smaller).
Generated as a fresh composition using the existing Chem Pod v2 and town map v2
as game-art references. No original Slack/profile photo was provided to generation.
The old dynamic photo gallery was also removed from the room UI; Slack avatars
remain in profiles.

## Room and scale

One experiment island, a back-wall fume hood, bookcase, reading nook, coffee
counter and bottom-center doorway. Warm wood, sage and cream retain the town's
palette. The standing personalized sprite is approximately 22% of room height,
scaled by the room's measured width; the old fixed 0.68 indoor shrink is gone
for Chem Pod. The complete boundary fits both desktop and portrait viewports.
Portrait screens retain surrounding space to avoid cropping the room.

The central bench, reading nook and coffee counter reuse clipped copies of the
same decoded PNG for depth. Their feet-based stacking order shares a context
with resident/player elements. No separate foreground raster assets are fetched.

Geometry is explicitly measured against the final generated art, not copied
from the requested prompt coordinates (the generator changed their placement).
`scripts/build-chempod-walkmask.mjs` is the source for the connected walk mask
and rectangular fallback. `town-zones.js` has the corresponding interaction
anchors. The compact room has eight deliberate resident staging positions;
additional workspace members remain around town. These are placements, not
claims of online presence.

## Final generation prompt

Create a completely redesigned Chem Pod interior background for the cozy Donut Town pixel-art game. References are GAME ART ONLY: use their warm wood, sage green, cream tile, crisp 16-bit pixel technique and overhead three-quarter camera. Do not preserve the old huge room layout. Output a landscape 3:2 full room background, 1536x1024. This is a SMALL intimate playable chemistry clubhouse, roughly 7 metres wide by 5 metres deep, with human-scale furniture and just one modest central experiment island. View close enough that an adult game character would occupy 13 percent of image height; the door opening must correspond to this scale. Enlarge chunky furniture/details relative to room, fewer tile rows, no huge showroom emptiness. Complete straight rectangular room boundary fully visible with a little dark sage surround; back wall upper 10-30 percent, playable floor approx x12-88 y34-87, short front cutaway wall around y88-93, clear wide entrance centered x44-57 y88-97. Central single wooden green-top chemistry bench occupies x37-61 y43-59, with a few colorful flasks, one small microscope and one brass instrument, NO stools blocking its front. Leave connected generous paths on all four sides of this bench and a broad path to the bottom-center door. Back wall: a compact fume hood in center, short closed cabinets left, narrow books shelf right. Left side near x16-28 y49-65 a cozy small armchair and low bookstand in one compact furniture island. Right side near x73-85 y50-64 a tiny coffee counter with kettle and two cups. Back-left wall a plain small cream noticeboard EMPTY for later live text, x18-30 y14-25. One potted fern beside back-right cabinet. Warm practical lighting, subtle floor contact shadows, readable game-like chunky pixel clusters, no photorealistic texture. Keep foreground floor mostly clear, human intimate scale, strongest focus central experiment bench. No people, no characters, no animals, no human likenesses, no portraits, no photos, no faces, no picture frames, no team gallery. No words, letters, numbers, labels, logos, signs, UI, grids or watermarks. Do not insert any reference town exterior or any crop of previous image; compose a fresh compact laboratory room.

## Validation

- One background generation; final scale tuned with the actual rendered resident,
  since the prompt's suggested sprite proportion did not produce the desired fit.
- Local browser: 1280 × 720 desktop and 390 × 844 portrait; custom avatar and a
  simulated 65-member roster (eight residents indoors, three personalized and
  five starter sprites). No production member or wallet writes.
- Browser: click movement, front/side furniture depth, toolbar and doorway exit/re-entry,
  clear doorway and photo-free room image sources. Keyboard taps from the browser
  runner were too brief to demonstrate continuous movement; existing held-key
  handlers remain unchanged. Reduced-motion transition inspected in code.
- Geometry tests sample every path segment around all four sides of the island,
  reject table/counter/front-wall positions, and check blocked clicks project to
  reachable floor. All tagged activity anchors are reachable from the entrance.
- Full local test suite: 94 passed, including the isolated local Redis chat test.
  Tests requiring local listeners need sandbox network permission.
- Skill frontmatter validator passed. This is one observed generation/integration,
  not an independent lower-capability model evaluation or a deployment test.
