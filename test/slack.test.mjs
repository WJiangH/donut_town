import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, sign as rsaSign } from "node:crypto";
import test from "node:test";
import { SlackClient } from "../slack/client.mjs";
import { activeRoundId, answerInvitation, appearanceIndexFor, createInvitation, discardInvitation, invitationMessage, invitationSnapshotFor, invitationStateFor, pendingInvitationsFor, resolveInvitationActors, restoreInvitationSnapshots } from "../slack/invitations.mjs";
import { decodeLedgerSnapshot, encodeLedgerSnapshot } from "../slack/ledger.mjs";
import { buildSlackAuthorizeUrl, verifySlackIdToken } from "../slack/oidc.mjs";
import { createLaunchToken, createOAuthStateToken, createSessionToken, parseCookies, verifyOAuthStateToken, verifyTownToken } from "../slack/session.mjs";
import { verifySlackRequest } from "../slack/signature.mjs";
import { keyForRound, UpstashInvitationStore } from "../slack/upstash-store.mjs";

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
    { ok: true, user: { id: "U1", name: "maya", real_name: "Maya", tz: "America/Los_Angeles", tz_label: "Pacific Time", profile: { display_name: "Maya C", image_72: "small.png", image_192: "large.png", title: "Materials Scientist", pronouns: "she/her", status_text: "In the lab" } } },
    { ok: true, user: { id: "U2", name: "bot", is_bot: true, profile: {} } }
  ];
  const methods = [];
  const requests = [];
  const client = new SlackClient("xoxb-test", async (url, options) => {
    methods.push(url.split("/").pop());
    requests.push(options);
    return { ok: true, json: async () => replies.shift() };
  });
  const members = await client.listChannelMembers("C1");
  assert.deepEqual(methods, ["conversations.members", "conversations.members", "users.info", "users.info"]);
  assert.match(requests[0].headers["content-type"], /^application\/x-www-form-urlencoded/);
  assert.equal(requests[0].body.get("channel"), "C1");
  assert.equal(requests[2].body.get("user"), "U1");
  assert.deepEqual(members, [{
    id: "U1",
    displayName: "Maya C",
    realName: "Maya",
    avatarUrl: "large.png",
    title: "Materials Scientist",
    pronouns: "she/her",
    statusText: "In the lab",
    timezone: "America/Los_Angeles",
    timezoneLabel: "Pacific Time"
  }]);
});

test("member profiles are cached between town refreshes", async () => {
  const methods = [];
  const client = new SlackClient("xoxb-test", async url => {
    const method = url.split("/").pop();
    methods.push(method);
    return {
      ok: true,
      json: async () => method === "conversations.members"
        ? { ok: true, members: ["U1"], response_metadata: { next_cursor: "" } }
        : { ok: true, user: { id: "U1", real_name: "Maya", profile: {} } }
    };
  });
  await client.listChannelMembers("C1");
  await client.listChannelMembers("C1");
  assert.deepEqual(methods, ["conversations.members", "users.info", "conversations.members"]);
});

test("an invitation can only be answered once by its invitee", () => {
  const invitation = createInvitation({ inviterId: "U1", inviteeId: "U2", inviterName: "Maya" });
  assert.equal(answerInvitation(invitation.id, "accepted", "U3"), null);
  assert.equal(answerInvitation(invitation.id, "accepted", "U2").status, "accepted");
  assert.equal(answerInvitation(invitation.id, "declined", "U2"), null);
  assert.equal(invitationMessage(invitation).blocks[1].elements[0].value, invitation.id);
  assert.equal(appearanceIndexFor("U2"), appearanceIndexFor("U2"));
  discardInvitation(invitation.id);
});

