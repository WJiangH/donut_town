import { createPublicKey, verify } from "node:crypto";

const SLACK_ISSUER = "https://slack.com";

export function buildSlackAuthorizeUrl({ clientId, redirectUri, state, nonce, team }) {
  const url = new URL("https://slack.com/openid/connect/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    scope: "openid profile",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    nonce,
    response_mode: "form_post",
    ...(team ? { team } : {})
  });
  return url.toString();
}

export async function exchangeSlackCode({ clientId, clientSecret, code, redirectUri, fetchImpl = fetch }) {
  const response = await fetchImpl("https://slack.com/api/openid.connect.token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret
    })
  });
  const result = await response.json();
  if (!response.ok || !result.ok || typeof result.id_token !== "string") {
    throw new Error(`Slack OpenID token exchange failed: ${result.error || response.status}`);
  }
  return result;
}

export async function fetchSlackJwks(fetchImpl = fetch) {
  const response = await fetchImpl("https://slack.com/openid/connect/keys");
  if (!response.ok) throw new Error(`Slack OpenID key request failed: ${response.status}`);
  const result = await response.json();
  if (!Array.isArray(result.keys) || result.keys.length === 0) throw new Error("Slack OpenID keys are missing");
  return result.keys;
}

export function verifySlackIdToken(idToken, { clientId, nonce, jwks, now = Date.now() }) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw new Error("Slack ID token is malformed");
  const [encodedHeader, encodedPayload, signature] = parts;
  const header = decodeJson(encodedHeader, "header");
  const claims = decodeJson(encodedPayload, "claims");
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Slack ID token algorithm is invalid");
  const jwk = jwks.find(candidate => candidate.kid === header.kid && candidate.kty === "RSA");
  if (!jwk) throw new Error("Slack ID token signing key was not found");
  const validSignature = verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(signature, "base64url")
  );
  if (!validSignature) throw new Error("Slack ID token signature is invalid");

  const nowSeconds = Math.floor(now / 1000);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== SLACK_ISSUER) throw new Error("Slack ID token issuer is invalid");
  if (!audience.includes(clientId)) throw new Error("Slack ID token audience is invalid");
  if (!Number.isInteger(claims.exp) || claims.exp <= nowSeconds) throw new Error("Slack ID token has expired");
  if (!Number.isInteger(claims.iat) || claims.iat > nowSeconds + 60) throw new Error("Slack ID token issue time is invalid");
  if (claims.nonce !== nonce) throw new Error("Slack ID token nonce is invalid");
  return claims;
}

function decodeJson(encoded, label) {
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new Error(`Slack ID token ${label} is invalid`);
  }
}
