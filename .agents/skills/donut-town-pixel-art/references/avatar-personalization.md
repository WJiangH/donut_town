# Slack avatar to Donut Town resident

Use for one requested member or an explicitly requested batch. Keep unassigned members on the shared atlas. A language model, including Luna, coordinates the tools; it cannot supply production art without an available image-generation tool. Do not claim Luna was tested unless an actual run was performed.

## 1. Identify and gather references

For a named member, start with the deployed Render member API, not a user-supplied image:

```bash
node .agents/skills/donut-town-pixel-art/scripts/fetch-render-avatar.mjs "Member name"
```

The helper reads `STAGING_PASSWORD` from the ignored project `.env.local` and calls `https://donut-town.onrender.com/api/slack/members` using HTTP Basic authentication (username `donut`). Never print the password or authentication header. If missing or HTTP 401, ask the user to configure the existing Render password locally; do not make the endpoint public or invent a session. Do not ask for an input PNG when the member name is sufficient.

The helper resolves an unambiguous exact or partial display/real name. If multiple members match, use a full name; never choose by face recognition. It downloads the returned `avatarUrl` to a private temporary directory and reports `imagePath` plus `metadataPath`. Keep both outside Git. The source may actually be JPEG or WebP; use the returned path rather than renaming its extension to PNG. The generated character output is PNG.

The current Render payload omits the default-avatar flag. In that case the helper uses the existing local Slack Bot only to verify that member's `profile.is_custom_image`, while retaining the Render-returned URL as the image source. If the flag is unavailable or false, skip generation. This fallback must be reported honestly; do not claim all metadata came from Render. If the endpoint later supplies `avatarIsCustom`/`isCustomAvatar`, the helper uses it directly.

For "my character" without a supplied name, resolve the caller with the Slack read-user-profile tool first, then invoke the helper with the full member name. Read only the needed member information and do not send messages.

View the avatar, `assets/donut-town-character-style-board.png`, `assets/donut-town-resident-atlas-transparent.png`, and `assets/donut-town-map-v2.png`. Label inputs explicitly: the avatar provides identity; town artwork provides style only. Record visible hair, glasses, expression, clothing and proportions. Separate proposed unseen clothing from observed details. Do not infer sensitive traits or personality. For nonhuman custom avatars, use their visible motif rather than inventing a human likeness.

If the requested character should support equipment, read [layered-wardrobe.md](layered-wardrobe.md) before generating the final atlas. Build the approved identity and garment layers under one versioned rig, then verify the original outfit reconstructs the approved appearance. Keep a flattened compatibility image for the existing Town renderer until layered equipment integration is requested.

## 2. Establish one approved appearance

Read [prompting.md](prompting.md). Use built-in image generation. Start with ONE full-body front-facing neutral sprite, no props or scenery, with generous padding. Ask for actual transparency. Do not start with a walk atlas before identity is established.

Prompt template (replace angle brackets; do not apply the example features to other people):

> Create ONE Donut Town resident. Image 1 is the exact identity reference. Images 2 and 3 are style/proportion references ONLY. Preserve <visible features>. Complete unseen lower clothing with <explicit proposal>. Cozy detailed 16-bit pixel art, crisp clustered shading, dark outlines, restrained warm palette, slightly oversized head, around 3 to 3.5 heads tall. Full body centered, relaxed arms, feet visible. Genuine transparent alpha, no checkerboard, shadow, text, scenery, grid or other people. Static design preview, not an animation sheet.

Successful example identity features: short black hair, rectangular black glasses, warm toothy smile, dark charcoal suit, pale shirt and black tie. Dark trousers and dress shoes were proposed because the source was a headshot. The user approved the resulting likeness. Preserve that approved design as the reference for later poses instead of starting over from the photograph.

For a preview request, stop after the single character and inspect it; do not generate walking atlases, change runtime bindings or deploy unless requested. Validate a static PNG with the atlas validator using `1 1` and report any alpha failure as a preview limitation. A likeness preview does not need production-animation QA. Do not spend repeated generation calls solely to make a preview production-ready.

## 3. Produce and validate the animation

For an animation request, follow [production-animation.md](production-animation.md) through generation, transparent output, measured frame geometry, interactive preview and the production acceptance checks.

Generate nine equal cells: columns step A / neutral / step B, rows down / right / up. Mirror the right-facing sprite in the renderer for left. Use the approved character as identity reference. Demand consistent size and baseline, opposite leg AND arm phases in A/B, and right-facing orientation throughout the side row. Up faces away with no face visible.

Actual failure cases from the first production run:

- A checkerboard preview was an RGB PNG with NO alpha. An attractive preview is not a production asset.
- A transparency-only request succeeded once, but later attempts redrew the checkerboard. Inspect the output every time.
- Columns A and B were nearly duplicate strides. Explicitly describe the opposite limbs, and verify visually; a PNG structure validator cannot check gait.
- Claimed equal cells were neither evenly divisible nor centered. Blind `background-size: 300% 300%` caused inconsistent positions. Measure frame rectangles and baseline, or normalize the atlas with an authorized deterministic process.
- A nominal third-row boundary cut through the back-facing character's hair. Inspect real silhouette bounds rather than deriving every crop from image width/3 and height/3.

