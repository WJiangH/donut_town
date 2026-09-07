// The shop as a room: what is on the shelves, and buying it while standing there.
import { itemArt } from "./shop/item-art.mjs";
import { SHOP_MESSAGES, shopRequest } from "./shop-panel.mjs";

const CATEGORIES = {all:'All',home:'Home',seasonal:'Seasonal',pets:'Pets',style:'Style'};

export function mountShopRoom(root, { onOwnedChange = () => {}, onPetChange = () => {} } = {}) {
  const shelves = root.querySelector('[data-shop="shelves"]');
  const status = root.querySelector('[data-shop="status"]');
  const wallet = root.querySelector('[data-shop="wallet"]');
  const bar = root.querySelector('[data-shop="bar"]');
  let state = { items: [], owned: [], pet: null, wallet: null };
  let selected = null;
  let category = "all";
  let page = 0;
  let busy = false;

  const stock = () => state.items.filter(item => !item.starter && (category === "all" || item.category === category));
  function slots() {
    return stock().slice(page*6, page*6+6)
      .map((item, index) => ({item, x: 32 + (index % 3)*18, y: 24 + Math.floor(index/3)*11}));
  }

  function render() {
    const tabs = root.querySelector('[data-shop="categories"]');
    tabs.innerHTML = Object.entries(CATEGORIES).map(([key,label])=>`<button data-category="${key}" aria-pressed="${category===key}">${label}</button>`).join('');
    tabs.querySelectorAll('button').forEach(button=>button.onclick=()=>{category=button.dataset.category;page=0;selected=null;render();});
    const pages = Math.max(1,Math.ceil(stock().length/6));
    page=Math.min(page,pages-1);
    const pager=root.querySelector('[data-shop="pages"]');
    pager.hidden=pages===1;
    pager.innerHTML=`<button aria-label="Previous shelf" ${page===0?'disabled':''}>←</button><span>${page+1} / ${pages}</span><button aria-label="Next shelf" ${page===pages-1?'disabled':''}>→</button>`;
    pager.querySelectorAll('button').forEach((button,index)=>button.onclick=()=>{page+=index?1:-1;selected=null;render();});
    shelves.innerHTML = slots().map(({ item, x, y }) => {
      const owned = state.owned.includes(item.id);
      const art = `background-image:url('${itemArt(item, true)}');background-size:contain;background-repeat:no-repeat;background-position:center`;
      return `<button class="shop-slot${owned ? " owned" : ""}${selected === item.id ? " selected" : ""}" type="button"
        data-slot="${item.id}" style="left:${x}%;top:${y}%;--swatch:${item.swatch || "#c9a227"}"
        aria-label="${item.name}, ${owned ? "owned" : `${item.price} donuts`}">
        <i style="${art}"></i><small>${item.available===false ? "Soon" : owned ? "Owned" : `${item.price}🍩`}</small>
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
    bar.querySelector('[data-shop="bar-thumb"]').style.cssText = `background-image:url('${itemArt(item, true)}');background-size:contain;background-repeat:no-repeat;background-position:center`;
    bar.querySelector('[data-shop="bar-name"]').textContent = item.name;
    bar.querySelector('[data-shop="bar-blurb"]').textContent = item.blurb || "";
    const action = bar.querySelector('[data-shop="bar-action"]');
    const affordable = state.wallet ? state.wallet.balance >= item.price : false;
    if (item.available === false) action.textContent = "Coming soon";
    else if (owned && item.kind === "pet") action.textContent = out ? "Leave at home" : "Take out";
    else if (owned) action.textContent = "Owned";
    else action.textContent = `Buy · ${item.price} 🍩`;
    action.disabled = item.available === false || busy || (owned && item.kind !== "pet") || (!owned && !affordable);
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
      status.textContent = "Choose something for your home.";
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
