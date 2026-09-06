---
name: donut-town-pixel-art
description: Generate, validate, and integrate Donut Town pixel residents, directional walk cycles, and cosmetic Donut rewards from approved character or town artwork. Use for Slack-avatar personalization, new resident sprites, animation atlases, art consistency fixes, or the related asset workflow; do not use for Slack messaging logic or general frontend changes without pixel-art work.
---

# Donut Town Pixel Art

Produce game-ready pixel characters that remain visually consistent with the approved Donut Town map and character direction.

## Reality check

A single character image provides identity and visual style, but it does not contain hidden views or motion. Generated side and back views are inferred and must be reviewed. Treat one-shot output as a draft until direction, identity, loop continuity, transparency, and in-map scale are verified.

The preferred production contract is three frames for each of three source directions: down, side, and up. Mirror the side row in code for the opposite direction. Use a four-row atlas only when distinct left and right artwork is important and both directions pass visual review.

## Slack avatar personalization

For turning a custom Slack avatar into a persistent resident identity, read [references/avatar-personalization.md](references/avatar-personalization.md). It covers default-avatar eligibility, generation, current renderer contracts, fallback, and member edits.

## Workflow

1. Inspect the source character and the current town map. Record identity invariants such as hair, face, glasses, clothing, palette, proportions, and pixel density.
2. Decide whether the task needs a concept board, static resident atlas, walk-cycle atlas, or an integration-only change.
3. For image generation or a failed-background retry, read [references/prompting.md](references/prompting.md).
4. Generate with genuine transparent alpha requested explicitly. Never assume a visible checkerboard means transparency.
5. Run `node scripts/validate-png-atlas.mjs <png> <columns> <rows>` on every final atlas.
6. Inspect the atlas visually at original resolution. Check identity, direction, foot baselines, cell boundaries, and animation continuity.
7. For CSS/JavaScript integration or browser QA, read [references/workflows.md](references/workflows.md).
8. Test the character over the actual town map at desktop and mobile sizes. Verify movement, collision, direction changes, reduced-motion behavior, and browser errors.

## Required distinctions

- A style board is approval material, not a production spritesheet.
- A static resident atlas does not prove walk animation quality.
- Alpha-channel metadata does not prove that every background pixel is transparent; inspect corner alpha and the rendered result.
- A smooth moving element without changing frames is sliding, not walking.
- Local movement proves only the client interaction. Multiplayer presence requires server-side state synchronization.

## Project conventions

- Keep approved and production assets under `assets/` with descriptive names.
- Keep discarded or checkerboard-baked intermediates out of Git.
- Preserve the approved cozy 16-bit look, restrained palette, and slightly oversized heads.
- Donut rewards are cosmetic. They must not imply social rank or change invitation priority.
- Use stable character assignments for Slack members. Do not regenerate a person's appearance on every page load.
- Do not infer sensitive personal attributes from a Slack photo. Auto-generated defaults should be editable by the member.
