# Chem Pod · modern laboratory v4

Production asset: `assets/chem-pod-interior-v4.png`, 1672 × 941 PNG,
2,289,117 bytes (v3: 2,267,937 bytes; about 0.9% larger). The background loads
only when the room is entered. Foreground islands reuse that same image URL.

Generated with the built-in image tool as a fresh layout, using v3 game art
only as a pixel-style reference. No Slack photos, portraits, or member data
were supplied to generation or embedded in this image.

## Room contract

One fixed whole-room view, fitted to the actual image aspect ratio with CSS
container units. No zoom, dragging camera, automatic follow, or overview toggle.
Standing sprites paint at about 8.9% of room height (88px × room width / 1750),
including remote members; the pet uses the same scale. Eight residents are
staged beside instruments, not randomly on furniture. These placements do not
claim live presence.

Two experiment islands, rear synthesis enclosure, fume hood and analysis
monitors, separate reading and coffee consoles, and a wide connected center
walkway. `scripts/build-chempod-walkmask.mjs` defines conservative furniture
rectangles with side clearance for sprite bodies, and bakes the 224 × 126 mask.
The same geometry supplies the fallback. `town-zones.js` holds the matching
interaction anchors. Four clipped copies of the background supply bench/console
depth using the same feet-based stacking context as characters. They are not
additional asset downloads. The dynamic announcement sits outside the art.

## Final generation prompt

Create a NEW production game background: a fancy contemporary chemistry research laboratory for Donut Town. Use attached OLD GAME ART only for the crisp handcrafted pixel-art rendering and overhead three-quarter orthographic viewpoint. Completely replace its cramped wooden cottage architecture and oversized central furniture. Landscape WIDE 16:9 canvas 1536x864. One complete cutaway rectangular modern laboratory with every outer boundary visible and a bottom-center open doorway. Contemporary premium materials: ivory modular cabinets, charcoal frames, muted teal glass, brushed metal, subtle warm amber lighting, small plants. Cozy sophisticated 16-bit game pixel art, crisp pixel clusters, no photographic realism. Room much wider and more spacious, live adult characters later will be only 9% of canvas height. Layout precise and simple: rear wall from y5-24%, cabinets/equipment at x10-90 y18-33%, main accessible pale grey terrazzo floor x10-90 y35-86%. Two SMALL separate experiment islands: left island x25-39% y45-58%; right island x61-75% y45-58%. Each includes some colorful flasks and a compact microscope or analytical instrument, leaving a BROAD unobstructed central aisle x42-58 from rear to entrance and clear paths around all sides. Back wall center hero feature: an elegant glass enclosed automated synthesis instrument with subtle teal practical lighting. Left rear a fume hood, right rear a compact analysis station with monitors showing only abstract curves no characters. Small reading/sample workstation at left wall x10-18 y59-69, small coffee console right wall x82-89 y59-69. Keep at least 60 percent of the playable floor visually free for nine small live characters, no stools or loose clutter in paths. Low cutaway front wall at y88-93 with wide central opening x44-56 to bottom edge. Dark desaturated teal surrounding margin minimal 2-3%. No people, characters, pets, portraits, faces, photos, posters, text, logos, letters, numbers, labels, UI, icons, grids or watermark. Do not preserve old image composition. This is a detailed professional pixel game level, not an architectural photorealistic render.

The generated dimensions and furniture positions differ from the requested
coordinates. Integration uses measurements of the delivered image, not the
prompt's proposed geometry.

## Validation

Geometry checks traverse all sides of both benches, the central aisle, and all
activity anchors from the doorway; every sampled route segment must stay on the
floor. Blocked clicks must project to reachable ground. Browser QA uses an
isolated synthetic roster, with real generated game sprites but no production
member or wallet writes.

Local browser QA: 2048 × 1014 and 390 × 844. The full frame stays fixed while
walking; both exit controls and re-entry work. Central-aisle movement, blocked
bench clicks, and walking behind the west bench were observed. The narrow frame
is fully contained; it keeps the same view rather than enlarging/cropping the
room. Pets share the resident scale at both sizes. Keyboard movement and
reduced-motion transition handlers are unchanged; this pass exercised click
movement. All 137 remaining repository tests passed after removing the obsolete
two-view camera module and its two tests. Privacy pattern check: zero findings.
