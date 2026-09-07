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

// What went wrong, in words a member can act on.
const SAVE_MESSAGES = {
  slack_login_required: 'Open the town from Slack to save your look.',
  member_not_found: 'Only channel members can change their look.',
  wardrobe_not_available: 'This character does not have a wardrobe yet.',
  invalid_outfit: 'That combination is not available.',
  outfit_store_unavailable: 'Wardrobe storage is not connected yet.',
  outfit_save_failed: 'Wardrobe storage did not answer. Try again.'
};

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
  let direction = 'down', phase = 1, timer, saving = false, note = '';
  const walk = root.querySelector('[data-action="walk"]');
  const saveButton = root.querySelector('[data-action="save"]');
  const revertButton = root.querySelector('[data-action="revert"]');
  const changed = () => JSON.stringify(outfit) !== JSON.stringify(confirmed);

  function draw() {
    drawWardrobe(root.querySelector('canvas'), manifest, images, outfit, direction, [0, 1, 2, 1][phase]);
    root.querySelectorAll('[data-slot]').forEach(group => group.querySelectorAll('[data-item]').forEach(button => button.setAttribute('aria-pressed', String(outfit[group.dataset.slot] === button.dataset.item))));
    root.querySelectorAll('[data-dir]').forEach(button => button.setAttribute('aria-pressed', String(direction === button.dataset.dir)));
    if (saveButton) saveButton.disabled = saving || !changed();
    if (revertButton) revertButton.disabled = saving || !changed();
    status.textContent = saving ? 'Saving…' : note || (changed() ? 'Try it on, then save your look.' : 'Equipped');
  }

  // Nothing is worn until it is saved, so a look can be tried on freely.
  async function save() {
    if (!changed() || saving) return;
    saving = true; root.dataset.saving = "true"; note = '';
    controls.forEach(button => { button.disabled = true; });
    draw();
    let result;
    try {
      const answer = await fetch('/api/wardrobe', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({outfit}), signal:AbortSignal.timeout(15000)});
      const payload = await answer.json().catch(() => ({}));
      if (!answer.ok) {
        console.warn('Donut Town wardrobe refused the save:', answer.status, payload.error || '(no code)');
        note = SAVE_MESSAGES[payload.error] || 'Could not save. Try again.';
        return;
      }
      result = payload;
      confirmed = outfitFor(manifest, result.outfit);
      outfit = {...confirmed};
    } catch {
      note = 'Could not reach the wardrobe. Try again.';
      return;
    } finally {
      saving = false; delete root.dataset.saving;
      controls.forEach(button => { button.disabled = false; });
      draw();
    }
    // The look is saved either way; only the town art may still be catching up.
    try {
      await onSaved(result.character);
      note = '';
    } catch {
      note = 'Saved. The town art is still catching up.';
    }
    draw();
  }

  function stop() { clearInterval(timer); timer = null; phase = 1; walk.textContent = 'Walk'; walk.setAttribute('aria-pressed', 'false'); draw(); }
  root.querySelectorAll('[data-slot]').forEach(group => group.querySelectorAll('[data-item]').forEach(button => button.onclick = () => { outfit[group.dataset.slot] = button.dataset.item; note = ''; draw(); }));
  root.querySelectorAll('[data-dir]').forEach(button => button.onclick = () => { direction = button.dataset.dir; draw(); });
  root.querySelector('[data-action="reset"]').onclick = () => { outfit = outfitFor(manifest); note = ''; stop(); };
  if (saveButton) saveButton.onclick = () => save();
  if (revertButton) revertButton.onclick = () => { outfit = {...confirmed}; note = ''; draw(); };
  walk.onclick = () => {
    if (timer) return stop();
    walk.textContent = 'Pause'; walk.setAttribute('aria-pressed', 'true');
    timer = setInterval(() => { phase = (phase + 1) % 4; draw(); }, 140);
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  root.addEventListener('wardrobe-close', stop);
  controls.forEach(button => { button.disabled = false; });
  root.addEventListener('wardrobe-outfit', event => {
    // Somebody else's device saved a look: only follow it when nothing is being tried on here.
    if (saving || changed()) return;
    outfit = outfitFor(manifest, event.detail); confirmed = {...outfit}; draw();
  });
  draw();
}
