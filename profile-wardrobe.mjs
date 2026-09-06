import { outfitFor, loadWardrobe, drawWardrobe } from './characters/wardrobe/renderer.mjs';

export async function mountWardrobe(root) {
  const status = root.querySelector('[role="status"]');
  const controls = [...root.querySelectorAll('button')];
  controls.forEach(button => { button.disabled = true; });
  const response = await fetch('/characters/wardrobe/r-7f3a2c.json', {signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('Wardrobe unavailable');
  const manifest = await response.json(), images = await loadWardrobe(manifest);
  const key = 'donut-town:wardrobe:r-7f3a2c:v1';
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch {}
  let outfit = outfitFor(manifest, saved), direction = 'down', phase = 1, timer;
  const walk = root.querySelector('[data-action="walk"]');
  function draw() {
    drawWardrobe(root.querySelector('canvas'), manifest, images, outfit, direction, [0, 1, 2, 1][phase]);
    root.querySelectorAll('[data-slot]').forEach(group => group.querySelectorAll('[data-item]').forEach(button => button.setAttribute('aria-pressed', String(outfit[group.dataset.slot] === button.dataset.item))));
    root.querySelectorAll('[data-dir]').forEach(button => button.setAttribute('aria-pressed', String(direction === button.dataset.dir)));
  }
  function save() {
    try { localStorage.setItem(key, JSON.stringify(outfit)); status.textContent = 'Preview · saved on this device'; }
    catch { status.textContent = 'Preview · not saved'; }
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
  status.textContent = 'Preview · saved on this device'; draw();
}
