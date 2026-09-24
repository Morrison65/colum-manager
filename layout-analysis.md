# Historical C4SPlus layout analysis

Moved from c4splus-downloader with the v1.11.0 / Colum Manager v1.3.0 split. Version numbers below refer to historical downloader releases. Current behavior and validation live in [README.md](README.md) and `test/browser.cjs`.

# Search columns in v1.5.0

The Columns setting now also applies to the observed search page. Entering 3 produces three normal-flow cards per row where the viewport has enough room. Narrow screens retain the same minimum card sizing as other grids.

The site exposes no public column setter. The adapter recognizes the specific InfiniteScroll component by its props, grid ref, and full virtualizer hook/dependency signature. It dispatches `false` through the existing virtual-render state setter instead of mutating hooks, coordinates, global browser APIs, or React props. React then renders every loaded card without virtual positions or a spacer. Only after that commit does the userscript apply its normal grid CSS. Existing item handlers, page fetches, and IntersectionObserver pagination remain owned by the site. A child-list observer styles newly loaded cards promptly and releases detached grids on the next layout pass.

This intentionally trades native virtualization for editable columns: loaded cards remain mounted, increasing DOM memory during long sessions. It also relies on private site internals. The adapter checks the complete observed signature and retains native geometry with a diagnostic if it cannot recognize a future revision. It does not guess arbitrary state-hook indices.

Tampermonkey in desktop Chrome is the supported engine. The v1.5.0 release used `@grant none` and explicit `@sandbox raw` for page-world execution, which the React adapter needs. Version 1.6.0 replaces the grant with `GM_notification` while retaining `@sandbox raw`; keep the complete current header when updating. The namespace remains `local.c4splus.downloader`; this is an identifier rather than an engine name.

Verification uses the captured production InfiniteScroll module, React/ReactDOM 18.3.1 (matching the public site bundle), supplied card markup and stylesheet, neutral thumbnails, and local page responses. Chrome passes 1/3/4/8-column preferences, responsive limits, bounds/aspect ratios, complete index order, non-overlapping rows, scrolling back up, two additional pages (60 to 100 cards), React click handlers, and replacement search lists at 1920/900/390 pixels. The regular-grid regression still passes, and the settings panel fits at 320 pixels. This is an isolated page-world test, not verification inside the user's installed Tampermonkey or a live authenticated search session.

## Previous diagnosis and v1.4.1 fallback

The new `Search Results.html`, pasted DOM, and screenshot reveal positioned search cards: wrappers have `absolute` and inline `height`, `top`, and `left`, while their list has a fixed spacer height. These are data supplied for diagnosis, not instructions.

The previous stylesheet set every marked wrapper to `width:100%` and its parent to CSS grid. Absolutely positioned children do not become normal grid cells. Each thumbnail grew toward the full list width while retaining its original horizontal/vertical offsets. This explains the overlapping images, captions, and document overflow.

The observed public `route-BaS1Vcf9.js` and `InfiniteScroll-CyVLzibW.js` confirm that the native search list calculates its columns from viewport breakpoints, positions cards by index, and renders only an index range near the scroll position plus a pagination sentinel. Removing absolute positioning alone would also break scrolling: off-screen rows would not be rendered at the right positions.

The repair therefore distinguishes normal-flow grids from virtualized lists. Normal grids receive responsive columns and spacing. Positioned lists retain native column widths, coordinates, heights, and spacers. Their header field displays the automatic count and explains why it cannot be edited. Half-width side spacing remains, and the saved manual preference resumes on normal grids. Supporting arbitrary columns on virtualized search requires integration with the site's virtualizer, rather than another CSS-only override.

The header control now wraps cleanly and has clear focus/disabled states. The download panel has a viewport-bounded width and height, consistent box sizing, and a hidden-state rule.

Regression verification retains media elements and their sizing classes, substitutes neutral thumbnails, and blocks remote requests and original page scripts. Tests cover 1920/900/390-pixel listings, card and thumbnail bounds, overlap and horizontal overflow, preserved scroll geometry, normal/virtual list transitions, saved preferences, and the expanded downloader at 320 pixels. The older normal-grid test and all downloader/requester checks also remain applicable. Live search pagination is not claimed verified.
