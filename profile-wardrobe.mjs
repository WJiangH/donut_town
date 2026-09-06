import { outfitFor, loadWardrobe, drawWardrobe } from './characters/wardrobe/renderer.mjs';

function renderOptions(root, manifest) {
  const host = root.querySelector('.wardrobe-options');
  const ui = manifest.ui || {};
  host.innerHTML = (manifest.layerOrder || Object.keys(manifest.slots)).map(slot => {
    const spec = manifest.slots[slot];
    const slotUi = ui[slot] || {};
    const buttons = Object.keys(spec.items).map(item => {
      const itemUi = slotUi.items?.[item] || {};
      const label = itemUi.label || item;
      return itemUi.swatch
        ? `<button data-item="${item}" aria-label="${label}" title="${label}" style="--swatch:${itemUi.swatch}" class="outfit-swatch" aria-pressed="false"></button>`
        : `<button data-item="${item}" aria-pressed="false">${label}</button>`;
    }).join('');
    return `<fieldset data-slot="${slot}"><legend>${slotUi.label || slot}</legend>${buttons}</fieldset>`;
  }).join('');
}

export async function mountWardrobe(root, {manifestUrl, initialOutfit = {}, onSaved = async () => {}} = {}) {
  const status = root.querySelector('[role="status"]');
  if (!manifestUrl) throw new Error('Wardrobe unavailable');
  const response = await fetch(manifestUrl, {signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('Wardrobe unavailable');
  const manifest = await response.json();
  renderOptions(root, manifest);
  const images = await loadWardrobe(manifest);
  const controls = [...root.querySelectorAll('button')];
  controls.forEach(button => { button.disabled = true; });
  let outfit = outfitFor(manifest, initialOutfit), confirmed = {...outfit};
  let direction = 'down', phase = 1, timer, saving = false;
  const walk = root.querySelector('[data-action="walk"]');
  function draw() {
    drawWardrobe(root.querySelector('canvas'), manifest, images, outfit, direction, [0, 1, 2, 1][phase]);
    root.querySelectorAll('[data-slot]').forEach(group => group.querySelectorAll('[data-item]').forEach(button => button.setAttribute('aria-pressed', String(outfit[group.dataset.slot] === button.dataset.item))));
    root.querySelectorAll('[data-dir]').forEach(button => button.setAttribute('aria-pressed', String(direction === button.dataset.dir)));
  }
  async function save() {
    saving = true; root.dataset.saving = "true";
    controls.forEach(button => { button.disabled = true; });
    status.textContent = 'Saving…';
    try {
      const response = await fetch('/api/wardrobe', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({outfit}), signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('Save failed');
      const result = await response.json();
      confirmed = outfitFor(manifest, result.outfit); outfit = {...confirmed};
      await onSaved(result.character);
      status.textContent = 'Equipped';
    } catch { outfit = {...confirmed}; status.textContent = 'Could not apply. Try again.'; }
    finally { saving = false; delete root.dataset.saving; controls.forEach(button => { button.disabled = false; }); draw(); }
  }
  function stop() { clearInterval(timer); timer = null; phase = 1; walk.textContent = 'Walk'; walk.setAttribute('aria-pressed', 'false'); draw(); }
  root.querySelectorAll('[data-slot]').forEach(group => group.querySelectorAll('[data-item]').forEach(button => button.onclick = () => { outfit[group.dataset.slot] = button.dataset.item; save(); draw(); }));
  root.querySelectorAll('[data-dir]').forEach(button => button.onclick = () => { direction = button.dataset.dir; draw(); });
  root.querySelector('[data-action="reset"]').onclick = () => { outfit = outfitFor(manifest); stop(); save(); };
  walk.onclick = () => {
    if (timer) return stop();
    walk.textContent = 'Pause'; walk.setAttribute('aria-pressed', 'true');
    timer = setInterval(() => { phase = (phase + 1) % 4; draw(); }, 140);
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  root.addEventListener('wardrobe-close', stop);
  controls.forEach(button => { button.disabled = false; });
  root.addEventListener('wardrobe-outfit', event => {
    if (saving) return;
    outfit = outfitFor(manifest, event.detail); confirmed = {...outfit}; draw();
  });
  status.textContent = 'Equipped'; draw();
}
