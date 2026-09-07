# Interaction poses (fast path)

Use this when an existing bound resident needs Town / Chem Pod poses, or a redraw of those poses. Do not read the other reference files unless a gate fails. Do not regenerate the walk atlas or wardrobe. Do not edit `app.js`, `town-zones.js`, `presence.mjs`, or assignments.

A batch coordinator assigns one existing `r-` id and tells the agent not to bind, commit, or deploy. Write only that id's action assets and stop. List targets with `node .agents/skills/donut-town-pixel-art/scripts/list-roster.mjs --missing-actions`.

Redraws and new poses go in `actions-v2.png`. Leave any `actions-v1.png` / `action-loops-v1.png` on disk. Point the manifest `url` at the new file.

## Skip

Report `SKIP` and write no files when any of these is true:

- `characters/<id>.json` already has `dance` and `fish` and every action `url` contains `actions-v2.png`;
- there is no walk atlas or the walk identity is not a human;
- one identity attempt cannot keep hair, face, glasses/hat, and clothing recognizable.

Do not invent a human from a pet, logo, or default silhouette. New pose ids allowed here are only `dance` and `fish`.

## Required poses

Nine ids. Coffee, Lawn, and Dance are two-frame loops; the rest are one static frame.

Do not draw the same silhouette for every resident. Run the flavor picker and follow it exactly:

```bash
python3 .agents/skills/donut-town-pixel-art/scripts/pick-action-flavor.py <id>
```

| id | facing | art |
|---|---|---|
| sitChair | down | seated. No chair. Use the flavor's sit. |
| sitGrass | down | on the ground: sit, sprawl, or lie. Frame 1 is the flavor's small idle change. No blanket. |
| garden | down | the flavor's garden beat. Handheld tool or pot only. |
| lookout | flavor `lookoutFacing` | the flavor's lookout beat. No railing. |
| read | down | the flavor's read beat, including prone-with-book when asked. |
| coffee | down | flavor rest, then sip. White cup only. |
| experiment | up | flavor lab beat. Small flask only. No bench. |
| fish | right | flavor fishing beat. Rod only. No water, dock, or fish. |
| dance | down | two distinct dance frames from the flavor. Same clothes, no stage. |

Handheld props only. No furniture, ground plane, walls, labels, or scenery. Same hair, face, glasses/hat, clothing, and head scale as the walk atlas.

## 1. Lock identity

```bash
python3 .agents/skills/donut-town-pixel-art/scripts/crop-walk-identity.py \
  assets/residents/<id>/walk-v1.png characters/<id>.json \
  --out /tmp/<id>-identity.png
python3 .agents/skills/donut-town-pixel-art/scripts/pick-action-flavor.py <id> \
  > /tmp/<id>-flavor.json
```

Inspect the crop plus `assets/donut-town-character-style-board.png`. The walk crop is the identity lock. The flavor JSON is the pose lock.

## 2. Generate two sheets, then extract locally

Image tools return JPEG. A checkerboard or black preview is **not** alpha. Do not spend image-tool retries on transparency.

1. `image_edit` a 6×1 sheet. Image 1 = identity crop. Image 2 = style board only. Cells left to right: sitChair, garden, lookout, read, experiment, fish. Put the flavor sentence for that cell in the prompt. Flat black `#000000` background. Equal cell size, equal scale, feet or body near the bottom of each cell. A prone pose may fill the cell width.
2. `image_edit` a 6×1 sheet the same way. Cells left to right: coffee rest, coffee sip, lawn A, lawn B, dance A, dance B.
3. One focused edit per sheet is allowed for a missed invariant. Do not redraw a good cell to fix a neighbor.
4. Extract locally:

```bash
python3 .agents/skills/donut-town-pixel-art/scripts/extract-checkerboard-alpha.py \
  <static.jpg> --out /tmp/<id>-static.png --grid 6 1
python3 .agents/skills/donut-town-pixel-art/scripts/extract-checkerboard-alpha.py \
  <loops.jpg> --out /tmp/<id>-loops.png --grid 6 1
node .agents/skills/donut-town-pixel-art/scripts/validate-png-atlas.mjs /tmp/<id>-static.png 6 1
node .agents/skills/donut-town-pixel-art/scripts/validate-png-atlas.mjs /tmp/<id>-loops.png 6 1
```

Inspect RGBA over a bright background. White shirts and black suits must survive. If a sheet is unusable, generate that one pose as a single sprite on black and compose it in. Do not use largest-component or “drop dark gray” mattes.

## 3. Compose one v2 atlas and write the manifest

```bash
python3 .agents/skills/donut-town-pixel-art/scripts/split-atlas-cells.py \
  /tmp/<id>-static.png --grid 6 1 --out /tmp/<id>-cells
python3 .agents/skills/donut-town-pixel-art/scripts/split-atlas-cells.py \
  /tmp/<id>-loops.png --grid 6 1 --out /tmp/<id>-loop-cells
python3 .agents/skills/donut-town-pixel-art/scripts/compose-action-atlas.py \
  --out assets/residents/<id>/actions-v2.png \
  --url /assets/residents/<id>/actions-v2.png \
  --cols 6 --cell 280 360 \
  --manifest /tmp/<id>-v2.json \
  /tmp/<id>-cells/0.png /tmp/<id>-cells/1.png /tmp/<id>-cells/2.png \
  /tmp/<id>-cells/3.png /tmp/<id>-cells/4.png /tmp/<id>-cells/5.png \
  /tmp/<id>-loop-cells/0.png /tmp/<id>-loop-cells/1.png /tmp/<id>-loop-cells/2.png \
  /tmp/<id>-loop-cells/3.png /tmp/<id>-loop-cells/4.png /tmp/<id>-loop-cells/5.png
python3 .agents/skills/donut-town-pixel-art/scripts/apply-action-manifest.py \
  characters/<id>.json --v2 /tmp/<id>-v2.json --flavor /tmp/<id>-flavor.json
node .agents/skills/donut-town-pixel-art/scripts/validate-png-atlas.mjs \
  assets/residents/<id>/actions-v2.png 6 2
```

`apply-action-manifest.py --v2` owns loop order, `frameMs`, and the nine ids. Keep walk frames, wardrobe, and the walk `url` untouched. Do not edit `town-zones.js`.

Inspect every cell at native size. Reject a sheet that changes identity, clips the head/hands, or leaves baked backdrop between limbs. Two dance frames must be different poses, not a duplicate.

## 4. Stop unless this run owns shipping

If the coordinator said not to bind, stop after the manifest validates. Leave `characters/assignments.json` untouched. Do not commit or deploy.

Otherwise the coordinator commits every ready id in one deploy. `npm test` must load the catalog.

Report `READY` or `SKIP`, the id, and the sitGrass / dance flavors used.

## Token notes

- Do not read prompting.md, production-animation.md, member-pipeline.md, or workflows.md for a standard action pass.
- Do not ask the image tool to extract backgrounds.
- Actions are a separate flattened atlas. Sitting, lying, and dancing change the silhouette, so do not add them as wardrobe layers.
- Coffee / Lawn: rest, rest, rest, act, act, rest. Dance: A, B, A, B.
