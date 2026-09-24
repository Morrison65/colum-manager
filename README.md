# colum-manager

Standalone Tampermonkey userscript for **desktop Chrome**, extracted from the column controls in `c4splus-downloader`. Version **1.0.0**. The repository name intentionally follows the requested spelling.

## Install

1. Open Tampermonkey's dashboard → **Utilities → Import from file** and select [`colum-manager.user.js`](colum-manager.user.js). Alternatively, create a new script and replace its entire contents with this file, including the metadata header.
2. Save/confirm installation, then reload the site.
3. Use **Columns** at the bottom right. Click its heading to collapse or expand it.

Supported URLs:

- `https://c4splus.com/*`
- `https://www.c4splus.com/*`
- `https://site-ma.brazzers.com/*`, including `/scenes?addon=5951&sortby=rating&tags=448`

No runtime dependencies, downloads, API requests or external resources are added. The `@match`, `@sandbox raw` and `@grant none` metadata follow the [Tampermonkey documentation](https://www.tampermonkey.net/documentation.php?locale=en). Page context is needed by the guarded C4SPlus React adapter.

## Controls

| Control | Behavior |
| --- | --- |
| Columns | 1–8 maximum cards per row; default 3. Narrow lists reduce columns to keep cards around 210px or wider. A narrower viewport still shows one card. |
| Gap | Horizontal and vertical space between cards, 0–40px; default 8px. |
| Wide layout | Expands detected listing containers; on by default. |
| Hide promotions | Brazzers only, on by default. Incorporates the supplied store, catfish and root-level dismissible promotion selectors without requiring `body.vsc-initialized`. |
| Hide locked | C4SPlus only, off by default. Hides cards with the site's lock badge and closes the gaps. |
| Reset settings | Restores the defaults above for the current origin. |

Preferences are saved in localStorage under `colum-manager.settings.v1`. Brazzers and C4SPlus are independent. The `www` and bare C4SPlus origins also have separate browser storage. If storage is blocked, adjustments still work for the current document and the panel explains that they will not persist.

The script follows newly inserted cards, filter results, body replacement and list resizing. It keeps existing cards, links, event handlers, thumbnail styling and pagination in place. It adjusts listing layout rather than recreating cards.

## Existing styles and downloader

**Brazzers:** the supplied wide-layout and promotion-hiding CSS is incorporated. Listing width follows the detected section's ancestors, avoiding fragile numbered children. Empty side gutters get the original 2% / 96% / 2% allocation where that structure exists. You can disable your old Stylus rule to let the new toggles control these features; if you leave it enabled, its own hiding/widening remains when a toggle is off. Other unrelated site styling stays in place.

**C4SPlus:** works standalone or alongside the existing downloader. First use imports its saved columns and Hide locked preference. When both run, this script hides the downloader's old layout toolbar and synchronizes its two layout settings. Download and playback controls remain available. Coexistence was tested against the local downloader **v1.10.2**, in both injection orders. Its existing widening still applies when this script's Wide layout is off. To return to only the downloader's layout, disable this userscript and reload.

Search uses virtualized cards. The adapter recognizes the complete observed React hook signature, asks React to render the loaded cards in normal flow and waits for React to remove absolute positions. Unknown virtualizers retain their native layout and show a status message. No guessed hook dispatches or forced removal of virtual positions are used. Switching a loaded search into flow can increase DOM size on very long result lists.

## Adapter design

Shared controls, validation, storage, responsive sizing, observers and layout CSS live in one dependency-free file. The `adapters` registry supplies listing discovery and an optional virtualizer adapter for each site.

- C4SPlus uses clip-card test IDs and listing containers; older responsive width wrappers are supported. Carousel tracks are excluded.
- Brazzers discovers repeated scene cards inside `section[id^="List-container-"]` using same-site numeric scene URLs. Two links to the same scene identify thumbnail/title pairs even before lazy images load. Generated styling classes are not required for multi-card detection. The observed `e1vusg2z0` component marker additionally identifies a single-card result.
- To add another site, add its exact metadata match and hostname, implement its `groups()` adapter returning `Map<Element, Element[]>`, and add narrowly scoped CSS if necessary. Never enable all-domain injection as a substitute for an adapter.

The body observer watches child additions/removals and relevant class/link changes. A ResizeObserver handles container widths, including resizes without a window event. Script-authored writes occur while its mutation observer is disconnected. Removed grids are unobserved. Reinjection does not create duplicate controls or observers.

## Validation

Run from this directory with Node 22+ and desktop Chrome installed:

```powershell
npm run check
```

No npm dependencies are required. `CHROME_PATH` can override the default Windows Chrome executable.

Lint uses the installed **Tampermonkey 5.5.0 / ESLint 8.32.0** worker with its default modern-Chrome configuration and metadata rules, copied from the existing project's audited runner. `tools/tampermonkey-5.5.0.eslint.json` pins that configuration. `TAMPERMONKEY_EXTENSION_DIR` can override its installation directory. A missing/different extension version fails the check; custom editor settings are not claimed to match.

The browser suite launches an isolated Chrome profile. All tested site requests are intercepted and fulfilled from a local server; captures are never allowed to run their scripts or contact remote media. The default suite uses neutral representative fixtures. It checks geometry at 1920/900/390/320px, columns, gaps, lazy placeholders, filtering, dynamic cards, SPA/body replacement, persistence, reset, site separation, blocked storage and unknown-virtualizer fallback.

Optional local integration checks:

```powershell
$env:BRAZZERS_HTML = 'C:\path\to\Brazzers Videos - Best HD Porn Movies & High Quality Sex Clips.html'
$env:C4S_ROOT = 'C:\path\to\c4splus-downloader'
npm run check
```

`C4S_ROOT` needs the actual userscript and its existing `verification/InfiniteScroll-CyVLzibW.js`, `react.production.min.js`, and `react-dom.production.min.js`. These optional checks exercise downloader coexistence and the captured production virtualizer with React, card events and two further pages of results. Private captures and vendor bundles are not copied into this repository.

The supplied Brazzers HTML's **24 actual card wrappers** passed column/geometry checks. Its generated Emotion/styled-components stylesheet tags are empty in the saved file. The test retains available saved styles (including the supplied Stylus CSS), with representative grid rules reconstructed from the saved bundle's layout. This validates detection and layout overrides, **not complete live stylesheet fidelity**.

Headless page injection does **not** verify Tampermonkey extension installation, injection permissions or authenticated live-site behavior. No such verification is claimed. Site revisions can require adapter updates; unsupported layouts are left unchanged.
