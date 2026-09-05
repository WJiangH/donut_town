# Donut Town art workflows

## Integrate a CSS atlas

For a grid with `C` columns and `R` rows:

```css
.sprite {
  background-size: calc(C * 100%) calc(R * 100%);
  background-position: var(--frame-x) var(--direction-y);
  image-rendering: pixelated;
}
```

CSS background positions refer to the remaining travel distance, so evenly spaced positions are:

- three columns: `0%`, `50%`, `100%`;
- three rows: `0%`, `50%`, `100%`;
- four rows: `0%`, `33.333%`, `66.667%`, `100%`.

For the preferred down/side/up atlas, mirror only the sprite element for the opposite side. Do not mirror its name label, status badge, or interaction UI.

Use a neutral frame while idle. While moving, cycle through the three frames at roughly 110-160 ms per frame. Keep movement speed independent of frame rate and normalize diagonal movement.

## Map placement and movement

- Place the image and all residents inside the same aspect-ratio world container.
- Store positions in map coordinates rather than viewport coordinates.
- Define walkable areas and obstacles separately from visual placement.
- Clicking outside a walkable area may snap to the nearest path, but the UI should not claim free movement.
- Keep NPC positions deterministic. Random placement without terrain awareness can put residents on roofs, water, or gardens.

## Browser QA

Check these observable behaviors:

1. The correct atlas loads and has a real transparent background.
2. Down, side, mirrored side, and up are visually distinct.
3. Holding a key creates continuous movement; a tap produces a short step.
4. Click-to-walk reaches the target without crossing the fountain or buildings.
5. The neutral frame returns after movement stops.
6. The player and residents remain aligned when the viewport changes.
7. The profile portrait and map identity match.
8. No console errors appear.

State whether desktop, mobile, or both were tested. A single local character does not validate multiplayer synchronization.

## Stable Slack-to-character assignment

When Slack integration is added:

1. Read the channel member's stable Slack user ID and allowed profile fields.
2. Derive a stable appearance seed from the user ID, not from request order.
3. Choose defaults from approved skin, hair, clothing, and accessory layers.
4. Store the assignment so code or palette changes do not silently replace the resident.
5. Let the member edit the generated character and preserve that choice.

Channel membership may initialize a resident, but it does not justify inferring sensitive attributes from a profile photo. Use photos only as an explicit user-provided style reference.

## Planned reusable workflows

- Generate or replace a static resident batch.
- Create a directional walk atlas from an approved character.
- Add a cosmetic Donut box, backpack, cart, or house decoration.
- Repair transparency without changing character identity.
- Validate and integrate an atlas into the current web prototype.
- Materialize stable default residents from Slack channel membership.
