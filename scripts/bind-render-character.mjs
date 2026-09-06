#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { findMember } from '../.agents/skills/donut-town-pixel-art/scripts/fetch-render-avatar.mjs';

// Read member identity only in memory; public assignments contain keyed hashes.
const [name, id, mode] = process.argv.slice(2);
if (!name || !/^r-[a-z0-9-]+$/.test(id || '') || (mode && mode !== '--verify')) {
  throw new Error('Usage: node scripts/bind-render-character.mjs "Member name" r-character-id [--verify]');
}
process.loadEnvFile(new URL('../.env.local', import.meta.url));
if (!process.env.STAGING_PASSWORD) throw new Error('Missing local STAGING_PASSWORD');
const origin = 'https://donut-town.onrender.com';
const headers = { authorization: 'Basic ' + Buffer.from('donut:' + process.env.STAGING_PASSWORD).toString('base64') };
async function get(path) {
  const response = await fetch(origin + path, { headers, redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Render returned HTTP ${response.status}`);
  return response;
}
const manifest = JSON.parse(await readFile(new URL(`../characters/${id}.json`, import.meta.url), 'utf8'));
if (!new RegExp(`^/assets/residents/${id}/[a-z0-9-]+\\.png$`).test(manifest.url)) throw new Error('Unexpected character asset path');
const localImage = await readFile(new URL('..' + manifest.url, import.meta.url));
const member = findMember((await (await get('/api/slack/members')).json()).members, name);
if (!/^[a-f0-9]{64}$/.test(member.characterKey || '')) throw new Error('Render must supply characterKey; never substitute a local hash');
const path = new URL('../characters/assignments.json', import.meta.url);
const bindings = JSON.parse(await readFile(path, 'utf8'));
if (mode === '--verify') {
  if (bindings[member.characterKey] !== id || member.character?.url !== manifest.url
    || JSON.stringify(member.character) !== JSON.stringify(manifest)) throw new Error('Live member binding or manifest does not match');
  const remoteImage = Buffer.from(await (await get(manifest.url)).arrayBuffer());
  const hash = data => createHash('sha256').update(data).digest('hex');
  if (hash(localImage) !== hash(remoteImage)) throw new Error('Live sprite bytes differ');
  console.log('PASS: Render member binding, manifest and generated sprite match.');
} else {
  if (bindings[member.characterKey] && bindings[member.characterKey] !== id) throw new Error('Member already has another character; review replacement explicitly');
  if (Object.entries(bindings).some(([key, value]) => value === id && key !== member.characterKey)) throw new Error('Character already has another key; review identity or key rotation explicitly');
  bindings[member.characterKey] = id;
  await writeFile(path, JSON.stringify(bindings, null, 2) + '\n');
  console.log('Saved Render-derived binding. Deploy, then rerun with --verify. No raw identity saved.');
}
