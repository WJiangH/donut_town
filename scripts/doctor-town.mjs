#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { townOrigin } from './setup-town.mjs';

export function parseEnv(contents, inherited = {}) {
  const env = { ...inherited };
  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const split = line.indexOf('=');
    if (split < 1) continue;
    const key = line.slice(0, split).trim();
    let value = line.slice(split + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in env)) env[key] = value;
  }
  return env;
}
const required = ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'SLACK_CHANNEL_ID', 'SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET', 'STAGING_PASSWORD', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];
const placeholder = value => !value || /your-|choose-a-|YOUR-|C0123456789/.test(value);
export function checkConfig(env) {
  const results = required.map(key => ({ ok: !placeholder(env[key]), label: key, detail: placeholder(env[key]) ? 'Missing or still a sample value' : 'Present (value hidden)' }));
  if (env.SLACK_ALLOW_SEND && !['true', 'false'].includes(env.SLACK_ALLOW_SEND)) results.push({ ok: false, label: 'SLACK_ALLOW_SEND', detail: 'Use true or false' });
  for (const key of ['PUBLIC_BASE_URL', 'UPSTASH_REDIS_REST_URL']) {
    if (env[key] && !placeholder(env[key])) {
      try { townOrigin(env[key]); } catch { results.push({ ok: false, label: key, detail: 'Use an HTTPS origin with no path or credentials' }); }
    }
  }
  return results;
}

// All network checks are read-only and opt-in. Never log response bodies,
// authorization headers, member IDs, secrets, OAuth state or redirect contents.
export async function checkLive(env, origin, fetchImpl = fetch) {
  const results = [];
  const probe = async (label, run, failure) => {
    try { await run(); results.push({ ok: true, label, detail: 'Passed' }); }
    catch { results.push({ ok: false, label, detail: failure }); }
  };
  const request = async (url, options = {}) => fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (env.SLACK_BOT_TOKEN && env.SLACK_CHANNEL_ID) {
    await probe('Slack bot and channel access', async () => {
      for (const [method, args] of [['auth.test', {}], ['conversations.members', { channel: env.SLACK_CHANNEL_ID, limit: '1' }]]) {
        const response = await request(`https://slack.com/api/${method}`, { method: 'POST', headers: { authorization: `Bearer ${env.SLACK_BOT_TOKEN}`, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(args) });
        if (!response.ok || !(await response.json()).ok) throw new Error('Slack failed');
      }
    }, 'Check bot token, installed scopes, channel ID and app channel membership.');
  }
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    await probe('Upstash connectivity (PING)', async () => {
      const url = townOrigin(env.UPSTASH_REDIS_REST_URL);
      const response = await request(url, { method: 'POST', headers: { authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(['PING']) });
      if (!response.ok || (await response.json()).result !== 'PONG') throw new Error('Redis failed');
    }, 'Check both REST credentials and database availability.');
  }
  if (origin) {
    const url = townOrigin(origin);
    await probe('Deployed health and storage configuration', async () => {
      const response = await request(`${url}/api/health`);
      const body = await response.json();
      if (!response.ok || body.ok !== true || body.storage !== true) throw new Error('Not ready');
    }, 'Check the deploy and both Upstash variables; health.storage reports configuration, not connectivity.');
    await probe('Member API rejects anonymous visitors', async () => {
      if ((await request(`${url}/api/slack/members`)).status !== 401) throw new Error('Member API must require authentication');
    }, 'Configure STAGING_PASSWORD. Anonymous member access must return HTTP 401.');
    await probe('Slack login starts', async () => {
      const response = await fetchImpl(`${url}/auth/slack/start`, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
      const target = new URL(response.headers.get('location'));
      if (response.status !== 302 || target.origin !== 'https://slack.com' || target.pathname !== '/openid/connect/authorize' || target.searchParams.get('redirect_uri') !== `${url}/auth/slack/callback`) throw new Error('Login redirect mismatch');
    }, 'Check Slack client settings and PUBLIC_BASE_URL. A real browser sign-in is still required.');
  }
  return results;
}

async function main() {
  const { values } = parseArgs({ options: { url: { type: 'string' }, live: { type: 'boolean' }, help: { type: 'boolean' } } });
  if (values.help) return console.log('npm run doctor [-- --url https://your-town.onrender.com] [--live]\nReads process env and .env.local. --live performs read-only Slack, Redis and HTTPS checks. No messages or data writes.');
  if (values.url) townOrigin(values.url);
  let local = '';
  try { local = await readFile(new URL('../.env.local', import.meta.url), 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const env = parseEnv(local, process.env);
  const results = checkConfig(env);
  if (values.url && env.PUBLIC_BASE_URL && townOrigin(env.PUBLIC_BASE_URL) !== townOrigin(values.url)) results.push({ ok: false, label: 'PUBLIC_BASE_URL', detail: 'Does not match --url; remove a stale value on Render or correct it.' });
  for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.label}: ${result.detail}`);
  if (values.live && results.every(r => r.ok)) {
    const live = await checkLive(env, values.url || env.PUBLIC_BASE_URL);
    results.push(...live);
    for (const result of live) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.label}: ${result.detail}`);
  }
  console.log('Finish in a browser: Slack sign-in, own profile, Home save/reload. A health check cannot prove these work.');
  if (results.some(r => !r.ok)) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('Doctor failed. Check command options and URL format; credential values are never printed.'); process.exitCode = 1; });
}
