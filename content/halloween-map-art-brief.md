# Halloween town, v1

Mode: imagegen edit of approved `assets/donut-town-map-v2.png`. Output: 1536×1024,
same composition and pixel scale. The generated candidate is registered in
`content/themes/halloween.json`; Classic is still the default.

## Final generation prompt

Edit this approved pixel-art game map into a cozy Halloween Donut Town seasonal
map. Output one complete landscape 3:2 map 1536x1024. The reference is the exact
layout to preserve: keep ALL roads, river banks, bridges, fountain footprint,
building footprints and doors, benches, cafe tables, farm beds and pod entrances
in exactly the same positions and scale. Same top-down three-quarter camera,
complete edge-to-edge framing, detailed crisp 16-bit pixel illustration. Change
decoration and palette only: autumn amber/copper/purple foliage, blue-violet
twilight water, small glowing jack-o-lanterns replacing flower clusters off paths,
warm orange windows, subtle cobwebs on existing roofs, striped autumn awnings,
little ghost-shaped lanterns hanging from trees away from walk lanes. Turn the
center pink donut fountain icing dark chocolate with orange sprinkles while
preserving basin size. Bottom-left science pods remain recognizable; cafe remains
donut-shaped. Halloween should be obvious and rich but cozy, readable and warm,
not horror. Road paving stays pale ochre with exactly the same borders; never add
pumpkins, props or obstacles on roads, bridge decks or furniture seating. Retain
all original benches and cafe furniture in place. No people, no pets, no real
portraits, no text, no UI, no watermark. Do not crop, move buildings, redesign
roads, enlarge river, or hide walkable areas in fog.

## Geometry decisions

The output preserved the main road/river/building layout closely enough for a
reviewed Classic base. Some ghost lanterns sit on ground and pumpkins replace
old grass/flowers, so the old mask is not used unchanged. `halloween-source.json`
records 76 measured blocker footprints, including a cafe-roof region where
overlay review caught a spill in the old palette-based mask. Compilation removes
27 disconnected cells and 14 conflicting action zones, leaving 215 outdoor zones. All six
established outdoor action types and 160 resident placements remain reachable.

Art is 3,805,667 bytes; Classic is 4,011,731 bytes. The generated PNG is kept
unchanged; settings thumbnails are compressed WebP, not full-size background
loads. Full-resolution art has a content hash in its filename and manifest.

Automated reachability/hash checks are recorded by `validate-map-themes.mjs` and
the map-theme tests. Browser QA uses synthetic members and isolated local state;
it is not proof of a production deployment or the real user's admin role.

## Local QA completed

- Full suite: 107 passing tests with the isolated Redis/Lua fixture enabled.
- Actual server routes: anonymous POST rejected with 401; ordinary channel member
  and non-member POST rejected with 403. No client-supplied role bypass.
- Two browser sessions: Classic → Halloween propagated, reload retained Halloween,
  and restoring Classic propagated to both. Preview made no theme write.
- Playable preview: collision overlay reviewed; walk-to-bench ended in the seated
  sprite; a second route ended in the coffee pose. The cafe-roof mask spill was
  fixed after visual review and the geometry gate rerun.
- Chem Pod keyboard entry and Back to town completed on Halloween. The pointer
  entry was initially outside the panned camera viewport, so it was not counted
  as a successful click test.
- Settings inspected at desktop and a confirmed 390×844 viewport: single-column
  phone cards, reachable controls and no horizontal document overflow.
- Preview console had no errors. Reduced-motion paths were inspected in code;
  OS-level reduced-motion behavior was not separately exercised in this run.

The local fixture was restored to Classic. No production theme change or push
was performed as part of this work.
