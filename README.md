# Donut Town prototype

An interactive product prototype for launching Donut chats from Slack. The
frontend remains dependency-free; a small Node.js server handles Slack API
calls and signed interaction callbacks.

## Run it

Node.js 20 or newer is required for Slack integration:

```sh
npm start
```

Then visit `http://127.0.0.1:4173`.

## Connect a Slack app locally

This repository never stores real credentials. Keep using the existing Donut
Lottery app if it is already owned and approved by the workspace; merge these
settings into that app rather than replacing its manifest blindly.

1. In the Slack app's **OAuth & Permissions** page, add these bot scopes:
   `users:read`, `chat:write`, `im:write`, plus `channels:read` for a public
   channel or `groups:read` for a private channel. Reinstall the app after
   changing scopes.
2. Make sure Donut Bot can access `#donut-be-strangers`. A private channel must
   explicitly contain the app.
3. Copy `.env.example` to `.env.local`, then paste the Bot User OAuth Token,
   Signing Secret, and testing channel ID. `.env.local` is ignored by Git.
4. Leave `SLACK_ALLOW_SEND=false`, run `npm start`, and open
   `http://127.0.0.1:4173/api/slack/members`. This performs a read-only sync.
5. A successful response returns every non-bot channel member with a stable
   `appearanceIndex`, which keeps each person's base character consistent.

Sample app settings are in `slack/manifest.example.yaml`. The interaction URL
must be a public HTTPS URL ending in `/slack/interactions`; Slack cannot send
button clicks to `127.0.0.1`. Use an approved development tunnel only when we
are ready to test one real DM.

### Safe invitation test

The town's confirmation button calls `POST /api/slack/invitations` and creates a
Block Kit invitation with **Accept** and **Not this week** buttons. The server
derives the inviter from the signed Slack session and verifies that both people
belong to the configured channel; it does not trust identity fields from the
browser. While `SLACK_ALLOW_SEND=false`, it returns the exact message as a
dry-run and sends nothing. Set it to `true` in Render only when one intended
recipient is ready for a real test.

The current test sends only the first person in the queue. Automatic fallback
to the second or third choice is deliberately not enabled yet, despite the
priority-list UI.

The separate **Send test to myself** control sends the same interactive DM to
the signed-in member without adding a formal self-invitation to their queue or
future Donut history. It remains a test-only UI affordance.

This is still a testing build:

- Invitation state uses Upstash when `UPSTASH_REDIS_REST_URL` and
  `UPSTASH_REDIS_REST_TOKEN` are configured. The private Slack ledger remains
  an optional fallback; without either store, state remains in memory and is
  lost when the server restarts.
- Slack-launched sessions expire after eight hours. Direct staging-password
  access remains deliberately unlinked to a Slack member.
- Used five-minute launch links are remembered only in process memory; a server
  restart can make an unexpired link usable again.
- Accepted invitations are not yet copied into the historical Google Sheet.
- The current map is intentionally not auto-filled with 60+ live members yet;
  that needs a neighborhood or visibility rule to avoid overlapping sprites.

## What is implemented

- Channel member sync excludes bots and deleted users and does not request email.
- Slack IDs map deterministically to one of the approved resident appearances.
- Slack request signatures and five-minute replay protection are checked.
- The channel entrance identifies the clicker and exchanges a five-minute,
  one-use launch link for an eight-hour web session.
- Private invitations have Accept and Not this week actions.
- Real DM sending is disabled by default; dry-run is the default behavior.
- Residents can be filtered and inspected in the product prototype.
- The current user can click paths or hold WASD / arrow keys to walk.
- Walking is limited to the roads, lawns, bridges and crop rows on the map.
- Standing still somewhere tagged settles a character into what that place is for.
- Neighbours are spread over the whole town rather than crowded round the plaza.
- A user can rank up to three invitations.
- Booked and pending residents have visible status without revealing partners.

### Where the town map can be walked

`assets/town-walkmask.js` is a baked grid, one cell per 8x8 map pixels, marking
every tile a character may stand on: paved roads, plazas, open lawn and the
bridges between them. Everything else - water, buildings, hedges, tree cover,
fenced farm plots - is solid, and the mask keeps only the ground you can
actually reach on foot. `town-collision.js` reads it at runtime for collision,
click-to-walk routing and for snapping hand-placed spots onto real ground.

