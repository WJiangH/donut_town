# Town map themes

Admins open **Settings → Preview / Apply to town**. Preview is a separate playable
map with path and activity overlays; it never changes the shared town. Apply
saves the selected ID in Upstash and notifies connected towns to reload. Other
tabs also check on return and once a minute. **Classic remains the default.**

Adding a catalog entry makes a theme available; it does not activate it. Settings
uses small thumbnails. Only the active or explicitly previewed full map loads.
Art streams from disk and content-hashed theme assets have immutable browser
caching. Image generation and geometry baking happen locally, not on Render.

## Administrator setup

By default, a Slack workspace admin/owner who belongs to the configured channel
can change the map. The repository also supports explicitly designated Town admins in `town-themes/admins.json`: an array of existing 64-character `characterKey` hashes, never raw Slack IDs. The current town owner is listed there. Forks can start with `[]`. Channel membership by itself grants no admin rights.

To designate specific Town admins, set **`TOWN_ADMIN_KEYS`** on Render to their
comma-separated `characterKey` values from the authenticated
`/api/slack/members` response. These are the same server-derived HMACs used for
character binding. This environment list overrides both Slack workspace admin roles and the repository list.
Keep the setting in Render or ignored `.env.local`, not in Git; do not substitute
a plain SHA of an ID. A staging password alone cannot change themes: the person
must enter through Slack so the server can verify their identity and membership.
Changing the app signing secret requires regenerating these keys.

To prepare that setting from a display name, put your deployed `PUBLIC_BASE_URL`
and staging password in ignored `.env.local`, then run:

```sh
node scripts/prepare-town-admin.mjs "Your Slack display name"
```

It reads the authenticated roster and writes only the server-derived hashes to
ignored `.donut/town-admin.env`. Set that value on Render; the helper does not
change remote permissions or activate a theme.

With no Upstash configured, the default map is readable and switching is
disabled. If configured storage is temporarily unavailable, initial loading
waits/retries rather than showing the wrong map. Already loaded towns keep their
last map. Conflicting admin writes are rejected instead of overwriting each other.

## Create another map

Use [Donut Town Maps](../.agents/skills/donut-town-maps/SKILL.md). The worked example
is [`halloween-source.json`](../content/themes/halloween-source.json), compiled to
[`halloween.json`](../content/themes/halloween.json). It is a new layout: a manor,
bakery terrace, alchemy lab, pumpkin patch, reading orchard and southern bridge.
Its measured geometry starts from an empty mask; it inherits no Classic paths or
activity anchors. The old palette-based automatic classifier is specific to Classic.

```sh
node scripts/build-map-theme.mjs content/themes/halloween-source.json
node scripts/validate-map-themes.mjs
npm test
```

The source accepts `base` only for reviewed, matching layouts. For a new layout,
omit it and provide a complete `theme`, `zones`, `allow` geometry and `block`
geometry. Allow/block shapes are polygons (`points: [[x,y], ...]`), corridors
(`from`, `to`, `width` as half-width), or ellipses (`x`, `y`, `rx`, `ry`). The
compiler retains the spawn's connected component and reports omitted zones;
inspect these reports rather than treating automatic removal as an art approval.

Every compiled package contains:

| Field | Purpose |
| --- | --- |
| `image`, `imageSha256`, `imageSize` | Exact reviewed art and dimensions |
| `worldWidth`, `camera`, `bounds` | Render size, initial framing and movement bounds |
| `spawn` | Safe default foot position |
| `walkMask` | Packed connected grid: `cols`, `rows`, base64 `bits` |
| `entrances` | `chemPod` and `donutShop` marker positions plus reachable `landing` |
| `stations` | Shared-chat marker and left/right participant positions |
| `zones` | Outdoor action, reachable `anchor`, radius/seat limit and facing |

Coordinates are normalized 0–100, measured at the character's feet. Each zone
has `scene: "town"`, `resolved: true`, `seats`, and an action string/array from
the supported sprite actions. Preserve indoor zones independently. Artwork
does not provide collision or invisible interaction data by itself.

Register `{id, name, manifest, thumbnail}` in
[`catalog.json`](../content/themes/catalog.json). Keep full PNGs named with a
12-character SHA256 suffix and thumbnails below 150 KB. Changed artwork requires
reviewing geometry, updating the full hash and naming a new immutable asset.

## Acceptance checks

Open `/map-preview.html?theme=halloween` on your local server. Test walking,
bridges, door approaches and stopping at activity markers. Use both overlays to
inspect the full image. The preview uses a generated example resident and the
same collision/zone code; it contains no real Slack profile photos.

Test admin and ordinary-member sessions against isolated data. Preview must not
write; apply must affect both sessions, persist across reload, and allow restoring
Classic. Check mobile layout and room entry/exit. Positions are stored per theme;
old-theme live coordinates are not rendered on another map during transitions.
The geometry validator proves reachability and image identity, not that the art
visually matches every collision boundary. That final check needs screenshots
and walking the map.
