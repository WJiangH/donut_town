# Donut Shop art handoff

The shop now contains 16 generated transparent pixel-art assets: 14 Home decorations and two wardrobe product previews. Existing pet art is retained. Production PNGs live under `assets/shop/`; the code-drawn placeholder remains only as a fallback for future stock.

## Replace art without changing ownership

Keep each item's `id` unchanged in `content/shop.json`. Purchases and room placements refer to that ID. Add `thumb: "/assets/shop/<id>-thumb-v1.png"` for the shop card and `art: "/assets/shop/<id>-v1.png"` for the home object. The room prefers `art`; the shop prefers `thumb`. The current collection shares each transparent PNG between both uses. No raw Slack IDs, source photos or member names belong in the art files.

Use transparent PNG, crisp pixel clusters, a warm 16-bit palette and the town's top-down three-quarter view. Keep the entire object visible, with a bottom-centred floor contact point and transparent padding. No people, text, scene background, UI or baked grid. Use deliberate pixel clusters readable at 48–96 display pixels and nearest-neighbour rendering; do not bake a checkerboard. The current generated PNG exports retain their original resolution. Align related assets to the same pixel density. Item dimensions can differ; the logical `footprint` is measured in the 14×9 floor grid, not image pixels.

| IDs | Brief | Footprint |
| --- | --- | --- |
| starter-chair | Simple warm wooden reading chair, same starter room for everyone | 2×2 |
| starter-lamp | Small warm standing reading lamp | 1×1 |
| starter-rug | Quiet cream/sage woven rug | 2×2 |
| deco-christmas-tree | Small evergreen, restrained red/gold ornaments | 2×2 |
| deco-pumpkin | Friendly illuminated carved pumpkin | 1×1 |
| deco-gift | Two wrapped seasonal gift boxes | 1×1 |
| deco-pet-bed | Cozy little pet corner/bed | 2×2 |
| deco-fern, deco-rug, deco-lamp, deco-shelf, deco-table | Everyday house accents; preserve catalog footprint until layout migration is planned | Current catalog |
| deco-window, deco-donut-sign | Freestanding framed display for the current floor-only editor; wall mounting is not yet supported | 1×1 |
| wear-shades, wear-hat | Concept thumbnails only; real items need per-rig directional wardrobe layers | Not placeable |

The two style items remain `available: false`. A thumbnail is not enough to enable purchase: implement the equipment entitlement, compatible rig layers, and real map equip behavior first. Do not change that flag merely because art has been generated.

## Future collections

- Seasonal: winter tree, Halloween pumpkin, lantern festival lights.
- Hobbies: books, telescope, tiny music stand, art easel.
- Pets: beds, toy baskets and feeding bowls; preserve companion behavior separately.
- Personal touches: framed pixel posters, rugs, tabletop plants, welcome mats.
- Later interactions: a guestbook, a shared coffee table, visiting a friend's home. These are ideas, not shipped behavior.

## Review

Check native pixel edges, transparent corners and limb/object gaps, baseline alignment, legibility at actual room scale, and mobile rendering. Verify that replacing art leaves IDs, ownership and saved coordinates intact. Large furniture needs a reviewed footprint and collision check, not only a larger PNG.

## Room art and state contract

The production room backgrounds are `assets/donut-home-interior-v1.png` and `assets/donut-shop-interior-v1.png`, generated with the built-in imagegen tool at 1536×1024. They follow the existing `donut-town-interiors` workflow: warm timber, cream masonry, green walls, full cutaway boundaries, bottom-centre door, no people or UI. The Home floor is empty in the painting; all movable furniture is rendered separately. Shop architecture includes fixed shelves and a fixed counter.

The Home floor grid occupies x=12–88%, y=39–78% of its image. Its 14×9 logical coordinates persist independently of the PNG. The shop counter blocks x=38–62%, y=48–64%; the front wall blocks y>77% outside x=40–60%. These are conservative foot-position collision regions, not pixel tracing. Home is a layout editor; visiting friends and walking inside personal homes are not yet implemented.

A new member receives the same three starter decorations without a purchase. An existing saved room, including an intentionally empty one, is preserved. Each item currently has one owned copy. The API validates ownership, grid bounds and multi-cell overlap. The client serializes saves and retains unsaved edits for retry. Purchases and pet equipment use atomic Redis scripts; no new donut earning mechanism is introduced.

Validation: Node unit tests; local Chrome with mocked member/shop/Home APIs for purchase → inventory → placement, keyboard movement, real pointer drag, cancelled drag, serialized saves, failed-save retry, reopening, categories, pagination and desktop/mobile framing. `scripts/verify-shop-redis.mjs` exercises the actual purchase/equip Lua against a disposable local Redis, including simultaneous purchases, insufficient balance, duplicate requests and a lost response. Browser test purchases do not debit real members.

## September 6 production art pass

All 16 assets have RGBA PNG data and four fully transparent corners. The fern required one transparency cleanup pass. `artFrame` records the visible bounds measured at alpha > 8/255, excluding imperceptible export noise; the Home renderer uses an SVG viewport over the unchanged PNG to align the visible bottom edge to the floor. This fixes transparent padding without redrawing or stretching furniture. The 14×9 placement grid and every existing item ID, price, footprint, starter grant and availability flag are preserved. The window item is explicitly presented as a freestanding display because wall mounting is not implemented.

The production receipt is `content/shop-art-manifest.json`: item briefs, asset hashes, dimensions and measured bounds. Every asset was generated independently with the built-in imagegen tool. Shared prompt: warm handcrafted 16-bit pixel art; deliberate 96×96-scale pixel clusters; elevated front three-quarter RPG view; upper-left light; muted sage, cream, terracotta and honey oak; one isolated object; genuine transparent alpha; no scene, floor, cast shadow, checkerboard or text. Each subject is recorded in the receipt.

This pass passed 70 Node tests, including validation of every production PNG, and in-app browser checks using a local simulated member and wallet: purchase-to-inventory, drag placement, keyboard movement, reload persistence, mobile Home/shop rendering and disabled wardrobe purchasing. Existing live wallets were not charged by the tests.
