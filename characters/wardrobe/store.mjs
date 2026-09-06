import { readdirSync, readFileSync } from 'node:fs';
import { outfitFor, layerUrls } from './renderer.mjs';

const assignments = JSON.parse(readFileSync(new URL('../assignments.json', import.meta.url)));
const wardrobeFiles = readdirSync(new URL('./', import.meta.url)).filter(name => /^r-[a-z0-9-]+\.json$/.test(name));
const wardrobes = new Map(wardrobeFiles.map(file => {
  const id = file.slice(0, -5);
  const manifest = JSON.parse(readFileSync(new URL(`./${file}`, import.meta.url)));
  const original = JSON.parse(readFileSync(new URL(`../${id}.json`, import.meta.url)));
  if (!manifest.slots || manifest.url !== original.url) throw new Error(`Invalid wardrobe manifest: ${id}`);
  return [id, Object.freeze({ id, manifest, original })];
}));
const wardrobeByUrl = new Map([...wardrobes.values()].map(entry => [entry.manifest.url, entry]));
const fallbackWardrobe = wardrobes.get('r-7f3a2c') || [...wardrobes.values()][0];

export function wardrobeFor(character) {
  return character?.url ? wardrobeByUrl.get(character.url) || null : null;
}

export function equippedCharacter(character, outfit) {
  const wardrobe = wardrobeFor(character);
  if (!wardrobe) return character;
  return { ...character, outfit: outfitFor(wardrobe.manifest, outfit), layers: layerUrls(wardrobe.manifest, outfit) };
}

export function validateOutfit(input, character) {
  const wardrobe = wardrobeFor(character) || fallbackWardrobe;
  if (!wardrobe || !input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).length !== Object.keys(wardrobe.manifest.slots).length
    || Object.entries(input).some(([slot, item]) => !wardrobe.manifest.slots[slot] || typeof item !== 'string' || !Object.hasOwn(wardrobe.manifest.slots[slot].items, item))) {
    throw new Error('invalid_outfit');
  }
  return outfitFor(wardrobe.manifest, input);
}

export function wardrobeSupported(character) {
  return Boolean(wardrobeFor(character));
}

export function wardrobeCharacters(outfits) {
  return Object.fromEntries(Object.entries(assignments).flatMap(([key, id]) => {
    const wardrobe = wardrobes.get(id);
    return wardrobe ? [[key, equippedCharacter(wardrobe.original, outfits[key])]] : [];
  }));
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
        const wardrobe = wardrobes.get(assignments[rows[i]]);
        try { result[rows[i]] = validateOutfit(JSON.parse(rows[i+1]), wardrobe?.original); } catch {}
      }
      if (generation === this.generation) { this.cache = result; this.expires = Date.now()+60000; }
      return generation === this.generation ? result : this.cache || result;
    }).finally(() => { this.pending = null; });
    return this.pending;
  }
  async save(key, input, character) {
    if (!/^[a-f0-9]{64}$/.test(key || '')) throw new Error('invalid_member_key');
    const outfit = validateOutfit(input, character);
    await this.command(['HSET','donut-town:wardrobe:v1',key,JSON.stringify(outfit)]);
    this.generation++;
    this.cache = {...(this.cache || {}), [key]:outfit}; this.expires = 0;
    return outfit;
  }
}