Regenerate it whenever the map art changes, and open the town with
`?collision=1` to see the result painted over the map:

```
node scripts/build-town-walkmask.mjs --preview /tmp/walkmask.png
```

Bridges, boardwalks and shaded crossings are listed as `ALLOW_SEGMENTS` inside
that script, and fenced ground you should still be able to walk - the farm crop
rows - as `ALLOW_SHAPES`. Add to them when the colour pass reads a crossing as
water or fences off somewhere the town should be able to wander.

### The Chem Pod floor

The room's floor is baked from its own art the same way the town is, so people
walk the aisles between the benches instead of a few hand-drawn rectangles, and
the counters, cabinets and wall tops stay solid. Regenerate it after changing
the interior art:

```
node scripts/build-chempod-walkmask.mjs
```

The room is held to the stage so all of it is in view, and figures indoors are
drawn a little smaller (`--pod-figure` in `styles.css`) so they read as people
in a room. A genuinely larger, multi-room pod would need new interior art.

### What each place on the map is for

Characters do not need a button to sit down: stop somewhere for a second or two
and they settle into whatever that spot is for - a free bench, the open lawn, a
bridge railing, the cafe tables, the crop rows. Seats are single occupancy, so
a bench with somebody already on it is left alone.

The tags come from two places. `town-zones.js` holds the hand-placed furniture -
every bench, cafe table, the gazebo, the picnic blanket, the bridges - written
as the object's own position; the spot to stand and the way to face are worked
out from the walk mask at load. `assets/town-zones-auto.js` holds the tags that
can be measured instead of placed: open lawn, riverbank viewpoints and planted
beds. Regenerate those after changing the map or the walk mask:

```
node scripts/build-town-zones.mjs
```

Open the town with `?zones=1` to see every tag drawn over the map.

### The shop at the fountain

The donut in the middle of the plaza is the shop. Clicking it walks you over
and opens the shelves. Donuts earned from pairings are the currency, so a
wallet is what a member has earned less what they have already spent, and a
purchase is recorded with the price that was paid - a later price change never
rewrites what somebody spent.

- `content/shop.json` is the catalogue: `id`, `kind` (`pet` / `decoration` /
  `wardrobe`), `name`, `price`, `blurb`, `swatch`. Edit it to stock the shop.
- `GET /api/shop` returns the catalogue, what the member owns and their wallet.
- `POST /api/shop/purchase` takes `{ itemId }`, checks it is affordable and not
  already owned, and records it.
- Ownership lives in the same Upstash instance as the wardrobe, under
  `donut-town:shop:v1`, keyed by the member's character key.

Until the Donut Bot history sync lands there is nothing earned to spend, so
`starterDonuts` in the catalogue is what everybody begins with.

Still to build on top of this: pets as followers that walk behind their owner,
and a member's own donut house, entered from the profile, where bought
decorations are dragged into place. Both read the same ownership records.

### Pets that follow their owner

A pet bought at the fountain can be taken out from the shop drawer. It walks
the ground its owner walked, a step or two behind, hurries when it falls
behind, waits at their heel when they stop, and never steps somewhere the walk
mask forbids. Which pet is out travels with presence, so other members see it
following you around town.

The sprites in `assets/pets/` are placeholders drawn by
`scripts/build-pixel-icons.mjs`: a three frame side-on walk, 24 pixels square,
facing right and mirrored in code. Replace the files with real art of the same
shape - or point `petArt()` in `pets.mjs` at new names - and nothing else
changes.

### Where you left off

A refresh puts a member back where they were standing rather than at the
fountain. The spot is kept per scene in their own browser and checked against
the walk mask on the way back in, so a saved spot that the map no longer allows
lands on the nearest ground instead of inside a hedge.

### Choosing your own pose

The profile lists every pose a member's character has. Pick one and they hold
it wherever they stand - fishing on dry land if that is the joke they want -
and other members see it through presence. "Let the place decide" hands the
choice back to the map. The choice is a display preference, so it is kept in
that browser rather than on the server.

### A member's own donut house

The profile has a door to a member's own room. It starts bare; decorations
bought at the fountain appear on the shelf below it and are dragged onto a
fourteen by nine floor, where each one keeps its square. Dragging a piece off
the floor puts it back on the shelf, arrow keys nudge whatever is selected, and
every change is saved a moment later.

