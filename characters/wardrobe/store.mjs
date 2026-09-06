import { readFileSync } from 'node:fs';
import { outfitFor, layerUrls } from './renderer.mjs';
const manifest = JSON.parse(readFileSync(new URL('./r-7f3a2c.json', import.meta.url)));
const original = JSON.parse(readFileSync(new URL('../r-7f3a2c.json', import.meta.url)));
const assignments = JSON.parse(readFileSync(new URL('../assignments.json', import.meta.url)));
export function equippedCharacter(character, outfit) {
  if (character?.url !== manifest.url) return character;
  return { ...character, outfit: outfitFor(manifest, outfit), layers: layerUrls(manifest, outfit) };
}
export function validateOutfit(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).length !== Object.keys(manifest.slots).length
    || Object.entries(input).some(([slot, item]) => !manifest.slots[slot] || typeof item !== 'string' || !Object.hasOwn(manifest.slots[slot].items, item))) {
    throw new Error('invalid_outfit');
  }
  return outfitFor(manifest, input);
}
export function wardrobeSupported(character) { return character?.url === manifest.url; }
export function wardrobeCharacters(outfits) {
  return Object.fromEntries(Object.entries(assignments).filter(([, id]) => id === 'r-7f3a2c').map(([key]) => [key, equippedCharacter(original, outfits[key])]));
}
export class OutfitStore {
  constructor({url = '', token = '', fetchImpl = fetch} = {}) {
    this.url = url; this.token = token; this.fetch = fetchImpl; this.cache = null; this.expires = 0; this.pending = null; this.generation = 0;
  }
  get configured() { return Boolean(this.url && this.token); }
  async command(args) {
    if (!this.configured) throw new Error('outfit_store_unavailable');
    const response = await this.fetch(this.url, {method:'POST', headers:{authorization:`Bearer ${this.token}`, 'content-type':'application/json'}, body:JSON.stringify(args), signal:AbortSignal.timeout(5000)});
    if (!response.ok) throw new Error('outfit_store_unavailable');
    const result = await response.json(); if (result.error) throw new Error('outfit_store_unavailable');
    return result.result;
  }
  async list() {
    if (!this.configured) return {};
    if (this.cache && Date.now() < this.expires) return this.cache;
    if (this.pending) return this.pending;
    const generation = this.generation;
    this.pending = this.command(['HGETALL','donut-town:wardrobe:v1']).then(rows => {
      const result = {};
      for (let i=0;i<(rows || []).length;i+=2) {
        if (!/^[a-f0-9]{64}$/.test(rows[i])) continue;
        try { result[rows[i]] = validateOutfit(JSON.parse(rows[i+1])); } catch {}
      }
      if (generation === this.generation) { this.cache = result; this.expires = Date.now()+60000; }
      return generation === this.generation ? result : this.cache || result;
    }).finally(() => { this.pending = null; });
    return this.pending;
  }
  async save(key, input) {
    if (!/^[a-f0-9]{64}$/.test(key || '')) throw new Error('invalid_member_key');
    const outfit = validateOutfit(input);
    await this.command(['HSET','donut-town:wardrobe:v1',key,JSON.stringify(outfit)]);
    this.generation++;
    this.cache = {...(this.cache || {}), [key]:outfit}; this.expires = 0;
    return outfit;
  }
}
