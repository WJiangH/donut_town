# Layered characters and local wardrobe edits

Use when a user requests reversible accessories, shoes, clothing variants, or a character prepared for future shopping. Read this before generating a new personalized resident intended for equipment. Keep identity generation separate from equipment production. Previewing clothing does not implement purchases, ownership or server persistence.

## Working implementation

- `characters/wardrobe/r-7f3a2c.regions.json`: reviewed regions for a legacy atlas, including shoe polygons, jacket material bounds/exclusions and sunglass lenses. These coordinates belong to this character only.
- `scripts/wardrobe/build.py`: deterministic local pixel split and same-silhouette palette variants. Requires Pillow. Use local pixel editing only when authorized by the user and permitted by the active image tool rules; that was the explicitly accepted workflow for this prototype. Never infer permission to use arbitrary image editing tools from this reference alone.
- `characters/wardrobe/r-7f3a2c.json`: rig version, common frame rectangles, base, required slots, optional slots, default items and layer order.
- `characters/wardrobe/renderer.mjs`: shared compositing renderer. It selects one image per required slot, preserves crop/scale across all layers, and mirrors the entire composite for left.
- `#profileWardrobe` in `index.html`, mounted by `profile-wardrobe.mjs`: compact English wardrobe inside the member’s own Slack profile, below My donuts. Includes eyewear, jacket/shoe swatches, four directions, walking and reset. Keep the Slack photo above it. There is no separate navigation entry; `/wardrobe.html` redirects to `/?profile=1` for old links. Selection persists only in this browser under the opaque character key, not as a shared Town equipment setting.

## Character construction contract

1. Establish and approve the character identity first. Reuse the accepted face/hair pixels for later equipment changes. Do not regenerate the whole resident for sunglasses or another shoe color.
2. Assign a versioned rig. Within a rig, all layers share atlas dimensions, frame count/order, source rectangles, feet baselines and crop origins. Publish compatibility by rig, never assume identical canvas size means identical anatomy. The existing prototype is a single-character rig; it does not demonstrate one garment fits all members.
3. For new assets, create the fixed identity/body and removable garments separately from the start. Plan face/eye, neck, wrist and ankle anchors for each frame, and direction-dependent occlusion. Do not ask a single generated composite PNG to contain hidden layers. If a new body template is introduced, validate at least two characters against it before calling its equipment reusable.
4. For an existing flattened image, use reviewed material masks to separate visible pixels losslessly. Where an old garment was removed, underlying anatomy is unknown: either require replacement garments that completely cover those cutouts, or deliberately produce and review a hidden base. Never call a cutout base a complete unclothed body. The prototype requires jacket and shoe layers and supports the original silhouette only.
5. Separate the item from its equipped state. Item IDs refer to immutable, versioned visual assets; outfits select IDs by slot. Required slots always have valid defaults. Unknown saved items fall back to defaults. Do not accept user-provided asset URLs as equipment IDs. Use explicit replacement/coverage rules for longer coats, skirts, boots and other silhouette changes; do not claim recoloring implements those changes.
6. Sunglasses must track the eyes in every forward/side frame and be hidden behind the head in back frames. Existing prescription frames may be retained with replaceable lenses; label that accurately. Shoes and clothes need every visible pose, not just a front preview. Mirror all equipment with the body, not independently.

## Verification gates

Run the builder for the reviewed prototype:

```bash
python3 scripts/wardrobe/build.py
npm test
```

The build verifies pixel-exact reconstruction from original parts, unchanged alpha for palette variants, and edits confined to approved clothing/shoe regions. Also inspect all nine poses: region arithmetic alone does not prove a mask follows the garment boundary. Keep skin, hands, shirt and tie outside jacket material changes. Check glasses align and back frames have no lenses.

For every new rig or item, verify the original outfit matches the original PNG, protected identity pixels remain unchanged outside the intentional accessory area, equipment does not leak old garment edges, no crop clips the item, and default/reset restores the original. Exercise every slot, all directions, walking/idle, browser reload, invalid saved choices, failed asset load, small in-map scale and desktop/mobile views. A passing legacy reconstruction does not fix repeated original walk poses.

## Skill handoff and delivery

Deliver the generated-only layers, rig/slot manifest, reviewed masks or anchors, a reproducible build where appropriate, interactive fitting-room preview and QA evidence. Explain which changes are palette-only, which change shapes, and which rigs are supported. Keep the source photograph, raw Slack ID and private provenance out of Git.

When the user requests Town equipment integration, additionally connect authenticated member equipment state to the renderer and verify what another member sees. Use the existing Render-derived member binding workflow in `avatar-personalization.md`; publishing a fitting-room page alone does not equip the Town character. Do not infer authorization for wallet, purchasing or deployment from a local fitting-room request.