- `GET /api/house` returns the grid, the layout, and which decorations the
  member owns; `POST /api/house` takes `{ layout: { items: [{id, x, y}] } }`.
- A layout is only accepted if every piece is a decoration the member owns, is
  placed once, sits on the floor, and shares its square with nothing else.
- Anything sold or unknown quietly leaves the room rather than breaking it.
- Layouts live in Upstash under `donut-town:house:v1`.

The room itself is drawn in CSS for now - floorboards and four walls - so the
engine does not wait on art. Real interior art drops in over the same grid.

### Changing how you look

The profile drawer previews a look and only equips it when **Save look** is
pressed; **Undo changes** puts the saved one back. A refusal now says which one
it was - not signed in through Slack, no wardrobe for that character, or no
wardrobe storage configured - instead of a single "could not apply".

Saving needs `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; without
them the API answers `outfit_store_unavailable` and nothing can be equipped.

The small UI icons are pixel art rather than CSS circles:

```
node scripts/build-pixel-icons.mjs
```

### Connect Upstash, the town's memory

One free Upstash Redis database holds everything the town has to remember:
invitation history, the outfit each member is wearing, and what they have
bought. Without it the town still runs, but nothing can be saved - the wardrobe
answers `outfit_store_unavailable` and the shop `shop_store_unavailable`.

1. Create a database at [console.upstash.com](https://console.upstash.com) -
   the free tier is enough. Pick the region closest to the Render service.
2. On the database page open **REST API** and copy the **UPSTASH_REDIS_REST_URL**
   and **UPSTASH_REDIS_REST_TOKEN** values.
3. In Render, open the service, **Environment**, and add both as environment
   variables. Both are required; setting only one is refused at boot. Save, and
   Render redeploys.
4. Check it took: `curl https://<service>.onrender.com/api/health` now reports
   `"storage": true`. That endpoint needs no login and reveals no credentials.

For local development put the same two lines in `.env.local`. The keys written
are `donut-town:invitations:*`, `donut-town:wardrobe:v1` and
`donut-town:shop:v1`, so one database can serve several towns as long as they
share a workspace.

### Free invitation history

The preferred persistent store is an Upstash Redis database in the same region
as Render. Donut Town writes one
versioned snapshot per week and reads it once after a Render restart; normal
town polling continues to use process memory.

When Upstash is configured it is the primary store. Existing Slack-ledger data
for the current week is imported automatically only when the Upstash week is
still empty. Previous weekly keys remain available for future history views.

### Optional Slack invitation ledger

Donut Town can use a private Slack channel as a small, no-cost invitation
ledger. Create a private channel containing only the administrator and Donut
Bot, invite the app, then add its channel ID to Render as
`SLACK_LEDGER_CHANNEL_ID`. No additional OAuth scopes are required beyond the
existing `groups:history` and `chat:write` scopes.

The Bot keeps one versioned state message per inviter per week and updates that
message when an invitation is accepted, declined, or cancelled. Render loads
only the current week's messages into memory. Older weekly messages remain in
the private channel as history, so memory use does not grow with the lifetime
of the town. This is suitable for the current internal scale, but it depends on
the workspace's Slack message-retention policy.

For a browser-only visual check, append `?previewPair=SLACK_USER_ID` to the town
URL. It pairs the signed-in member with that channel member only in the current
browser; it does not send a Slack message or alter the ledger.

## Deploy the protected testing build to Render

The repository includes `render.yaml`, so the shortest setup uses a Render
Blueprint:

1. Sign in to Render and choose **New → Blueprint**.
2. Connect GitHub and select `WJiangH/donut_town` on the `main` branch.
3. Render reads `render.yaml` and asks for six deployment values:
   `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_CHANNEL_ID`, and
   `STAGING_PASSWORD`, plus `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` for
   one-click Slack identity. Member names, avatars, roles, pronouns, statuses,
   and time zones come from Slack rather than a second profile database.
4. Use the testing channel ID. Keep `SLACK_ALLOW_SEND=false`.
5. Choose a long, unique staging password and deploy. Do not upload or commit
   `.env.local`.
6. When the service is live, open its `https://<name>.onrender.com` URL. The
   temporary username is `donut`; the password is `STAGING_PASSWORD`.

The health check at `/api/health` intentionally does not require the staging
password. All pages and member APIs do. Slack's signed interaction endpoint is
also outside Basic authentication because Slack cannot answer that prompt; it
performs Slack signature verification instead.

