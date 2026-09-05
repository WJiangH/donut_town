import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SlackClient } from "./slack/client.mjs";
import { answerInvitation, appearanceIndexFor, createInvitation, invitationMessage } from "./slack/invitations.mjs";
import { verifySlackRequest } from "./slack/signature.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
await loadLocalEnv(join(root, ".env.local"));

const config = {
  botToken: process.env.SLACK_BOT_TOKEN || "",
  signingSecret: process.env.SLACK_SIGNING_SECRET || "",
  channelId: process.env.SLACK_CHANNEL_ID || "",
  currentUserId: process.env.SLACK_CURRENT_USER_ID || "",
  allowSend: process.env.SLACK_ALLOW_SEND === "true",
  port: Number(process.env.PORT || 4173)
};
const slack = config.botToken ? new SlackClient(config.botToken) : null;
let memberCache = null;
let memberCacheExpiresAt = 0;
let memberSyncPromise = null;

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (request.method === "GET" && url.pathname === "/api/slack/status") {
      return sendJson(response, 200, {
        configured: Boolean(config.botToken && config.channelId),
        interactivityConfigured: Boolean(config.signingSecret),
        currentUserConfigured: Boolean(config.currentUserId),
        sendEnabled: config.allowSend
      });
    }

    if (request.method === "GET" && url.pathname === "/api/slack/members") {
      if (!slack || !config.channelId) return missingConfiguration(response);
      const members = await getCachedChannelMembers();
      const currentUserFound = members.some(member => member.id === config.currentUserId);
      return sendJson(response, 200, {
        total: members.length,
        currentUserConfigured: Boolean(config.currentUserId),
        currentUserFound,
        members: members.map(member => ({
          ...member,
          appearanceIndex: appearanceIndexFor(member.id),
          isCurrentUser: member.id === config.currentUserId,
          status: "open"
        }))
      });
    }

    if (request.method === "POST" && url.pathname === "/api/slack/invitations") {
      const body = JSON.parse(await readBody(request));
      validateInvitation(body);
      const invitation = createInvitation(body);
      const message = invitationMessage(invitation);
      if (!config.allowSend) {
        return sendJson(response, 200, { ok: true, dryRun: true, invitation, message });
      }
      if (!slack) return missingConfiguration(response);
      const channel = await slack.openDm(invitation.inviteeId);
      await slack.postMessage(channel, message);
      return sendJson(response, 201, { ok: true, dryRun: false, invitation });
    }

    if (request.method === "POST" && url.pathname === "/slack/interactions") {
      const rawBody = await readBody(request);
      const valid = verifySlackRequest({
        signingSecret: config.signingSecret,
        timestamp: request.headers["x-slack-request-timestamp"],
        signature: request.headers["x-slack-signature"],
        rawBody
      });
      if (!valid) return sendJson(response, 401, { ok: false, error: "invalid_signature" });
      const encodedPayload = new URLSearchParams(rawBody).get("payload");
      if (!encodedPayload) return sendJson(response, 400, { ok: false, error: "missing_payload" });
      const payload = JSON.parse(encodedPayload);
      response.writeHead(200);
      response.end();
      queueMicrotask(() => handleSlackAction(payload).catch(error => console.error("Slack action failed", error)));
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") return sendJson(response, 404, { error: "not_found" });
    return serveStatic(url.pathname, response, request.method === "HEAD");
  } catch (error) {
    console.error(error);
    return sendJson(response, error.name === "SyntaxError" ? 400 : 500, { error: error.message });
  }
});

async function getCachedChannelMembers() {
  if (memberCache && Date.now() < memberCacheExpiresAt) return memberCache;
  if (memberSyncPromise) return memberSyncPromise;
  memberSyncPromise = slack.listChannelMembers(config.channelId)
    .then(members => {
      memberCache = members;
      memberCacheExpiresAt = Date.now() + 5 * 60 * 1000;
      return members;
    })
    .catch(error => {
      if (memberCache) return memberCache;
      throw error;
    })
    .finally(() => {
      memberSyncPromise = null;
    });
  return memberSyncPromise;
}

async function handleSlackAction(payload) {
  if (!slack || payload.type !== "block_actions") return;
  const action = payload.actions?.[0];
  if (!action || !["donut_accept", "donut_decline"].includes(action.action_id)) return;
  const status = action.action_id === "donut_accept" ? "accepted" : "declined";
  const invitation = answerInvitation(action.value, status, payload.user.id);
  if (!invitation) {
    await slack.postMessage(payload.channel.id, { text: "This Donut invitation is no longer active." });
    return;
  }
  const responderMessage = status === "accepted"
    ? "Accepted! Donut Town marked you as booked for this week. :doughnut:"
    : "No problem — Donut Town will leave you available for another week.";
  await slack.postMessage(payload.channel.id, { text: responderMessage });
  const inviterChannel = await slack.openDm(invitation.inviterId);
  await slack.postMessage(inviterChannel, {
    text: status === "accepted"
      ? `<@${invitation.inviteeId}> accepted your Donut chat invitation.`
      : `<@${invitation.inviteeId}> is not available for a Donut chat this week.`
  });
}

function validateInvitation(body) {
  for (const key of ["inviterId", "inviteeId", "inviterName"]) {
    if (typeof body[key] !== "string" || !body[key].trim()) throw new SyntaxError(`Missing ${key}`);
  }
  if (!/^[UW][A-Z0-9]+$/.test(body.inviterId) || !/^[UW][A-Z0-9]+$/.test(body.inviteeId)) {
    throw new SyntaxError("Invalid Slack user ID");
  }
  if (body.inviterId === body.inviteeId) throw new SyntaxError("Cannot invite yourself");
  body.priority = Number(body.priority || 1);
  if (!Number.isInteger(body.priority) || body.priority < 1 || body.priority > 5) throw new SyntaxError("Priority must be 1-5");
}

function missingConfiguration(response) {
  return sendJson(response, 503, { error: "slack_not_configured", required: ["SLACK_BOT_TOKEN", "SLACK_CHANNEL_ID"] });
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(response, statusCode, data) {
  const body = JSON.stringify(data);
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
  response.end(body);
}

async function serveStatic(pathname, response, headOnly) {
  const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const filePath = resolve(root, normalize(relativePath));
  if (!filePath.startsWith(resolve(root) + "/")) return sendJson(response, 403, { error: "forbidden" });
  try {
    const metadata = await stat(filePath);
    if (!metadata.isFile()) throw new Error("not_file");
    const body = headOnly ? null : await readFile(filePath);
    response.writeHead(200, { "content-type": contentType(extname(filePath)), "content-length": metadata.size });
    response.end(body);
  } catch {
    sendJson(response, 404, { error: "not_found" });
  }
}

function contentType(extension) {
  return ({
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml"
  })[extension] || "application/octet-stream";
}

async function loadLocalEnv(filePath) {
  try {
    const contents = await readFile(filePath, "utf8");
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

server.listen(config.port, "127.0.0.1", () => {
  console.log(`Donut Town is running at http://127.0.0.1:${config.port}`);
  console.log(config.botToken && config.channelId ? "Slack member sync is configured." : "Slack is in local demo mode; add .env.local to connect.");
  console.log(config.allowSend ? "Slack DM sending is ENABLED." : "Slack DM sending is disabled (dry-run mode)." );
});
