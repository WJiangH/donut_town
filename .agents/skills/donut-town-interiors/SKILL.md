---
name: donut-town-interiors
description: Design, generate, validate, and integrate enterable pixel-art interiors for Donut Town buildings such as Chem Pod, Physical Pod, and Bio Pod. Use for new Pod rooms, room art consistency, door transitions, walkable floors, or furniture collision; do not use for Slack messaging or character sprite creation.
---

# Donut Town Interiors

Create reusable, game-like building interiors that feel native to the approved Donut Town map.

## Reality check

An interior background does not contain game behavior. Treat the room as three separate layers:

1. Raster background art.
2. Normalized walkable and blocked geometry maintained in code.
3. Live characters and interactions rendered above the background.

Do not claim that generated furniture automatically supplies collision, that a visible character is online without presence data, or that a scene transition proves multiplayer behavior.

## Workflow

1. Inspect the current town map, one approved resident sprite, and any existing Pod interior at original resolution.
2. Define the Pod's purpose, signature equipment, palette accents, entrance location, interaction points, and required floor paths.
3. Read [references/room-workflow.md](references/room-workflow.md) before generating or integrating a room.
4. Use the existing town only as a style, camera, lighting, scale, and pixel-density reference. Do not reproduce its outdoor composition.
5. Generate the background without people, labels, UI, or baked interaction markers. Keep a clear bottom-center entrance unless the existing building requires another orientation.
6. Save approved production art as `assets/<pod-slug>-interior.png`. Keep failed drafts and intermediate generations out of Git.
7. Implement the room as a distinct scene. Door buttons must respond immediately; optional character approach animation must never block entry.
8. Define walkability and collision separately in normalized 0–100 coordinates. Use a few maintainable furniture islands rather than tracing every pixel.
9. Verify entry, exit, keyboard and click movement, collision, mobile framing, reduced motion, and asset loading over the actual application.

## Consistency rules

- Preserve the cozy 16-bit look, warm practical lighting, readable silhouettes, and top-down three-quarter perspective.
- Keep the complete room boundary visible and preserve generous connected walking lanes.
- Use one visual hero object per Pod and restrained thematic details; the room should remain readable as a game map.
- Keep residents and activity animations out of the background so live state can position them correctly.
- Add occupants only from real application state. Empty rooms are preferable to fake presence.
- Reuse scene and collision code before adding another frontend framework or map engine.

## Completion report

Report the production asset path, final generation prompt, generation mode, collision assumptions, observable QA performed, and any behavior that remains simulated.
