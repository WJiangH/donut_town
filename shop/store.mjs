import { readFileSync } from 'node:fs';

const PURCHASE = `
local raw = redis.call('HGET', KEYS[1], ARGV[1])
local purse = raw and cjson.decode(raw) or {owned={}}
local spent = 0
for _,entry in ipairs(purse.owned or {}) do
  if entry.id == ARGV[2] then return cjson.encode(purse) end
  spent = spent + (tonumber(entry.price) or 0)
end
if spent + tonumber(ARGV[3]) > tonumber(ARGV[4]) then return redis.error_reply('not_enough_donuts') end
purse.owned = purse.owned or {}
table.insert(purse.owned, {id=ARGV[2],price=tonumber(ARGV[3]),at=ARGV[5]})
local result = cjson.encode(purse)
redis.call('HSET', KEYS[1], ARGV[1], result)
return result
`;
const EQUIP = `
local raw = redis.call('HGET', KEYS[1], ARGV[1])
local purse = raw and cjson.decode(raw) or {owned={}}
local found = ARGV[2] == ''
for _,entry in ipairs(purse.owned or {}) do if entry.id == ARGV[2] then found = true end end
if not found then return redis.error_reply('pet_not_owned') end
purse.pet = ARGV[2] ~= '' and ARGV[2] or cjson.null
local result = cjson.encode(purse)
redis.call('HSET', KEYS[1], ARGV[1], result)
return result
`;

const KINDS = new Set(['pet', 'decoration', 'wardrobe']);

export function loadCatalog(url = new URL('../content/shop.json', import.meta.url)) {
  const catalog = JSON.parse(readFileSync(url));
  const items = Array.isArray(catalog.items) ? catalog.items : [];
  const ids = new Set();
  for (const item of items) {
    if (!/^[a-z0-9-]{3,40}$/.test(item.id || '') || ids.has(item.id)) throw new Error(`Invalid shop item id: ${item.id}`);
    if (!KINDS.has(item.kind)) throw new Error(`Invalid shop item kind: ${item.kind}`);
    if (!Number.isInteger(item.price) || item.price < 0 || item.price > 999) throw new Error(`Invalid price for ${item.id}`);
    if (typeof item.name !== 'string' || !item.name.trim()) throw new Error(`Invalid name for ${item.id}`);
    if (item.thumb !== undefined && !/^\/assets\/[\w./-]+\.(png|jpg)$/.test(item.thumb)) throw new Error(`Invalid thumbnail for ${item.id}`);
    if (item.art !== undefined && !/^\/assets\/[\w./-]+\.png$/.test(item.art)) throw new Error(`Invalid art for ${item.id}`);
    if (item.footprint && (!Number.isInteger(item.footprint.w) || !Number.isInteger(item.footprint.h) || item.footprint.w < 1 || item.footprint.h < 1 || item.footprint.w > 4 || item.footprint.h > 4)) throw new Error('Invalid footprint');
    ids.add(item.id);
  }
  const starter = Number.isInteger(catalog.starterDonuts) ? catalog.starterDonuts : 0;
  return Object.freeze({ currency: catalog.currency || 'donut', starterDonuts: starter, items: Object.freeze(items) });
}

// A wallet is what a member has earned, less what they have already spent.
export function walletFor({ earned = 0, purse }) {
  const spent = purse?.owned?.reduce((total, entry) => total + (entry.price || 0), 0) || 0;
  return { earned, spent, balance: earned - spent };
}

export function ownedIds(purse) {
  return (purse?.owned || []).map(entry => entry.id);
}

// One pet is out at a time, and only if it has been bought.
export function equippedPet(purse, catalog) {
  const pet = purse?.pet;
  if (!pet || !ownedIds(purse).includes(pet)) return null;
  return catalog.items.some(item => item.id === pet && item.kind === 'pet') ? pet : null;
}

// What a purchase would do, without touching the store: the same rules the
// server applies, kept pure so they can be tested and reused by the client.
export function checkPurchase({ item, purse, earned }) {
  if (!item || item.starter) return { error: 'item_not_found' };
  if (item.available === false) return { error: 'item_unavailable' };
  if (ownedIds(purse).includes(item.id)) return { error: 'already_owned' };
  const wallet = walletFor({ earned, purse });
  if (wallet.balance < item.price) return { error: 'not_enough_donuts' };
  return { ok: true, wallet: { ...wallet, balance: wallet.balance - item.price, spent: wallet.spent + item.price } };
}

export class ShopStore {
  constructor({ url = '', token = '', fetchImpl = fetch, key = 'donut-town:shop:v1' } = {}) {
    this.url = url; this.token = token; this.fetch = fetchImpl; this.key = key;
  }
  get configured() { return Boolean(this.url && this.token); }
  // A cold instance or a distant region can miss a first, tight attempt, and a
  // wardrobe or a purchase is worth one more try before telling somebody no.
  async command(args, attempt = 0) {
    if (!this.configured) throw new Error('shop_store_unavailable');
    try {
      return await this.send(args);
    } catch (error) {
      if (attempt > 0 || error.code) throw error;
      await new Promise(resolve => setTimeout(resolve, 250));
      return this.command(args, attempt + 1);
    }
  }
  async send(args) {
    const response = await this.fetch(this.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error('shop_store_unavailable');
    const result = await response.json();
    if (result.error) {
      const code = ['not_enough_donuts','pet_not_owned'].find(code => result.error.includes(code));
      throw Object.assign(new Error(code || 'shop_store_unavailable'), {code});
    }
    return result.result;
  }
  static validPurse(value, catalog) {
    const known = new Map(catalog.items.map(item => [item.id, item]));
    const owned = [];
    for (const entry of Array.isArray(value?.owned) ? value.owned : []) {
      const item = known.get(entry?.id);
      // The price paid is kept with the purchase, so a later price change
      // cannot rewrite what a member already spent.
      if (item && !owned.some(seen => seen.id === item.id)) {
        owned.push({ id: item.id, price: Number.isInteger(entry.price) ? entry.price : item.price, at: entry.at || null });
      }
    }
    return { owned, pet: typeof value?.pet === 'string' ? value.pet : null };
  }
  async purse(key, catalog) {
    if (!/^[a-f0-9]{64}$/.test(key || '')) throw new Error('invalid_member_key');
    if (!this.configured) return { owned: [] };
    const raw = await this.command(['HGET', this.key, key]);
    try { return ShopStore.validPurse(JSON.parse(raw), catalog); } catch { return { owned: [] }; }
  }
  async buy(key, item, purse, earned) {
    if (!/^[a-f0-9]{64}$/.test(key || '')) throw new Error('invalid_member_key');
    if (!Number.isFinite(earned) || earned < 0) throw new Error('invalid_wallet');
    const raw = await this.command(['EVAL', PURCHASE, 1, this.key, key, item.id, item.price, earned, new Date().toISOString()]);
    const result = JSON.parse(raw);
    if (!Array.isArray(result.owned)) result.owned = [];
    return result;
  }
  async equip(key, purse, petId) {
    if (!/^[a-f0-9]{64}$/.test(key || '')) throw new Error('invalid_member_key');
    const raw = await this.command(['EVAL', EQUIP, 1, this.key, key, petId || '']);
    const result = JSON.parse(raw);
    if (!Array.isArray(result.owned)) result.owned = [];
    return result;
  }
}
