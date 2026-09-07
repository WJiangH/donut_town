# Donut Home rooms

Everyone starts in Cozy Cottage with the same free chair, lamp, and rug. Buy Modern Loft (12 donuts) or Moonlight Suite (18 donuts) in **Shop → Rooms**, then choose it with **My Home → Room**. Switching rooms keeps furniture and Luxury unchanged. Only placed decorations contribute Luxury.

Decorate mode supports drag and drop, selecting an item then clicking the floor, and quarter-cell arrow-key nudges (Shift + arrow moves one full cell). Done decorating returns to walking. The clear floor near the back wall is usable; wall surfaces are not furniture slots.

## Adding another room

Keep architecture separate from live furniture and residents. Use `.agents/skills/donut-town-interiors/SKILL.md` with an approved empty Home as the reference, never a real member photo. The two current prompts and geometry are recorded in `assets/homes/provenance.json`.

- Canvas: 1536 × 1024, three-quarter pixel art, complete room frame and bottom-center doorway.
- Shared floor: x 12–88%, y 34–80%. Keep the same geometry so existing layouts remain valid.
- Layout: 14 × 9 logical units, with quarter-unit placement. Furniture footprints are checked server-side; walking uses the same footprints on a finer grid.
- Add a `kind: "room"`, `category: "rooms"` catalog item with an immutable full PNG path and a small thumbnail. Store backgrounds in `assets/homes/` with content-hashed names. The shop uses only thumbnails; Home decodes the chosen background before switching.
- Room ownership is enforced by `/api/house`. An unavailable saved room falls back to the cottage without discarding furniture. Do not grant rooms through client state.

Validate buying, insufficient funds, an unowned room save, switching both directions, persistence after reopening, quarter-cell placement and overlap, walking, and desktop/mobile exit controls. Preview against isolated accounts and storage; do not spend a real member's donuts for automated QA.
