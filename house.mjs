// A member's own room. Decorations they own are dragged from the shelf onto a
// grid; where each one sits is saved as soon as it is put down.
const MESSAGES = {
  slack_login_required: 'Open the town from Slack to visit your house.',
  member_not_found: 'Only channel members have a house.',
  house_store_unavailable: 'House storage is not connected yet.',
  house_save_failed: 'The room did not save. Try again.',
  invalid_layout: 'That spot will not take it.'
};

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function mountHouse(root, { paintCharacter = null } = {}) {
  const floor = root.querySelector('[data-house="floor"]');
  const shelf = root.querySelector('[data-house="shelf"]');
  const status = root.querySelector('[data-house="status"]');
  const grid = { cols: 14, rows: 9 };
  let furniture = new Map();
  let layout = [];
  let owned = [];
  let saveTimer = null;
  let dragging = null;
  let selected = null;

  const placed = id => layout.find(entry => entry.id === id);
  const cellTaken = (x, y, exceptId) => layout.some(entry => entry.x === x && entry.y === y && entry.id !== exceptId);

  function tileMarkup(item, { x, y } = {}) {
    const style = x === undefined
      ? ''
      : `style="--swatch:${escapeHtml(item.swatch || '#c9a227')};grid-column:${x + 1};grid-row:${y + 1};z-index:${y + 1}"`;
    return `<button class="house-tile" data-item="${escapeHtml(item.id)}" ${style || `style="--swatch:${escapeHtml(item.swatch || '#c9a227')}"`}
      title="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}"><span>${escapeHtml(item.name.split(' ').map(word => word[0]).join('').slice(0, 2))}</span></button>`;
  }

  function render() {
    floor.style.setProperty('--cols', grid.cols);
    floor.style.setProperty('--rows', grid.rows);
    floor.innerHTML = layout.map(entry => {
      const item = furniture.get(entry.id);
      return item ? tileMarkup(item, entry) : '';
    }).join('');
    const spare = owned.filter(id => furniture.has(id) && !placed(id));
    shelf.innerHTML = spare.length
      ? spare.map(id => tileMarkup(furniture.get(id))).join('')
      : '<p class="house-empty">Everything you own is in the room. Buy more at the fountain.</p>';
    root.querySelectorAll('.house-tile').forEach(tile => {
      tile.classList.toggle('selected', tile.dataset.item === selected);
    });
  }

  async function load() {
    status.textContent = 'Opening the door…';
    try {
      const response = await fetch('/api/house', { signal: AbortSignal.timeout(15000) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.warn('Donut Town house refused:', response.status, payload.error || '(no code)');
        status.textContent = MESSAGES[payload.error] || 'The house is not available right now.';
        return;
      }
      Object.assign(grid, payload.grid || grid);
      furniture = new Map((payload.furniture || []).map(item => [item.id, item]));
      owned = payload.owned || [];
      layout = payload.layout?.items || [];
      status.textContent = layout.length || owned.length
        ? 'Drag your things where you want them.'
        : 'Bare walls for now. The fountain sells decorations.';
      render();
    } catch {
      status.textContent = 'Could not reach your house. Try again.';
    }
  }

  function queueSave() {
    clearTimeout(saveTimer);
    status.textContent = 'Saving…';
    saveTimer = setTimeout(async () => {
      try {
        const response = await fetch('/api/house', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ layout: { items: layout } }),
          signal: AbortSignal.timeout(15000)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.warn('Donut Town house refused the save:', response.status, payload.error || '(no code)');
          status.textContent = MESSAGES[payload.error] || 'The room did not save. Try again.';
          return;
        }
        layout = payload.layout?.items || layout;
        status.textContent = 'Saved.';
        render();
      } catch {
        status.textContent = 'Could not save the room. Try again.';
      }
    }, 400);
  }

  function place(id, x, y) {
    if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows || cellTaken(x, y, id)) return false;
    const entry = placed(id);
    if (entry) { entry.x = x; entry.y = y; }
    else layout.push({ id, x, y });
    render();
    queueSave();
    return true;
  }

  function pickUp(id) {
    if (!placed(id)) return;
    layout = layout.filter(entry => entry.id !== id);
    render();
    queueSave();
  }

  function cellFromPoint(clientX, clientY) {
    const bounds = floor.getBoundingClientRect();
    if (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) return null;
    return {
      x: Math.floor(((clientX - bounds.left) / bounds.width) * grid.cols),
      y: Math.floor(((clientY - bounds.top) / bounds.height) * grid.rows)
    };
  }

  root.addEventListener('pointerdown', event => {
    const tile = event.target.closest('.house-tile');
    if (!tile) return;
    event.preventDefault();
    selected = tile.dataset.item;
    dragging = { id: selected, from: placed(selected) ? 'floor' : 'shelf' };
    const ghost = tile.cloneNode(true);
    ghost.className = 'house-tile house-ghost';
    ghost.style.setProperty('--swatch', getComputedStyle(tile).getPropertyValue('--swatch'));
    document.body.appendChild(ghost);
    dragging.ghost = ghost;
    ghost.style.left = `${event.clientX}px`;
    ghost.style.top = `${event.clientY}px`;
    root.setPointerCapture(event.pointerId);
    render();
  });

  root.addEventListener('pointermove', event => {
    if (!dragging) return;
    dragging.ghost.style.left = `${event.clientX}px`;
    dragging.ghost.style.top = `${event.clientY}px`;
    const cell = cellFromPoint(event.clientX, event.clientY);
    floor.classList.toggle('drop-ok', Boolean(cell) && !cellTaken(cell.x, cell.y, dragging.id));
  });

  root.addEventListener('pointerup', event => {
    if (!dragging) return;
    const { id, from, ghost } = dragging;
    dragging = null;
    ghost.remove();
    floor.classList.remove('drop-ok');
    const cell = cellFromPoint(event.clientX, event.clientY);
    if (cell) place(id, cell.x, cell.y);
    else if (from === 'floor') pickUp(id);
    else render();
  });

  // Arrow keys move whatever is selected, so a mouse is not the only way in.
  root.addEventListener('keydown', event => {
    if (!selected) return;
    const entry = placed(selected);
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (step && entry) {
      event.preventDefault();
      place(selected, entry.x + step[0], entry.y + step[1]);
    } else if (step && !entry) {
      event.preventDefault();
      place(selected, Math.floor(grid.cols / 2), Math.floor(grid.rows / 2));
    } else if ((event.key === 'Backspace' || event.key === 'Delete') && entry) {
      event.preventDefault();
      pickUp(selected);
    }
  });

  if (paintCharacter) paintCharacter(root.querySelector('[data-house="resident"]'));
  return { load };
}
