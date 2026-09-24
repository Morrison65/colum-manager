# colum-manager

Standalone Tampermonkey userscript for **desktop Chrome**, extracted from the column controls in `c4splus-downloader`. Version **1.4.0**, supporting C4SPlus, Brazzers, Eporner and Adult Time. The repository name intentionally follows the requested spelling.

**v1.4.0 adds Adult Time video listings** on `members.adulttime.com`, including the supplied Video Updates page. Columns, Gap and Wide layout use independent preferences for that origin.

**v1.3.0 completes the split from C4SPlus Downloader v1.11.0:** Colum Manager is the sole owner of listing layout. Update both userscripts and reload open tabs. Saved downloader columns and Hide locked preferences are imported once; existing Colum Manager preferences take priority.

**v1.2.0 improves the C4SPlus watchlist:** clearer cards, readable two-line titles, larger selection controls, selection counts and responsive filters. A native page button beside the Watchlist heading shows/hides the account sidebar and remembers the choice. Layout controls sit above the cards on this page.

**v1.1.1 fixes Wide layout scroll jumps:** existing listing and container styles remain applied during refreshes. Only changed properties and retired layout markers are updated. Previously a refresh briefly restored native narrow widths; a concurrent layout measurement could clamp the scroll position while the page was temporarily shorter. Resize handling now reacts to width changes rather than every thumbnail/list height change.

## Install

1. Open Tampermonkey's dashboard → **Utilities → Import from file** and select [`colum-manager.user.js`](colum-manager.user.js). Alternatively, create a new script and replace its entire contents with this file, including the metadata header.
2. Save/confirm installation, then reload the site.
3. Use **Columns** at the bottom right, or **Watchlist layout** above the cards on the C4SPlus watchlist. Click its heading to collapse or expand it.

The metadata name and namespace remain unchanged so importing this version updates the existing script. The panel shows **Columns · Adult Time** on the new site.

Supported URLs:

- `https://c4splus.com/*`
- `https://www.c4splus.com/*`
- `https://members.adulttime.com/*`, including `/en/videos/?sortBy=all_scenes_latest_desc&fromSeeAll=1`
- `https://site-ma.brazzers.com/*`, including `/scenes?addon=5951&sortby=rating&tags=448`
- `https://eporner.com/*` and `https://*.eporner.com/*`, including `www` and language subdomains. The requested “eponer.com” is interpreted as **eporner.com**, matching the attached CSS; the misspelled host is not matched.

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

Preferences are saved in localStorage under `colum-manager.settings.v1`. Each supported origin has independent preferences. The `www` and bare C4SPlus origins also have separate browser storage. If storage is blocked, adjustments still work for the current document and the panel explains that they will not persist.

The script follows newly inserted cards, filter results, body replacement and list resizing. It keeps existing cards, links, event handlers, thumbnail styling and pagination in place. It adjusts listing layout rather than recreating cards.

## Existing styles and downloader

**Brazzers:** the supplied wide-layout and promotion-hiding CSS is incorporated. Listing width follows the detected section's ancestors, avoiding fragile numbered children. Empty side gutters get the original 2% / 96% / 2% allocation where that structure exists. You can disable your old Stylus rule to let the new toggles control these features; if you leave it enabled, its own hiding/widening remains when a toggle is off. Other unrelated site styling stays in place.

