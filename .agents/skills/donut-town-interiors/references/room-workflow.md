# Room generation and integration

Use this reference for every new Pod interior or material room redesign.

## Room brief

Record these inputs before generating:

| Field | Decision |
| --- | --- |
| Pod name | User-facing building name |
| Purpose | What members do or discuss here |
| Hero object | One instantly recognizable central feature |
| Supporting equipment | Three to six themed object groups |
| Accent palette | Two or three colors layered onto the town palette |
| Entrance | Door edge and clear arrival area |
| Interaction points | Tables, chairs, stations, displays, or counters |
| Walk paths | Connected routes between entrance and interaction points |

If a Pod name is organizational rather than scientific, ask what the team actually does instead of inferring equipment from the label.

## Generation prompt template

Replace bracketed values while preserving the constraints that make the image usable in the game.

```text
Use case: stylized-concept
Asset type: production game background for an enterable Donut Town building interior
Input images: The town image is a style, camera, lighting, palette, scale, and pixel-density reference only. Do not copy its outdoor composition.

Create the interior of [POD NAME], a friendly [PURPOSE] space, in the same cozy handcrafted 16-bit pixel-art style and top-down three-quarter game perspective.

Scene: one complete rectangular room filling a 3:2 landscape canvas. Include [HERO OBJECT] and [SUPPORTING EQUIPMENT]. Use [ACCENT PALETTE] with warm wood, cream stone, plants, and practical lights consistent with Donut Town.

Composition: room boundaries fully visible; a clear [ENTRANCE LOCATION] doorway; broad unobstructed arrival floor; generous connected walking lanes around furniture; furniture arranged as discrete collision islands.

Constraints: no people, characters, animals, text, signs, letters, labels, UI, watermark, grid overlay, exterior scenery, cropped walls, or furniture blocking the entrance. Crisp pixel edges, cohesive scale, production-ready game background.
```

Recommended production canvas: 1536 × 1024 PNG. Other 3:2 resolutions are acceptable when they match the existing scene renderer.

## Theme examples

These are starting points, not fixed definitions.

- Chem Pod: central wet bench, glassware, fume hood, microscope, sample cabinets; sage, teal, muted coral, and brass.
- Physical Pod: central instrument or build table, measurement rigs, material samples, tool storage, and display stands; steel blue, amber, cream, and warm wood.
- Bio Pod: central microscopy bench, incubator or culture station, specimen storage, sinks, and abundant plants; botanical green, aqua, cream, and soft coral.

Confirm the user's actual meaning before using a themed example.

## Visual QA

Inspect the final PNG at original size and confirm:

- the doorway is visible and unobstructed;
- the floor forms one connected region;
- foreground and background have enough human-scale furniture to anchor the resident sprite without leaving a large showroom-like void;
- furniture reads as separate collision islands;
- any bulletin board or gallery intended for live content has a blank rectangular inset rather than baked text or people;
- no people, text, watermark, or baked UI are present;
- perspective, scale, palette, lighting, and pixel density match the town;
- the player sprite remains readable against both light and dark floor areas.

## Integration contract

- Background: one `<img>` or canvas layer that owns no live state.
- Interaction layer: accessible entrance, exit, and station controls above the image.
- Character layer: player and verified occupants above the background.
- Content layer: announcements, team portraits, and event copy loaded separately from the PNG so they can change without regenerating the room.
- Geometry: normalized 0–100 coordinates so collision survives responsive scaling.
- Navigation: direct entry on the Enter control. Walking toward a doorway may be decorative, but a pathfinding failure must not suppress the scene change.
- Scene state: store one player position per scene and restore it when returning.
- Motion: use a short transition and honor `prefers-reduced-motion`.

Start collision with broad rectangles or ellipses around large furniture. Tune against observed sprite feet, not the character's full visual bounding box.

## Functional QA

1. Click Enter from multiple player positions and confirm every click changes scenes.
2. Enter repeatedly and confirm duplicate clicks cannot leave the transition overlay stuck.
3. Walk around every side of the hero object and confirm furniture cannot be crossed.
4. Click blocked furniture and confirm the player stops at a nearby valid floor point.
5. Exit using both the room door and the toolbar control.
6. Repeat at desktop and narrow viewport sizes.
7. Confirm reduced-motion users get an immediate transition.
8. Confirm the production asset returns successfully from the deployed URL.

State explicitly whether QA was code-level, local-browser, or deployed-browser testing.
