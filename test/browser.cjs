// Real Chrome geometry/DOM checks. Separate from Tampermonkey installation.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'colum-manager.user.js'), 'utf8');
const capture = process.env.BRAZZERS_HTML;
const c4sRoot = process.env.C4S_ROOT;
const thumbnail = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#544663"/></svg>');
const card = (site, i) => site === 'c4splus'
    ? `<div data-testid="studio-clip-card" class="w-card"><a href="/clip/${1000+i}/sample"><span data-testid="studio-thumb-wrapper"><img src="${thumbnail}"></span>Video ${i}</a>${i%2 ? '' : '<span data-testid="clip-overlay_tag_lock">Locked</span>'}</div>`
    : `<div class="scene-wrapper"><article><a href="/scene/${1000+i}/sample">${i < 12 ? `<img src="${thumbnail}">` : '<span class="lazy-placeholder">&nbsp;</span>'}</a><div><a href="/scene/${1000+i}/sample">Video ${i}</a></div></article></div>`;
const fixtureCSS = `body{margin:0;background:#141116;color:#eee;font:14px system-ui}a{color:inherit}img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}header{height:50px} .max-w-c4s-1600{max-width:1100px;margin:auto;padding:0 32px}.flex-wrap{display:flex;flex-wrap:wrap}.w-card{width:20%;padding:6px;box-sizing:border-box}.absolute{position:absolute}.scene-grid,.e1vusg2z0{display:flex;flex-wrap:wrap;margin-left:-10px}.scene-wrapper,.e1vusg2z1{width:25%;padding-left:10px;margin-bottom:10px;box-sizing:border-box;position:relative}.list-shell{max-width:1100px;margin:auto}.carousel{display:flex;overflow:auto}.carousel>*{min-width:200px}`;
function markup(site) {
    const cards = Array.from({ length: 24 }, (_, i) => card(site, i)).join('');
    return site === 'c4splus' ? `<header id="headerNavigationSection"></header><main class="max-w-c4s-1600"><div id="listing" class="flex-wrap">${cards}</div></main><div class="carousel">${card(site, 99)}</div>`
        : `<div id="root"><div><header>Navigation</header><div class="list-shell"><section id="List-container-123"><h1>Videos</h1><div id="listing" class="scene-grid">${cards}</div><button id="next">Next page</button></section></div><div id="promo"><button><svg></svg></button></div></div></div><section id="unrelated"><a href="/scene/12/menu">Menu link</a></section>`;
}
function capturedMarkup() {
    const raw = fs.readFileSync(capture, 'utf8');
    // Never execute capture scripts. CSP also blocks remote media, handlers,
    // frames, fetches and external styles. Styles/markup remain inspection data.
    const styles = (raw.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).filter(x => !x.includes('stndz-')).join('');
    const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(raw)?.[1];
    if (!body) throw Error('Capture has no body');
    return styles + body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<(?:iframe|object|embed|link|source)\b[^>]*>/gi, '')
        .replace(/<img\b[^>]*>/gi, tag => tag.replace(/\s(?:src|srcset)="[^"]*"/gi, '').replace('<img', `<img src="${thumbnail}"`));
}
function virtualScript() {
    const raw = fs.readFileSync(path.join(c4sRoot, 'verification/InfiniteScroll-CyVLzibW.js'), 'utf8');
    const code = raw.slice(raw.indexOf('function ee('), raw.indexOf('function de('));
    assert(code.startsWith('function ee(') && code.includes('function te('), 'Unknown captured virtualizer');
    return `<script src="/react.js"></script><script src="/react-dom.js"></script><script nonce="fixture">
      const r=React,Z=React,i={jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};
      const D=()=>({i18n:{language:'en'}}),R=()=>true,q=()=>null;
      ${code}
      window.pageCalls=0;window.cardClicks=0;
      const mount=document.querySelector('#listing');mount.className='';mount.innerHTML='';
      const root=ReactDOM.createRoot(mount);
      const items=(start,n)=>Array.from({length:n},(_,x)=>({clipId:start+x}));
      const transform=(ref,set,observable)=>(item,index,style)=>React.createElement('div',{
        key:item.clipId,'data-index':index,className:'w-card'+(style?' absolute':''),style,ref:observable(index)?ref:null,onClick:()=>window.cardClicks++,
        dangerouslySetInnerHTML:{__html:'<div data-testid="search-clip-card"><a href="/clip/'+item.clipId+'/sample"><span data-testid="search-thumb-wrapper"><img src="${thumbnail}"></span>Video</a>'+(index%2?'':'<span data-testid="clip-overlay_tag_lock">Locked</span>')+'</div>'}});
      const calculateColumns=ref=>{const cols=innerWidth>=1280?5:innerWidth>=768?3:1;const width=ref.current.clientWidth/cols;return {itemWidth:width,multiplier:cols,itemHeight:width*9/16+80};};
      window.renderSearch=key=>root.render(React.createElement(te,{key,isVirtualList:true,initialData:items(0,60),itemsPerPage:20,firstPage:3,itemTransformer:transform,calculateColumns,
        getItemsByPage:async(page,count)=>{window.pageCalls++;return {data:count<100?items(count,20):[]};}}));
      renderSearch('initial');
    </script>`;
}
const server = http.createServer((req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' 'nonce-fixture'; style-src 'self' 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'");
    if (req.url === '/script.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(source); return; }
    if (req.url === '/downloader.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(fs.readFileSync(path.join(c4sRoot, 'c4splus-download.user.js'))); return; }
    if (['/react.js', '/react-dom.js'].includes(req.url)) {
        res.setHeader('Content-Type', 'application/javascript');
        res.end(fs.readFileSync(path.join(c4sRoot, 'verification', req.url === '/react.js' ? 'react.production.min.js' : 'react-dom.production.min.js'))); return;
    }
    const site = (req.headers['x-fixture-host'] || req.headers.host).startsWith('c4splus.com') ? 'c4splus' : 'brazzers';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><html><head><meta charset="utf-8"><style>${fixtureCSS}</style></head><body>${req.url === '/capture' ? capturedMarkup() : markup(site)}
      ${req.url === '/virtual' ? virtualScript() : ''}
      ${req.url === '/coexist-before' ? '<script src="/downloader.js"></script>' : ''}
      <script src="/script.js"></script>${req.url === '/coexist-after' ? '<script src="/downloader.js"></script>' : ''}</body></html>`);
});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function connect(url) {
    const ws = new WebSocket(url), pending = new Map();
    let sequence = 0;
    const listeners = new Map();
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    ws.onmessage = event => {
        const message = JSON.parse(event.data), task = pending.get(message.id);
        if (!task) { listeners.get(message.method)?.(message.params); return; }
        pending.delete(message.id); clearTimeout(task.timer);
        message.error ? task.reject(Error(JSON.stringify(message.error))) : task.resolve(message.result);
    };
    return { close: () => ws.close(), on: (event, listener) => listeners.set(event, listener), send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = ++sequence;
            const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)); }, 8000);
            pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
        });
    } };
}
async function main() {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'colum-manager-chrome-'));
    const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
        '--headless', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--no-proxy-server',
        '--host-resolver-rules=MAP c4splus.com 127.0.0.1, MAP site-ma.brazzers.com 127.0.0.1',
        '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
    ], { windowsHide: true, stdio: 'ignore' });
    let browser, page;
    try {
        const activePort = path.join(profile, 'DevToolsActivePort');
        for (let n = 0; !fs.existsSync(activePort) && n < 100; n++) await pause(50);
        const port = fs.readFileSync(activePort, 'utf8').split('\n')[0];
        const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
        browser = await connect(version.webSocketDebuggerUrl);
        page = await connect(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
        // Intercept HTTPS before any real network access (Brazzers uses HSTS).
        // The unmodified script sees its genuine hostname; all bytes are local.
        page.on('Fetch.requestPaused', async event => {
            try {
                const url = new URL(event.request.url);
                if (!['c4splus.com', 'site-ma.brazzers.com'].includes(url.hostname)) {
                    await page.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }); return;
                }
                const response = await fetch(`http://127.0.0.1:${server.address().port}${url.pathname}`, { headers: { 'X-Fixture-Host': url.hostname } });
                const body = Buffer.from(await response.arrayBuffer()).toString('base64');
                await page.send('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: 200,
                    responseHeaders: [...response.headers].filter(([name]) => !['connection','content-length','transfer-encoding','keep-alive'].includes(name)).map(([name,value]) => ({name,value})), body });
            } catch (error) { console.error('Fixture interception failed:', error.message); }
        });
        await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
        async function evaluate(expression) {
            const result = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
            if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
            return result.result.value;
        }
        async function wait(expression) {
            for (let n = 0; n < 120; n++) { if (await evaluate(expression)) return; await pause(25); }
            throw Error('Timed out: ' + expression + '; page: ' + await evaluate('JSON.stringify({url:location.href,title:document.title,text:document.body?.textContent.slice(0,180)})'));
        }
        async function navigate(site, route = '/') {
            await page.send('Page.navigate', { url: `https://${site === 'c4splus' ? 'c4splus.com' : 'site-ma.brazzers.com'}${route}` });
            await wait('!!document.querySelector("#colum-manager-control")?.shadowRoot');
            await pause(100);
        }
        async function change(key, value) {
            await evaluate(`(()=>{const input=document.querySelector('#colum-manager-control').shadowRoot.getElementById(${JSON.stringify(key)});input[input.type==='checkbox'?'checked':'value']=${JSON.stringify(value)};input.dispatchEvent(new Event(input.type==='checkbox'?'change':'input'));})()`);
            await pause(60);
        }
        const geometry = `(()=>{
            const grid=document.querySelector('[data-cm-grid="flow"]');if(!grid)throw Error('No managed grid');
            const cards=[...grid.children].filter(e=>e.hasAttribute('data-cm-card')&&getComputedStyle(e).display!=='none');
            const cols=getComputedStyle(grid).gridTemplateColumns.split(' ').length,bounds=grid.getBoundingClientRect(),rects=cards.map(c=>c.getBoundingClientRect());
            rects.forEach((r,i)=>{if(r.width<1||r.right>bounds.right+1||r.left<bounds.left-1)throw Error('Card overflow');if(i%cols&&Math.abs(r.top-rects[i-1].top)>1)throw Error('Row gaps');if(i>=cols&&r.top<rects[i-cols].bottom-1)throw Error('Row overlap');});
            return {cols,count:cards.length,width:bounds.width,gap:parseFloat(getComputedStyle(grid).gap)};
        })()`;
        for (const site of ['c4splus', 'brazzers']) {
            await page.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
            await navigate(site);
            assert.equal((await evaluate(geometry)).count, 24);
            for (const columns of [1, 4, 8, 3]) { await change('columns', columns); assert.equal((await evaluate(geometry)).cols, columns); }
            await change('gap', 24); assert.equal((await evaluate(geometry)).gap, 24);
            await change('columns', 4);
            await evaluate("const bad=document.querySelector('#colum-manager-control').shadowRoot.querySelector('#columns');bad.value='0';bad.dispatchEvent(new Event('input'));bad.dispatchEvent(new Event('blur'));");
            assert.equal(await evaluate("document.querySelector('#colum-manager-control').shadowRoot.querySelector('#columns').value"), '4');
            if (site === 'c4splus') {
                assert.equal(await evaluate("document.querySelector('.carousel').hasAttribute('data-cm-grid')"), false);
                await change('hideLocked', true); assert.equal((await evaluate(geometry)).count, 12);
                await change('hideLocked', false);
            } else {
                assert.equal(await evaluate("getComputedStyle(document.querySelector('#promo')).display"), 'none');
                await change('hidePromos', false); assert.notEqual(await evaluate("getComputedStyle(document.querySelector('#promo')).display"), 'none');
            }
            await evaluate("const grid=document.querySelector('[data-cm-grid]');const newCard=grid.firstElementChild.cloneNode(true);newCard.querySelectorAll('a').forEach(a=>a.href=a.href.replace('/1000/','/9999/'));grid.append(newCard);");
            await wait("document.querySelectorAll('[data-cm-card]').length===25");
            await evaluate("const list=document.querySelector('[data-cm-grid]');list.replaceWith(list.cloneNode(true));history.pushState({},'', '?new-filter');");
            await pause(100); assert.equal((await evaluate(geometry)).count, 25);
            for (const width of [900, 390, 320]) {
                await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
                await pause(100);
                const g = await evaluate(geometry); assert(g.cols <= 4); if (width <= 390) assert.equal(g.cols, 1);
                assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'Horizontal overflow at ' + width);
            }
            await navigate(site);
            assert.equal(await evaluate("document.querySelector('#colum-manager-control').shadowRoot.querySelector('#columns').value"), '4');
            await evaluate("const script=document.createElement('script');script.src='/script.js';document.head.append(script);");
            await pause(100); assert.equal(await evaluate("document.querySelectorAll('#colum-manager-control').length"), 1);
            await evaluate("document.querySelector('#colum-manager-control').remove()");
            await wait("!!document.querySelector('#colum-manager-control')");
            await change('wide', false); assert.equal(await evaluate("document.querySelectorAll('[data-cm-wide]').length"), 0);
            await evaluate("document.querySelector('#colum-manager-control').shadowRoot.querySelector('#reset').click()");
            await navigate(site);
            assert.equal(await evaluate("document.querySelector('#colum-manager-control').shadowRoot.querySelector('#columns').value"), '3');
            await evaluate("const oldBody=document.body;const newBody=oldBody.cloneNode(true);newBody.querySelector('#colum-manager-control').remove();oldBody.replaceWith(newBody)");
            await wait("!!document.querySelector('#colum-manager-control')");
            assert.equal((await evaluate(geometry)).count, 24);
            console.log(`PASS ${site}: 1/3/4/8 columns, gaps, 1920/900/390/320px, filtering, appended cards, SPA replacement, persistence, reset, reinjection, control recovery`);
        }
        await page.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
        await navigate('c4splus'); await change('columns', 7);
        await navigate('brazzers');
        assert.equal(await evaluate("document.querySelector('#colum-manager-control').shadowRoot.querySelector('#columns').value"), '3');
        if (process.env.SCREENSHOT_DIR) {
            fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
            const screenshot = await page.send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync(path.join(process.env.SCREENSHOT_DIR, 'brazzers-neutral.png'), Buffer.from(screenshot.data, 'base64'));
        }
        await evaluate("const g=document.querySelector('[data-cm-grid]');g.className='e1vusg2z0';[...g.children].slice(1).forEach(c=>c.remove())");
        await wait("document.querySelectorAll('[data-cm-card]').length===1");
        assert.equal((await evaluate(geometry)).count, 1);
        await evaluate("document.querySelector('[data-cm-grid]').innerHTML=''");
        await wait("!document.querySelector('[data-cm-grid]')");
        console.log('PASS independent site preferences, single-result and empty-result listings, body replacement');
        const denyStorage = await page.send('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}})" });
        await navigate('brazzers'); await change('columns', 4);
        assert.equal((await evaluate(geometry)).cols, 4);
        assert(await evaluate("document.querySelector('#colum-manager-control').shadowRoot.querySelector('#status').textContent.includes('Storage unavailable')"));
        await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: denyStorage.identifier });
        console.log('PASS unavailable storage: controls remain usable with session-only notice');
        await navigate('c4splus');
        await evaluate("document.querySelectorAll('#listing > *').forEach((c,i)=>{c.classList.add('absolute');c.style.top=(i*220)+'px'});");
        await wait("!document.querySelector('[data-cm-grid]')");
        assert(await evaluate("document.querySelector('#colum-manager-control').shadowRoot.querySelector('#status').textContent.includes('native positions')"));
        console.log('PASS unknown virtualizer: native positions retained');
        if (capture) {
            await navigate('brazzers', '/capture');
            assert.equal((await evaluate(geometry)).count, 24);
            for (const columns of [1, 4, 8]) { await change('columns', columns); assert.equal((await evaluate(geometry)).cols, columns); }
            console.log('PASS supplied Brazzers capture: all 24 actual card wrappers detected; 1/4/8-column geometry with saved styles and reconstructed grid rules');
        }
        if (c4sRoot) {
            for (const route of ['/coexist-before', '/coexist-after']) {
                await navigate('c4splus', route);
                await wait("!!document.querySelector('#c4splus-layout-control')");
                await change('columns', 4); await change('gap', 20); await change('hideLocked', true);
                assert.equal((await evaluate(geometry)).cols, 4); assert.equal((await evaluate(geometry)).count, 12);
                assert.equal(await evaluate("getComputedStyle(document.querySelector('#c4splus-layout-control')).display"), 'none');
                assert.equal(await evaluate("document.querySelector('#c4splus-layout-control').shadowRoot.querySelector('input').value"), '4');
                await change('hideLocked', false); assert.equal((await evaluate(geometry)).count, 24);
            }
            console.log('PASS actual downloader coexistence: both injection orders, one visible toolbar, synchronized columns and locked filtering');
            await navigate('c4splus', '/virtual');
            await wait("document.querySelectorAll('[data-cm-card]').length>=60");
            assert.equal((await evaluate(geometry)).count, 60);
            for (const columns of [1, 4, 8]) { await change('columns', columns); assert.equal((await evaluate(geometry)).cols, columns); }
            await evaluate("document.querySelector('[data-cm-card]').click()"); assert.equal(await evaluate('cardClicks'), 1);
            await change('columns', 3);
            await change('hideLocked', true);
            assert.equal((await evaluate(geometry)).count, await evaluate("document.querySelectorAll('[data-cm-card]').length/2"));
            for (let i = 0; i < 2; i++) {
                if (await evaluate("document.querySelectorAll('[data-cm-card]').length===100")) break;
                const before = await evaluate("document.querySelectorAll('[data-cm-card]').length");
                await evaluate("document.querySelector('[data-testid=loader]').scrollIntoView()");
                await wait(`document.querySelectorAll('[data-cm-card]').length>${before}`);
                await pause(100);
            }
            assert.equal((await evaluate(geometry)).count, 50);
            assert(await evaluate('pageCalls>=2'));
            await evaluate("scrollTo(0,0);renderSearch('new-filter')");
            await wait("document.querySelectorAll('[data-cm-card]').length===60");
            assert.equal((await evaluate(geometry)).count, 30);
            console.log('PASS captured production C4SPlus virtualizer with React: columns, card events, locked filtering, two additional pages, filter replacement');
        }
        console.log('Browser checks complete. Extension installation and authenticated live sessions were not exercised.');
    } finally {
        if (browser) { try { await browser.send('Browser.close'); } catch {} browser.close(); }
        page?.close(); chrome.kill(); server.close();
        // Leave the isolated temporary profile to the OS; never touch the user's profile.
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; server.close(); });

