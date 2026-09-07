import {validateTheme} from './contract.mjs';

async function json(url, options={}) {
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(45000),...options});
  const data=await response.json();
  if (!response.ok) throw new Error(data.error || 'theme_unavailable');
  return data;
}
export async function loadTheme(entry) {
  const theme=validateTheme(await json(entry.manifest));
  if (theme.id!==entry.id) throw new Error('invalid_theme_package');
  const art=new Image();
  art.src=theme.image;
  await art.decode();
  if (art.naturalWidth!==theme.imageSize.width || art.naturalHeight!==theme.imageSize.height) throw new Error('invalid_theme_image');
  return theme;
}

export async function mountThemes({apply}) {
  let state=await json('/api/town/theme');
  const loadedRevision=state.current.revision;
  let applying=false, checking=false;
  const active=state.themes.find(t=>t.id===state.current.id);
  if (!active) throw new Error('theme_unavailable');
  apply(await loadTheme(active));
  const button=document.querySelector('#townSettingsButton');
  const dialog=document.querySelector('#townSettings');
  const grid=dialog.querySelector('[data-themes="grid"]');
  const status=dialog.querySelector('[data-themes="status"]');
  const close=dialog.querySelector('[data-themes="close"]');
  button.hidden=!state.canManage;
  function render() {
    grid.replaceChildren();
    for (const entry of state.themes) {
      const current=entry.id===state.current.id;
      const card=document.createElement('article');
      card.className='theme-card';
      const img=document.createElement('img');
      img.src=entry.thumbnail; img.alt=entry.name+' map'; img.loading='lazy'; img.width=480; img.height=320;
      const title=document.createElement('h3'); title.textContent=entry.name;
      const tag=document.createElement('span'); tag.className='theme-tag';tag.textContent=current?'Active':'Available';
      const actions=document.createElement('div');actions.className='theme-actions';
      const preview=document.createElement('a');preview.textContent='Preview';preview.href='/map-preview.html?theme='+encodeURIComponent(entry.id);preview.target='_blank';preview.rel='noopener';
      const use=document.createElement('button');use.type='button';use.textContent=current?'Current map':'Apply to town';use.disabled=current || !state.canSave || !state.canManage || applying;
      use.onclick=async()=>{
        applying=true;close.disabled=true;render();status.textContent='Preparing '+entry.name+'…';
        try {
          await loadTheme(entry); // Never activate a package whose art cannot load.
          const current=await json('/api/town/theme',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:entry.id,revision:state.current.revision})});
          state.current=current;
          location.reload();
        } catch(error) {
          status.textContent=error.message==='theme_conflict'?'Another admin changed the map. Close and reopen settings.':error.message==='town_admin_required'?'Town admin access required.':'Could not confirm the change. Reopen settings to check the active theme.';
          applying=false;close.disabled=false;render();
        }
      };
      actions.append(preview,use);card.append(img,title,tag,actions);grid.append(card);
    }
  }
  button.onclick=async()=>{
    window.townSettingsOpen=true;
    if (!dialog.open) dialog.showModal();
    status.textContent='Loading themes…';
    try { state=await json('/api/town/theme');render();status.textContent=state.canSave?'Applies to everyone; open towns reload.':'Connect persistent storage to save a town theme.'; }
    catch {status.textContent='Could not load settings. Close and try again.';}
  };
  close.onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{window.townSettingsOpen=false;});
  dialog.addEventListener('cancel',event=>{if(applying)event.preventDefault();});
  async function check() {
    if (checking || applying || document.hidden) return;
    checking=true;
    try {
      const next=await json('/api/town/theme');
      if (next.current.revision!==loadedRevision) location.reload();
    } catch { /* Keep the last loaded map through a temporary outage. */ }
    finally {checking=false;}
  }
  const timer=setInterval(check,60000);
  document.addEventListener('visibilitychange',check);
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  return {check};
}
