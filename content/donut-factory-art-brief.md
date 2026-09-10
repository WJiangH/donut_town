# Donut Factory v2

Each of the two buildings contains **12 worktables / 24 reserved standing positions**, arranged in four columns and three rows. Further confirmed pairs use later shifts, with capacity derived from `DonutFactory.stations.length` throughout the UI. Pairing, rewards, and storage are unchanged by this presentation update.

Only reciprocal `booked` records with one pair ID and two distinct members occupy a station. These are confirmed chat pairs, not evidence that both members are online or actually baking. A live member replaces their stationary representative in the same factory/shift. Baking starts only while that member is stationary at their own reserved position; walking away restores the ordinary avatar.

## Production assets

- `assets/donut-factory-interior-v2.webp`: 1536 × 1024, lossless WebP, 1,811,992 bytes. The twelve tables differ in material, cabinet color, utensils, and donut preparation stage. Bottom-center doorway and connected aisles remain clear. No people or labels are baked into the room.
- `assets/factory-baking-v1.png`: transparent RGBA, 768 × 384, four columns × two rows, 192px square cells, 346,333 bytes. Top row rolls dough in four changing poses. Bottom row pipes icing in four changing poses.
- Combined served art: 2,158,325 bytes, versus 2,241,675 bytes for the previous room PNG alone. Both rooms reuse the assets; foreground counter copies reuse the same decoded room image. Both assets load on Factory entry.

The generated upper body is shared cream baking workwear, apron, and white gloves with no fixed skin tone. Existing neutral front-facing heads are cropped at reviewed collar proportions in `donut-factory.js` and fitted over the workwear at runtime. Saved avatars and wardrobe files are untouched. The 56 assigned identities were inspected together for these collar cuts; four representative identities were exercised in the local game fixture. Unknown future character URLs use a conservative default cut and should receive a fitting review when added.

CSS uses discrete four-frame steps, with stable per-member timing offsets. Reduced motion pauses the loop. Until the atlas loads successfully, ordinary complete resident sprites remain visible. The two activities are visual only; no production events, donuts, or messages are emitted.

## Geometry and rendering

Measured from the resulting art, not assumed from the prompt:

- Columns: x = 20.8, 39.8, 60.5, 79.8.
- Tabletop top edges: y = 33.4, 48.7, 64.3.
- Reserved feet: x = column ± 2.9, y = tabletop top + 5.2. Partners face down, side by side behind the counter.
- Counter ground collision: x = center ± 6.5, y = feet + 1 through tabletop top + 12.6. Projected tabletops overlap the standing plane; counter fronts establish the blocked ground footprint.
- Foreground copies provide counter occlusion for walking visitors. Baking upper bodies render just above their own counter depth, with legs hidden by the workwear presentation. Pair nameplates sit on cabinet fronts rather than over the next row's heads.
- The complete 3:2 room fits the viewport. Figure scale follows room width / 1500; ordinary standing height is about 9% of room height and visible baking upper bodies about 7%. At 390px viewport width, the complete room and 12 stations remain visible, but nameplates are necessarily small; profile controls provide full names.

Classic bakery/watermill and Halloween manor/northeast-cottage entrances continue to share these rooms and pair state. Geometry is converted into the existing collision mask; no extra navigation implementation is introduced.

## Generation and processing record

Mode: built-in image generation, four successful image calls: room, action atlas, and two focused background-repair attempts. A filesystem-reference attempt failed before generation because of the host sandbox's symlinked writable root; the visible game-art references were used instead. No Slack photos or real member IDs were sent to image generation.

The atlas and both extraction attempts returned RGB with baked checkerboard. After the user authorized local handling, Python removed connected neutral background regions, cleaned the silhouette fringe, and assembled eight equal cells into RGBA. White gloves, dark outlines, arm gaps, and all eight distinct tool poses were inspected over a contrasting green background. Room conversion to WebP is lossless. Generated originals remain in the thread's Codex generated-images folder; drafts and contact sheets remain outside the repository.

### Room prompt

