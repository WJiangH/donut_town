# New member resident (fast path)

Use this for one named #donut-be-strangers member who should get an editable Town character. Do not read the other reference files unless a gate fails.

## 1. Fetch and inspect

```bash
node .agents/skills/donut-town-pixel-art/scripts/fetch-render-avatar.mjs "Member name"
```

View the returned `imagePath` plus `assets/donut-town-character-style-board.png`. Crop one approved front frame from `assets/residents/r-7f3a2c/walk-v1.png` if you need a style/proportion lock. Record visible hair, face, glasses/hat, clothing. Label unseen shoes/pants as an explicit proposal. Skip if the helper says the avatar is default.

## 2. Generate twice, then extract locally

Image tools return JPEG. A checkerboard or near-white preview is **not** alpha. Do not spend image-tool retries on transparency.

1. `image_edit` one full-body front sprite. Image 1 = avatar identity. Image 2 = style only. Ask for transparent alpha anyway; expect a baked backdrop.
2. Inspect identity. One focused edit is allowed for a missed invariant (for example sunglasses turned into clear glasses).
3. `image_edit` a 3×3 atlas from the approved sprite: columns step A / neutral / step B; rows down / right / up. Demand opposite arm and leg phases.
4. Extract locally:

```bash
python3 .agents/skills/donut-town-pixel-art/scripts/extract-checkerboard-alpha.py <atlas.jpg> --out /tmp/walk.png --grid 3 3
node .agents/skills/donut-town-pixel-art/scripts/validate-png-atlas.mjs /tmp/walk.png 3 3
```

Inspect the RGBA result. White clothes must survive. If the tool baked a light backdrop, the script floods from the border and the 3×3 cell edges. If it baked a checkerboard, it keys the two gray squares and stops at chromatic pixels.

## 3. Measure, split, bind

Pick a new opaque id `r-` + 6 hex. Do not put the member name in paths.

```bash
python3 .agents/skills/donut-town-pixel-art/scripts/measure-animation.py assets/residents/<id>/walk-v1.png --url /assets/residents/<id>/walk-v1.png --out characters/<id>.json
```

Add `version`, `designApproved`, and an honest `animationStatus`. Copy the measured frames into a `characters/wardrobe/<id>.regions.json` with `"split": "color-band"`, shoe `band` around 24, and a `ui` block (Shirt/Jacket labels and swatches). Then:

```bash
python3 scripts/wardrobe/build.py <id>
node scripts/bind-render-character.mjs "Member name" <id>
npm test
```

The builder must reconstruct the source PNG byte-for-byte. Color-band is for this casual silhouette only; do not claim one garment fits every member. Suit characters still use reviewed polygons.

## 4. Ship

Commit the atlas, wardrobe layers, both JSON manifests, hashed assignment, and any shared wardrobe-store/UI change. Never commit the Slack photo or raw member id. After Render deploys:

```bash
node scripts/bind-render-character.mjs "Member name" <id> --verify
```

Check the member as a local player and as another resident. Report artwork, wardrobe, and live binding separately. Open `/animation-preview.html?id=<id>` for gait QA.

## Token notes from the Wabie run

- Do not read prompting.md, production-animation.md, and workflows.md for a standard member.
- Do not ask the image tool to extract backgrounds. Two failed JPEG retries taught nothing.
- Do not flatten-then-hand-trace regions for a new casual outfit; color-band + per-foot bottoms is enough for same-silhouette shirt/shoe recolors.
- Keep slot IDs `jacket` / `shoes` / `eyewear` with the same item keys so the outfit store stays shared. Change only the `ui` labels.
