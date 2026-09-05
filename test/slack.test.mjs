import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { SlackClient } from "../slack/client.mjs";
import { answerInvitation, appearanceIndexFor, createInvitation, invitationMessage } from "../slack/invitations.mjs";
import { createLaunchToken, createSessionToken, parseCookies, verifyTownToken } from "../slack/session.mjs";
import { verifySlackRequest } from "../slack/signature.mjs";

test("Slack signatures are checked and stale requests are rejected", () => {
  const signingSecret = "test-secret";
  const timestamp = "1788540000";
  const rawBody = "payload=%7B%22type%22%3A%22block_actions%22%7D";
  const signature = `v0=${createHmac("sha256", signingSecret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
  assert.equal(verifySlackRequest({ signingSecret, timestamp, signature, rawBody, now: 1788540100_000 }), true);
  assert.equal(verifySlackRequest({ signingSecret, timestamp, signature: `${signature}0`, rawBody, now: 1788540100_000 }), false);
  assert.equal(verifySlackRequest({ signingSecret, timestamp, signature, rawBody, now: 1788541000_000 }), false);
});

test("channel members paginate and bots are excluded", async () => {
  const replies = [
    { ok: true, members: ["U1"], response_metadata: { next_cursor: "next" } },
    { ok: true, members: ["U2"], response_metadata: { next_cursor: "" } },
    { ok: true, members: [
      { id: "U1", name: "maya", real_name: "Maya", profile: { display_name: "Maya C", image_72: "a.png" } },
      { id: "U2", name: "bot", is_bot: true, profile: {} },
      { id: "U3", name: "outside", real_name: "Outside Channel", profile: {} }
    ], response_metadata: { next_cursor: "" } }
  ];
  const methods = [];
  const requests = [];
  const client = new SlackClient("xoxb-test", async (url, options) => {
    methods.push(url.split("/").pop());
    requests.push(options);
    return { ok: true, json: async () => replies.shift() };
  });
  const members = await client.listChannelMembers("C1");
  assert.deepEqual(methods, ["conversations.members", "conversations.members", "users.list"]);
  assert.match(requests[0].headers["content-type"], /^application\/x-www-form-urlencoded/);
  assert.equal(requests[0].body.get("channel"), "C1");
  assert.deepEqual(members, [{ id: "U1", displayName: "Maya C", realName: "Maya", avatarUrl: "a.png", timezone: "" }]);
});

test("an invitation can only be answered once by its invitee", () => {
  const invitation = createInvitation({ inviterId: "U1", inviteeId: "U2", inviterName: "Maya" });
  assert.equal(answerInvitation(invitation.id, "accepted", "U3"), null);
  assert.equal(answerInvitation(invitation.id, "accepted", "U2").status, "accepted");
  assert.equal(answerInvitation(invitation.id, "declined", "U2"), null);
  assert.equal(invitationMessage(invitation).blocks[1].elements[0].value, invitation.id);
  assert.equal(appearanceIndexFor("U2"), appearanceIndexFor("U2"));
});

test("town launch and session tokens are signed, scoped, and expire", () => {
  const signingSecret = "test-signing-secret";
  const now = 1788540000_000;
  const launch = createLaunchToken({ userId: "U123ABC", channelId: "C123ABC", signingSecret, now, ttlSeconds: 300 });
  const verifiedLaunch = verifyTownToken(launch, {
    signingSecret,
    expectedType: "launch",
    expectedChannelId: "C123ABC",
    now: now + 10_000
  });
  assert.equal(verifiedLaunch.sub, "U123ABC");
  assert.equal(typeof verifiedLaunch.jti, "string");
  assert.ok(verifiedLaunch.jti.length > 0);
  assert.equal(verifyTownToken(`${launch}x`, { signingSecret, expectedType: "launch", expectedChannelId: "C123ABC", now }), null);
  assert.equal(verifyTownToken(launch, { signingSecret, expectedType: "launch", expectedChannelId: "COTHER", now }), null);
  assert.equal(verifyTownToken(launch, { signingSecret, expectedType: "launch", expectedChannelId: "C123ABC", now: now + 301_000 }), null);

  const session = createSessionToken({ userId: "U123ABC", channelId: "C123ABC", signingSecret, now });
  assert.equal(verifyTownToken(session, { signingSecret, expectedType: "session", expectedChannelId: "C123ABC", now }).sub, "U123ABC");
  assert.deepEqual(parseCookies(`theme=green; donut_town_session=${session}`), { theme: "green", donut_town_session: session });
});
