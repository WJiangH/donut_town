#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SlackClient } from '../../../../slack/client.mjs';

const REQUIRED_ACTIONS = ['sitChair', 'sitGrass', 'garden', 'lookout', 'read', 'coffee', 'experiment'];
const missingActions = process.argv.includes('--missing-actions');

process.loadEnvFile(fileURLToPath(new URL('../../../../.env.local', import.meta.url)));
if (!process.env.STAGING_PASSWORD) throw new Error('Set STAGING_PASSWORD in the ignored local .env.local file.');
const endpoint = 'https://donut-town.onrender.com/api/slack/members';
const response = await fetch(endpoint, {
  headers: { accept: 'application/json', authorization: 'Basic ' + Buffer.from('donut:' + process.env.STAGING_PASSWORD).toString('base64') },
  redirect: 'error', signal: AbortSignal.timeout(30000)
});
if (!response.ok) throw new Error(`Render returned HTTP ${response.status}`);
const payload = await response.json();
const assignments = JSON.parse(readFileSync(new URL('../../../../characters/assignments.json', import.meta.url), 'utf8'));
const slack = process.env.SLACK_BOT_TOKEN ? new SlackClient(process.env.SLACK_BOT_TOKEN) : null;
const rows = [];
for (const member of payload.members || []) {
  const name = member.displayName || member.realName || '';
  const assignedId = assignments[member.characterKey] || null;
  let isCustom = member.isCustomAvatar ?? member.avatarIsCustom ?? null;
  let eligibilitySource = 'render';
  if (isCustom === null && slack && member.id) {
    const profile = await slack.getUser(member.id);
    isCustom = profile?.profile?.is_custom_image ?? profile?.is_custom_image ?? null;
    eligibilitySource = 'slack-profile-metadata';
  }
  const avatarUrl = member.avatarUrl || '';
  const looksDefault = /secure\.gravatar\.com|\/ava_00\d{2}-/.test(avatarUrl);
  let skip = null;
  let actionIds = [];
  if (assignedId) {
    const character = JSON.parse(readFileSync(new URL(`../../../../characters/${assignedId}.json`, import.meta.url), 'utf8'));
    actionIds = Object.keys(character.actions || {});
  }
  const hasAllActions = REQUIRED_ACTIONS.every(id => actionIds.includes(id));
  if (missingActions) {
    if (!assignedId) skip = looksDefault || isCustom === false ? 'default-avatar' : 'no-character';
    else if (hasAllActions) skip = 'actions-ready';
  } else if (assignedId) skip = 'already-assigned';
  else if (isCustom === false || looksDefault) skip = 'default-avatar';
  rows.push({ name, assignedId, isCustom, eligibilitySource, skip, actionIds, avatarHost: (() => { try { return new URL(avatarUrl).hostname; } catch { return ''; } })() });
}
if (missingActions) {
  console.log(JSON.stringify({
    total: rows.length,
    actionsReady: rows.filter(row => row.skip === 'actions-ready').length,
    missingActions: rows.filter(row => !row.skip && row.assignedId).map(row => ({ name: row.name, id: row.assignedId, have: row.actionIds })),
    skipped: rows.filter(row => row.skip && row.skip !== 'actions-ready').map(row => ({ name: row.name, skip: row.skip, id: row.assignedId || null }))
  }, null, 2));
} else {
  console.log(JSON.stringify({ total: rows.length, skipDefault: rows.filter(row => row.skip === 'default-avatar').length, alreadyAssigned: rows.filter(row => row.skip === 'already-assigned').length, candidates: rows.filter(row => !row.skip).map(row => row.name), skipped: rows.filter(row => row.skip).map(row => ({ name: row.name, skip: row.skip })) }, null, 2));
}
