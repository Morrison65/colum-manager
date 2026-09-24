// ==UserScript==
// @name         Colum Manager - C4SPlus, Brazzers and Eporner
// @namespace    local.colum-manager
// @version      1.3.0
// @description  Adjustable thumbnail columns, spacing and wide listings with independent site preferences.
// @match        https://c4splus.com/*
// @match        https://www.c4splus.com/*
// @match        https://site-ma.brazzers.com/*
// @match        https://eporner.com/*
// @match        https://*.eporner.com/*
// @run-at       document-idle
// @grant        none
// @sandbox      raw
// @noframes
// ==/UserScript==

/* global globalThis:readonly, module:readonly */
(function () {
    'use strict';
    const VERSION = '1.3.0';
    const STORAGE_KEY = 'colum-manager.settings.v1';
    const DEFAULTS = { columns: 3, gap: 8, wide: true, hidePromos: true, hideLocked: false };
    function cleanSettings(value) {
        const result = { ...DEFAULTS };
        if (!value || typeof value !== 'object') return result;
        for (const [key, min, max] of [['columns', 1, 8], ['gap', 0, 40]]) {
            if (Number.isInteger(value[key]) && value[key] >= min && value[key] <= max) result[key] = value[key];
        }
        for (const key of ['wide', 'hidePromos', 'hideLocked']) {
            if (typeof value[key] === 'boolean') result[key] = value[key];
        }
        return result;
    }
    function fittingColumns(width, requested, gap) {
        return Math.min(requested, Math.max(1, Math.floor((width + gap) / (210 + gap))));
    }
    function siteFor(hostname) {
        if (['c4splus.com', 'www.c4splus.com'].includes(hostname)) return 'c4splus';
        if (hostname === 'site-ma.brazzers.com') return 'brazzers';
        if (hostname === 'eporner.com' || hostname.endsWith('.eporner.com')) return 'eporner';
        return null;
    }
    // C4SPlus InfiniteScroll/useVirtualList adapter. Require the complete observed
    // hook signature; React itself must remove positions and spacer height.
    function searchLayoutDispatch(grid) {
        const key = Object.keys(grid).find(name => name.startsWith('__reactFiber$'));
        for (let fiber = key && grid[key], depth = 0; fiber && depth < 12; fiber = fiber.return, depth++) {
            const props = fiber.memoizedProps;
            if (!props?.isVirtualList || typeof props.calculateColumns !== 'function' ||
                typeof props.itemTransformer !== 'function' || !Number.isInteger(props.itemsPerPage)) continue;
            for (const candidate of [fiber, fiber.alternate].filter(Boolean)) {
                const hooks = [];
                for (let hook = candidate.memoizedState; hook && hooks.length < 100; hook = hook.next) hooks.push(hook);
                if (!hooks.some(h => h.memoizedState?.current === grid)) continue;
                for (let i = 0; i + 7 < hooks.length; i++) {
                    const [width, count, height, range, enabled, resize, scroll, render] = hooks.slice(i, i + 8);
                    if (![width, count, height, range, enabled].every(h => typeof h.queue?.dispatch === 'function')) continue;
                    if (![width, count, height].every(h => Number.isFinite(h.memoizedState) && h.memoizedState > 0)) continue;
                    if (!Array.isArray(range.memoizedState) || range.memoizedState.length !== 2 || !range.memoizedState.every(Number.isFinite)) continue;
                    if (enabled.memoizedState !== true || typeof resize.memoizedState?.create !== 'function' || typeof scroll.memoizedState?.create !== 'function') continue;
                    const resizeDeps = resize.memoizedState.deps, scrollDeps = scroll.memoizedState.deps;
                    const callback = render.memoizedState, deps = callback?.[1];
                    if (resizeDeps?.length !== 1 || resizeDeps[0] !== true || scrollDeps?.length !== 4 ||
                        scrollDeps[0] !== height.memoizedState || scrollDeps[1] !== count.memoizedState || scrollDeps[3] !== true) continue;
                    if (!Array.isArray(callback) || typeof callback[0] !== 'function' || deps?.length !== 7 ||
                        deps[0] !== range.memoizedState || deps[2] !== height.memoizedState || deps[3] !== count.memoizedState ||
                        deps[4] !== width.memoizedState || deps[5] !== true || typeof deps[1] !== 'function' || typeof deps[6] !== 'function') continue;
                    return enabled.queue.dispatch;
                }
            }
        }
        return null;
    }
    if (typeof module === 'object' && module.exports) {
        module.exports = { cleanSettings, fittingColumns, siteFor, searchLayoutDispatch };
        return;
    }
    const site = siteFor(location.hostname);
    if (!site || globalThis[Symbol.for('local.colum-manager')]) return;
    globalThis[Symbol.for('local.colum-manager')] = { version: VERSION };
    let settings = cleanSettings(), storageAvailable = true;
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        settings = cleanSettings(JSON.parse(saved || '{}'));
        if (!saved && site === 'c4splus') {
            settings = cleanSettings({ ...settings, columns: Number(localStorage.getItem('c4splus.layout.columns')),
                hideLocked: localStorage.getItem('c4splus.layout.hideLocked') === 'true' });
            // Import once; later reloads and edits belong only to this script.
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        }
    } catch { storageAvailable = false; }
    const sidebarKey = 'colum-manager.c4splus.sidebarOpen';
    let sidebarPreference = null;
    try {
        const saved = localStorage.getItem(sidebarKey);
        if (saved === 'true' || saved === 'false') sidebarPreference = saved === 'true';
    } catch { /* The page toggle still works for this document. */ }

    function groupsFrom(wrappers) {
        const groups = new Map();
        for (const card of wrappers) {
            const grid = card.parentElement;
            if (!groups.has(grid)) groups.set(grid, []);
            groups.get(grid).push(card);
        }
        return groups;
    }
    function c4sGroups() {
        const wrappers = new Set();
        const listing = element => element && (element.classList.contains('flex-wrap') || getComputedStyle(element).display === 'grid');
        for (const card of document.querySelectorAll('[data-testid$="-clip-card"]')) {
            if (!card.querySelector('a[href*="/clip/"]')) continue;
            // Watchlist uses one wrapper per card; its native grid only starts
            // at md, so computed display alone misses the mobile listing.
            if (card.dataset.testid === 'watchlist-page-clip-card' && card.closest('article')?.querySelector('[data-testid="watchlist-title"]')) wrappers.add(card.parentElement);
            else if (listing(card.parentElement)) wrappers.add(card);
            else if (listing(card.parentElement?.parentElement)) wrappers.add(card.parentElement);
        }
        for (const card of document.querySelectorAll('[class~="xl:w-1/5"], [class~="lg:w-1/5"]')) {
            if (listing(card.parentElement) && card.querySelector('a[href*="/clip/"]')) wrappers.add(card);
        }
        return groupsFrom(wrappers);
    }
    const sceneSelector = 'a[href*="/scene/"], a[href*="/video/"]';
    function sceneIds(element) {
        const ids = new Set();
        for (const link of element.querySelectorAll(sceneSelector)) {
            try {
                const url = new URL(link.getAttribute('href'), location.href);
                const match = /^\/(?:scene|video)\/(\d+)(?:\/|$)/.exec(url.pathname);
                if (url.hostname === location.hostname && match) ids.add(match[1]);
            } catch { /* Not a scene link. */ }
        }
        return ids;
    }
    function brazzersGroups() {
        const groups = new Map();
        // Section IDs describe a site component rather than a CSS build hash.
        // Every card must contain one unique scene, a thumbnail or paired scene
        // links (lazy placeholders have no img yet), and be a direct
        // child of a repeated list. This excludes navigation and card internals.
        for (const section of document.querySelectorAll('section[id^="List-container-"]')) {
            for (const link of section.querySelectorAll(sceneSelector)) {
                for (let card = link.parentElement, depth = 0; card && card !== section && depth < 7; card = card.parentElement, depth++) {
                    const grid = card.parentElement;
                    if (groups.has(grid)) break;
                    if (grid.closest('[aria-roledescription="carousel"], .flickity-slider, .swiper-wrapper')) break;
                    const children = [...grid.children];
                    const cards = children.filter(child => sceneIds(child).size === 1 &&
                        (child.querySelector('img') || child.querySelectorAll(sceneSelector).length >= 2));
                    // Known component marker also allows a filtered single result.
                    const knownSingle = children.length === 1 && grid.classList.contains('e1vusg2z0');
                    if (cards.length && (cards.length >= 2 || knownSingle) && cards.length === children.length &&
                        new Set(cards.map(child => [...sceneIds(child)][0])).size === cards.length) {
                        groups.set(grid, cards);
                        break;
                    }
                }
            }
        }
        return groups;
    }
    function epornerGroups() {
        const cards = new Set();
        for (const card of document.querySelectorAll('.mb, .mbhd')) {
            if (card.parentElement.closest('.mb, .mbhd, .swiper-wrapper, .flickity-slider, [aria-roledescription="carousel"]')) continue;
            const isVideo = [...card.querySelectorAll('a[href]')].some(link => {
                try {
                    const url = new URL(link.getAttribute('href'), location.href);
                    return siteFor(url.hostname) === 'eporner' && /^\/(?:hd-porn\/[^/]+\/|video-[^/]+\/)/.test(url.pathname);
                } catch { return false; }
            });
            if (isVideo && card.querySelector('.mbimg, .mbcontent, img')) cards.add(card);
        }
        return groupsFrom(cards);
    }
    // Adding a site requires only a hostname match, an adapter and scoped CSS.
    // Shared controls, persistence, sizing and lifecycle do not depend on the site.
    const adapters = {
        c4splus: { label: 'C4SPlus', groups: c4sGroups, virtualDispatch: searchLayoutDispatch },
        brazzers: { label: 'Brazzers', groups: brazzersGroups },
        eporner: { label: 'Eporner', groups: epornerGroups }
    };
    const adapter = adapters[site];
    const style = document.createElement('style');
    style.id = 'colum-manager-style';
    style.textContent = `
      html[data-colum-manager] [data-cm-grid="flow"]:not(:has(> .absolute)) {
        display:grid!important;grid-template-columns:repeat(var(--cm-columns,3),minmax(0,1fr))!important;
        gap:var(--cm-gap)!important;align-items:start!important;margin:0!important;padding:0!important;width:100%!important;min-width:0!important;
      }
      html[data-colum-manager] [data-cm-grid="flow"] > [data-cm-card] {
        width:100%!important;min-width:0!important;max-width:none!important;flex-basis:auto!important;
        box-sizing:border-box!important;padding:0!important;margin:0!important;
      }
      html[data-colum-manager] [data-cm-card] img {max-width:100%}
      html[data-colum-manager] [data-cm-wide] {width:100%!important;max-width:100%!important;min-width:0!important;margin-left:0!important;margin-right:0!important;box-sizing:border-box!important}
      html[data-colum-manager="c4splus"] [data-cm-wide] {padding-left:2%!important;padding-right:2%!important}
      html[data-colum-manager="c4splus"] [data-cm-card] [data-testid$="-thumb-wrapper"] {display:block;position:relative;aspect-ratio:16/9;max-width:100%;overflow:hidden}
      html[data-colum-manager="c4splus"] [data-cm-grid="flow"][data-cm-hide-locked] > [data-cm-card]:has([data-testid="clip-overlay_tag_lock"]) {display:none!important}
      html[data-colum-manager="c4splus"] [data-cm-watchlist-article] {min-width:0!important}
      html[data-colum-manager="c4splus"] [data-cm-watchlist] [data-testid="watchlist-title"] {font-size:clamp(26px,3vw,38px);line-height:1.2;text-transform:none;letter-spacing:-.025em;margin-bottom:4px;padding:0}
      html[data-colum-manager="c4splus"] [data-cm-watchlist-toolbar] {display:flex!important;flex-direction:column!important;gap:14px;padding:16px;background:#15121b;border:1px solid #ffffff20;border-radius:12px}
      html[data-colum-manager="c4splus"] [data-cm-watchlist-filters] {display:flex!important;flex-wrap:wrap!important;gap:12px!important;order:0!important;width:100%!important;max-width:none!important}
      html[data-colum-manager="c4splus"] [data-cm-watchlist-filters] > div {min-width:0!important;margin:0!important;padding:0!important}
      html[data-colum-manager="c4splus"] [data-cm-watchlist-filter-buttons] {flex:1 1 340px!important;gap:10px}
      html[data-colum-manager="c4splus"] [data-cm-watchlist-filter-buttons] > div {min-width:0!important;margin:0!important;flex:1!important;max-width:none!important}
      html[data-colum-manager="c4splus"] [data-cm-watchlist-search] {flex:1 1 220px!important}
      html[data-colum-manager="c4splus"] [data-cm-watchlist-selection] {order:1!important;align-items:center;flex-wrap:wrap;gap:12px;height:auto!important;margin:0!important;padding:0!important}
      html[data-colum-manager="c4splus"] [data-cm-watchlist] :is([data-testid="clips-source-filter"],[data-testid="category-filter_button"],[data-testid="watchlist-search-bar_container"]) {min-width:0!important;width:100%!important;min-height:44px;border-radius:8px!important;background:#211b2a;border-color:#ffffff35}
      html[data-colum-manager="c4splus"] [data-cm-watchlist] [data-testid="watchlist-search-bar_input-container"] {min-width:0!important}
      html[data-colum-manager="c4splus"] [data-cm-watchlist] [data-cm-grid="flow"] {align-items:stretch!important;row-gap:max(16px,var(--cm-gap))!important;margin-top:16px!important}
      html[data-colum-manager="c4splus"] [data-cm-watchlist] :is([class~="sm:-mx-1.5"],[class~="lg:-mx-2"]):has(> [data-cm-grid]) {margin-left:0!important;margin-right:0!important}
      html[data-colum-manager="c4splus"] [data-testid="watchlist-page-clip-card"][data-cm-watchlist-card] {height:100%;gap:0;overflow:hidden;border-radius:12px;border:1px solid #ffffff20;background:#16121e;transition:border-color .15s}
      html[data-colum-manager="c4splus"] [data-cm-watchlist-card]:hover {border-color:#a976c9}
      html[data-colum-manager="c4splus"] [data-cm-watchlist-card]:has(input:checked) {border-color:#d0a0ed;background:#281b34;box-shadow:inset 0 0 0 1px #b979df}
      html[data-colum-manager="c4splus"] [data-cm-watchlist-meta] {display:grid!important;grid-template-columns:24px minmax(0,1fr);align-items:start;gap:10px;padding:12px!important;overflow:visible!important}
      html[data-colum-manager="c4splus"] [data-cm-watchlist-meta] > div {min-width:0;margin:0!important;white-space:normal}
      html[data-colum-manager="c4splus"] [data-cm-watchlist-meta] [data-testid="watchlist-page-clip-card-title"] {display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;line-height:1.4;min-height:2.8em;font-size:14px;overflow:hidden}
      html[data-colum-manager="c4splus"] [data-cm-watchlist-meta] [data-testid="watchlist-page-clip-card-studio-anchor"] {margin-top:6px;font-size:12px;color:#c5b6d1}
      html[data-colum-manager="c4splus"] [data-cm-watchlist] [role="checkbox"] {width:24px;height:24px;border-color:#a999b7}
      html[data-colum-manager="c4splus"] [data-cm-watchlist] :is(a,button,input,[role="checkbox"]):focus-visible {outline:2px solid #d3a3f5!important;outline-offset:3px}
      html[data-colum-manager="c4splus"] #colum-manager-account-toggle {float:right;position:relative;z-index:1;margin:0 0 12px 12px;padding:9px 12px;min-height:40px;border:1px solid #ffffff35;border-radius:8px;background:#211b2a;color:#eee;font:13px/1.4 system-ui;cursor:pointer}
      html[data-colum-manager="c4splus"] #colum-manager-account-toggle:focus-visible {outline:2px solid #d3a3f5;outline-offset:3px}
      html[data-colum-manager="c4splus"] [data-cm-account-sidebar] {display:flex!important}
      html[data-colum-manager="c4splus"] [data-cm-sidebar-collapsed] > [data-cm-account-sidebar] {display:none!important}
      @media(min-width:1024px){html[data-colum-manager="c4splus"] [data-cm-account-shell] {display:grid!important;grid-template-columns:210px minmax(0,1fr);gap:24px!important}html[data-colum-manager="c4splus"] [data-cm-account-sidebar] {min-width:0!important;width:auto!important;font-size:14px}}
      @media(min-width:1024px){html[data-colum-manager="c4splus"] [data-cm-account-shell][data-cm-sidebar-collapsed] {grid-template-columns:minmax(0,1fr)}}
      @media(max-width:1023px){html[data-colum-manager="c4splus"] [data-cm-account-shell] {flex-direction:column!important}html[data-colum-manager="c4splus"] [data-cm-account-sidebar] {min-width:0!important;width:100%;padding:12px;background:#15121b;border-radius:12px}}
      @media(max-width:767px){html[data-colum-manager="c4splus"] [data-cm-watchlist] {padding:0 12px}html[data-colum-manager="c4splus"] [data-cm-watchlist-toolbar] {padding:12px}html[data-colum-manager="c4splus"] [data-cm-account-shell] {gap:0!important}}
      html[data-colum-manager="brazzers"] [data-cm-list-column] {flex-basis:96%!important;flex-grow:1!important;max-width:100%!important;min-width:0!important}
      html[data-colum-manager="brazzers"] [data-cm-gutter] {flex-basis:2%!important;max-width:2%!important;min-width:0!important}
      html[data-colum-manager="eporner"] [data-cm-grid="flow"] > :not([data-cm-card]) {grid-column:1 / -1}
      html[data-colum-manager="eporner"] [data-cm-grid="flow"]::before,
      html[data-colum-manager="eporner"] [data-cm-grid="flow"]::after {content:none!important}
      html[data-colum-manager="brazzers"][data-cm-hide-promos] #root > div:first-of-type > div > div > div > div:has(> div a[href^='https://officialzzstore.com']),
      html[data-colum-manager="brazzers"][data-cm-hide-promos] #root > div > div:has(> img[src*='/catfish.gif']),
      html[data-colum-manager="brazzers"][data-cm-hide-promos] #root > div > div:has(> button > svg) {display:none!important}
    `;
    const control = document.createElement('div');
    control.id = 'colum-manager-control';
    const floatingStyle = 'position:fixed!important;right:12px!important;bottom:12px!important;z-index:2147483646!important;max-width:calc(100vw - 24px)!important;';
    control.style.cssText = floatingStyle;
    const shadow = control.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
      :host{all:initial;color:#f6f3f8;font:13px/1.5 system-ui,sans-serif;color-scheme:dark}
      details{box-sizing:border-box;background:#1c1921;border:1px solid #776a85;border-radius:10px;box-shadow:0 4px 24px #0008;max-width:320px}
      summary{cursor:pointer;padding:8px 12px;font-weight:600} .fields{padding:0 12px 12px;display:grid;gap:8px}
      label{display:flex;justify-content:space-between;align-items:center;gap:12px} input{font:inherit;accent-color:#c998eb}
      input[type=number]{box-sizing:border-box;width:64px;padding:4px;border:1px solid #776a85;border-radius:4px;background:#28232e;color:white}
      button{font:inherit;cursor:pointer;border:1px solid #776a85;border-radius:4px;padding:4px;background:#28232e;color:white}
      :focus-visible{outline:2px solid #d2a1f2;outline-offset:2px}small{color:#d0c5dc;max-width:34ch}[hidden]{display:none!important}
      :host([data-cm-docked]) details{max-width:none;background:#15121b;border-color:#ffffff20;box-shadow:none}
      :host([data-cm-docked]) .fields{display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px}
      :host([data-cm-docked]) label{gap:8px}:host([data-cm-docked]) small{max-width:none;flex:1 1 220px}
    </style><details open><summary>Columns · ${adapter.label}</summary><div class="fields">
      <label>Columns (1–8)<input id="columns" aria-label="Thumbnail columns" type="number" min="1" max="8" step="1"></label>
      <label>Gap (px)<input id="gap" aria-label="Thumbnail gap" type="number" min="0" max="40" step="1"></label>
      <label>Wide layout<input id="wide" type="checkbox"></label>
      <label ${site === 'brazzers' ? '' : 'hidden'}>Hide promotions<input id="hidePromos" type="checkbox"></label>
      <label ${site === 'c4splus' ? '' : 'hidden'}>Hide locked<input id="hideLocked" type="checkbox"></label>
      <small id="status" role="status"></small><button id="reset" type="button">Reset settings</button>
    </div></details>`;
    const status = shadow.querySelector('#status');
    const watchlistCount = document.createElement('span');
    watchlistCount.id = 'colum-manager-watchlist-count';
    watchlistCount.setAttribute('role', 'status');
    watchlistCount.style.cssText = 'margin-left:auto;color:#c9bbd4;font:13px/1.5 system-ui;';
    const sidebarToggle = document.createElement('button');
    sidebarToggle.id = 'colum-manager-account-toggle';
    sidebarToggle.type = 'button';
    sidebarToggle.addEventListener('click', () => {
        sidebarPreference = sidebarToggle.getAttribute('aria-expanded') !== 'true';
        try { localStorage.setItem(sidebarKey, String(sidebarPreference)); } catch { /* Session-only preference. */ }
        applyLayout();
    });
    function prepareWatchlist() {
        if (site !== 'c4splus') return null;
        const title = document.querySelector('[data-testid="watchlist-title"]');
        const article = title?.closest('article');
        if (!article) return null;
        const content = title.parentElement;
        mark(content, 'data-cm-watchlist'); mark(article, 'data-cm-watchlist-article');
        mark(article.parentElement, 'data-cm-account-shell');
        const sidebar = [...article.parentElement.children].find(node => node.tagName === 'ASIDE');
        if (sidebar) {
            mark(sidebar, 'data-cm-account-sidebar');
            if (!sidebar.id) sidebar.id = 'colum-manager-account-menu';
            setAttribute(sidebarToggle, 'aria-controls', sidebar.id);
            const open = sidebarPreference ?? window.matchMedia('(min-width:1024px)').matches;
            if (!open) mark(article.parentElement, 'data-cm-sidebar-collapsed');
            setAttribute(sidebarToggle, 'aria-expanded', String(open));
            const label = open ? 'Hide account menu' : 'Show account menu';
            if (sidebarToggle.textContent !== label) sidebarToggle.textContent = label;
            if (sidebarToggle.parentElement !== content) title.before(sidebarToggle);
        }
        const search = content.querySelector('[data-testid="watchlist-search-bar_container"]');
        const selection = content.querySelector('[data-testid="select-all-checkbox"]');
        let toolbar = selection?.parentElement;
        while (toolbar && toolbar !== content && !toolbar.contains(search)) toolbar = toolbar.parentElement;
        if (toolbar && toolbar !== content && search) {
            mark(toolbar, 'data-cm-watchlist-toolbar');
            mark(selection.parentElement, 'data-cm-watchlist-selection');
            const filters = [...toolbar.children].find(node => node.contains(search));
            if (filters && filters !== selection.parentElement) {
                mark(filters, 'data-cm-watchlist-filters');
                for (const node of filters.children) mark(node, node.contains(search) ? 'data-cm-watchlist-search' : 'data-cm-watchlist-filter-buttons');
            }
            if (watchlistCount.parentElement !== selection.parentElement) selection.parentElement.append(watchlistCount);
        }
        const cards = [...content.querySelectorAll('[data-testid="watchlist-page-clip-card"]')];
        for (const card of cards) {
            mark(card, 'data-cm-watchlist-card');
            const checkbox = card.querySelector('[data-testid="checkbox"]');
            if (checkbox) {
                mark(checkbox.parentElement, 'data-cm-watchlist-meta');
                const target = checkbox.querySelector('[role="checkbox"]');
                if (target && !target.hasAttribute('aria-label')) target.setAttribute('aria-label', `Select ${card.querySelector('[data-testid="watchlist-page-clip-card-title"]')?.textContent.trim() || 'video'}`);
            }
        }
        const grid = cards[0]?.parentElement.parentElement;
        if (grid && control.parentElement !== grid.parentElement) grid.before(control);
        else if (!grid && control.parentElement !== content) content.append(control);
        return cards;
    }
    function updateWatchlist(cards) {
        const docked = cards !== null;
        if (control.hasAttribute('data-cm-docked') !== docked) {
            control.toggleAttribute('data-cm-docked', docked);
            control.style.cssText = docked ? 'display:block!important;position:relative!important;max-width:100%!important;margin-top:16px!important;' : floatingStyle;
            shadow.querySelector('summary').textContent = docked ? 'Watchlist layout' : `Columns · ${adapter.label}`;
        }
        if (!docked) {
            watchlistCount.remove();
            sidebarToggle.remove();
            if (control.parentElement !== document.body) document.body.append(control);
            return;
        }
        const shown = cards.filter(card => getComputedStyle(card.parentElement).display !== 'none').length;
        const selected = cards.filter(card => card.querySelector('input[type="checkbox"]:checked')).length;
        const text = `${shown} shown on this page · ${selected} selected`;
        if (watchlistCount.textContent !== text) watchlistCount.textContent = text;
    }
    function updateInputs() {
        for (const key of Object.keys(DEFAULTS)) {
            const input = shadow.getElementById(key);
            if (input.type === 'checkbox') input.checked = settings[key];
            else input.value = String(settings[key]);
        }
    }
    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            storageAvailable = true;
        } catch { storageAvailable = false; }
        applyLayout();
    }
    function bindInput(key) {
        const input = shadow.getElementById(key);
        input.addEventListener(input.type === 'checkbox' ? 'change' : 'input', () => {
            if (!input.validity.valid || (input.type === 'number' && input.value === '')) return;
            settings = cleanSettings({ ...settings, [key]: input.type === 'checkbox' ? input.checked : Number(input.value) });
            save();
        });
        input.addEventListener('blur', updateInputs);
    }
    Object.keys(DEFAULTS).forEach(bindInput);
    shadow.querySelector('#reset').addEventListener('click', () => { settings = cleanSettings(); updateInputs(); save(); });
    updateInputs();
    let frame = 0, marked = new Map(), nextMarks = new Map(), observed = new Set();
    const inlineOriginals = new Map();
    function overrideCard(card) {
        // The user's Eporner theme has two-ID !important selectors and mobile
        // display:contents. Inline overrides keep each thumbnail/title one item.
        // Restore exact prior declarations before rediscovery or removing a card.
        const display = getComputedStyle(card).display === 'none' ? 'none' : 'block';
        const properties = { display, float: 'none', width: '100%', 'max-width': 'none' };
        inlineOriginals.set(card, Object.keys(properties).map(name => [name, card.style.getPropertyValue(name), card.style.getPropertyPriority(name)]));
        for (const [name, value] of Object.entries(properties)) card.style.setProperty(name, value, 'important');
    }
    const attempts = new WeakSet();
    function schedule() {
        if (!frame) frame = requestAnimationFrame(() => { frame = 0; applyLayout(); });
    }
    const observer = new MutationObserver(schedule);
    const observedWidths = new WeakMap();
    const resizeObserver = new ResizeObserver(entries => {
        // Appending cards and loading previews change height, not column fit.
        // Do not turn scrolling/lazy loading into repeated full layout passes.
        for (const entry of entries) {
            const width = entry.contentRect.width;
            if (observedWidths.get(entry.target) !== width) {
                observedWidths.set(entry.target, width);
                schedule();
            }
        }
    });
    function setAttribute(element, attribute, value) {
        if (element.getAttribute(attribute) !== value) element.setAttribute(attribute, value);
    }
    function setProperty(element, name, value) {
        if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
    }
    function mark(element, attribute, value = '') {
        if (!element) return;
        if (!nextMarks.has(element)) nextMarks.set(element, new Set());
        nextMarks.get(element).add(attribute);
        setAttribute(element, attribute, value);
    }
    function removeObsoleteMarks() {
        for (const [node, attributes] of marked) {
            for (const name of attributes) {
                if (!nextMarks.get(node)?.has(name)) node.removeAttribute(name);
            }
            if (attributes.has('data-cm-grid') && !nextMarks.get(node)?.has('data-cm-grid')) {
                node.style.removeProperty('--cm-columns'); node.style.removeProperty('--cm-gap');
            }
        }
        marked = nextMarks;
    }
    function widen(grid) {
        if (!settings.wide) return;
        if (site === 'c4splus') {
            for (let node = grid.parentElement; node && node !== document.body; node = node.parentElement) {
                if ([...node.classList].some(name => /^max-w-c4s-\d+$/.test(name))) { mark(node, 'data-cm-wide'); break; }
            }
        } else if (site === 'eporner') {
            for (let node = grid.parentElement; node && node !== document.body; node = node.parentElement) {
                if (node.matches('#content, #div-search-results, #panel-rightXpornstar, main, .results-video-results-layout')) mark(node, 'data-cm-wide');
            }
        } else {
            const section = grid.closest('section[id^="List-container-"]');
            // Follow the actual list ancestry, not nth-child positions which can
            // start pointing at a filter bar after a site revision.
            for (let node = section; node && node.id !== 'root' && node !== document.body; node = node.parentElement) {
                mark(node, 'data-cm-wide');
                const siblings = [...node.parentElement.children];
                if (siblings.length === 3 && siblings[1] === node &&
                    !siblings[0].textContent.trim() && !siblings[2].textContent.trim() &&
                    !siblings[0].querySelector('a,button,img,input') && !siblings[2].querySelector('a,button,img,input')) {
                    mark(node, 'data-cm-list-column');
                    mark(siblings[0], 'data-cm-gutter'); mark(siblings[2], 'data-cm-gutter');
                }
            }
        }
    }
    function applyLayout() {
        observer.disconnect();
        try {
            if (!document.body || !document.head) return;
            setAttribute(document.documentElement, 'data-colum-manager', site);
            document.documentElement.toggleAttribute('data-cm-hide-promos', settings.hidePromos);
            if (!style.isConnected) document.head.append(style);
            if (!control.isConnected) document.body.append(control);
            for (const [node, properties] of inlineOriginals) {
                for (const [name, value, priority] of properties) {
                    if (value) node.style.setProperty(name, value, priority);
                    else node.style.removeProperty(name);
                }
            }
            inlineOriginals.clear();
            // Keep managed dimensions active during all reads. Tearing down the
            // wide container here lets scroll anchoring/layout readers see a
            // transient narrow, shorter page before it expands again.
            nextMarks = new Map();
            const watchlistCards = prepareWatchlist();
            const groups = adapter.groups(), nextObserved = new Set();
            let flowCount = 0, virtualCount = 0;
            for (const [grid, cards] of groups) {
                const virtual = cards.some(card => card.classList.contains('absolute') || getComputedStyle(card).position === 'absolute');
                if (virtual) {
                    virtualCount++;
                    const dispatch = adapter.virtualDispatch?.(grid);
                    if (dispatch && !attempts.has(dispatch)) { attempts.add(dispatch); dispatch(false); schedule(); }
                    continue;
                }
                widen(grid);
                mark(grid, 'data-cm-grid', 'flow');
                for (const card of cards) {
                    mark(card, 'data-cm-card');
                    if (site === 'eporner') overrideCard(card);
                }
                if (settings.hideLocked) mark(grid, 'data-cm-hide-locked');
                setProperty(grid, '--cm-gap', `${settings.gap}px`);
                nextObserved.add(grid);
                flowCount++;
            }
            // Remove only retired marks (including Wide layout being turned off)
            // before measuring the final containers, never all marks per pass.
            removeObsoleteMarks();
            for (const grid of nextObserved) {
                setProperty(grid, '--cm-columns', String(fittingColumns(grid.clientWidth, settings.columns, settings.gap)));
            }
            for (const node of observed) if (!nextObserved.has(node)) resizeObserver.unobserve(node);
            for (const node of nextObserved) if (!observed.has(node)) resizeObserver.observe(node);
            observed = nextObserved;
            updateWatchlist(watchlistCards);
            const unavailable = virtualCount > 0 && flowCount === 0;
            for (const key of ['columns', 'gap', 'wide', 'hideLocked']) shadow.getElementById(key).disabled = unavailable;
            const message = virtualCount ? 'Virtualized results retain native positions; columns, spacing and Hide locked apply only to supported lists.'
                : flowCount ? `${settings.columns} maximum columns · ${flowCount} list${flowCount === 1 ? '' : 's'}. Fewer columns on narrow screens.`
                    : 'Waiting for a supported video listing…';
            const text = message + (storageAvailable ? '' : ' Storage unavailable; settings last this session.');
            if (status.textContent !== text) status.textContent = text;
        } finally {
            observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'href', 'data-testid'] });
        }
    }
    window.addEventListener('resize', schedule);
    document.addEventListener('change', event => {
        if (event.target.matches?.('input[type="checkbox"]') && event.target.closest('[data-cm-watchlist]')) schedule();
    });
    window.addEventListener('popstate', schedule);
    window.addEventListener('pageshow', schedule);
    window.addEventListener('storage', event => {
        if (event.key === sidebarKey || event.key === null) {
            try { const saved = localStorage.getItem(sidebarKey); sidebarPreference = saved === 'true' ? true : saved === 'false' ? false : null; } catch { sidebarPreference = null; }
            schedule();
        }
        if (event.key !== STORAGE_KEY && event.key !== null) return;
        try { settings = cleanSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); } catch { settings = cleanSettings(); }
        updateInputs(); schedule();
    });
    applyLayout();
}());
