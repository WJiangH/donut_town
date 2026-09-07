---
name: donut-town-maps
description: Create selectable Donut Town seasonal or replacement maps with matching walk masks, building entrances, resident spawns and interaction zones. Use for Halloween or other town themes and new outdoor layouts; use the interior skill for individual rooms.
---

# Donut Town Maps

Deliver a complete, validated map package, not just a background image. The default town stays Classic unless the user explicitly requests activation. Adding files or testing a local fixture is not permission to change the live theme or push.

## Inspect first

Read `content/themes/catalog.json`, the chosen reference theme JSON, and `town-themes/contract.mjs`. Inspect the actual approved map and one resident sprite. Use only approved game art as image references; never original Slack photos, member lists or raw IDs. Read `docs/map-themes.md` for schema, commands and a worked Halloween example.

## Choose the right workflow

When asked for a new/replacement theme map, default to a **new layout** with different street topology, landmarks and building positions. A recolor or decoration pass is only a seasonal reskin; do not present it as a new map. Reuse the old geometry only when the user explicitly wants the old layout preserved.

- **Seasonal reskin:** imagegen edit of the approved map. Lock the complete framing, road and river borders, bridges, building footprints, doors, benches and cafe tables. Seasonal decor belongs off the lanes. A preserved-looking layout is a hypothesis until its mask overlay is inspected. `base` may reuse the old geometry only after that review. Block every new obstacle; omit displaced activity anchors.
- **New layout:** generate new art, then measure new geometry. Omit `base`, define the full theme metadata, connected `allow` polygons/corridors, blocked objects, spawn, entrances with landings, pair stations and activity zones. Do not run the Classic green/yellow color classifier on an arbitrary autumn, snow or night palette. Do not reuse old anchors just because the dimensions match.

Keep the cozy 16-bit, top-down three-quarter style, complete scene framing and clear paths. Render at the measured reference pixel density. Do not bake residents, personal portraits, UI, text or interaction markers into the art. All coordinates describe feet in normalized 0–100 space; an entrance marker may overlap its building but its `landing` must be on reachable ground.

## Build a candidate

1. Save the selected game art under `assets/themes/<id>-<12 hex SHA256>.png`. Record the exact final prompt and geometry assumptions in a content brief. Use genuine image generation; keep drafts and original photo inputs out of Git.
2. Create `content/themes/<id>-source.json` and compile with `node scripts/build-map-theme.mjs content/themes/<id>-source.json`. It writes a self-contained `<id>.json`: image SHA256 and size, world size, camera, walk mask, entrances, spawn, pair stations and zones. Inspect the reported dropped cells and omitted zones; automatic pruning does not prove the art is correct. Fix geometry if a bridge or required interaction vanished.
3. Add a small WebP thumbnail (under 150 KB) and a catalog entry. Full-resolution art is loaded only when active or previewed. Keep the catalog default in code as Classic. Do not change Redis to publish a candidate.
4. Run `node scripts/validate-map-themes.mjs` and `npm test`. Verify image identity, all reachable entrance landings, all six established outdoor actions, pair spots and 160 resident slots. Sample every smoothed route segment, including activity-to-activity routes, against the mask: a nonempty A* result alone does not prove that characters can follow it past small obstacle corners. Include the optional local Redis test when changing admin/save behavior. Never use production Redis for tests.
5. Open `/map-preview.html?theme=<id>`. Inspect the **entire map**, then toggle Walkable paths and Activity spots. Click and walk through bridges, courtyard paths, farms and all door approaches. Check that a table or bench action anchor is at the feet/seat edge, never on the tabletop; keep lantern bases and planters blocked even when they sit inside otherwise open paving. Confirm buildings, water, pumpkins and furniture are blocked. Stop at sitting, coffee, reading, gardening and lookout spots; the preview uses the real collision/zone functions and an approved sprite with action frames.
6. Verify the actual application in an isolated fixture: admin Settings → Preview causes no write, Apply changes both open clients, ordinary members cannot apply, a reload retains the selected theme, Classic can be restored, and indoor entry/exit still works. Review desktop/mobile framing and reduced-motion behavior. An API response or static screenshot alone does not prove these interactions.

## Runtime invariants

- `content/themes/<id>.json` is the complete package; changing only the PNG is incomplete.
- `TownZones.setTown` replaces outdoor zones and preserves interior zones; moving resets a held/automatic pose. Only actions supported by that character may trigger.
- Themes own outdoor art and geometry only. Home layouts, purchased rooms, furniture, wallet, outfits and pets use the same authenticated member records through `/api/house` and `/api/shop`. Never duplicate member saves into a theme, prefix member storage keys with a theme, or package private IDs. Defer theme reload while Home is open; flush its save before reloading on exit. Test the same fixture account before and after a theme change.
- Distribute residents across authored, reachable activity slots with `town-activity-slots.mjs`, respecting zone capacity, spacing, booked status and available character action frames. Do not leave the population on arbitrary road points or make an unsupported pose play.
- Pets use shared `pets-motion.mjs`, scene dimensions and the active collision/path functions. Never add per-theme follow patches. Run `test/pet-themes.test.mjs` across all catalog maps, 30/60/120/144 Hz and different aspect ratios; check stationary settling and atlas/DOM stability too.
- Town overview must contain the complete artwork while walking, including room for fixed controls. Close framing belongs to explicit Follow me. Validate both wide and narrow viewports.
- Theme-specific saved positions snap to valid ground. Presence carries `themeId`; ignore positions from another map while peers reload.
- Backend authorization uses a valid Slack session, channel membership, and either the explicit `TOWN_ADMIN_KEYS` hash allowlist or Slack workspace admin/owner status when no allowlist is configured. Hiding Settings is not authorization. Never add a query-string/localStorage admin bypass to production.
- Theme choice persists in Upstash. No database config means Classic/read-only; a failed configured read must not silently show Classic. Conflicting administrators get a conflict response. A successful change notifies connected clients; they reload, with a periodic/visibility refresh as fallback.

## Completion

Report candidate art and manifest paths, what was actually tested, file sizes, and whether the current theme was changed or pushed. Show the preview/settings result. Explicitly distinguish fixture roles/members from real Slack and deployment verification. If activation was not requested, leave the live town unchanged.
