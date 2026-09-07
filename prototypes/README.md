# Head accessory functional prototype

Open `/prototypes/headwear.html` through the local web server for an isolated preview. To test on the signed-in player's character, open `/?profile=1&accessories=1`; controls appear below the existing profile wardrobe only for rig `r-7f3a2c`. Other rigs and normal town URLs do not load the prototype.

The hat uses a separately generated felt-trilby sprite with front, side and back views; the editable 12-character banner is drawn in code. The old block cap has been replaced. Existing character pixels remain unchanged. Per-frame head anchors cover the 9 walking frames and all 12 frames across 9 action poses; the same overlay renderer is used by preview and town. The complete character, including hat, mirrors for left; only banner lettering is counter-mirrored. Each rendered player owns at most one accessory canvas, repainted when selection, direction or frame changes.

Selection is in-memory for this page only. It does not write wardrobe data, purchase an item, debit a wallet, or synchronize to other members. Reload removes it. Existing garment recolors still do not apply to action art; the cap/banner layer does.

Verification: four-direction previews; walking and grass-pose animation; actual town/room rendering; movement clears the held pose while retaining accessories; removal; mobile layout; Node anchor, bounded-text and mirroring tests. These checks use the generated character and a simulated member, not production profile writes. Other member rigs, multiplayer synchronization, shop ownership, final art approval, tilting accessories with the head, and large-group label overlap are not validated by this prototype.

## Refined felt hat

`/prototypes/headwear-review.html` shows the unchanged character alongside fitted front, side, back, mirrored-left and action views. The built-in imagegen tool produced the hat from the character atlas as style guidance, then performed a transparent-background extraction pass. No member photo was used. `assets/accessories/felt-hat-v1.json` records the prompt summary, source/output hashes and frames; its image URL points to the versioned runtime PNG (60,568 bytes, 480×112).

The full-resolution master stays in ignored `art-source/accessories/felt-hat-v1.png`. Run `python3 scripts/art/build-hat-asset.py` locally with Pillow to crop the three cells and bake the small atlas. This is asset preparation only; Render does no image processing. Keep the master backed up separately. This remains a local fitting prototype, not a purchasable item or a fix for garment recoloring in pose art.

## Random six-resident fitting sample

`/prototypes/headwear-sample.html` compares original/equipped characters with direction and action selectors and animation. `hat-fit-sample.json` records the random seed, six sampled asset IDs, measured per-frame head positions, exact source hashes and review notes. The same 60,568-byte hat atlas is reused for all six; no new character PNGs or hat copies are created. `python3 scripts/art/sample-hat-fits.py` remeasures the recorded sample; an optional JSON selection file may supply `seed` and `ids` for a new sample. Measurement is only a starting point for visual review.

Four samples are adequate for a basic visual prototype. `r-654fff` already wears a cap baked into the original pixels, so the preview deliberately exposes the double-hat failure; it needs a reviewed replacement mask/base. `r-c74fc1` has a side walking row containing right-facing, front-facing and left-facing frames, so directional equipment cannot be consistently aligned until that source animation is repaired. Neither is classified as compatible. They remain visible in the review rather than being removed from the random sample. These are rough fitting results, not approval for all members or all future accessories. No sampled member's saved outfit is changed, and production rig support is not expanded by this gallery.
