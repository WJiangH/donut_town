# Data and public releases

## License and assets

The project's code, documentation, agent skills and project-created game assets
are distributed under [Apache License 2.0](../LICENSE), unless a file has a
separate license notice. Preserve the license, applicable notices and change
notices when redistributing. [NOTICE](../NOTICE) identifies the project.

This includes the generated pixel maps, interiors, furniture, pets and character
art committed to the repository, to the extent the contributors hold licensable
rights. It does not grant rights in original Slack profile photographs, personal
data, third-party trademarks or a person's likeness. Those source photos and
private records are not part of the licensed game-asset collection. Do not imply
that a depicted person endorses a derivative product.

Third-party dependencies retain their own licenses. The `ws` dependency is MIT
licensed; its license is distributed in the installed package. Any separately
licensed contributions or assets must retain their applicable notices.

## What belongs where

| Material | Location |
| --- | --- |
| Code, approved pixel game art, sprite manifests | Repository |
| Character bindings | Repository, keyed HMAC identifiers only |
| Tokens, signing/client secrets, staging password | Hosting secret fields or ignored local environment |
| Original member photos and private generation metadata | Temporary private files outside the repository |
| Slack profile identities | Slack and authenticated runtime responses |
| Invitations, purchases, outfits, Homes, confirmations | Operator-controlled storage |

Original photos and raw member IDs must not enter Git. Generated characters may
still resemble a real person. Obtain permission to publish recognizable likenesses;
a keyed hash protects a binding better than a plain hash but is not anonymity.

Town reads the configured channel's roster, excluding bots and deleted users,
and displays available name, avatar, role, pronouns, status and time-zone fields.
The Town manifest does not request email or channel-message history. This is
not a promise that no personal data is processed: runtime membership checks and
invitation records use Slack IDs, and optional Lottery automation has broader
permissions. Chat history records matches/confirmations, not Slack conversation text.

Use a dedicated Upstash database for each deployment. Invite history is namespaced
by channel; wardrobe/shop/Home also rely on HMAC member keys. Rotating
`SLACK_SIGNING_SECRET` changes those keys, invalidates sessions and can disconnect
saved state and character bindings. Back up and plan migration before rotation.

## Reviewing public releases

Review the files **and Git history** for credentials, private source images,
member lists and accidental exports. `.gitignore` does not remove old commits.
Review permission to publish generated member likenesses and third-party assets.
Keep production environment settings out of screenshots and issue reports.

## Privacy review and optional source-only export

The 2026-09-07 audit inspected 72 reachable commits and 1,451 unique Git blobs,
plus the current tracked and non-ignored working files. Text candidates were
reviewed rather than counted as confirmed leaks. No real Slack tokens, private
key blocks, source-avatar URLs, private document links or real raw Slack IDs
were found by these checks. Placeholder IDs and code constants were excluded.
All 672 historical image blobs were PNGs without text/EXIF metadata; a contact
sheet review of 69 current art files (including resident walk atlases and room
backgrounds) showed game artwork, not original member photographs. This does
not constitute exhaustive visual inspection of every animation layer.

Member-specific announcement/description text was removed from current files.
The existing repository is already public. Its historical first-name mentions
and author email metadata were reviewed and accepted by the maintainer; these
are not treated as credential leaks or blockers requiring a history rewrite.
Production HMAC character bindings remain supported in the current repository.

For a fresh template without deployment-specific bindings or old commit history,
an optional source-only export is available:

```sh
npm run privacy:check -- --history
npm run export:public -- --out /tmp/donut-town-public
npm run privacy:check -- --dir /tmp/donut-town-public
```

The history check can flag accepted author metadata: review its findings rather
than interpreting every match as a secret leak. Export copies the current
tracked/non-ignored source, preserves approved game art and license files,
excludes Git and ignored files, and writes an empty
`characters/assignments.json` only in the exported copy. It refuses to overwrite
an existing destination. The production repository and bindings stay intact.
Using the export is optional; normal development can continue in the existing
public repository.

For a private list of names, emails and organization terms, pass
`--deny-file /private/path/terms.json` to either command. The file is a JSON
array of strings, belongs outside the repository, and its values are never
printed by the check. The script checks common patterns, not arbitrary API-key
formats or image likenesses. A clean result is evidence for its stated scope,
not a guarantee of anonymity. Generated likenesses remain in the export under
the project's art policy; remove them if a truly anonymous release is required.

## Operational boundaries

- The generated staging password gives access to admin preview and member data;
  treat it as a secret, and give members the Slack entrance link instead.
- Slack sessions default to 30 days and renew during use. `SESSION_DAYS` can
  shorten that period. Membership is verified at sign-in; immediate revocation
  of already-issued sessions is not a complete administrative feature.
- Used login tokens and active presence live in one process. A restart clears
  those replay records; do not claim persistent one-time-token enforcement.
- Authentication is required for member APIs. Hidden repository paths, `.env`
  files, Git/agent working directories and private art sources are not served
  as static files, including during local HTTPS development.
- The project has targeted tests, not a certification or a full public-release
  security audit. A new workspace deployment still needs real login/callback and
  persistence verification with that workspace's own app.
