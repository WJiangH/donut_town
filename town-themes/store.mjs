import { createHash, randomUUID } from 'node:crypto';
import { DEFAULT_THEME, INITIAL_REVISION } from './contract.mjs';

const SAVE = `
local old = redis.call('GET', KEYS[1])
local revision = 'initial'
if old then revision = cjson.decode(old).revision end
if revision ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1`;

export class ThemeStore {
  constructor({url='',token='',namespace='',fetchImpl=fetch}={}) {
    Object.assign(this,{url,token,fetch:fetchImpl});
    this.key='donut-town:theme:v1:'+createHash('sha256').update(namespace).digest('hex');
  }
  get configured() { return Boolean(this.url && this.token); }
  async command(args) {
    if (!this.configured) throw new Error('theme_store_unavailable');
    const response=await this.fetch(this.url,{method:'POST',headers:{authorization:`Bearer ${this.token}`,'content-type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error('theme_store_unavailable');
    const data=await response.json();
    if (data.error) throw new Error('theme_store_unavailable');
    return data.result;
  }
  async load() {
    const raw=this.configured ? await this.command(['GET',this.key]) : null;
    if (raw===null) return {id:DEFAULT_THEME,revision:INITIAL_REVISION};
    try {
      const value=JSON.parse(raw);
      if (typeof value.id!=='string' || typeof value.revision!=='string') throw new Error();
      return value;
    } catch { throw new Error('theme_store_unavailable'); }
  }
  async save(id,expectedRevision) {
    const value={id,revision:randomUUID()};
    if (await this.command(['EVAL',SAVE,1,this.key,expectedRevision,JSON.stringify(value)])!==1) throw new Error('theme_conflict');
    return value;
  }
}