Use case: stylized-concept. Production Donut Town pixel-art bakery interior background v2. Input image 1 (bakery) is primary style/material/lighting/perspective reference. Image 2 town is only style reference; image 3 sprite only scale reference, DO NOT draw any characters. Redesign workshop to contain EXACTLY TWELVE SMALL worktables, arranged evenly in FOUR COLUMNS and THREE ROWS. Landscape 3:2 canvas, whole cutaway rectangular room boundary visible, bottom-center doorway, warm cream tiled floor, copper ovens and mixer and cooling shelves confined to shallow back wall top 20 percent of canvas. Worktable center columns at 20%,40%,60%,80% canvas width; rows tabletops start near 34%,54%,74% canvas height. Each table about 13% canvas width, 10% canvas height including legs. Broad vertical aisles between columns and central approach to bottom-center door. Twelve distinct tables: maple rolling bench with dough circles; marble glazing slab with pink bowl; dark walnut cocoa station; mint cabinet with sprinkle jars; cherry butcher block; cream enamel bench; blue tile worktop; flour-dusted pine; copper-trimmed board; lavender icing station; sage rolling bench; honey oak packing table with little donut tray. Clear empty space along back edge for two live game characters standing SIDE BY SIDE BEHIND each table facing viewer. Table heights consistent, restrained baking props along sides, central tabletop free for animated tools. Straight front-view three-quarter topdown pixel art, crisp pixels, cozy warm light, teal trim matching bakery. NO people, characters, animals, text, labels, signs, UI, numbers, grids, watermark. All 12 tables visible, no extra center furniture. Room fills image.

### Action prompt

Use case: stylized-concept. Production transparent sprite animation atlas for Donut Town bakery. The supplied bakery is STYLE reference only. Create exactly EIGHT HEADLESS baking upper-body sprite frames in a strict 4 COLUMN by 2 ROW equal-cell grid, landscape 2:1 canvas. Transparent background, no backdrop, no checkerboard. Each cell SAME anchored torso position and SAME scale; no head, no face, no hair, no legs, no furniture. This is a reusable layer attached under existing character heads. Warm cream long-sleeved chef workshirt, pale caramel apron over chest and waist, two white cotton gloved hands, a small dark neck opening at upper-center. Arms must be clearly attached to shoulders and bend naturally. Front-facing three-quarter top-down cozy detailed pixel game art, crisp pixels, matches room. Row 1 four DISTINCT consecutive frames of both hands gripping a rolling pin over a small flattened dough patch: push far, halfway back, pull near, halfway forward. Rolling pin and elbow silhouettes must visibly move vertically; apron and shoulder anchors remain identical. Row 2 four DISTINCT consecutive frames decorating a pink donut with piping bag: grip raised bag, press nozzle on left side, squeeze icing on right side, lift bag from finished icing ring. Include small flour flecks in rolling frames and a tiny pink icing strand in piping frames. Torso top at 15% of each cell height, bottom at 85%; tools in lower half; generous transparent margins. No tables or table surfaces, no detached hands, no text, labels, numbers, grid lines, characters' heads or complete characters. Deliver eight clearly separated clean RGBA sprite cells with genuinely transparent surrounding pixels.

Focused repair 1 preserved all poses, requested actual alpha, and extended white glove cuffs to shirt sleeves to remove exposed wrist skin. The cuff correction succeeded; alpha did not. Focused repair 2 requested background extraction only with a pure-black fallback; output still contained baked checkerboard, so the user-authorized local extraction was used.

## Validation

- Factory unit tests cover 0, 1, 12, 13, 24, 25, and 32 pairs; stable whole-pair allocation; 24 reachable standing spots; blocked counters; nonreciprocal records; live workshop identity; own-seat baking; movement and cancellation restoration.
- Atlas validator confirms exact 4 × 2 grid, RGBA, and zero alpha in corners. Visual review confirms changing hands/tools and icing progression.
- Full isolated repository suite: 182 tests passed, using synthetic Slack and disposable local Redis. Theme validator passes Classic and Halloween. Public-file scan reports zero candidate findings.
- Local-browser verification and final screenshots are recorded separately below. No production deployment or live Slack message test is implied.

Local Chrome QA completed with 25 synthetic pairs: 12/12/1 across factories and shifts, all four changing tool frames observed, nameplates clear of heads, both entrance handlers and toolbar/door exits, profile opening, click-to-walk and keyboard movement, walking-to-baking restoration, a real local WebSocket peer switching workshops without duplicate residents, 1536 × 1100 and 2048 × 1014 desktop plus 390 × 844 mobile fit, reduced motion, failed-atlas fallback, and no JavaScript page errors. All 56 head/workwear combinations were also reviewed on a fitting contact sheet. Test traffic was confined to local fixtures; no Slack messages were sent. The final screenshot and short animation preview use synthetic members.
