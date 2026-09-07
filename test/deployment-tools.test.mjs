import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configureManifest, townOrigin } from '../scripts/setup-town.mjs';
import { parseEnv, checkConfig, checkLive } from '../scripts/doctor-town.mjs';
import { isPrivatePath } from '../web/private-path.mjs';
const template = JSON.parse(readFileSync(new URL('../slack/manifest.example.json', import.meta.url)));

test('a Slack app can be bootstrapped before a hostname exists and wired afterward', () => {
  const initial = configureManifest(template);
  assert.deepEqual(initial.oauth_config.redirect_urls, []);
  assert.deepEqual(initial.settings.interactivity, { is_enabled: false });
  const configured = configureManifest(template, 'https://my-team.onrender.com/');
  assert.deepEqual(configured.oauth_config.redirect_urls, ['https://my-team.onrender.com/auth/slack/callback']);
  assert.equal(configured.settings.interactivity.request_url, 'https://my-team.onrender.com/slack/interactions');
  assert.deepEqual(configured.oauth_config.scopes, initial.oauth_config.scopes);
  assert.deepEqual(template.settings.interactivity, { is_enabled: false });
  assert(!configured.oauth_config.scopes.bot.some(scope => /email|history/.test(scope)));
});

test('deployment helpers reject URLs that could leak secrets or misroute callbacks', () => {
  for (const url of ['http://town.example', 'https://name:secret@town.example', 'https://town.example/path', 'https://town.example?secret=1', 'https://town.example/#token', 'not a url']) {
    assert.throws(() => townOrigin(url));
  }
  assert.equal(townOrigin('https://team.example/'), 'https://team.example');
});

const env = {
  SLACK_BOT_TOKEN: 'fixture-bot-secret', SLACK_SIGNING_SECRET: 'fixture-signing-secret',
  SLACK_CHANNEL_ID: 'CFAKECHANNEL', SLACK_CLIENT_ID: 'fixture-client', SLACK_CLIENT_SECRET: 'fixture-client-secret',
  STAGING_PASSWORD: 'fixture-admin-password', UPSTASH_REDIS_REST_URL: 'https://fixture.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'fixture-redis-secret', SLACK_ALLOW_SEND: 'false'
};
test('doctor respects injected env, catches incomplete samples, and never returns credential values', () => {
  const parsed = parseEnv('# ignored\r\nSLACK_CLIENT_ID="local"\nOTHER=\'value\'\n', { SLACK_CLIENT_ID: 'injected' });
  assert.equal(parsed.SLACK_CLIENT_ID, 'injected');
  assert.equal(parsed.OTHER, 'value');
  assert(checkConfig(env).every(row => row.ok));
  const missing = checkConfig({ ...env, UPSTASH_REDIS_REST_TOKEN: '' });
  assert(missing.some(row => row.label === 'UPSTASH_REDIS_REST_TOKEN' && !row.ok));
  assert(checkConfig({}).every(row => !row.ok));
  assert(checkConfig({ ...env, SLACK_BOT_TOKEN: 'xoxb-your-token' }).some(row => !row.ok));
  for (const secret of [env.SLACK_BOT_TOKEN, env.SLACK_CLIENT_SECRET, env.STAGING_PASSWORD, env.UPSTASH_REDIS_REST_TOKEN]) {
    assert(!JSON.stringify(missing).includes(secret));
  }
});

test('live doctor probes are read-only, do not forward secrets to the town, and catch broken auth', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({url,options});
    if (url.startsWith('https://slack.com/')) return Response.json({ok:true});
    if (url === env.UPSTASH_REDIS_REST_URL) {
      assert.deepEqual(JSON.parse(options.body), ['PING']);
      return Response.json({result:'PONG'});
    }
    assert.equal(options.headers, undefined);
    if (url.endsWith('/api/health')) return Response.json({ok:true,storage:true});
    if (url.endsWith('/api/slack/members')) return new Response('',{status:401});
    const target = 'https://slack.com/openid/connect/authorize?redirect_uri=https%3A%2F%2Ftown.example%2Fauth%2Fslack%2Fcallback';
    return new Response('',{status:302,headers:{location:target}});
  };
  const results = await checkLive(env,'https://town.example',fakeFetch);
  assert.equal(results.length,5);
  assert(results.every(row=>row.ok));
  assert(!calls.some(call=>/chat\.postMessage|chat\.update/.test(call.url)));
  const failed = await checkLive({}, 'https://town.example', async () => Response.json({ok:true,storage:true}));
  assert(failed.some(row=>row.label.includes('anonymous') && !row.ok));
  assert(failed.some(row=>row.label.includes('login') && !row.ok));
});

test('static paths block local credentials, private sources and Git even under alternate separators', () => {
  for (const path of ['.env.local', '.env', '.git/config', '.donut/secrets.json', '.agents/private.json', 'art-source/reference.png', 'node_modules/ws/package.json', 'assets/../.env.local', 'assets\\..\\.env.local', decodeURIComponent('%2eenv.local')]) {
    assert(isPrivatePath(path), path);
  }
  for (const path of ['index.html','assets/chem-pod-interior-v3.png','characters/r-example.json','content/shop.json','house.mjs']) assert(!isPrivatePath(path),path);
});
