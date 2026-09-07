# Customize your Town

Start with a working [deployment](deploy.md), then change one part at a time.
The included starter characters, town map and room art are enough to run it.

## Characters and wardrobe

Use the [pixel-art skill](../.agents/skills/donut-town-pixel-art/SKILL.md) for a
named member. It covers source-avatar eligibility, generated sprites, animation,
wardrobe layers and runtime validation. Image generation happens during asset
creation, not on Render. Your agent needs an image tool only for new art.

For the fetch/binding helpers, put your own deployed origin in the ignored local
`.env.local` as `PUBLIC_BASE_URL`, together with that deployment's staging
password. They no longer default to the maintainer's Render URL.

New workspaces get stable starter appearances. The existing keyed assignments
will not bind to another Slack app's signing secret. Generated PNGs belong under
`assets/residents/`; manifests and HMAC assignments live under `characters/`.
Never put original photos, raw Slack member IDs or private source manifests into
Git. Generated likenesses can still identify people: get their agreement before
publishing their artwork. See [character details](../characters/README.md).

A manifest must describe the actual frame rectangles, source dimensions and
foot alignment. A character needs a wardrobe rig to recolor clothing/shoes or
use compatible layers. One garment is not guaranteed to fit every character.
Pose availability follows each character's action atlas. Moving clears a manually
selected pose. Saved outfits use Upstash; **Save look** applies an outfit, while
**Undo changes** restores the saved one.

## Shop, pets and Homes

Edit [`content/shop.json`](../content/shop.json). Each item has a stable `id`,
`kind` (`wardrobe`, `decoration`, `pet`), name, price and art metadata. Use
`available: false` for previews. Keep IDs stable across updates: ownership and
Home layouts reference them. Changing a price does not rewrite purchase history.

`starterDonuts` is the starting allowance (currently 6). Changing it affects
current balance calculation; it is not a one-time grant ledger. Earn-from-chat
rewards and historical Lottery imports are not connected. Preview content must
not imply that those systems already exist.

For fixed member-specific testing credits, `shop/grants.json` maps an existing
server-derived character HMAC to additional lifetime donuts. An empty object is
valid for a new workspace. Credits are added to earnings before purchase checks;
refreshing or deploying again does not restore spent donuts. Do not put names,
raw Slack IDs or credentials in the file, and do not lower grants after spending.

Home starts in walking mode: click the floor or use WASD/arrows. **Decorate** opens
the owned decoration inventory. Drag items onto the floor, or select and place
them; arrow keys nudge a selection. Only owned decorations,
valid cells and non-overlapping footprints can be saved. Starters add 0 Luxury.
Placed non-starter decorations contribute their fixed `luxury` catalog value;
removing them subtracts it, and moving/saving cannot farm points. Thresholds:

| Tier | Luxury |
| --- | ---: |
| Simple | 0 |
| Cozy | 20 |
| Charming | 60 |
| Elegant | 120 |
| Luxurious | 200 |
| Grand | 320 |

Change these in [`house/luxury.mjs`](../house/luxury.mjs). Luxury is a decoration
score, not a ranking of members or a change to pairing priority.

Pets use `pets.mjs` and catalog ownership. An equipped pet follows its owner's
walked route, and presence shares which pet is out. Match the existing atlas
contract when replacing placeholder art; buying a static image alone does not
supply a walking animation.

## Rooms and movement

Use the [interior skill](../.agents/skills/donut-town-interiors/SKILL.md). Generate
room art without people or real photos; add occupants from app state. Measure
scale beside an actual resident, then align collision and foreground depth with
the final image. The [Chem Pod brief](../content/chem-pod-art-brief.md) records a
worked example and its QA limits.

```sh
node scripts/build-chempod-walkmask.mjs
node scripts/build-town-walkmask.mjs --preview /tmp/town-walkmask.png
node scripts/build-town-zones.mjs
```

Run only the corresponding bake after changing its art or geometry. Town paths
come from the baked mask, with explicit bridge/ground allowances in the build
script; Chem Pod uses measured furniture islands. `town-zones.js` supplies
activity anchors and `assets/town-zones-auto.js` supplies measured town zones.
`?collision=1` and `?zones=1` help inspect them. Check entrance, exit, every route
around furniture, mobile framing, sprite feet and reduced motion.

The town camera supports overview and follow modes. Room fit uses its own
responsive sizing. A scene-position preference is stored in the browser and
snapped to valid ground after a map change; it is not cross-device location sync.

## Architecture and state

For complete seasonal maps, use the [map-theme workflow](map-themes.md). It
packages artwork, navigation and actions together and adds candidates to the
administrator's Settings menu without changing the active town.

The browser renders the map, sprites, shop and Home. `server.mjs` handles Slack,
authenticated APIs, signed callbacks, static asset streaming and WebSocket presence.
One Node dependency (`ws`) is installed with the lockfile; there is no frontend build.

| Data | Storage |
| --- | --- |
| Member profiles | Slack; server cache, shown to authorized visitors |
| Invitations | Upstash weekly snapshots and active process cache |
| Outfits / shop / Home | Upstash, under keyed member identifiers |
| Chat confirmations / friendships | Upstash; hashed participants, no chat text |
| Position / pose preference | Browser storage |
| Active town theme | Upstash, scoped to the configured channel |
| Presence / used login tokens | Process memory |

A confirmed Town chat needs both participants' attestations; it does not prove
attendance independently or award donuts. History reads the last 52 weekly
invitation snapshots, shows the latest 50 confirmations and all-time friendship
totals. Pending/declined invitations and self-tests cannot count as completed
chats. The weekly pair is counted once, even under repeated confirmations.

Run `npm test` for the normal suite. The optional Lua integration test accepts
`TEST_CHAT_REDIS_URL` only for an isolated localhost Redis REST fixture. Never
point tests at production. See [publishing notes](publishing.md) before sharing
art or deployment artifacts.
