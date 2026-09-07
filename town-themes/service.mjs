import { canManageTheme } from './contract.mjs';

export class ThemeService {
  constructor({store,catalog,memberFor,keyFor,adminKeys='',designatedKeys=[],onChanged=()=>{}}) {
    if (!Array.isArray(designatedKeys) || designatedKeys.some(key=>!/^[a-f0-9]{64}$/.test(key))) throw new Error('invalid_town_admin_keys');
    Object.assign(this,{store,catalog,memberFor,keyFor,adminKeys,designatedKeys,onChanged});
  }
  current() {
    // Coalesce visitors' reads so theme polling does not scale Redis traffic per member.
    if (!this.statePromise || Date.now()>=this.stateExpires) {
      const pending=this.store.load();
      this.statePromise=pending;this.stateExpires=Date.now()+15000;
      pending.catch(()=>{if(this.statePromise===pending)this.statePromise=null;});
    }
    return this.statePromise;
  }
  async view(userId) {
    const current=await this.current();
    if (!this.catalog.some(t=>t.id===current.id)) throw new Error('theme_unavailable');
    const member=userId ? await this.memberFor(userId) : null;
    return {current,themes:this.catalog,canManage:canManageTheme(member,userId ? this.keyFor(userId) : '',this.adminKeys,this.designatedKeys),canSave:this.store.configured};
  }
  async change(userId,body) {
    if (!userId) throw new Error('slack_login_required');
    const member=await this.memberFor(userId);
    if (!canManageTheme(member,this.keyFor(userId),this.adminKeys,this.designatedKeys)) throw new Error('town_admin_required');
    if (!body || Object.keys(body).length!==2 || !this.catalog.some(t=>t.id===body.id) || typeof body.revision!=='string' || body.revision.length>64) throw new Error('invalid_theme');
    const saved=await this.store.save(body.id,body.revision);
    this.statePromise=Promise.resolve(saved);this.stateExpires=Date.now()+15000;
    this.onChanged(saved);
    return saved;
  }
}
