# D&D Character Generator - project instructions

## Keep README.md current
Whenever features are added, changed, or removed, update README.md in the
same commit so it accurately describes the tool. Check especially the
feature bullets, the file-structure note in "Run It", and any counts
(reference entries, spell coverage, level range).

## Deploys
- The site is GitHub Pages from this repo (charactergenerator.github.io).
- **Never push to main.** Every change goes on a short topically named branch
  (`bg-mark`, `mobile-fixes`), gets pushed, and lands through a pull request.
  Merging the PR is what publishes. Same flow as the sibling autorolltables and
  dmscreen repos.
- Pushing the branch is where the agent's part ends: `git push` prints the
  compare URL, and dangeratio opens and merges the PR on GitHub. There is no
  `gh` CLI on this machine and no `GH_TOKEN`, so the PR cannot be opened from
  the terminal.
- Commits are authored as `dangeratio
  <7716602+dangeratio@users.noreply.github.com>`, set in this repo's local git
  config, so they are attributed to the account rather than to the machine's
  stale global identity.
- Before pushing more commits to an existing PR's branch, check that the PR is
  still open. If it has been merged or closed, branch again from the updated
  main and open a new PR.
- Bump the `?v=N` query on the css/js links in index.html on every deploy
  that changes those files (cache busting). Use safe UTF-8 file handling
  when editing index.html from scripts (emoji corruption risk with
  PowerShell Get-Content/Set-Content; use [IO.File] with UTF8 no-BOM).

## Installable app (PWA)
- `manifest.webmanifest`, `sw.js`, and `assets/icon-*.png` make Chrome offer
  "Install" and let the app run offline. All three need HTTPS, so none of it
  works from a file:// open; use a local server to test.
- Regenerate icons with `node tools/make-icons.js` if the mark changes.
- Bump `VERSION` in `sw.js` on any deploy that should drop the old cache.
- The worker is network-first for the page and cache-first for everything
  else, which is safe because css/js carry a `?v=N` that changes per deploy.

## Conventions
- Plain HTML/CSS/vanilla JS only; no frameworks, no build step for the app
  itself (the data generators under tools/ are run by hand, not at deploy).
- SRD 5.2 (D&D 2024 rules) is the primary content source. EN Publishing's
  Level Up: Advanced 5th Edition content comes from the Open5e API.
- Hand-written SRD data lives in js/data.js; logic in js/app.js; styles for
  both themes in css/style.css.
- New interactive elements should work in both themes and both layouts
  (desktop sidebar and mobile bottom bar), and important terms should be
  clickable via refLookup()/refLink() with entries in RULES.

## Generated data files (do not hand-edit)
- `js/open5e.js` (A5E spells, feats, backgrounds, conditions, and the playable
  Marshal) and `js/bestiary.js` (Monstrous Menagerie creatures) are generated.
- To refresh: `node tools/fetch-open5e.js` then `node tools/build-open5e.js`.
  The fetch caches raw JSON under `tools/raw/o5e/`; delete a file to re-pull it.
- `js/open5e.js` loads with data.js before app.js. `js/bestiary.js` is ~1 MB and
  is injected in the background the first time the Reference tab is opened; it
  calls `onBestiaryLoaded()`, which appends the creatures to RULES as a
  "Creature" type and re-renders.
- Known bad upstream fields for a5e-mm, deliberately not shown: `alignment`
  (reads "chaotic evil" for all 586 creatures) and `environments` (always
  empty). Re-check these if the data is refreshed.
- `js/items.js` is the Reference tab's extended Equipment set (~2,000 items),
  built by `node tools/build-items.js` from the item catalogue the companion
  DM Screen project publishes at `https://dmscreen.github.io/data/items.json`.
  It caches the raw pull under `tools/raw/dmscreen/`; delete it to re-pull. It
  is ~1.4 MB and, like the bestiary, is injected the first time the Reference
  tab is opened; it calls `onItemsLoaded()`, which folds the items into RULES
  and skips any whose name the hand-written SRD data already covers, since
  those are the ones wired into the sheet and the equipment picker.
- `assets/logo-autorolltables.png` is the Auto Roll Tables mark for the
  sidebar's "More" link, pulled from that site by
  `node tools/fetch-link-logos.js`. It is an alpha mask, not a picture: the
  stylesheet paints currentColor through it. Re-run the tool if they change
  their logo.

## Licensing (important)
- Keep every attribution in the Settings tab, README.md, and the page footer
  intact and accurate. Sources are not all under the same licence.
- SRD 5.2 and the A5E Adventurer's Guide / Dungeon Delver's Guide / Gate Pass
  Gazette are CC-BY-4.0.
- SRD 5.1, the source of much of the Reference tab's equipment, is CC-BY-4.0.
- Monstrous Menagerie (the creatures) and the Kobold Press (Vault of Magic,
  Tome of Heroes) and Green Ronin (Tal'Dorei) magic items are **OGL 1.0a only**.
  `OGL.txt` carries the full licence and its Section 15 notice, lists which
  content it covers, and must stay in the repo and stay linked from Settings.
  If any of that content is removed, its notice can go with it; if content from
  another OGL source is added, add it to Section 15.
