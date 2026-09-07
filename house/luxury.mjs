// Room decoration only. Points are catalog values, independent of shop prices.
export const LUXURY_TIERS = Object.freeze([
  { name: 'Simple', min: 0 },
  { name: 'Cozy', min: 20 },
  { name: 'Charming', min: 60 },
  { name: 'Elegant', min: 120 },
  { name: 'Luxurious', min: 200 },
  { name: 'Grand', min: 320 }
].map(Object.freeze));

export function decorationLuxury(item) {
  return item?.kind === 'decoration' && !item.starter && Number.isSafeInteger(item.luxury) && item.luxury > 0 ? item.luxury : 0;
}

export function houseLuxury(layout, { catalog, ownedIds }) {
  const furniture = new Map(catalog.items.map(item => [item.id, item]));
  const owned = new Set(ownedIds);
  // Moving, repeated saves and duplicate references cannot add points.
  const placed = new Set((layout?.items || []).map(item => item.id));
  const score = [...placed].reduce((total, id) => total + (owned.has(id) ? decorationLuxury(furniture.get(id)) : 0), 0);
  const index = LUXURY_TIERS.findLastIndex(tier => score >= tier.min);
  const tier = LUXURY_TIERS[index], nextTier = LUXURY_TIERS[index + 1] || null;
  return {
    score, tier, nextTier,
    remaining: nextTier ? nextTier.min - score : 0,
    progress: nextTier ? (score - tier.min) / (nextTier.min - tier.min) * 100 : 100
  };
}
