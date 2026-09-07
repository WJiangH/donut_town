# Halloween town, new layout

Generated with the built-in imagegen tool, 1536 × 1024. This replaces the earlier
Classic recolor with a genuinely new street plan. Classic remains the default;
adding or deploying this candidate does not change the active theme selection.

## Final generation prompt

Use case: stylized-concept. Create a NEW playable Halloween Donut Town outdoor map for a cozy pixel-art social game. This is a new geographical layout, not a recolor of the old town. Wide 1536x1024 landscape, top-down three-quarter 16-bit pixel art, crisp textured pixels, detailed but legible walking paths, entire town visible with clear complete borders. NEW COMPOSITION: crescent moon festival village around a large crooked haunted mansion at the TOP CENTER, with a broad empty horizontal cobblestone main street across the middle. On the LEFT a purple-roof donut bakery shop with an unmistakable pink donut roof emblem and a door facing the street, plus a small outdoor coffee terrace. On the RIGHT a compact teal-glass alchemy laboratory with a round dome and an obvious south-facing front door. LOWER LEFT a pumpkin growing patch with walkable aisles, LOWER RIGHT a quiet orchard and reading benches. A narrow stream runs along the BOTTOM edge and a single wide short stone bridge at bottom center leads to a small lantern-lit landing at the lower border. A connected loop of cobblestone lanes circles an EMPTY central festival dance square, with clearly distinct visible paths connecting every doorway, coffee terrace, garden, benches and bridge. Along the upper sides small crooked cottages, orange trees, tiny ghost lanterns, mushrooms, warm window light. Palette: muted plum and deep teal roofs, amber cobblestones, copper foliage, warm gold lights; twilight but bright ground visibility. Keep buildings fully within the image. Keep central square and lanes completely empty and wide enough for many tiny game characters. Place pumpkins and lantern posts beside lanes only. No people, no characters, no portraits, no lettering or text, no user interface, no map markers, no grids, no watermark. Make it charming, rich, game-quality, avoid photographic rendering, avoid a central fountain, avoid duplicating the old circular donut fountain map layout.

## Art and geometry

- Full art: `assets/themes/halloween-e06660656e2c.png`, 3,636,398 bytes.
- Thumbnail: `assets/themes/halloween-thumb-8518b81ffd78.webp`, 61,674 bytes.
- Geometry: `content/themes/halloween-source.json`; no `base` mask.
- The independent 256 × 176 navigation mask has 9,606 connected cells, no
  discarded components and no omitted activity anchors.
- 11 measured activity spots cover dancing, coffee, sitting, reading, gardening
  and river overlooks. Four paired-chat stations and 160 resident slots pass
  path reachability checks. Bakery and lab door landings are reachable.
- Buildings, riverbanks, pumpkin beds, central planting islands and small lantern
  bases stay blocked. The single southern bridge connects the river landing.

## Runtime cost

Only the selected full map loads. Settings uses the small thumbnail. Art is
streamed from disk and immutable cached; generation and mask building run locally.
No portraits or residents are baked into the map. The retired recolor is removed
from the asset bundle to avoid accumulating an unused multi-megabyte map.

## Validation record

Run `npm run themes:check` for geometry/art identity and `npm test` for runtime
contracts. Browser validation and the shop/Home fixes are recorded in
`content/shop-home-map-qa.md`.
