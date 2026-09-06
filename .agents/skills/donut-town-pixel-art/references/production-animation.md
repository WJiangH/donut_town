# Production animation from an approved resident

Use this mode when the user asks for walking animation, production sprites, or to continue an approved preview into an animated character. Such a request authorizes local production and QA; do not return only another static concept. Preserve the current approved identity, including proposed clothing the user has elected to continue with. Reuse its local path instead of downloading the same avatar and redesigning it.

## Deliverables

Produce a genuinely transparent directional PNG, a renderer-compatible manifest, and an interactive local animation preview over the actual town map. Preserve the source photo outside the repository. Report production readiness separately from deployment and from live multiplayer testing.

## Generate and repair

1. Inspect the approved sprite and read `prompting.md`. Generate a 3-column by 3-row atlas: down, right, up; step A, neutral, step B. Preserve silhouette, clothing, color, face and scale. Describe opposite arms/legs explicitly so A/B are not duplicates. For skirts or long clothing, allow a small readable stride without changing the garment. Right-facing characters must face right in all three columns; up-facing characters must show their backs.
2. Immediately run `validate-png-atlas.mjs <path> 3 3`. Do not proceed as production if transparency fails. A checkerboard may look convincing while every pixel is opaque.
3. If pose/identity is wrong, make a focused image-tool correction before the final transparency pass. Then use the image tool's background-extraction request, targeting the latest corrected image and preserving its poses. Editing poses after extraction can reintroduce opaque backgrounds, so revalidate after every edit.
4. Follow the two-failed-background-retry limit in `prompting.md`. Count only background-extraction repair calls as transparency retries: one initial generation plus one extraction is ONE failed repair, not two. Do not stop early by counting the initial atlas as a repair. Keep one attempt ledger across focused edits and do not reset the retry counter each time a new candidate appears. Keep a short attempt log (target, intended change, actual alpha/pose result). Do not silently substitute an earlier defective gait as production. If a tool restriction requires user authorization for code-based editing, report the specific failure and ask once; keep independent manifest and preview work moving. Do not bypass that rule with an alternate image-editing tool or a CSS filter.

A prompt does not prove output quality. Inspect all nine silhouettes and verify at least these invariants: same hair/clothing/head proportions; neutral standing pose; opposite A/B stride phases; correct down/right/up; no clipped fingers/hair/boots; no leftover checkerboard between limbs. Do not infer that generated unseen details reproduce the real person's unseen appearance.

## Measure without redrawing

Use `scripts/measure-animation.py <transparent.png> --url /assets/residents/<opaque-id>/walk-v1.png --out <manifest.json>` to measure frame rectangles. This is a read-only image inspection tool: it writes JSON, not altered PNGs. If an RGBA candidate has residual corner alpha, `--draft` can measure its silhouettes for a diagnostic preview; it marks the manifest `productionReady:false`. This does not waive the production alpha check. Do not substitute guessed width/3 cells merely because the strict production measurement rejects residual alpha. Run it with a Python that has Pillow (the bundled desktop runtime does). If it cannot identify three separated rows and three silhouettes per row, inspect the geometry and supply reviewed rectangles; do not force width/3 and height/3.

The manifest includes imageWidth, imageHeight, frameHeight and nine source rectangles. It fits the existing `paintPersonalCharacter` renderer. Render all frames at ONE common scale with consistent feet baselines. Compare torso center as well as bounding-box center; moving arms can shift the visual center. A non-integer grid is acceptable only when explicit reviewed rectangles remove clipping/jumps. Structural validation does not certify gait.

## Interactive and game QA

Create a local HTML preview with down/right/left/up controls, play/pause, frame stepping, and adjustable 110–160 ms frame timing. Use the actual town map behind the character, and A / neutral / B / neutral order. Mirror only the right-facing art for left. Show the reference neutral frame alongside the animation so identity drift is reviewable. Use explicit source-rectangle CSS background sizing/position or canvas `drawImage` source rectangles to render existing frames; an 88px `<img>` with `object-fit:none` does not scale an atlas into frames. This rendering does not authorize rewriting source image pixels. Keep a separate phase index for `[0,1,2,1]`: advancing with `indexOf(frame)` gets stuck between the duplicate neutral and step B. Verify that step A reappears after a complete cycle, not just that the label changes. Respect reduced motion by starting paused.

Inspect at native frame size and at actual 88px character height, including Overview scale 0.65 and Follow scale 1. Verify complete silhouettes, stable foot baseline, no apparent teleport between frames, distinct stride phases and no background halo. Capture desktop/mobile evidence. On this desktop, Chrome may abort inside the restricted sandbox; use the available `exec_command` escalation for the same isolated local browser QA rather than declaring the browser unavailable after repeating the same failing launch. The bundled Playwright can launch the installed Chrome with `chromium.launch({headless:true, channel:"chrome"})`. If automatic review rejects the launch, report that rejection; otherwise verify actual rendering and controls. CSS breakpoints in source are not browser QA. The preview may use private temporary input paths and synthetic user IDs; it must not expose actual IDs or credentials.

For a requested game replacement, additionally wire its HMAC binding following `avatar-personalization.md`, and test local/remote player rendering, idle, direction changes, scene changes, reset/reload and failed-asset fallback. Do not alter shared characters. Deploy only when requested in the session. A local demo alone does not prove live multiplayer synchronization.

## Completion report

List final asset and manifest paths, the interactive preview, image-tool call count, alpha/geometry checks, visual QA performed and any failed gate. A transparent but repeated-stride atlas is a draft, not a production success. If blocked, keep the latest valid deliverables, state what remains and provide reviewable evidence. Token counts must come from actual per-agent usage records; image-tool internal billing is separate unless returned explicitly.

Before reporting, refresh all preview labels, atlas thumbnails and manifest notes to the actual final candidate. Do not leave stale RGB/checkerboard warnings on an RGBA result. Compare the written outcome with the actual silhouette/stride, and state visual uncertainty instead of claiming an opposite stride from mere pixel differences.