test("acceptance books both people and closes their other pending invitations", () => {
  const first = createInvitation({ inviterId: "U10", inviteeId: "U20", inviterName: "Maya" });
  const second = createInvitation({ inviterId: "U10", inviteeId: "U30", inviterName: "Maya" });
  assert.deepEqual(invitationStateFor("U10"), { status: "open", partnerId: null, pairId: null });
  assert.deepEqual(invitationStateFor("U20"), { status: "pending", partnerId: "U10", pairId: null });

  answerInvitation(first.id, "accepted", "U20");
  assert.deepEqual(invitationStateFor("U10"), { status: "booked", partnerId: "U20", pairId: first.id });
  assert.deepEqual(invitationStateFor("U20"), { status: "booked", partnerId: "U10", pairId: first.id });
  assert.deepEqual(invitationStateFor("U30"), { status: "open", partnerId: null, pairId: null });
  assert.equal(answerInvitation(second.id, "accepted", "U30"), null);

  discardInvitation(first.id);
  discardInvitation(second.id);
});

test("weekly invitation snapshots restore pending and accepted pair state", () => {
  const invitation = createInvitation({ inviterId: "U40", inviteeId: "U50", inviterName: "Maya" });
  const pendingSnapshot = invitationSnapshotFor("U40");
  discardInvitation(invitation.id);
  restoreInvitationSnapshots([pendingSnapshot]);
  assert.equal(invitationStateFor("U50").status, "pending");

  answerInvitation(invitation.id, "accepted", "U50");
  const acceptedSnapshot = invitationSnapshotFor("U40");
  discardInvitation(invitation.id);
  restoreInvitationSnapshots([acceptedSnapshot]);
  assert.deepEqual(invitationStateFor("U40"), { status: "booked", partnerId: "U50", pairId: invitation.id });
  discardInvitation(invitation.id);
});

test("Slack ledger records are versioned and weekly", () => {
  assert.equal(activeRoundId(new Date("2026-09-05T12:00:00Z")), "week:2026-08-31");
  const snapshot = { version: 1, roundId: "week:2026-08-31", inviterId: "U1", invitations: [] };
  assert.deepEqual(decodeLedgerSnapshot(encodeLedgerSnapshot(snapshot)), snapshot);
  assert.equal(decodeLedgerSnapshot("ordinary Slack message"), null);
});

test("Upstash stores and restores one weekly invitation snapshot", async () => {
  const calls = [];
  let stored = null;
  const store = new UpstashInvitationStore({
    url: "https://example.upstash.io/",
    token: "test-token",
    fetchImpl: async (url, options) => {
      const command = JSON.parse(options.body);
      calls.push({ url, command, authorization: options.headers.authorization });
      if (command[0] === "SET") stored = command[2];
      return { ok: true, json: async () => ({ result: command[0] === "GET" ? stored : "OK" }) };
    }
  });
  const roundId = "week:2026-08-31";
  const snapshots = [{ version: 1, roundId, inviterId: "U1", invitations: [] }];
  await store.save(roundId, snapshots);
  assert.deepEqual(await store.load(roundId), snapshots);
  assert.equal(calls[0].url, "https://example.upstash.io");
  assert.equal(calls[0].authorization, "Bearer test-token");
  assert.deepEqual(calls.map(call => call.command.slice(0, 2)), [
    ["SET", "donut-town:invitations:week:2026-08-31"],
    ["GET", "donut-town:invitations:week:2026-08-31"]
  ]);
  assert.equal(keyForRound(roundId), "donut-town:invitations:week:2026-08-31");
});

test("Upstash distinguishes a missing week from an intentionally empty week", async () => {
  let stored = null;
  const store = new UpstashInvitationStore({
    url: "https://example.upstash.io",
    token: "test-token",
    fetchImpl: async (_url, options) => {
      const command = JSON.parse(options.body);
      if (command[0] === "SET") stored = command[2];
      return { ok: true, json: async () => ({ result: command[0] === "GET" ? stored : "OK" }) };
    }
  });
  const roundId = "week:2026-08-31";
  assert.equal(await store.load(roundId), null);
  await store.save(roundId, []);
  assert.deepEqual(await store.load(roundId), []);
});

