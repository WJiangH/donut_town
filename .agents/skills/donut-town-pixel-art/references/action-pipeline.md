# Interaction poses (fast path)

Use this when an existing bound resident needs Town / Chem Pod poses. Do not read the other reference files unless a gate fails. Do not regenerate the walk atlas or wardrobe.

A batch coordinator assigns one existing `r-` id and tells the agent not to bind, commit, or deploy. Write only that id's action assets and stop. List targets with `node .agents/skills/donut-town-pixel-art/scripts/list-roster.mjs --missing-actions`.

## Skip

Report `SKIP` and write no files when any of these is true:

- `characters/<id>.json` already has all seven action ids below;
- there is no walk atlas or the walk identity is not a human (keep the default Town atlas);
- one identity attempt cannot keep hair, face, glasses/hat, and clothing recognizable.

Do not invent a human from a pet, logo, or default silhouette. Do not add new action ids.

## Required poses

Seven ids. Coffee and Lawn are two-frame loops; the rest are one static frame.

| id | facing | art |
|---|---|---|
| sitChair | down | seated, knees forward, hands on thighs. No chair. |
| sitGrass | down | frame 0: sit on the ground, hands on knees, face the camera. frame 1: same sit, head turned to one side. |
| garden | down | kneel or crouch with a small trowel or pot. No garden bed. |
| lookout | right | stand in a right-facing side or 3/4 view, looking out. No railing. |
| read | down | hold an open book, head tilted toward it. |
| coffee | down | frame 0: white cup at chest/waist. frame 1: cup at the mouth, sipping. |
| experiment | up | back or 3/4-back, small flask or beaker in hand. No bench. |

Handheld props only. No furniture, ground plane, walls, labels, or scenery. Same hair, face, glasses/hat, clothing, and head scale as the walk atlas.

## 1. Lock identity

```bash
python3 .agents/skills/donut-town-pixel-art/scripts/crop-walk-identity.py \
  assets/residents/<id>/walk-v1.png characters/<id>.json \
  --out /tmp/<id>-identity.png
```

Inspect that crop plus `assets/donut-town-character-style-board.png`. Record hair, face, glasses/hat, clothing. The walk crop is the identity lock.

## 2. Generate two sheets, then extract locally

Image tools return JPEG. A checkerboard or black preview is **not** alpha. Do not spend image-tool retries on transparency.

1. `image_edit` a 5×1 sheet. Image 1 = identity crop. Image 2 = style board only. Cells left to right: sitChair, garden, lookout, read, experiment. Flat black `#000000` background. Equal cell size, equal scale, feet near the bottom of each cell.
2. `image_edit` a 4×1 sheet the same way. Cells left to right: coffee rest, coffee sip, lawn sit, lawn look-aside.
3. One focused edit per sheet is allowed for a missed invariant. Do not redraw a good cell to fix a neighbor.
4. Extract locally (auto-detects black / checker / light):

```bash
python3 .agents/skills/donut-town-pixel-art/scripts/extract-checkerboard-alpha.py \
  <static.jpg> --out /tmp/<id>-static.png --grid 5 1
python3 .agents/skills/donut-town-pixel-art/scripts/extract-checkerboard-alpha.py \
  <loops.jpg> --out /tmp/<id>-loops.png --grid 4 1
node .agents/skills/donut-town-pixel-art/scripts/validate-png-atlas.mjs /tmp/<id>-static.png 5 1
node .agents/skills/donut-town-pixel-art/scripts/validate-png-atlas.mjs /tmp/<id>-loops.png 4 1
```

Inspect RGBA over a bright background. White shirts and black suits must survive. If a sheet is unusable, generate that one pose as a single sprite on black and compose it in. Do not use largest-component or “drop dark gray” mattes; they delete charcoal clothes.

## 3. Compose and write the manifest

```bash
python3 .agents/skills/donut-town-pixel-art/scripts/split-atlas-cells.py \
  /tmp/<id>-static.png --grid 5 1 --out /tmp/<id>-cells
python3 .agents/skills/donut-town-pixel-art/scripts/split-atlas-cells.py \
  /tmp/<id>-loops.png --grid 4 1 --out /tmp/<id>-loop-cells
python3 .agents/skills/donut-town-pixel-art/scripts/compose-action-atlas.py \
  --out assets/residents/<id>/actions-v1.png \
  --url /assets/residents/<id>/actions-v1.png \
  --cols 5 --cell 280 360 \
  --manifest /tmp/<id>-static.json \
  /tmp/<id>-cells/0.png /tmp/<id>-cells/1.png /tmp/<id>-cells/2.png \
  /tmp/<id>-cells/3.png /tmp/<id>-cells/4.png
python3 .agents/skills/donut-town-pixel-art/scripts/compose-action-atlas.py \
  --out assets/residents/<id>/action-loops-v1.png \
  --url /assets/residents/<id>/action-loops-v1.png \
  --cols 4 --cell 240 360 \
  --manifest /tmp/<id>-loops.json \
  /tmp/<id>-loop-cells/0.png /tmp/<id>-loop-cells/1.png \
  /tmp/<id>-loop-cells/2.png /tmp/<id>-loop-cells/3.png
python3 .agents/skills/donut-town-pixel-art/scripts/apply-action-manifest.py \
  characters/<id>.json /tmp/<id>-static.json /tmp/<id>-loops.json
node .agents/skills/donut-town-pixel-art/scripts/validate-png-atlas.mjs \
  assets/residents/<id>/actions-v1.png 5 1
node .agents/skills/donut-town-pixel-art/scripts/validate-png-atlas.mjs \
  assets/residents/<id>/action-loops-v1.png 4 1
```

`apply-action-manifest.py` owns loop order, `frameMs`, and facings. Do not hand-edit those fields. Keep walk frames, wardrobe, and `url` untouched.

Inspect every cell at native size. Reject a sheet that changes identity, clips the head/hands, or leaves baked backdrop between limbs.

## 4. Stop unless this run owns shipping

If the coordinator said not to bind, stop after the manifest validates. Leave `characters/assignments.json` untouched. Do not commit or deploy.

Otherwise the coordinator commits every ready id in one deploy. `npm test` must load the catalog.

Report `READY` or `SKIP`, the id, and any pose that stayed static because a loop frame failed.

## Token notes

- Do not read prompting.md, production-animation.md, member-pipeline.md, or workflows.md for a standard action pass.
- Do not ask the image tool to extract backgrounds.
- Actions are a separate flattened atlas. Sitting and kneeling change the silhouette, so do not add them as wardrobe layers.
- Coffee / Lawn loops: rest, rest, rest, act, act, rest. Other poses stay one frame.
