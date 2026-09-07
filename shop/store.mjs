import { readFileSync } from 'node:fs';

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
  if (!item) return { error: 'item_not_found' };
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
      if (attempt > 0) throw error;
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
    if (result.error) throw new Error('shop_store_unavailable');
    return result.result;
  }
  static validPurse(value, catalog) {
    const known = new Map(catalog.items.map(item => [item.id, item]));
    const owned = [];
    for (const entry of value?.owned || []) {
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
  async buy(key, item, purse) {
    if (!/^[a-f0-9]{64}$/.test(key || '')) throw new Error('invalid_member_key');
    const next = { owned: [...purse.owned, { id: item.id, price: item.price, at: new Date().toISOString() }], pet: purse.pet || null };
    await this.command(['HSET', this.key, key, JSON.stringify(next)]);
    return next;
  }
  async equip(key, purse, petId) {
    if (!/^[a-f0-9]{64}$/.test(key || '')) throw new Error('invalid_member_key');
    const next = { owned: purse.owned, pet: petId };
    await this.command(['HSET', this.key, key, JSON.stringify(next)]);
    return next;
  }
}
