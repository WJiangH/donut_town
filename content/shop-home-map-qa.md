# Shop, Home and Halloween regression notes

## Changes

- Shop roster/outfit refreshes no longer fetch or rebuild product shelves. Selecting
  an item only changes its selection and detail bar. Concurrent shop loads share
  one request; unchanged data preserves the product nodes; stale reads cannot
  overwrite a purchase/equip result.
- Shop has a sticky Back to town control and Escape exit. Scene transition cleanup
  runs even if rendering fails. Home's Back to town now actually returns to Town,
  including when Home was opened while inside the Shop.
- Home opens in walking mode. Click a clear floor tile or use WASD/arrows. Furniture
  footprints block paths, rugs remain walkable. Decorate enables the existing
  drag/tap/keyboard arrangement tools. Hidden town movement pauses inside Home.
- `shop/grants.json` contains fixed lifetime test credits keyed by existing public
  character HMACs. Credits apply server-side to shop earnings, not chat history.
  Redeploying/refreshing cannot replenish spending. Other members keep their
  existing balance. Keep these grants stable after purchases; reducing a grant
  retroactively can make a wallet negative. New workspaces may use an empty object.
- Halloween now uses new art, roads, entrances, interactions and paired-chat spots.
  The obsolete recolor asset is retired. Classic remains the default.

## Automated checks

The full Node suite passed: **113 tests, 0 failures, 0 skipped**, using the optional
local Redis/Lua fixture. It includes fresh-map reachability and art identity,
unchanged shelf DOM write counts, concurrent shop loading, Home collision/path
routing, fixed-credit accounting, and hidden-town movement isolation.

`npm run themes:check`: 11 Halloween zones, 160 reachable spawn slots, 3,636,398
art bytes; the new map has no inherited Classic mask and no dropped components.
`npm run privacy:check`: no candidate findings. No source portraits, raw member
IDs, credentials, or fixture sessions are included in the changes.

## Browser validation

Local synthetic members and local test storage only; no real-member purchases:

- Purchased a cat (6), equipped it, returned to town, observed its rendered follower.
- Purchased a Christmas tree (3); balance changed from 106 to 97. It appeared in
  Home's decoration shelf. Placed on clear floor, saved, gained 30 Luxury; reloading
  retained the tree and Luxury score. Overlapping the starter rug was rejected.
- Click-to-walk moved the Home resident from row 8.5 to row 4.5. A short ArrowLeft
  tap moved from column 7.5 to 6.5. The house opens in walking mode again after reload.
- Town → Shop → Town and Home → Shop → Escape → Town worked, including with an
  equipped pet. The initial plain Shop exit failure was not reproducible locally;
  the persistent exit and cleanup address the fragile paths without claiming a
  confirmed single cause for the user's deployed symptom.
- Inspected the complete new map and navigation overlay: manor, bakery terrace,
  lab frontage, pumpkin aisle, orchard, planting islands and southern bridge.
- Admin Apply loaded Halloween in two connected local clients. Chem Pod entry and
  return worked with the new map. Mobile Shop and Home were checked at 390 × 844
  with no horizontal overflow; Shop Back to town stayed visible after scrolling
  two pages and returned successfully.
- A real bridge-to-cafe walk exposed fixed-step line sampling clipping a tiny
  blocked cell corner. Grid traversal now checks every intersected cell. The new
  test walks all 196 pairs of Halloween gameplay anchors in 0.025-unit increments.
  Browser replay reached the southern landing (50,95), then the bakery terrace
  (20.8,45.7) and triggered the coffee pose without errors.
- Restored Classic in both local fixture clients. No production theme selection
  was changed.

The production credit is bound using the authenticated deployed roster's existing
character hash. The local signing configuration differs from production, so no
production signed test session was issued. This document contains no raw identity.
