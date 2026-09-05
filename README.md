# Donut Town prototype

An interactive, dependency-free product prototype for launching Donut chats from Slack.

## Run it

Open `index.html` directly, or serve this folder with any static web server.

For example:

```sh
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

## What is implemented

- Every channel member appears in town and is open to invitations by default.
- Residents can be filtered and inspected.
- The current user can click paths or hold WASD / arrow keys to walk.
- The player uses a three-frame directional walk cycle with map collision limits.
- A user can rank up to three invitations.
- Donut Bot's private invitation flow is simulated.
- Booked and pending residents have visible status without revealing partners.
- Successful historical pairings are represented as collectible donuts.

Slack authentication, real DMs, the historical sheet import and persistence are intentionally mocked in this design version.

## Repository skill

The reusable pixel-art generation and animation workflow lives at
`.agents/skills/donut-town-pixel-art/`. It covers prompt construction, atlas
validation, CSS integration, map placement, movement QA, and stable future
Slack-to-character assignment.
