#!/usr/bin/env node
// Read an authenticated roster, save only HMAC keys to an ignored deployment snippet.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {townOrigin} from './setup-town.mjs';
import {findMember} from '../.agents/skills/donut-town-pixel-art/scripts/fetch-render-avatar.mjs';
const name=process.argv.slice(2).join(' ').trim();
if (!name) throw new Error('Usage: node scripts/prepare-town-admin.mjs "Display name"');
try {process.loadEnvFile('.env.local');} catch(error) {if(error.code!=='ENOENT')throw error;}
if (!process.env.PUBLIC_BASE_URL || !process.env.STAGING_PASSWORD) throw new Error('Set your deployed PUBLIC_BASE_URL and STAGING_PASSWORD in ignored .env.local first');
const origin=townOrigin(process.env.PUBLIC_BASE_URL);
const response=await fetch(origin+'/api/slack/members',{headers:{authorization:'Basic '+Buffer.from('donut:'+process.env.STAGING_PASSWORD).toString('base64')},redirect:'error',signal:AbortSignal.timeout(45000)});
if (!response.ok) throw new Error(`Roster request returned HTTP ${response.status}`);
const member=findMember((await response.json()).members,name);
if (!/^[a-f0-9]{64}$/.test(member.characterKey || '')) throw new Error('Missing server-derived character key');
const keys=[...new Set([...(process.env.TOWN_ADMIN_KEYS || '').split(/[\s,]+/).filter(Boolean),member.characterKey])];
if (keys.some(key=>!/^[a-f0-9]{64}$/.test(key))) throw new Error('Existing admin keys are invalid');
await mkdir('.donut',{recursive:true});
const output=resolve('.donut/town-admin.env');
await writeFile(output,`TOWN_ADMIN_KEYS=${keys.join(',')}\n`,{mode:0o600});
console.log('Prepared .donut/town-admin.env. Set its TOWN_ADMIN_KEYS value in Render. No remote configuration was changed; no raw member ID or avatar was saved.');
