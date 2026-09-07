import { readFileSync } from 'node:fs';

// Fixed credits are added once to lifetime earnings, never once per visit/deploy.
// Bindings use the same server HMAC as characters; no names or Slack IDs belong here.
export function validateGrants(grants) {
  if (!grants || Array.isArray(grants) || typeof grants !== 'object') throw Error('invalid_grants');
  for (const [key,amount] of Object.entries(grants)) {
    if (!/^[a-f0-9]{64}$/.test(key) || !Number.isSafeInteger(amount) || amount<0 || amount>100000) throw Error('invalid_grants');
  }
  return Object.freeze(grants);
}
const grants=validateGrants(JSON.parse(readFileSync(new URL('./grants.json',import.meta.url))));
export const grantedDonuts = key => Object.hasOwn(grants,key) ? grants[key] : 0;
