# Deploy Donut Town to your Slack channel

The shortest supported setup is **your fork + one Slack app + one Render web
service + one Upstash Redis database**. Each deployment serves one channel in
one workspace. Google Sheets and Apps Script are optional; skip them initially.

## 1. Create your fork and Slack app

Fork the repository to an account you control, clone the fork, and run:

```sh
npm ci
npm run setup
```

Open [Slack apps](https://api.slack.com/apps), choose **Create New App → From a
manifest**, select your workspace, and paste `.donut/slack-manifest.json` in the
JSON editor. The first manifest deliberately has no callback URLs: Render has
not allocated your hostname yet. [Slack supports JSON and YAML manifests.](https://docs.slack.dev/reference/app-manifest/)

Install the app to your workspace in **OAuth & Permissions**. Workspace policy
may require administrator approval. Add Donut Bot to the target channel using
**Channel details → Integrations → Add apps** (also do this for public channels).
Copy the channel ID from channel details; use the ID, not `#channel-name`.

The manifest grants `users:read`, `channels:read`, `groups:read`, `chat:write`
and `im:write` to the bot. `openid` and `profile` belong to Sign in with Slack,
not the bot authorization request. There is no email or message-history scope
in the basic Town manifest. [Slack OpenID setup](https://docs.slack.dev/authentication/sign-in-with-slack/).

**Already have an app?** Merge these settings with its existing manifest; do
not replace event subscriptions, commands or permissions used by another bot.
A separate app is usually simpler for a new installation. Reinstall after
changing bot scopes.

## 2. Create a dedicated Upstash database

Create a Redis database in [Upstash](https://console.upstash.com), preferably
near your Render region. Copy its **REST URL** and **REST Token**, not a Redis
TCP password or a read-only token. [Upstash connection settings](https://upstash.com/docs/redis/howto/connect-with-upstash-redis).

Use a dedicated database per deployment. Wardrobe, shop and Home use shared
key names; pointing another town at the same database is not a supported
isolation boundary. Backups and retention are your responsibility.

For an existing Town moving to DigitalOcean App Platform, use the
[App Platform migration guide](deploy-digitalocean.md). It preserves the Slack app
and existing Upstash data.

## 3. Deploy your fork on Render

In [Render](https://dashboard.render.com), choose **New → Blueprint**, connect
your fork and branch, and use the root `render.yaml`. It configures Node,
`npm ci`, `npm start`, the listener and `/api/health` automatically.

Fill these **seven values** in Render's secret fields:

| Environment variable | Where to get it |
| --- | --- |
| `SLACK_BOT_TOKEN` | Slack app → OAuth & Permissions → Bot User OAuth Token (`xoxb-…`) |
| `SLACK_SIGNING_SECRET` | Slack app → Basic Information → App Credentials → Signing Secret |
| `SLACK_CLIENT_ID` | Same App Credentials section → Client ID |
| `SLACK_CLIENT_SECRET` | Same App Credentials section → Client Secret |
| `SLACK_CHANNEL_ID` | Target channel → channel details → channel ID |
| `UPSTASH_REDIS_REST_URL` | Upstash database → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash database → REST API, read/write token |

Render generates `STAGING_PASSWORD` for you. It is an administrator preview
password, not a password to distribute to members. Keep `SLACK_ALLOW_SEND=false`
for the first deploy. The Blueprint's automatic secret generation preserves an
existing value; it does not intentionally rotate a configured password.
[Render secret configuration](https://render.com/docs/blueprint-spec).

Leave `PUBLIC_BASE_URL` unset on Render: the app detects its assigned hostname.
For a custom domain, set it to the exact HTTPS origin with no path. **Never copy
this project's original deployment URL into your configuration.**

After deploying, visit `https://YOUR-TOWN.onrender.com/api/health`. Expect
`ok: true` and `storage: true`. The storage flag means both credentials are
configured; it does **not** prove Redis credentials work. The next checks do.

## 4. Connect Slack to your new URL

In your clone, run:

```sh
npm run setup -- --url https://YOUR-TOWN.onrender.com
```

For the new app created in step 1, apply the generated JSON through Slack's
**App Manifest** page. It fills exactly these two settings:

| Slack setting | Value |
| --- | --- |
| OAuth & Permissions → Redirect URLs | `https://YOUR-TOWN.onrender.com/auth/slack/callback` |
| Interactivity & Shortcuts → Request URL | `https://YOUR-TOWN.onrender.com/slack/interactions` |

Keep OpenID scopes separate from bot scopes when authorizing. No Events API
subscription, slash command or Apps Script webhook is needed for Town.

The command also prints the entrance URL:

```text
https://YOUR-TOWN.onrender.com/auth/slack/start
```

Sign in through that URL as a member of the configured channel. Slack may ask
for consent on first use. Other workspaces and non-channel members are rejected.
A direct visit to `/` can show Basic authentication: use `donut` and the generated
`STAGING_PASSWORD` only for admin preview. Basic authentication does not identify
a member and cannot replace Slack login for purchases or saving an outfit/Home.

## 5. Verify, then invite your team

Your agent can run these commands with the same settings supplied through its
local environment or an ignored `.env.local` file:

```sh
npm run doctor -- --url https://YOUR-TOWN.onrender.com
npm run doctor -- --url https://YOUR-TOWN.onrender.com --live
```

The first command checks configuration locally. `--live` additionally performs
read-only Slack bot/channel checks, a Redis `PING`, an anonymous-member access
check, health and the initial Slack login redirect. It sends no messages and
writes no database data. It never prints credentials or member records. Network
errors fail the check; a sleeping Render instance may need to wake before retrying.
Local credentials must match Render's configuration for these checks to be useful.

Finish in a browser:

1. Use the Slack entrance link and check that **You** and your profile match.
2. Open **Donut Home**, move a starter decoration, reload, and confirm it stayed.
3. If testing invitations, review a dry-run first. Then enable
   `SLACK_ALLOW_SEND=true` in Render and test with an agreed recipient; check both
   the invitation and its Accept / Not this week callback. Enabling the flag
   permits real DMs to channel members. An agent needs explicit approval before
   sending a message; the flag alone is not approval.
4. Add the entrance URL as a channel bookmark/tab or post and pin it yourself.
   Members need only that link; they do not need the deployment credentials.

Keep the service connected to **your fork** so upstream commits do not deploy
to your team automatically. Review upstream changes before merging them into
your deployment branch. Render's [deploy button documentation](https://render.com/docs/deploy-to-render)
explains why direct upstream deployments require extra care with auto-deploys.

## Hosting and cost

The included Blueprint selects Render's free plan for evaluation. Free web
services sleep after 15 minutes without inbound traffic, and waking takes
roughly a minute. For a team relying on Slack interactions, select an always-on
paid instance and review the current cost before approving it. Do not rely on
artificial keep-alive traffic. [Render free-service limitations](https://render.com/docs/free).

Upstash has its own request, storage and pricing limits. Choose its plan based
on your roster and usage; the project does not promise an indefinitely free
production deployment. Assets are static files; generated character art does
not require a paid image API at runtime.

Run **one web instance**. Presence, anti-replay tracking and the active invitation
cache have process-local state; horizontal scaling requires additional coordination.
Redis persists outfits, purchases, Home layouts and chat confirmations across
restarts. Do not save production state to Render's ephemeral local filesystem.

## Local development

Use Node.js 22+ for all repository tooling. `npm ci`, copy `.env.example` to
`.env.local`, fill your development app values, then `npm start`.

For Slack login and callbacks, expose the local service through your chosen
HTTPS development tunnel, set `PUBLIC_BASE_URL` to that origin, and rerun
`npm run setup -- --url https://YOUR-TUNNEL-HOST`. Apply those callbacks to a
**development** Slack app. Keep production callback settings intact. A plain
localhost browser visit is useful for UI work but cannot receive Slack callbacks.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Login redirects to someone else's town | Remove stale `PUBLIC_BASE_URL`; set both Slack callbacks to your own origin. |
| `redirect_uri` error | Match scheme, hostname and `/auth/slack/callback` exactly. |
| Login succeeds in Slack but Town rejects access | Same app/workspace credentials, membership in the configured channel, and bot access to that channel. |
| `missing_scope` / `channel_not_found` | Apply scopes, reinstall the app, verify the channel ID, and add the bot to it. |
| Password prompt / saves require Slack login | Start at `/auth/slack/start`, not `/`; Basic auth is only an admin preview. |
| Map waits for residents | Let the instance wake; check bot token/channel access and app logs. No credentials means no offline demo roster. |
| Outfits, purchases or Home will not save | Both Upstash REST values, a read/write token, and a real Slack session. |
| Invitations are only previews | `SLACK_ALLOW_SEND=false`; enable only when ready for real messages. |
| New secret was added to the Blueprint but is absent on Render | `sync: false` prompts only at initial creation; add new values in Environment manually. |
| Custom art falls back to a starter | Binding belongs to a different signing secret or asset validation failed. See customization. |
