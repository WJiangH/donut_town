export function outfitFor(manifest, requested = {}) {
  return Object.fromEntries(Object.entries(manifest.slots).map(([slot, spec]) =>
    [slot, Object.hasOwn(spec.items, requested[slot]) ? requested[slot] : spec.default]));
}

export function layerUrls(manifest, requested) {
  const outfit = outfitFor(manifest, requested);
  return [manifest.base, ...manifest.layerOrder.map(slot => manifest.slots[slot].items[outfit[slot]])].filter(Boolean);
}

export async function loadWardrobe(manifest) {
  const urls = new Set([manifest.url, manifest.base, ...Object.values(manifest.slots).flatMap(slot => Object.values(slot.items)).filter(Boolean)]);
  const entries = await Promise.all([...urls].map(url => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => image.naturalWidth === manifest.imageWidth && image.naturalHeight === manifest.imageHeight
      ? resolve([url, image]) : reject(new Error('Equipment atlas dimensions do not match the rig'));
    image.onerror = () => reject(new Error('Equipment image could not load'));
    image.src = url;
  })));
  return new Map(entries);
}

export function drawWardrobe(canvas, manifest, images, outfit, direction = 'down', frame = 1, original = false) {
  if (!['down', 'right', 'left', 'up'].includes(direction) || ![0, 1, 2].includes(frame)) throw new Error('Invalid pose');
  const row = direction === 'up' ? 2 : direction === 'down' ? 0 : 1;
  const [x, y, w, h] = manifest.frames[row * 3 + frame];
  const context = canvas.getContext('2d');
  const scale = canvas.height / manifest.frameHeight;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.imageSmoothingEnabled = false;
  if (direction === 'left') { context.translate(canvas.width, 0); context.scale(-1, 1); }
  for (const url of original ? [manifest.url] : layerUrls(manifest, outfit)) {
    context.drawImage(images.get(url), x, y, w, h, (canvas.width - w * scale) / 2, canvas.height - h * scale, w * scale, h * scale);
  }
  context.restore();
}
