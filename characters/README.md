# Personal characters

`assignments.json` maps HMAC-SHA256 member keys to versioned character manifests. `catalog.mjs` computes keys on the server with `SLACK_SIGNING_SECRET` and the domain prefix `donut-town:character:v1\0`; raw IDs and the secret are never stored in this catalog. The server attaches the descriptor to authorized member responses. Source photos are not shipped. PNGs under `assets/residents/` are deployed with the application from Git; no runtime file upload or automatic regeneration is involved.

A manifest supplies the image size, nine source rectangles (down/right/up; step/neutral/step), and a common `frameHeight` for consistent display scale. The renderer aligns rectangle bottoms with the feet position, mirrors right-facing art for left, and uses the neutral frame in portraits and when idle. Invalid manifests fail startup; a failed image load falls back to the existing shared character.

Current `r-7f3a2c` design is user-approved. Its v1 transparent atlas is a preview: first and third strides are very similar. Corrected gait art exists only as an unaccepted opaque intermediate and is not shipped. Two background-removal retries failed; code-based cleanup is awaiting user authorization. Do not describe this as a finished walk-cycle quality gate or a validated Luna run.

Reusable workflow: `.agents/skills/donut-town-pixel-art/references/avatar-personalization.md`.

The keyed hash makes guessing member IDs from the public catalog harder than plain SHA-256. It is a pseudonymous binding, not anonymity: the generated artwork may still resemble its owner, and authorized town members see profile identities through existing APIs. Changing the signing secret requires regenerating bindings from authorized member IDs before deployment; otherwise those members fall back to shared art. Never commit the IDs, key, source photos, or photo fingerprints.
