# Visits, conversations and donuts

Open a neighbor’s profile to **Visit Home** or **Message**. Homes use the same owner key on every town theme. Visiting members can walk around and read the guestbook; only the owner can change rooms or furniture. The left Home panel shows recent visitors; the right shows notes and gifts.

- Kudos, flowers and hearts are free: one of each per visitor/owner every 24 hours.
- A donut gift transfers 1–999 donuts from the visitor’s available balance to the owner. Gifts and shop purchases share the same atomic wallet check.
- Notes and private messages accept up to 1,000 plain-text characters. Each guestbook and conversation retains its latest 100 entries. Visitor lists show the 30 most recent unique visitors.
- Town private messages are a separate inbox, not Slack DMs. Only channel members participating in a conversation can read it through the API. Workspace operators with database access can access stored messages; this is not end-to-end encryption.

**Baking together** lists this week’s accepted Donut Chat pairs and opens their Factory station. It describes the Town pairing activity, not a claim that both people are currently online or that their real conversation has happened.

## Invitation and reward rules

An invitation can be accepted or declined in the Town invitation dock or the existing Slack bot message. Both paths update the same weekly invitation records. New Slack invitation cards are updated to remove their action buttons after an answer; older cards without a stored message reference still enforce the same server state on click. Accepting marks both members booked, cancels their other pending invitations and awards **5 donuts to each person**. Redis commits these changes together; repeated clicks, webhook retries and overlapping app instances do not grant extra donuts. Existing accepted matches from before this feature do not receive a retroactive award.

A member can have one accepted pair per weekly round (Monday UTC). Chat completion remains separate: mutual **We chatted** confirmation adds friendship points, not a second donut reward. To change the earning policy later, keep these two milestones distinct.

Redis/Upstash is required for accepted-pair rewards, gifting, visits and messaging. No new credentials or Slack scopes are needed beyond the existing invitation integration. A legacy deployment without Redis must configure it before accepting real invitations with rewards.

## Storage and loading

Social data lives in Redis under the configured workspace namespace. Member references use the existing server HMAC keys. Original Slack avatars remain runtime URLs and are never copied into Git. Message bodies and guestbook contents must not be checked into the repository.

The feature adds no raster images, asset downloads, dependencies or persistent message cache in Render memory. Private messages poll only while the inbox is open (5 seconds); the Home social feed polls only while Home is visible (20 seconds). Room art and furniture are not reloaded by these polls. Concurrent roster polls share a one-second server snapshot; acceptance always reads durable invitation state. Message and note history is capped; financial idempotency receipts persist so old gift retries cannot charge twice.

## Local verification

`npm test` runs the non-network checks. Set `TEST_CHAT_REDIS_URL` to an isolated local Redis REST fixture to include the real Lua and HTTP integration tests. These tests reject non-local URLs. The HTTP test starts two temporary app workers, supplies synthetic member sessions through `/enter`, intercepts all Slack calls and forbids external network access. It verifies both acceptance paths, duplicate rewards, conflicting acceptances, gift/purchase races, guest read-only access, DM participant isolation and cross-origin write rejection.
