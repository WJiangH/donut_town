# New member resident (fast path)

Use this for one named #donut-be-strangers member who should get an editable Town character. Do not read the other reference files unless a gate fails.

A batch coordinator may assign a unique `r-` + 6 hex id and tell the agent not to bind, commit, or deploy. In that mode, write only that id's assets and stop. The coordinator binds every ready id, then deploys once.

## Skip instead of inventing

Keep the shared default Town atlas when any of these is true. Write no files and report `SKIP` with the reason:

- the fetch helper says the member uses a default Slack avatar, or the URL is Gravatar / `ava_00` artwork;
- the custom image is not a photograph or drawing of a human (pets, logos, landscapes, cartoons of animals, objects, text-only);
- the face is too small, occluded, filtered, or otherwise too hard to extract a stable likeness after one identity attempt.

Do not invent a human body from a cat, logo, or default silhouette. Already-bound members stay on their current character unless the user asked to replace that one person.

## 1. Fetch and inspect

For a batch, the coordinator may first run `node .agents/skills/donut-town-pixel-art/scripts/list-roster.mjs` to drop default avatars and already-bound members. For interaction poses on existing residents, use `--missing-actions` and [action-pipeline.md](action-pipeline.md).

```bash
node .agents/skills/donut-town-pixel-art/scripts/fetch-render-avatar.mjs "Member name"
```

View the returned `imagePath` plus `assets/donut-town-character-style-board.png`. Crop one approved front frame from `assets/residents/r-7f3a2c/walk-v1.png` if you need a style/proportion lock. Record visible hair, face, glasses/hat, clothing. Label unseen shoes/pants as an explicit proposal. Apply the skip rules above before any image call.

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

## 4. Bind only when this run owns shipping

If the coordinator said not to bind, stop after a passing `build.py` and `npm test` (or the wardrobe tests). Leave `characters/assignments.json` untouched.

Otherwise bind, then deploy with every other ready character in the same commit:

```bash
node scripts/bind-render-character.mjs "Member name" <id>
node scripts/bind-render-character.mjs "Member name" <id> --verify
```

Never commit the Slack photo or raw member id. Report `READY` or `SKIP`, the id, and any animation limitation. Open `/animation-preview.html?id=<id>` for gait QA.

## Token notes

- Do not read prompting.md, production-animation.md, or workflows.md for a standard member.
- Do not ask the image tool to extract backgrounds.
- Color-band shirt detection is sage-green only. Non-sage clothes still ship; navy/olive jacket variants may be empty. Do not restyle a navy coat into sage just to make recolors work unless the photo is only a headshot.
- Keep slot IDs `jacket` / `shoes` / `eyewear`. Change only the `ui` labels.
