# Optional: weekly Lottery automation

**Town does not require this.** Start with [the basic deployment](deploy.md).
The `Google_Script/` files support an additional Sheet-managed signup/weekly
pairing workflow. They do not currently import completed chats or currency into
Town. The Sheet profile bridge is a retained prototype, not the live profile source.

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
