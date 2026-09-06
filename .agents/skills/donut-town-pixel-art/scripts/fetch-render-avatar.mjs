#!/usr/bin/env node
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SlackClient } from '../../../../slack/client.mjs';

export function findMember(members, query) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) throw new Error('Provide a member name.');
  const names = member => [member.displayName, member.realName].filter(Boolean).map(value => value.toLocaleLowerCase());
  const exact = members.filter(member => names(member).includes(normalized));
  const matches = exact.length ? exact : members.filter(member => names(member).some(name => name.includes(normalized)));
  if (matches.length !== 1) throw new Error(matches.length ? `Multiple matches: ${matches.map(member => member.displayName).join(', ')}. Use a full name.` : 'No matching town member.');
  return matches[0];
}

async function main() {
  const query = process.argv.slice(2).join(' ').trim();
  if (!query) throw new Error('Usage: node fetch-render-avatar.mjs "Member name"');
  process.loadEnvFile(fileURLToPath(new URL('../../../../.env.local', import.meta.url)));
  if (!process.env.STAGING_PASSWORD) throw new Error('Set STAGING_PASSWORD in the ignored local .env.local file; never paste it into chat.');
  const endpoint = 'https://donut-town.onrender.com/api/slack/members';
  const response = await fetch(endpoint, {
    headers: { accept: 'application/json', authorization: 'Basic ' + Buffer.from('donut:' + process.env.STAGING_PASSWORD).toString('base64') },
    redirect: 'error', signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`Render returned HTTP ${response.status}; do not bypass authentication or print credentials.`);
  const payload = await response.json();
  if (!Array.isArray(payload.members)) throw new Error('Render response has no member array.');
  const member = findMember(payload.members, query);
  let isCustom = member.isCustomAvatar ?? member.avatarIsCustom ?? null;
  let eligibilitySource = 'render';
  // Older deployed member payloads omit this flag. Verify only this member's
  // eligibility with the existing Slack adapter; the image URL stays from Render.
  if (isCustom === null && process.env.SLACK_BOT_TOKEN) {
    const profile = await new SlackClient(process.env.SLACK_BOT_TOKEN).getUser(member.id);
    isCustom = profile?.profile?.is_custom_image ?? profile?.is_custom_image ?? null;
    eligibilitySource = 'slack-profile-metadata';
  }
  if (isCustom !== true) throw new Error(isCustom === false ? 'Member uses a default avatar; skip character generation.' : 'Custom-avatar eligibility is unavailable; keep the existing character.');
  const avatar = new URL(member.avatarUrl);
  if (avatar.protocol !== 'https:' || !(avatar.hostname === 'avatars.slack-edge.com' || avatar.hostname.endsWith('.slack-edge.com'))) throw new Error('Unexpected avatar origin; inspect it before downloading.');
  const imageResponse = await fetch(avatar, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!imageResponse.ok) throw new Error(`Avatar returned HTTP ${imageResponse.status}.`);
  const mime = imageResponse.headers.get('content-type')?.split(';')[0];
  const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[mime];
  if (!extension) throw new Error('Unsupported avatar image format.');
  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('Avatar size is unexpected.');
  const directory = await mkdtemp(join(tmpdir(), 'donut-avatar-'));
  const imagePath = join(directory, `reference.${extension}`);
  const metadataPath = join(directory, 'private-source.json');
  await writeFile(imagePath, bytes, { mode: 0o600 });
  await writeFile(metadataPath, JSON.stringify({ memberId: member.id, name: member.displayName, imagePath, endpoint, avatarUrl: member.avatarUrl, isCustom, eligibilitySource, retrievedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ name: member.displayName, imagePath, metadataPath, source: 'render-member-api', eligibilitySource, mime, bytes: bytes.length }, null, 2));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
