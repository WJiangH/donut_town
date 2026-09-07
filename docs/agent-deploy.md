# Agent deployment runbook

Goal: give the owner a working, private Town entrance for one Slack channel,
with persistent Home/shop/wardrobe state. Follow [deploy.md](deploy.md) for the
account UI steps and exact settings. Do not add Google Sheets to this baseline.

## Inputs and boundaries

Resolve these from the user's existing authorized context before asking:

- Their fork/branch, Slack workspace and target channel.
- Access to Slack app settings, Render and Upstash.
- Hosting plan choice; the checked-in free plan is an evaluation default.
- Credentials through a secret store, environment or ignored `.env.local`.

Batch missing account inputs in one request. Do not ask the owner to choose
scopes, invent callback paths, edit source, or configure a frontend build.
Do not print tokens, passwords, member rosters, source-avatar URLs or OAuth
callback query strings. Do not put secrets in command arguments, git commits,
screenshots or the final report. Do not copy credentials into generated manifests.

A deploy request permits preparing and deploying the requested service through
the owner's authorized accounts. It does not authorize changing repo visibility,
sending Slack messages, upgrading to a paid plan without a budget decision,
replacing an existing bot's manifest wholesale, or deleting production data.
Keep existing environment values during updates, especially the signing secret.

## Execute

1. Inspect the checkout and preserve existing work. Use the user's fork and
   branch, not the upstream maintainer's production service. Read `render.yaml`,
   `.env.example` and `slack/manifest.example.json`.
2. Run `npm ci` and `npm test`. Run `npm run setup`; import the generated
   `.donut/slack-manifest.json` into a **new** Slack app. With an existing app,
   merge the required settings and retain unrelated features. Have the owner
   complete installation/consent if your tools cannot perform it.
3. Obtain the five Slack values and the dedicated database's two Upstash REST
   values. Configure them directly in Render. Let the Blueprint generate the
   admin staging password. Do not rotate existing secrets. Use one web instance.
4. Deploy the fork with the root Blueprint. Record the actual allocated HTTPS
   origin. Leave `PUBLIC_BASE_URL` unset on Render unless using a custom domain.
   Do not infer a hostname from the original project's documentation or scripts.
5. Run `npm run setup -- --url https://ACTUAL-HOST`. Apply its callbacks to the
   new Slack app. Keep OpenID scopes separate from bot scopes. Add the bot to the
   target channel and reinstall if scopes changed.
6. If local checks are available, supply the same credentials through an ignored
   file or environment. Run `npm run doctor -- --url https://ACTUAL-HOST`, then
   its `--live` mode. These checks do not send Slack messages or mutate storage.
   If only Render has credentials, perform equivalent checks there; do not call
   a local missing-env failure a deployed-service failure.
7. Verify browser sign-in through `/auth/slack/start`, the current member's
   profile and Home save/reload. Do not claim successful OAuth from a health
   endpoint or initial redirect. A custom wardrobe check requires a rigged
   character; skip it explicitly if the workspace only has starter characters.
8. Keep `SLACK_ALLOW_SEND=false` until the owner authorizes the recipient and
   message test. If authorized, enable sending and verify the invitation and
   response flow. Otherwise report messaging as configured but untested. Give the
   owner the entrance link; do not post it to Slack without permission.

## Completion evidence

Report the fork/commit, actual service origin, channel entrance URL, storage
check result, browser sign-in and save/reload results, and messaging status.
List any remaining owner actions and the precise missing access. Do not claim
an unperformed fresh-account deployment, security audit, load test or recurring
Lottery sync. Existing project sessions are not proof that a new installation works.

For optional character generation, follow the pixel-art skill after deployment.
Set the local helper's `PUBLIC_BASE_URL` to the new service first; use only
Render-returned character keys for bindings. No image generation is necessary
for the initial installation.