Run `node .agents/skills/donut-town-pixel-art/scripts/validate-png-atlas.mjs <atlas.png> 3 3`. Inspect alpha around silhouettes and limb gaps, not just corners. Compare A/B/neutral and all directions at native size and at the actual in-town scale.

If transparency fails, do **not** spend image-tool retries on it. The image tools return JPEG with a baked checkerboard or near-white backdrop. Run `python3 .agents/skills/donut-town-pixel-art/scripts/extract-checkerboard-alpha.py <atlas> --out <rgba.png> --grid 3 3` and inspect the result. That local extraction is the authorized production path.

## 4. Integrate a stable identity

Current implementation entry points:

- `characters/assignments.json`: HMAC-SHA256 member keys mapped to opaque character IDs. No raw member IDs or display names in public bindings.
- `characters/catalog.mjs`: server-only key computation and validated manifest lookup. Use the existing server `SLACK_SIGNING_SECRET` with domain prefix `donut-town:character:v1\0`. Never commit the key. Test correct-key lookup locally without putting real IDs into tests. Ordinary tests use invented member strings. A key rotation requires regenerating the assignments. For a Render deployment, use the matched member’s `characterKey` returned by the authenticated `/api/slack/members` endpoint. Do not assume the local signing secret equals the deployed secret. After deployment, verify that the member API returns the expected non-null `character.url`; an HTTP 200 for the PNG alone does not verify the binding.
- `characters/<character-id>.json`: image URL/dimensions, common frameHeight and nine `[x,y,width,height]` source rectangles in down/right/up order.
- `assets/residents/<character-id>/`: versioned production PNG. Keep the photo and discarded intermediates out of public assets.
- Server `/api/slack/members` attaches `character` to each assigned member. Never select an identity by roster index or display name.
- `loadCharacterArt`, `paintPersonalCharacter`, `personMarkup`, `playerMarkup`, `updatePlayerElement`, and `renderLivePlayers` in `app.js`: loading, fallback, static and animated rendering.
- Keep the account button and both Slack profile drawers on `setSlackAvatar`. Generated characters belong in the town and wardrobe; never replace a Slack profile photo with game artwork.

The renderer uses source rectangles without editing the PNG. Keep source rectangles inside image bounds, common display scale, feet at the bottom and the torso centered across frames. Walking sequence is A / neutral / B / neutral; idle is neutral. Mirror only the art, never labels. Reduced motion uses neutral frames. Confirm asset failure keeps shared defaults visible.

Test with mocked identities: assigned user as local player; assigned user as remote player observed by another member; unassigned fallback; failed asset load; all four directions, idle and walking; town/interior; Overview/Follow; desktop/mobile; reload. Check console errors and ensure art loads before enabling the custom renderer. Use synthetic presence data for local animation tests and label it as such; it does not prove a live multi-client Slack session.

### Required binding sequence for a Town replacement

Run these commands from the project root. The helper uses the ignored `.env.local` authentication; do not paste credentials or raw member IDs into commands, reports, or Git.

1. Save the generated sprite under `assets/residents/<opaque-id>/` and its measured manifest at `characters/<opaque-id>.json`. Keep animation readiness explicit; binding does not certify artwork quality.
2. Resolve the requested member and save the deployed HMAC assignment:

   ```bash
   node scripts/bind-render-character.mjs "Member name" r-character-id
   ```

   The helper requires an unambiguous member match and Render’s `characterKey`. It rejects missing keys and conflicting assignments. Do not substitute a locally computed hash, roster position, or display-name runtime binding. For a conflict, inspect the existing assignment and requested replacement before changing it; do not automatically delete another binding.
3. Review the generated PNG, manifest and hashed assignment together. Publish them together when deployment is authorized in the session. Source avatars, private receipts, raw Slack IDs and secrets stay outside Git. If publication is outside the request, report the binding as local and not yet deployed.
4. After Render finishes deployment, run the read-only check:

   ```bash
   node scripts/bind-render-character.mjs "Member name" r-character-id --verify
   ```

   Require a pass for the live member assignment, complete manifest and exact image bytes. Check existing personalized members after a shared binding change. A successful image request alone is insufficient.
5. Verify the actual Town renderer with the assigned character as both the local player and another resident; label simulated identity tests as simulated. Report binding, rendering and animation readiness separately. Do not call a standalone preview page a completed Town replacement.

If the member still shows a default, distinguish a missing assignment, changed deployment key, failed image load, and an unlinked login session. Use API and browser evidence before blaming the hash algorithm. A secret rotation requires refreshing affected bindings and re-running live verification.

## 5. Persistence and delivery

Commit only the generated character PNG, manifest, hashed assignment and relevant code when deployment is requested. Never commit source-avatar PNGs, raw member IDs, names identifying an opaque asset, or source-photo fingerprints. Keep any source-reference receipts outside the public repository. These ship from Git into each Render deployment. Do not rely on files created only in the running Render instance. An avatar change must not silently overwrite an accepted identity; use a new version while preserving the old assignment until replacement is requested.

Report the saved asset, actual validations, inferred views, remaining animation limitations, and local versus deployed status. A successful first member does not establish batch reliability. Do not change invitations or send messages as part of this workflow.

The public artwork can still resemble its owner. HMAC hides the literal ID in the repository but is not a claim of anonymity, and it does not remove identities from the existing authenticated Slack member API. Do not describe this feature as encrypting or anonymizing the entire application.
