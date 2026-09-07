// The donut fountain's shop: what the town sells, and what you have already
// bought. Purchases are spent from the donuts a member has earned.
export const SHOP_MESSAGES = {
  slack_login_required: 'Open the town from Slack to shop.',
  member_not_found: 'Only channel members can shop.',
  shop_store_unavailable: 'The shop till is not connected yet.',
  shop_purchase_failed: 'The till did not answer. Try again.',
  not_enough_donuts: 'Not enough donuts yet.',
  already_owned: 'You already own this one.',
  item_not_found: 'That item has left the shelf.',
  invalid_purchase: 'That item cannot be bought.',
  pet_not_owned: 'You do not own that pet yet.',
  invalid_pet: 'That is not a pet.'
};

// One place that talks to the till, for both the drawer and the room.
export async function shopRequest(path, body) {
  const response = await fetch(path, body
    ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) }
    : { signal: AbortSignal.timeout(15000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.warn("Donut Town shop refused:", response.status, payload.error || "(no code)");
    throw Object.assign(new Error(payload.error || "shop_error"), { code: payload.error, status: response.status });
  }
  return payload;
}

const KIND_LABEL = { pet: 'Pet', decoration: 'Decoration', wardrobe: 'Wardrobe' };

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function mountShop(root, { onOwnedChange = () => {}, onPetChange = () => {} } = {}) {
  const status = root.querySelector('[data-shop="status"]');
  const wallet = root.querySelector('[data-shop="wallet"]');
  const shelf = root.querySelector('[data-shop="shelf"]');
  let state = { items: [], owned: [], wallet: null, pet: null };
  let busy = false;

  function render() {
    wallet.textContent = state.wallet ? `${state.wallet.balance} left of ${state.wallet.earned}` : '—';
    shelf.innerHTML = state.items.map(item => {
      const owned = state.owned.includes(item.id);
      const affordable = state.wallet ? state.wallet.balance >= item.price : false;
      const out = state.pet === item.id;
      const petButton = owned && item.kind === 'pet'
        ? `<button data-pet="${escapeHtml(item.id)}" class="shop-pet${out ? ' out' : ''}">${out ? 'With you' : 'Take out'}</button>`
        : '';
      return `<li class="shop-item${owned ? ' owned' : ''}">
        <span class="shop-thumb${item.thumb ? ' pictured' : ''}" style="--swatch:${escapeHtml(item.swatch || '#c9a227')}${item.thumb ? `;background-image:url('${escapeHtml(item.thumb)}')` : ''}" aria-hidden="true"></span>
        <span class="shop-copy">
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(KIND_LABEL[item.kind] || item.kind)} · ${escapeHtml(item.blurb || '')}</small>
        </span>
        ${petButton || `<button data-buy="${escapeHtml(item.id)}"${owned || busy || !affordable ? ' disabled' : ''}>${owned ? 'Owned' : `${item.price} 🍩`}</button>`}
      </li>`;
    }).join('');
    shelf.querySelectorAll('[data-buy]').forEach(button => { button.onclick = () => buy(button.dataset.buy); });
    shelf.querySelectorAll('[data-pet]').forEach(button => { button.onclick = () => equip(button.dataset.pet === state.pet ? null : button.dataset.pet); });
  }

  async function load() {
    status.textContent = 'Opening the shop…';
    try {
      const response = await fetch('/api/shop', { signal: AbortSignal.timeout(15000) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.warn('Donut Town shop is closed:', response.status, payload.error || '(no code)');
        status.textContent = SHOP_MESSAGES[payload.error] || 'The shop is closed right now.';
        return;
      }
      state = { items: payload.items || [], owned: payload.owned || [], wallet: payload.wallet, pet: payload.pet || null };
      status.textContent = state.items.length ? 'Spend the donuts you have earned.' : 'Nothing on the shelves yet.';
      render();
      onOwnedChange(state.owned);
    } catch {
      status.textContent = 'Could not reach the shop. Try again.';
    }
  }

  async function buy(itemId) {
    if (busy) return;
    busy = true;
    status.textContent = 'Wrapping it up…';
    render();
    try {
      const response = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId }),
        signal: AbortSignal.timeout(15000)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.warn('Donut Town purchase refused:', response.status, payload.error || '(no code)');
        status.textContent = SHOP_MESSAGES[payload.error] || 'Could not buy that. Try again.';
        return;
      }
      state = { ...state, owned: payload.owned, wallet: payload.wallet, pet: payload.pet ?? state.pet };
      status.textContent = `${payload.item.name} is yours.`;
      onOwnedChange(state.owned);
      onPetChange(state.pet);
    } catch {
      status.textContent = 'Could not reach the till. Try again.';
    } finally {
      busy = false;
      render();
    }
  }

  // A pet walks out with its owner, or stays at home until it is picked again.
  async function equip(petId) {
    if (busy) return;
    busy = true;
    status.textContent = petId ? 'Fetching the lead…' : 'Settling them at home…';
    render();
    try {
      const response = await fetch('/api/shop/equip', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ petId }),
        signal: AbortSignal.timeout(15000)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.warn('Donut Town pet refused:', response.status, payload.error || '(no code)');
        status.textContent = SHOP_MESSAGES[payload.error] || 'That pet is staying put.';
        return;
      }
      state = { ...state, pet: payload.pet || null, owned: payload.owned || state.owned };
      status.textContent = state.pet ? 'They are following you now.' : 'Left at home.';
      onPetChange(state.pet);
    } catch {
      status.textContent = 'Could not reach the shop. Try again.';
    } finally {
      busy = false;
      render();
    }
  }

  return { load, get owned() { return state.owned; }, get pet() { return state.pet; } };
}
