# Release workflow

The user requires every finished userscript version to be committed, and every completed commit to be pushed automatically.

- Keep the metadata `@version`, runtime `VERSION` and package version consistent.
- Update behavior documentation and run `npm run check` plus relevant capture/coexistence regressions before committing.
- Inspect the scoped staged diff; preserve unrelated work. Do not commit captured pages, browser profiles, logs or media.
- Include the version in the commit subject.
- Inspect the current branch and upstream, then perform a normal push after each completed commit. Never force-push. No further confirmation is needed.
- If authentication, upstream configuration or a non-fast-forward rejection blocks the push, preserve the local commit and report the actual blocker.
- Report version, commit, push outcome and validation limits. Headless injection does not verify authenticated Tampermonkey installation.

# Layout regressions

When changing layout refreshes, test scroll position near the end of a long listing under unrelated DOM/class mutations, both standalone and with the C4SPlus downloader. Keep listing styles continuously applied; do not briefly remove all layout markers and force native geometry reads during rediscovery. Test pagination and filter/list replacement as well.

For watchlist UI changes, set `C4S_WATCHLIST_HTML` to the saved watchlist HTML (with adjacent saved CSS) and run the browser suite. Preserve the sidebar toggle as a native page button beside the Watchlist heading, outside the column control UI. Keep native search/filter, selection/removal and pagination nodes and handlers intact; do not infer a total watchlist count from loaded cards.
