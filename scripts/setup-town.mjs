#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

export function townOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Use a public HTTPS origin, for example https://your-town.onrender.com'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('The town URL must be an HTTPS origin without credentials, path, query or fragment.');
  }
  return url.origin;
}

export function configureManifest(template, baseUrl) {
  const manifest = structuredClone(template);
  // Create the app before Render allocates a hostname. Add callbacks afterward.
  manifest.oauth_config.redirect_urls = baseUrl ? [`${townOrigin(baseUrl)}/auth/slack/callback`] : [];
  manifest.settings.interactivity = baseUrl
    ? { is_enabled: true, request_url: `${townOrigin(baseUrl)}/slack/interactions` }
    : { is_enabled: false };
  return manifest;
}

async function main() {
  const { values } = parseArgs({ options: { url: { type: 'string' }, help: { type: 'boolean' } } });
  if (values.help) return console.log('npm run setup [-- --url https://your-town.onrender.com]\nWrites .donut/slack-manifest.json. No secrets, account changes or Slack messages.');
  const template = JSON.parse(await readFile(new URL('../slack/manifest.example.json', import.meta.url), 'utf8'));
  const manifest = configureManifest(template, values.url);
  const output = new URL('../.donut/', import.meta.url);
  await mkdir(output, { recursive: true });
  await writeFile(new URL('slack-manifest.json', output), JSON.stringify(manifest, null, 2) + '\n');
  console.log('Created .donut/slack-manifest.json');
  if (values.url) {
    const origin = townOrigin(values.url);
    console.log(`Update your NEW Slack app with this manifest. For an existing app, merge only the required scopes and callback URLs.\nRedirect: ${origin}/auth/slack/callback\nInteractivity: ${origin}/slack/interactions\nMember entrance: ${origin}/auth/slack/start\nHealth check: ${origin}/api/health\nNext: npm run doctor -- --url ${origin}`);
  } else console.log('Create a Slack app From a manifest at https://api.slack.com/apps and paste this JSON.\nAfter deploying Render, rerun with --url to fill both callbacks.\nContinue with docs/deploy.md.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('Setup failed. Check the HTTPS URL and command options; see npm run setup -- --help.'); process.exitCode = 1; });
}
