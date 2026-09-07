---
name: donut-town-pixel-art
description: Generate, validate, and integrate Donut Town pixel residents, directional walk cycles, interaction poses, and cosmetic Donut rewards from approved character or town artwork. Use for Slack-avatar personalization, new resident sprites, sit/garden/coffee/read/lookout/lab actions, animation atlases, art consistency fixes, or the related asset workflow; do not use for Slack messaging logic or general frontend changes without pixel-art work.
---

# Donut Town Pixel Art

Produce game-ready pixel characters that remain visually consistent with the approved Donut Town map and character direction.

## Reality check

A single character image provides identity and visual style, but it does not contain hidden views or motion. Generated side and back views are inferred and must be reviewed. Treat one-shot output as a draft until direction, identity, loop continuity, transparency, and in-map scale are verified.

The preferred production contract is three frames for each of three source directions: down, side, and up. Mirror the side row in code for the opposite direction. Use a four-row atlas only when distinct left and right artwork is important and both directions pass visual review.

## Slack avatar personalization

For one named channel member, or a batch of members, read only [references/member-pipeline.md](references/member-pipeline.md). That is the token-cheap path: skip ineligible avatars, two image calls, local background extraction, color-band wardrobe. Do not load the other reference files unless a gate fails.

Keep the shared default atlas for default Slack avatars, non-human custom images, and likenesses that fail after one identity attempt. For a batch, spawn one agent per remaining member, pre-assign unique `r-` ids, and have agents write assets only. The parent binds and deploys once.

For unusual cases (preview-only, walk-cycle repair, or a non-casual silhouette) read [references/avatar-personalization.md](references/avatar-personalization.md). Start with a member name; no uploaded PNG is required.

## Interaction poses

When asked to add sit, garden, coffee, read, lookout, or lab poses to an existing resident, read only [references/action-pipeline.md](references/action-pipeline.md). That is the token-cheap path: two sheets, local extraction, compose scripts. Do not load the other reference files unless a gate fails.

For a batch, spawn one agent per assigned character that is missing the seven action ids. Agents write that id's action assets only. The parent validates and deploys once.

## Production animation

When asked to continue a preview into walking or production animation, follow [references/production-animation.md](references/production-animation.md). Complete the transparent atlas, measured frame manifest and interactive animation QA; an existing static preview is the input, not the deliverable.

## Layered characters and equipment

New casual residents use the color-band wardrobe in the member pipeline. Keep slot IDs `jacket` / `shoes` / `eyewear` and change only the `ui` labels. For suit-style polygon splits or a new slot shape, read [references/layered-wardrobe.md](references/layered-wardrobe.md). Each rig is independent; do not claim one garment fits every member.

## Bind and verify a Town character

For a requested character replacement in Town, complete the binding and deployment steps in [avatar-personalization.md, section 4](references/avatar-personalization.md#4-integrate-a-stable-identity). Use `scripts/bind-render-character.mjs` from the project root to bind with Render’s `characterKey`, then run its `--verify` mode after an authorized deployment. A generated PNG or standalone preview does not complete a Town replacement. Report artwork readiness and live binding status separately. Preview-only requests remain preview-only.

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
- Default Slack avatars and non-human custom images stay on the shared Town atlas.