**C4SPlus:** works independently or alongside [C4SPlus Downloader v1.11.0](https://github.com/Morrison65/c4splus-downloader). Update both scripts together and reload: the downloader no longer injects column controls, layout styles, observers or a React layout adapter. Colum Manager imports the legacy `c4splus.layout.columns` and `c4splus.layout.hideLocked` keys only when its own settings are absent, immediately saves the imported preferences, and never writes those legacy keys. Existing manager settings and the account-menu preference are preserved. Removing/turning off the downloader does not affect layout controls; removing Colum Manager and reloading restores native listing layout. Older downloaders still own layout and should be upgraded; the old toolbar synchronization bridge has been removed.

All former downloader layout capabilities are handled here:

| Downloader capability | Colum Manager replacement |
| --- | --- |
| Saved 1–8 columns, default 3, responsive minimum width | Columns, with available width and gap included in fitting |
| Fixed 8px/12px spacing, reduced card/side padding and outer margins | Adjustable Gap, padding-free grid cards, and Wide layout with 2% C4SPlus side gutters; Wide off restores native container width |
| Hide locked with closed gaps and late lock badges | Hide locked, preserving native cards and automatically following badge changes |
| Studio/direct cards, wrapped search cards, older width classes | C4SPlus adapter; carousels stay native |
| Guarded React virtualizer, scrolling pagination and filter replacement | Same strict adapter, now owned and tested here; unknown virtualizers retain native positions and disable unavailable controls |
| Dynamic lists, resize, navigation, UI recovery and storage failures | Shared observers, responsive sizing, recovered controls and session-only fallback |

The spacing controls replace the downloader's fixed spacing policy; they do not reproduce its exact pixel margins. Search/render adapter tests and historical analysis have moved here, and the former separate layout browser harnesses are consolidated into `test/browser.cjs`. Download, recovery, playback, notifications and rate-limit handling remain in the downloader.

**Eporner:** keep your existing Stylus theme enabled. The script handles video cards on the homepage, listings, search/profile pages and related-video sections using `.mb`/`.mbhd` wrappers with same-site video links. It overrides the supplied `32.15% !important`/`40% !important` widths, floats and mobile `display: contents !important` without changing theme colors or player controls. Important inline declarations on managed cards overcome the theme's high-specificity two-ID selectors; prior inline values are restored before rediscovery. Cards already hidden by site/theme rules stay hidden. Pagination/non-card siblings span the row, and clearfix pseudo-elements cannot create phantom cells. Photo/category cards and player layout are not converted. `xhtotal.com` appears in the attached CSS but is not included in this userscript's domain matches.

**Adult Time:** manages video items inside `.SearchListing .ListingGrid`, identified by the site's named card classes and same-host language-prefixed video links. All card slots in an identified video list are retained, including lazy placeholders; native image links, menus, pagination and filters remain in place. Actor lists and recognized carousels stay unchanged. Wide layout releases width caps only between the card grid and its search listing, leaving the page navigation alone. The attached listing is already fluid in places, so Wide layout may make little difference there. Hide locked and Hide promotions remain specific to their existing sites.

The saved Adult Time HTML and adjacent CSS were replayed with **60 slots (20 loaded cards and 40 lazy placeholders)** at 1920/1280/900/390/320px. Checks cover 1/4/8 maximum columns, gaps, wide toggling, thumbnail/card bounds, native links and pagination node identity, lazy slot population, inserted cards, replaced lists, single/empty results and deep-scroll stability. Original capture scripts and remote media are blocked; the test simulates lazy population and cannot verify authenticated pagination requests or live preview playback.

```powershell
$env:ADULTTIME_HTML = 'C:\path\to\Video Updates _ Adult Time.html'
# Keep the adjacent Video Updates _ Adult Time_files folder containing saved CSS.
npm run check
```

C4SPlus search uses virtualized cards. The adapter recognizes the complete observed React hook signature, asks React to render the loaded cards in normal flow and waits for React to remove absolute positions. Unknown virtualizers retain their native layout and show a status message. No guessed hook dispatches or forced removal of virtual positions are used. Switching a loaded search into flow can increase DOM size on very long result lists.

## C4SPlus watchlist

- **Show account menu / Hide account menu** is a normal button in the page HTML beside the Watchlist heading, outside the column controls' shadow root. It has `aria-expanded` and `aria-controls` and supports normal button keyboard interaction. Hiding the sidebar gives its space to the cards.
- The account menu follows the site's desktop-visible/mobile-hidden default until you choose a state. That choice is saved independently under `colum-manager.c4splus.sidebarOpen` for the current origin and survives reloads. On smaller screens an open menu stacks above the watchlist. Reset settings resets the column controls, not this menu preference.
- Desktop sidebar width is reduced to 210px. Source/category/search controls wrap into available space. Layout controls are docked above the cards so they do not cover thumbnails.
- Cards have consistent surfaces, two-line titles, studio names and larger checkboxes. Selected cards are highlighted. The count says **shown on this page** and **selected**, not an inferred total for the entire watchlist.
- Native card links, search/filter controls, selection inputs, removal actions and pagination remain in place with their original event handlers. This UI enhancement makes no watchlist API requests and does not itself select, remove or download videos.
- Detection uses the watchlist title/card test IDs and supports the one-wrapper-per-card layout at mobile widths as well as desktop. The styling is confined to the recognized watchlist. Other pages retain the floating layout panel.

The supplied `User Watchlist _ C4S+.html` and its adjacent saved CSS were tested with 12 real card wrappers at 1920/1280/900/390/320px. Tests cover sidebar visibility and reload persistence, reclaimed card width, selection counts, original control identity/handlers, docked controls and downloader coexistence. Screenshots use neutral thumbnails/titles. The inert capture cannot verify authenticated filter/removal requests or Tampermonkey installation; the saved global header also lacks its live responsive JavaScript.

To include this regression:

```powershell
$env:C4S_WATCHLIST_HTML = 'C:\path\to\User Watchlist _ C4S+.html'
# Keep its adjacent User Watchlist _ C4S+_files directory with the saved CSS.
npm run check
```

## Adapter design

Shared controls, validation, storage, responsive sizing, observers and layout CSS live in one dependency-free file. The `adapters` registry supplies listing discovery and an optional virtualizer adapter for each site.

- C4SPlus uses clip-card test IDs and listing containers; older responsive width wrappers are supported. Carousel tracks are excluded.
- Brazzers discovers repeated scene cards inside `section[id^="List-container-"]` using same-site numeric scene URLs. Two links to the same scene identify thumbnail/title pairs even before lazy images load. Generated styling classes are not required for multi-card detection. The observed `e1vusg2z0` component marker additionally identifies a single-card result.
- Adult Time groups named `ListingGrid-ListingGridItem` wrappers within a recognized video search listing, including its unpopulated lazy slots, without relying on generated `styles_*` hashes.
- Eporner groups `.mb`/`.mbhd` video cards by their direct parent. It accepts the site's `/hd-porn/…/` and `/video-…/` URL patterns and excludes photo cards, nested card internals and recognized carousel tracks.
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
$env:C4S_STUDIO_HTML = 'C:\path\to\saved-studio-listing.html'
# Optional override; defaults to this repository's ignored verification directory.
$env:C4S_LAYOUT_ASSETS = 'C:\path\to\layout-assets'
npm run check
```

`C4S_ROOT` needs only the actual downloader userscript and enables paired-script checks in both injection orders plus a downloader-only native-layout check. Search tests run independently of that repo when `verification/` (or `C4S_LAYOUT_ASSETS`) contains `InfiniteScroll-CyVLzibW.js`, `react.production.min.js` and `react-dom.production.min.js` (React 18.3.1). The studio capture additionally needs `layout-tailwind.css` in that directory. The local copies have been transferred into this project's ignored verification directory; private captures and vendor bundles are not committed. The search test checks native card events, locked filtering and two further pages of results.

The Wide layout regression scrolls deep into a listing and triggers unrelated page mutations while measuring container geometry during refreshes. It fails on v1.1.0 (1905px briefly contracts to 1164px and scrolling can reset to zero) and passes on v1.1.1. It also runs with the saved C4SPlus studio markup and captured stylesheet when `C4S_STUDIO_HTML` and the local layout stylesheet are available, and with the actual downloader in both injection orders. The reported studio 82095 URL returned the logged-out landing page in the isolated browser, so authenticated live verification of that exact filtered listing is not claimed.

## Releases

Every completed userscript version is committed with its tests and documentation after validation. Each completed commit is automatically pushed to the current branch's configured upstream using a normal push. See [AGENTS.md](AGENTS.md) for the standing user instruction and failure handling.

The supplied Brazzers HTML's **24 actual card wrappers** passed column/geometry checks. Its generated Emotion/styled-components stylesheet tags are empty in the saved file. The test retains available saved styles (including the supplied Stylus CSS), with representative grid rules reconstructed from the saved bundle's layout. This validates detection and layout overrides, **not complete live stylesheet fidelity**.

Eporner was captured from the public homepage and two profile pages with the site-capture skill. The generated site styles and **both full attached user styles** were replayed locally. These captures contained **65, 38 and 38 managed video cards** and passed 1/4/8-column checks at 1920/900/390px. The standalone Eporner fixture additionally tests the two-ID mobile `display: contents !important` conflict at 320px. Repeat the capture tests by setting `EPORNER_CAPTURE` to the helper's output directory and `EPORNER_STYLES` to a JSON array of user-style file paths:

```powershell
$env:EPORNER_CAPTURE = 'C:\path\to\capture-output'
$env:EPORNER_STYLES = ConvertTo-Json -Compress -InputObject @('C:\path\to\theme.user.css')
npm run check
```

The test translates the supplied Stylus `@-moz-document` wrappers to `@media all` only inside the Eporner fixture. The production userscript does not replace or install the theme.

Headless page injection does **not** verify Tampermonkey extension installation, injection permissions or authenticated live-site behavior. No such verification is claimed. Site revisions can require adapter updates; unsupported layouts are left unchanged.

## Reusable site-capture skill

[`skills/capture-site-layout/SKILL.md`](skills/capture-site-layout/SKILL.md) and its dependency-free Node helper capture rendered HTML, generated CSS and computed card geometry, with bounded same-origin subpage discovery. A copy is installed at `~/.codex/skills/capture-site-layout` for future Codex sessions. Invoke it as `$capture-site-layout`; restart the Codex session if needed for skill discovery.

The skill is intended for layout development. Captures use an isolated unauthenticated Chrome profile and remain local; they are not a crawler for video downloads. See the skill for options and capture limitations. `verification/` is ignored by Git.
