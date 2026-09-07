// The donut fountain's shop: what the town sells, and what you have already
// bought. Purchases are spent from the donuts a member has earned.
const MESSAGES = {
  slack_login_required: 'Open the town from Slack to shop.',
  member_not_found: 'Only channel members can shop.',
  shop_store_unavailable: 'The shop till is not connected yet.',
  shop_purchase_failed: 'The till did not answer. Try again.',
  not_enough_donuts: 'Not enough donuts yet.',
  already_owned: 'You already own this one.',
  item_not_found: 'That item has left the shelf.',
  invalid_purchase: 'That item cannot be bought.'
};

const KIND_LABEL = { pet: 'Pet', decoration: 'Decoration', wardrobe: 'Wardrobe' };

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function mountShop(root, { onOwnedChange = () => {} } = {}) {
  const status = root.querySelector('[data-shop="status"]');
  const wallet = root.querySelector('[data-shop="wallet"]');
  const shelf = root.querySelector('[data-shop="shelf"]');
  let state = { items: [], owned: [], wallet: null };
  let busy = false;

  function render() {
    wallet.textContent = state.wallet ? `${state.wallet.balance} left of ${state.wallet.earned}` : '—';
    shelf.innerHTML = state.items.map(item => {
      const owned = state.owned.includes(item.id);
      const affordable = state.wallet ? state.wallet.balance >= item.price : false;
      return `<li class="shop-item${owned ? ' owned' : ''}">
        <span class="shop-thumb" style="--swatch:${escapeHtml(item.swatch || '#c9a227')}" aria-hidden="true"></span>
        <span class="shop-copy">
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(KIND_LABEL[item.kind] || item.kind)} · ${escapeHtml(item.blurb || '')}</small>
        </span>
        <button data-buy="${escapeHtml(item.id)}"${owned || busy || !affordable ? ' disabled' : ''}>${owned ? 'Owned' : `${item.price} 🍩`}</button>
      </li>`;
    }).join('');
    shelf.querySelectorAll('[data-buy]').forEach(button => { button.onclick = () => buy(button.dataset.buy); });
  }

  async function load() {
    status.textContent = 'Opening the shop…';
    try {
      const response = await fetch('/api/shop', { signal: AbortSignal.timeout(15000) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { status.textContent = MESSAGES[payload.error] || 'The shop is closed right now.'; return; }
      state = { items: payload.items || [], owned: payload.owned || [], wallet: payload.wallet };
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
      if (!response.ok) { status.textContent = MESSAGES[payload.error] || 'Could not buy that. Try again.'; return; }
      state = { ...state, owned: payload.owned, wallet: payload.wallet };
      status.textContent = `${payload.item.name} is yours.`;
      onOwnedChange(state.owned);
    } catch {
      status.textContent = 'Could not reach the till. Try again.';
    } finally {
      busy = false;
      render();
    }
  }

  return { load, get owned() { return state.owned; } };
}
