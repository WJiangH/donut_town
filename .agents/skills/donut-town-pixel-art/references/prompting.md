# Pixel-art generation prompts

Use the built-in image-generation tool unless the user explicitly requests a different path. Supply the approved character image as the identity reference and the town map as the style, camera, lighting, palette, and pixel-density reference.

## Before prompting

Write down the invariants that cannot drift:

- character identity and silhouette;
- hair, face, glasses, clothing, and colors;
- equal sprite scale and foot baseline;
- atlas columns, rows, and direction order;
- transparent background and no ground shadow;
- no text, grid lines, scenery, or cell overlap.

Do not ask a single source image to prove unseen details. Side and back views are model proposals that require visual approval.

## Static resident atlas

Use a strict equal-cell grid. Ask for one centered, full-body resident per cell, the same scale and camera angle, generous padding, and transparent alpha. Specify the exact number of residents and forbid large props that cross cell boundaries.

## Recommended walk atlas

Use a 3-column by 3-row layout:

- columns: left step, neutral passing pose, right step;
- row 1: facing down;
- row 2: one side view;
- row 3: facing up.

Ask for the same person in every frame. Require identical hair, glasses, clothing, proportions, outline weight, lighting, and palette. The side row can be mirrored in code to produce the fourth direction.

If distinct left and right views matter, request a 3-column by 4-row atlas ordered down, left, right, up. Reject it when either side faces the wrong way or identity changes between rows.

## Prompt skeleton

```text
Use case: stylized-concept
Asset type: production pixel-art walk-cycle atlas
Input images: Image 1 is the exact character identity reference. Image 2 is the town style and camera reference only.
Primary request: Create a strict <columns>-column by <rows>-row atlas for one character.
Layout: <state the exact frame and direction order>.
Consistency: preserve <list identity invariants> in every frame. Equal cell size, equal scale, and aligned feet.
Style: crisp handcrafted 16-bit pixel art with hard edges and the same map perspective.
Background: genuine transparent alpha.
Constraints: no checkerboard, ground shadow, labels, grid, scenery, text, watermark, or cell overlap.
```

## Transparency retry

If the output contains a baked checkerboard, use background extraction on that atlas. State that the atlas is the edit target, change only the background, preserve every frame and pixel-art edge, and require genuine transparent alpha around and between all frames.

Do not trust the preview alone. Run the validator and inspect the result over the actual map. If a transparency-only retry redraws the character or adds a colored backdrop, reject it and retry once with narrower invariants. Stop after two materially failed retries and report the blocker instead of silently accepting drift.