The Blueprint uses Render's free plan for a visual/testing deploy. Free web
services spin down after inactivity, so they are not reliable for Slack's
time-sensitive interaction callbacks. Use an always-on instance before treating
the Enter Donut Town button as production-ready.

## Connect the one-click Slack entrance

The existing Apps Script does **not** need a `doPost(e)` function. It publishes
the channel message. The button opens Slack's OpenID flow, and Render verifies
the returned identity before mapping the member to a town resident.

1. Wait until Render has deployed the latest commit and its health check passes.
2. In Slack App **Basic Information**, copy the app's Client ID and Client
   Secret into Render as `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`. These are
   secrets and must not be added to the Sheet or repository.
3. In Slack App **OAuth & Permissions → Redirect URLs**, add exactly
   `https://donut-town.onrender.com/auth/slack/callback`. Under **User Token
   Scopes**, add `openid` and `profile`, then save. Keep these separate from the
   existing bot scopes; Donut Town does not request the OpenID `email` scope.
4. Keep Slack **Interactivity & Shortcuts** set to
   `https://donut-town.onrender.com/slack/interactions`.
5. Sync `Google_Script/Code.gs`, `Google_Script/Automation.gs`, and
   `Google_Script/ProfileApi.gs` into the existing Sheet-bound Apps Script
   project.
6. Run `initializeDonutSheets()` once so the existing `Configs` tab gains
   `TOWN_URL`. Its default is
   `https://donut-town.onrender.com/auth/slack/start`.
7. Run `postDonutTownEntrance()` manually once to publish a fresh testing
   message. Messages posted before this update still use the two-click private
   link; only newly posted buttons contain the one-click URL.
8. Click **Enter Donut Town**. Slack may show an authorization confirmation on
   the first use. After confirmation, the browser enters the town with the
   clicker's Slack ID mapped to the controllable `You` character.

The callback verifies the OpenID token signature, audience, expiry, nonce,
workspace, and current testing-channel membership. It then creates an 8-hour,
HTTP-only town session cookie. The Slack Client Secret never reaches the
browser.

The tracked Apps Script source contains no Token, channel ID, employee email,
or team roster. Secrets remain in Script Properties; workspace-specific member,
manager, and channel data remain in the private Sheet tabs.

## Sheet-managed scheduling

`Google_Script/Automation.gs` adds an internal `Configs` tab and an
auditable `Rounds` tab. After syncing the files, run `initializeDonutSheets()`,
fill `Configs.CHANNEL_ID`, then run `setupDonutAutomation()` once. It removes only the old
`runGuessWhoLottery`, `runDonutLottery`, and `donutAutomationTick` time triggers,
then installs one idempotent 15-minute automation tick.

The tick reads `Configs` on every run. Channel ID, weekly weekday/time, timezone,
signup duration, emoji, and message copy can therefore change without editing
code or rebuilding the trigger. Actual message timestamps and round state belong
in `Rounds`, rather than in the global configuration table. Apps Script timing is
approximate; the weekly post occurs on the first 15-minute tick at or after the
configured local time.

The same setup also creates `Members`. `syncDonutMembers()` refreshes Slack ID,
display name, channel membership, and email when the app is permitted to read
it. It preserves Team, Manager Slack ID, invite preference, Specialty,
Location, Pet, and Chat Topics. Pairing rules use Manager Slack ID rather than
hard-coded email rosters.

## Slack member profiles

Town profile cards use the existing `users.info` response. They show a member's
Slack display name, avatar, role, pronouns, status, and time zone when those
fields have been filled in. Empty fields are omitted. Members update this
information in Slack, so Donut Town does not need a second editable profile or
an externally accessible Google Sheet. Email and phone fields are not sent to
the browser. Profile responses are cached for ten minutes to stay comfortably
within Slack API limits.

`Google_Script/ProfileApi.gs` and `profile-store.mjs` are retained as a record
of the Sheet-backed prototype, but the current town interface does not call
that bridge. Donut history still needs a separate one-way sync from the Lottery
sheet before the collection counts can be restored.

## Repository skill

The reusable pixel-art generation and animation workflow lives at
`.agents/skills/donut-town-pixel-art/`. It covers prompt construction, atlas
validation, CSS integration, map placement, movement QA, and stable future
Slack-to-character assignment.
