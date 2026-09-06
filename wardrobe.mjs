import { outfitFor, loadWardrobe, drawWardrobe } from './characters/wardrobe/renderer.mjs';
const key = 'donut-town:wardrobe:r-7f3a2c:v1';
const status = document.querySelector('#status');
const controls = [...document.querySelectorAll('button')];
controls.forEach(button => { button.disabled = true; });
try {
  const response = await fetch('/characters/wardrobe/r-7f3a2c.json');
  if (!response.ok) throw new Error('角色配置暂时无法读取');
  const manifest = await response.json(), images = await loadWardrobe(manifest);
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch {}
  let outfit = outfitFor(manifest, saved), direction = 'down', phase = 1, walking = false, original = false, timer;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function draw() {
    for (const canvas of document.querySelectorAll('canvas')) drawWardrobe(canvas, manifest, images, outfit, direction, [0, 1, 2, 1][phase], original);
    document.querySelectorAll('[data-slot]').forEach(group => group.querySelectorAll('[data-item]').forEach(button => button.setAttribute('aria-pressed', String(outfit[group.dataset.slot] === button.dataset.item))));
    document.querySelectorAll('[data-dir]').forEach(button => button.setAttribute('aria-pressed', String(direction === button.dataset.dir)));
    document.querySelector('#lookLabel').textContent = original ? '正在对比原装' : '你的当前搭配';
  }
  function save() {
    try { localStorage.setItem(key, JSON.stringify(outfit)); status.textContent = '搭配已保存在本机 · 随时可以恢复原装'; }
    catch { status.textContent = '当前搭配可试穿，但浏览器未允许保存'; }
  }
  function stop() { clearInterval(timer); walking = false; phase = 1; document.querySelector('#walk').textContent = '▶ 看看走路'; document.querySelector('#walk').setAttribute('aria-pressed', 'false'); draw(); }
  document.querySelectorAll('[data-slot]').forEach(group => group.querySelectorAll('[data-item]').forEach(button => button.onclick = () => { outfit[group.dataset.slot] = button.dataset.item; original = false; document.querySelector('#compare').setAttribute('aria-pressed', 'false'); save(); draw(); }));
  document.querySelectorAll('[data-dir]').forEach(button => button.onclick = () => { direction = button.dataset.dir; draw(); });
  document.querySelector('#compare').onclick = event => { original = !original; event.currentTarget.setAttribute('aria-pressed', String(original)); draw(); };
  document.querySelector('#reset').onclick = () => { outfit = outfitFor(manifest); original = false; document.querySelector('#compare').setAttribute('aria-pressed', 'false'); stop(); save(); };
  document.querySelector('#walk').onclick = event => {
    if (walking) return stop();
    walking = true; event.currentTarget.textContent = 'Ⅱ 停下来'; event.currentTarget.setAttribute('aria-pressed', 'true');
    timer = setInterval(() => { phase = (phase + 1) % 4; draw(); }, 140);
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  reducedMotion.addEventListener('change', stop);
  controls.forEach(button => { button.disabled = false; });
  status.textContent = '选择装饰即可试穿 · 脸和发型保持不变'; draw();
} catch (error) { status.textContent = '试衣间加载失败，请刷新重试。' + error.message; }
