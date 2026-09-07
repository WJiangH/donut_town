// The shop as a room: what is on the shelves, and buying it while standing there.
import { SHOP_MESSAGES, shopRequest } from "./shop-panel.mjs";

// Where each kind of stock sits along the back wall, in room percentages.
const SHELVES = {
  pet: { y: 40, from: 15, to: 44 },
  decoration: { y: 40, from: 56, to: 88 }
};

export function mountShopRoom(root, { onOwnedChange = () => {}, onPetChange = () => {} } = {}) {
  const shelves = root.querySelector('[data-shop="shelves"]');
  const status = root.querySelector('[data-shop="status"]');
  const wallet = root.querySelector('[data-shop="wallet"]');
  const bar = root.querySelector('[data-shop="bar"]');
  let state = { items: [], owned: [], pet: null, wallet: null };
  let selected = null;
  let busy = false;

  function slots() {
    const rows = [];
    for (const [kind, shelf] of Object.entries(SHELVES)) {
      const stock = state.items.filter(item => item.kind === kind);
      stock.forEach((item, index) => {
        const spread = stock.length > 1 ? (shelf.to - shelf.from) / (stock.length - 1) : 0;
        rows.push({ item, x: stock.length > 1 ? shelf.from + spread * index : (shelf.from + shelf.to) / 2, y: shelf.y });
      });
    }
    return rows;
  }

  function render() {
    shelves.innerHTML = slots().map(({ item, x, y }) => {
      const owned = state.owned.includes(item.id);
      const art = item.thumb ? `background-image:url('${item.thumb}')` : "";
      return `<button class="shop-slot${owned ? " owned" : ""}${selected === item.id ? " selected" : ""}" type="button"
        data-slot="${item.id}" style="left:${x}%;top:${y}%;--swatch:${item.swatch || "#c9a227"}"
        aria-label="${item.name}, ${owned ? "owned" : `${item.price} donuts`}">
        <i style="${art}"></i><small>${owned ? "Owned" : `${item.price}🍩`}</small>
      </button>`;
    }).join("");
    shelves.querySelectorAll("[data-slot]").forEach(button => {
      button.onclick = () => select(button.dataset.slot);
    });
    wallet.textContent = state.wallet ? `${state.wallet.balance} of ${state.wallet.earned} 🍩` : "—";
    renderBar();
  }

  function renderBar() {
    const item = state.items.find(entry => entry.id === selected);
    bar.hidden = !item;
    if (!item) return;
    const owned = state.owned.includes(item.id);
    const out = state.pet === item.id;
    bar.querySelector('[data-shop="bar-thumb"]').style.cssText = item.thumb
      ? `background-image:url('${item.thumb}');background-size:cover`
      : `background:${item.swatch || "#c9a227"}`;
    bar.querySelector('[data-shop="bar-name"]').textContent = item.name;
    bar.querySelector('[data-shop="bar-blurb"]').textContent = item.blurb || "";
    const action = bar.querySelector('[data-shop="bar-action"]');
    const affordable = state.wallet ? state.wallet.balance >= item.price : false;
    if (owned && item.kind === "pet") action.textContent = out ? "Leave at home" : "Take out";
    else if (owned) action.textContent = "Owned";
    else action.textContent = `Buy · ${item.price} 🍩`;
    action.disabled = busy || (owned && item.kind !== "pet") || (!owned && !affordable);
    action.onclick = () => (owned && item.kind === "pet" ? equip(out ? null : item.id) : buy(item.id));
  }

  function select(itemId) {
    selected = itemId;
    render();
  }

  async function load() {
    status.textContent = "Opening the shop…";
    try {
      const payload = await shopRequest("/api/shop");
      state = { items: payload.items || [], owned: payload.owned || [], pet: payload.pet || null, wallet: payload.wallet };
      status.textContent = "Click something on a shelf to look at it.";
      render();
      onOwnedChange(state.owned);
      onPetChange(state.pet);
    } catch (error) {
      // A shop window is worth looking at even when the till will not serve you.
      status.textContent = SHOP_MESSAGES[error.code] || "The shop is closed right now.";
      try {
        const catalogue = await (await fetch("/content/shop.json", { signal: AbortSignal.timeout(10000) })).json();
        state = { items: catalogue.items || [], owned: [], pet: null, wallet: null };
        render();
      } catch {
        // Nothing to show at all.
      }
    }
  }

  async function buy(itemId) {
    if (busy) return;
    busy = true;
    status.textContent = "Wrapping it up…";
    renderBar();
    try {
      const payload = await shopRequest("/api/shop/purchase", { itemId });
      state = { ...state, owned: payload.owned, wallet: payload.wallet, pet: payload.pet ?? state.pet };
      status.textContent = `${payload.item.name} is yours.`;
      onOwnedChange(state.owned);
    } catch (error) {
      status.textContent = SHOP_MESSAGES[error.code] || "Could not buy that. Try again.";
    } finally {
      busy = false;
      render();
    }
  }

  async function equip(petId) {
    if (busy) return;
    busy = true;
    renderBar();
    try {
      const payload = await shopRequest("/api/shop/equip", { petId });
      state = { ...state, pet: payload.pet || null };
      status.textContent = state.pet ? "They are following you now." : "Left at home.";
      onPetChange(state.pet);
    } catch (error) {
      status.textContent = SHOP_MESSAGES[error.code] || "That pet is staying put.";
    } finally {
      busy = false;
      render();
    }
  }

  return { load };
}
