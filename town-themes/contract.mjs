// A theme is artwork and gameplay geometry, selected as one unit.
export const DEFAULT_THEME = 'classic';
export const INITIAL_REVISION = 'initial';
const ACTIONS = new Set(['sitChair','sitGrass','coffee','read','garden','lookout','experiment','dance','fish']);
const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100;
export function validateTheme(theme) {
  const bad = () => { throw new Error('invalid_theme_package'); };
  if (theme?.schemaVersion !== 1 || !/^[a-z][a-z0-9-]{0,39}$/.test(theme.id || '')) bad();
  if (!/^\/assets\/[a-zA-Z0-9/_-]+\.png$/.test(theme.image || '') || !/^[a-f0-9]{64}$/.test(theme.imageSha256 || '')) bad();
  if (!theme.name || !point(theme.spawn) || !point(theme.camera)) bad();
  if (!Number.isInteger(theme.imageSize?.width) || !Number.isInteger(theme.imageSize?.height) || theme.imageSize.width < 64 || theme.imageSize.height < 64) bad();
  if (!Number.isFinite(theme.worldWidth) || theme.worldWidth < 512 || theme.worldWidth > 8192) bad();
  const b=theme.bounds;
  if (!b || !point({x:b.minX,y:b.minY}) || !point({x:b.maxX,y:b.maxY}) || b.minX>=b.maxX || b.minY>=b.maxY) bad();
  for (const key of ['chemPod','donutShop']) if (!point(theme.entrances?.[key]) || !point(theme.entrances[key].landing)) bad();
  const m=theme.walkMask;
  if (!m || !Number.isInteger(m.cols) || !Number.isInteger(m.rows) || m.cols<8 || m.rows<8 || m.cols*m.rows>262144 || !/^[A-Za-z0-9+/]+=*$/.test(m.bits || '')) bad();
  if (atob(m.bits).length!==Math.ceil(m.cols*m.rows/8)) bad();
  if (!Array.isArray(theme.zones) || !theme.zones.length || theme.zones.length>1000) bad();
  for (const z of theme.zones) if (!point(z) || !point(z.anchor) || z.scene!=='town' || !z.resolved || ![z.action].flat().length || ![z.action].flat().every(a=>ACTIONS.has(a)) || !Number.isInteger(z.seats) || z.seats<1 || z.seats>10 || (z.radius!==undefined && (!Number.isFinite(z.radius) || z.radius<=0 || z.radius>10))) bad();
  if (!Array.isArray(theme.stations) || !theme.stations.length || theme.stations.some(s=>![s,s.left,s.right].every(point))) bad();
  return theme;
}

// An explicit Town allowlist overrides Slack workspace roles. Raw IDs stay private.
export function canManageTheme(member, characterKey, configuredKeys = '') {
  if (!member) return false;
  if (configuredKeys.trim()) {
    const keys = configuredKeys.split(/[\s,]+/).filter(Boolean);
    return /^[a-f0-9]{64}$/.test(characterKey || '') && keys.includes(characterKey);
  }
  return member.isWorkspaceAdmin === true;
}
