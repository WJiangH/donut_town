# Optional: weekly Lottery automation

**Town does not require this.** Start with [the basic deployment](deploy.md).
The `Google_Script/` files support an additional Sheet-managed signup/weekly
pairing workflow. With Town sync enabled, accepted Town invitations and scheduled
pairings share the same weekly bookings and +5-donut rewards. Completed-chat
confirmation remains a separate action in Town. The Sheet profile bridge is a
retained prototype, not the live profile source.

For a team that explicitly wants the extra workflow:

1. Create a private Google Sheet and its bound Apps Script project. Copy
   `Code.gs`, `Automation.gs` and `ProfileApi.gs` from `Google_Script/`.
2. Store `SLACK_TOKEN` in **Script Properties**, never in source. In addition to
   the basic Town scopes, this workflow reads channel history and reactions and
   adds reaction acknowledgments: review `channels:history` / `groups:history`,
   `reactions:read` and `reactions:write` for the selected channel. Add
   `users:read.email` only if the optional Sheet email field is needed. Reinstall
   after scope changes and keep the app in the channel.
3. Run `initializeDonutSheets()` to create `Configs`, `Rounds` and `Members`.
   Set `Configs.CHANNEL_ID` and **your own** `Configs.TOWN_URL` ending in
   `/auth/slack/start`. New sheets have no default Town URL.
4. Review timezone, weekday/time, signup duration, emoji and message copy in
   `Configs`. Keep member and manager details in the private Sheet.
5. After approval to schedule real messages, run `setupDonutAutomation()` once.
   It replaces only the Donut-owned triggers with one idempotent 15-minute tick.
   Scheduling is approximate: the first tick at/after the chosen local time runs
   the job. Round/message state lives in `Rounds`.

`postDonutTownEntrance()` posts a channel message with the Town link; run it only
when that message is authorized. No `doPost(e)` is needed for the basic Town
entrance: Slack login and signed interactions are handled by the Node service.
Do not expose the Sheet or publish the legacy profile bridge as part of setup.

An optional private Slack invitation ledger also exists via
`SLACK_LEDGER_CHANNEL_ID`, requiring the app in that channel and `groups:history`.
It is a fallback for invitations, not a substitute for Upstash outfit, shop,
Home or friendship storage. Its retention follows workspace policy.

## Connect the 24-hour pairing to Town

For an existing Sheet deployment, replace **Code.gs and Automation.gs** with the
files in this repo. A Git/Render deployment does **not** update the Sheet script.

1. Generate a random secret, for example `openssl rand -hex 32`. Save the same
   value as `LOTTERY_SYNC_SECRET` in **Render Environment** and **Apps Script →
   Project Settings → Script Properties**. Keep it out of the Sheet, source and
   Slack messages. This is a dedicated service credential, not a member session.
2. In the Sheet's `Configs`, set `TOWN_URL` to your Town's
   `https://…/auth/slack/start` and `TOWN_SYNC_ENABLED` to `TRUE`. Running
   `initializeDonutSheets()` adds the new setting without replacing existing rows.
   Keep the channel ID identical to Render's `SLACK_CHANNEL_ID`.
3. Render must have persistent Upstash storage and `SLACK_ALLOW_SEND=true` for
   thread reminders. Run `checkTownPairingConnection()` in Apps Script to verify
   the connection; this check sends no Slack message and creates no pairs.
4. Keep the existing `donutAutomationTick` trigger. New weekly signup messages
   include both a plain Town link and the entrance button. The script registers
   that message as this week's thread. An existing, unprocessed signup message
   from this week is registered on the next tick too.

Members can invite anyone eligible in the channel from Town and accept in Town
or the Bot's DM. A successful acceptance books both people for the UTC week,
awards each 5 donuts, and queues a reply under the signup message. Pending,
declined and self-test invitations do not create pair announcements.

After `SIGNUP_HOURS` (24 by default), the script removes booked members from the
reaction pool, applies the existing manager/history constraints, and submits
the whole batch atomically. If someone accepts a Town invitation between the
pool read and submission, the batch is rejected without partial bookings or
rewards; the next tick rebuilds the pool. Script retries resume a saved batch
instead of drawing or rewarding again. Random pairs appear in Town, including
the Factory, through the same invitation-state feed.

Successful pairs are announced in the original thread, without broadcasting
each reply into the channel. This uses Slack's standard
[`thread_ts` message field](https://docs.slack.dev/reference/methods/chat.postmessage).
The next tick retries failed reminders, even after the signup message is marked
done. Sent notices are recorded, and a short Redis lease prevents simultaneous
workers from sending the same notice. A lost Slack response after actual delivery
can still cause a duplicate reminder on retry; pair booking and rewards remain
idempotent. Notifications may be delayed by Slack failures or Render startup.

With sync enabled, an odd remaining member stays available to find a partner in
Town; the legacy “join any pair as a trio” message is not used because Town
currently represents pairs of two. The original trio behavior is unchanged when
sync is disabled. This does not change the separate new-hire lottery.

Town's existing round boundary is **Monday 00:00 UTC**. Signup must open and close
in the same UTC week, with one canonical signup announcement per channel/week.
The integration rejects a crossing window or conflicting announcement instead
of silently matching into the wrong round. The default Monday posting +24 hours
fits this rule. Disabling sync reverts to the independent legacy lottery;
keep it enabled once the workflows are connected.

The `/api/lottery` endpoint verifies a timestamped HMAC-SHA256 body using the
dedicated secret. Apps Script signs it with
[`Utilities.computeHmacSha256Signature`](https://developers.google.com/apps-script/reference/utilities/utilities).
Unsigned requests, wrong channels and stale signatures are rejected. If sync is
enabled but unavailable, the script pauses pairing; it never falls back to an
unfiltered draw. No Google Sheet public web-app deployment is needed.

Local checks: `node --test test/apps-script-pairing.test.mjs test/lottery-bridge.test.mjs`.
For atomicity and HTTP integration cases, also set `TEST_CHAT_REDIS_URL` to an
isolated localhost Redis REST fixture and include
`test/social-http.integration.test.mjs`. Those cases mock Slack and use invented
members; they must never target production storage.
