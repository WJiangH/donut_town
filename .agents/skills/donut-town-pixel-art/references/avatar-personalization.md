# Slack avatar to Donut Town resident

Use this workflow when asked to personalize a member from their Slack avatar. Keep the existing atlas as the fallback. Generate only the requested members; channel membership alone does not request a bulk generation job.

## Inputs and eligibility

- Work from a stable Slack user ID plus a user-supplied avatar image or an authorized profile source. Do not identify the person by recognizing their face.
- Inspect `slack/client.mjs` and the current member payload. At the time this workflow was added, the adapter returns `avatarUrl` but does not retain Slack's default-avatar metadata. A nonempty URL does not establish a custom avatar. Preserve a verified default/custom signal before implementing automatic eligibility; consult current Slack documentation for its field location. If eligibility is unknown, leave the fallback and report it.
- Skip Slack default avatars and absent/unreadable images. An animal, logo, drawing, or landscape may be a deliberate custom avatar; preserve its recognizable colors or motif without inventing a human likeness. Ask a focused question only if the intended interpretation matters.
- Use visible hair, glasses, clothing, colors, and silhouette as references. Do not infer personality, ethnicity, health, gender identity, or other sensitive traits. Unseen clothing and rear views are proposed design choices. Preserve a member's explicit edits.

## Generate one reusable identity

1. Inspect the avatar, `assets/donut-town-character-style-board.png`, `assets/donut-town-resident-atlas-transparent.png`, and `assets/donut-town-map-v2.png` with an image-viewing tool. List a few visible identity features and any proposed details.
2. Read [prompting.md](prompting.md). Use the available image-generation tool with the avatar as identity reference and the approved town assets as style reference. A language model can orchestrate this workflow only when an image-generation tool is available; do not promise that the model alone renders sprites.
3. First generate a single front-facing full-body neutral sprite with true transparency. Keep the cozy 16-bit palette, oversized head, and the existing residents' scale. Reuse this identity for every subsequent frame.
4. Generate a 3-column, 3-row atlas: columns step/neutral/step; rows down/right/up. Mirror the right-facing sprite for left. Preserve identity, frame padding, and foot baseline. Derive the static portrait from the neutral down frame so the portrait and walking character agree.
5. Run `node .agents/skills/donut-town-pixel-art/scripts/validate-png-atlas.mjs <atlas.png> 3 3`, then inspect frames and render over the map at Overview and Follow scales. A passing PNG validator proves structural properties only. Check facing, loop continuity, and identity visually. Follow the bounded retry rule in prompting.md.

## Save and integrate

Use versioned files under `assets/residents/<opaque-asset-id>/`. Keep original profile photos out of public static assets. Record the stable Slack ID to asset-ID mapping on the server, source revision/fingerprint, atlas columns/rows, direction order, neutral frame, and whether the member customized it. Do not overwrite an accepted identity when a profile photo changes; propose a new version.

Inspect current consumers before integrating: `personMarkup`, `playerMarkup`, `updatePlayerElement`, and `renderLivePlayers` in `app.js`, plus `.pixel-person` and `.player-character` in `styles.css`. Currently the shared resident atlas is 4 by 3 and the player atlas is 3 by 4; their background positions cannot be reused unchanged for a personal 3 by 3 atlas. A static sprite index is not a personal walking atlas. Wire the same identity into resident pins, the local player, remote players, and portraits, retaining fallback on load failure.

The member manifest and per-member rendering support are a future implementation requirement, not something this skill adds automatically. Keep generation and runtime implementation distinct in the result. Do not change invitations or send Slack messages as part of art generation.

Report assets produced, validation performed, inferred views, whether runtime integration is complete, and whether an end-to-end run was actually tested. Start with one requested member before expanding to a batch; every identity needs multiple views and QA, so cost scales beyond the initial avatar image.
