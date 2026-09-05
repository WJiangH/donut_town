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

`POST /api/slack/invitations` creates a Block Kit invitation with **Accept** and
**Not this week** buttons. While `SLACK_ALLOW_SEND=false`, it returns the exact
message as a dry-run and sends nothing. Only set it to `true` for a test account
after reviewing that preview.

This is an integration spike, not yet production-ready:

- Invitation state is held in memory and is lost when the server restarts.
- Slack-launched sessions expire after eight hours. Direct staging-password
  access remains deliberately unlinked to a Slack member.
- Used five-minute launch links are remembered only in process memory; a server
  restart can make an unexpired link usable again.
- Accepted invitations are not yet persisted to the historical sheet or a
  database.
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
- A user can rank up to three invitations.
- Booked and pending residents have visible status without revealing partners.

The historical sheet import and durable invitation persistence remain out of
scope for this integration spike.

## Deploy the protected testing build to Render

The repository includes `render.yaml`, so the shortest setup uses a Render
Blueprint:

1. Sign in to Render and choose **New → Blueprint**.
2. Connect GitHub and select `WJiangH/donut_town` on the `main` branch.
3. Render reads `render.yaml` and asks for six secret values:
   `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_CHANNEL_ID`, and
   `STAGING_PASSWORD`, plus `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` for
   one-click Slack identity.
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
5. Sync `Google_Script/Code.gs` and `Google_Script/Automation.gs` into the
   existing Sheet-bound Apps Script project.
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
it, while preserving the manually maintained Team, Manager Slack ID, and invite
preference columns. Pairing rules use Manager Slack ID rather than hard-coded
email rosters.

## Repository skill

The reusable pixel-art generation and animation workflow lives at
`.agents/skills/donut-town-pixel-art/`. It covers prompt construction, atlas
validation, CSS integration, map placement, movement QA, and stable future
Slack-to-character assignment.
