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
   Signing Secret, channel ID, and your personal Slack member ID. The personal
   ID lets the controllable `You` character replace your resident instead of
   adding a duplicate. `.env.local` is ignored by Git.
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
- The API does not yet authenticate the person operating the town. It must not
  be exposed publicly until Slack sign-in or a signed launch flow is added.
- Accepted invitations are not yet persisted to the historical sheet or a
  database.
- The current map is intentionally not auto-filled with 60+ live members yet;
  that needs a neighborhood or visibility rule to avoid overlapping sprites.

## What is implemented

- Channel member sync excludes bots and deleted users and does not request email.
- Slack IDs map deterministically to one of the approved resident appearances.
- Slack request signatures and five-minute replay protection are checked.
- Private invitations have Accept and Not this week actions.
- Real DM sending is disabled by default; dry-run is the default behavior.
- Residents can be filtered and inspected in the product prototype.
- The current user can click paths or hold WASD / arrow keys to walk.
- A user can rank up to three invitations.
- Booked and pending residents have visible status without revealing partners.

Slack user authentication, the historical sheet import, and durable persistence
remain intentionally out of scope for this integration spike.

## Repository skill

The reusable pixel-art generation and animation workflow lives at
`.agents/skills/donut-town-pixel-art/`. It covers prompt construction, atlas
validation, CSS integration, map placement, movement QA, and stable future
Slack-to-character assignment.