test("invitation identity comes from the Slack session and channel roster", () => {
  const members = [
    { id: "U1", displayName: "Maya" },
    { id: "U2", displayName: "Avery" }
  ];
  assert.deepEqual(resolveInvitationActors({ sessionUserId: "U1", inviteeId: "U2", priority: 2, members }), {
    inviterId: "U1",
    inviterName: "Maya",
    inviteeId: "U2",
    priority: 2,
    selfTest: false
  });
  assert.throws(() => resolveInvitationActors({ sessionUserId: "U1", inviteeId: "U3", members }), /must be members/);
  assert.throws(() => resolveInvitationActors({ sessionUserId: "U1", inviteeId: "U1", members }), /yourself/);
  const selfTestInput = resolveInvitationActors({ sessionUserId: "U1", inviteeId: "U1", members, allowSelfInvite: true });
  assert.equal(selfTestInput.selfTest, true);
  const selfTestInvitation = createInvitation(selfTestInput);
  const selfTestMessage = invitationMessage(selfTestInvitation);
  assert.match(selfTestMessage.text, /Test preview: Maya invited you/);
  assert.match(selfTestMessage.blocks[0].text.text, /Test preview/);
  assert.match(selfTestMessage.blocks[0].text.text, /<@U1> would like to have a Donut chat/);
  assert.equal(pendingInvitationsFor("U1").some(item => item.id === selfTestInvitation.id), false);
  discardInvitation(selfTestInvitation.id);
  const invitation = createInvitation({ inviterId: "U1", inviteeId: "U2", inviterName: "Maya", priority: 1 });
  assert.match(invitationMessage(invitation).blocks[0].text.text, /<@U1> would like to have a Donut chat/);
  assert.equal(pendingInvitationsFor("U1").some(item => item.id === invitation.id), true);
  discardInvitation(invitation.id);
  assert.equal(pendingInvitationsFor("U1").some(item => item.id === invitation.id), false);
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

test("OAuth state is signed, single-purpose, and expires", () => {
  const signingSecret = "test-signing-secret";
  const now = 1788540000_000;
  const state = createOAuthStateToken({ signingSecret, now, ttlSeconds: 600 });
  const verified = verifyOAuthStateToken(state, { signingSecret, now: now + 1_000 });
  assert.equal(verified.type, "oauth_state");
  assert.equal(typeof verified.nonce, "string");
  assert.ok(verified.nonce.length >= 20);
  assert.equal(verifyOAuthStateToken(`${state}x`, { signingSecret, now }), null);
  assert.equal(verifyOAuthStateToken(state, { signingSecret, now: now + 601_000 }), null);
});

test("Slack OpenID authorization and ID token bind identity to client and nonce", () => {
  const clientId = "123.456";
  const nonce = "a-private-browser-nonce";
  const redirectUri = "https://donut-town.onrender.com/auth/slack/callback";
  const authorizeUrl = new URL(buildSlackAuthorizeUrl({ clientId, redirectUri, state: "signed-state", nonce, team: "T123ABC" }));
  assert.equal(authorizeUrl.origin + authorizeUrl.pathname, "https://slack.com/openid/connect/authorize");
  assert.equal(authorizeUrl.searchParams.get("scope"), "openid profile");
  assert.equal(authorizeUrl.searchParams.get("redirect_uri"), redirectUri);
  assert.equal(authorizeUrl.searchParams.get("response_mode"), "form_post");
  assert.equal(authorizeUrl.searchParams.get("team"), "T123ABC");

  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = publicKey.export({ format: "jwk" });
  jwk.kid = "test-key";
  jwk.use = "sig";
  const now = 1788540000_000;
  const claims = {
    iss: "https://slack.com",
    aud: clientId,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + 300,
    nonce,
    sub: "U123ABC",
    "https://slack.com/user_id": "U123ABC",
    "https://slack.com/team_id": "T123ABC"
  };
  const idToken = createTestIdToken(claims, privateKey, jwk.kid);
  assert.equal(verifySlackIdToken(idToken, { clientId, nonce, jwks: [jwk], now }).sub, "U123ABC");
  assert.throws(() => verifySlackIdToken(idToken, { clientId, nonce: "wrong", jwks: [jwk], now }), /nonce/);
  assert.throws(() => verifySlackIdToken(idToken, { clientId: "other-client", nonce, jwks: [jwk], now }), /audience/);
  assert.throws(() => verifySlackIdToken(idToken, { clientId, nonce, jwks: [jwk], now: now + 301_000 }), /expired/);
});

function createTestIdToken(claims, privateKey, kid) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const signature = rsaSign("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}
