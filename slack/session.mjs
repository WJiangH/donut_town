import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

const VERSION = "v1";

export function createLaunchToken({ userId, channelId, signingSecret, now = Date.now(), ttlSeconds = 300 }) {
  return createToken({
    type: "launch",
    sub: userId,
    channel: channelId,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + ttlSeconds,
    jti: randomUUID()
  }, signingSecret);
}

export function createSessionToken({ userId, channelId, signingSecret, now = Date.now(), ttlSeconds = 8 * 60 * 60 }) {
  return createToken({
    type: "session",
    sub: userId,
    channel: channelId,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + ttlSeconds
  }, signingSecret);
}

export function createOAuthStateToken({ signingSecret, now = Date.now(), ttlSeconds = 10 * 60 }) {
  return createToken({
    type: "oauth_state",
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + ttlSeconds,
    jti: randomUUID(),
    nonce: randomBytes(24).toString("base64url")
  }, signingSecret);
}

export function verifyOAuthStateToken(token, { signingSecret, now = Date.now() }) {
  const payload = verifySignedToken(token, { signingSecret, now });
  if (!payload || payload.type !== "oauth_state") return null;
  if (typeof payload.jti !== "string" || !payload.jti) return null;
  if (typeof payload.nonce !== "string" || payload.nonce.length < 20) return null;
  return payload;
}

export function verifyTownToken(token, { signingSecret, expectedType, expectedChannelId, now = Date.now() }) {
  const payload = verifySignedToken(token, { signingSecret, now });
  if (!payload) return null;
  if (payload.type !== expectedType || payload.channel !== expectedChannelId) return null;
  if (!/^[UW][A-Z0-9]+$/.test(payload.sub || "")) return null;
  if (expectedType === "launch" && (typeof payload.jti !== "string" || !payload.jti)) return null;
  return payload;
}

export function parseCookies(header = "") {
  const cookies = {};
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies[key] = value;
  }
  return cookies;
}

function createToken(payload, signingSecret) {
  if (!signingSecret) throw new Error("Slack signing secret is required");
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${VERSION}.${encoded}.${sign(encoded, signingSecret)}`;
}

function verifySignedToken(token, { signingSecret, now }) {
  if (!token || !signingSecret) return null;
  const [version, encoded, signature, extra] = token.split(".");
  if (version !== VERSION || !encoded || !signature || extra) return null;
  const expected = sign(encoded, signingSecret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const nowSeconds = Math.floor(now / 1000);
  if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) return null;
  if (payload.iat > nowSeconds + 60 || payload.exp <= nowSeconds) return null;
  return payload;
}

function sign(encoded, signingSecret) {
  return createHmac("sha256", signingSecret)
    .update(`donut-town:${VERSION}:${encoded}`)
    .digest("base64url");
}
