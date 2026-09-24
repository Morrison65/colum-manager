#!/usr/bin/env node
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawn } = require('node:child_process');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function options(argv) {
    const result = { urls: [], maxPages: 3, settleMs: 750, timeoutMs: 10000, selector: 'main, article', chrome: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' };
    const keys = { '--url':'urls', '--out':'out', '--include':'include', '--max-pages':'maxPages', '--settle-ms':'settleMs', '--timeout-ms':'timeoutMs', '--selector':'selector', '--chrome':'chrome' };
    for (let i=0;i<argv.length;i++) {
        const key=keys[argv[i]],value=argv[++i];
        if (!key || !value) throw Error('Expected --url URL --out DIRECTORY and optional --include REGEX --max-pages N --selector CSS');
        if (key==='urls') result.urls.push(new URL(value)); else result[key]=value;
    }
    if (!result.urls.length || !result.out) throw Error('--url and --out are required');
    for (const [key,min,max] of [['maxPages',1,10],['settleMs',0,3000],['timeoutMs',1000,30000]]) {
        result[key]=Number(result[key]);
        if (!Number.isInteger(result[key]) || result[key]<min || result[key]>max) throw Error(`Invalid ${key}: expected ${min}–${max}`);
    }
    for (const url of result.urls) {
        if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.origin!==result.urls[0].origin) throw Error('URLs must use HTTP(S), have no credentials and share one origin');
        url.hash='';
    }
    result.include=result.include ? new RegExp(result.include) : null;
    result.out=path.resolve(result.out);
    if (fs.existsSync(path.join(result.out,'manifest.json'))) throw Error('Output already contains a capture; choose a new directory');
    return result;
}
async function connect(url) {
    const ws=new WebSocket(url), pending=new Map(), listeners=new Map();let sequence=0;
    await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
    ws.onmessage=event=>{
        const message=JSON.parse(event.data), task=pending.get(message.id);
        if (!task) {listeners.get(message.method)?.(message.params);return;}
        pending.delete(message.id);clearTimeout(task.timer);
        message.error?task.reject(Error(message.error.message)):task.resolve(message.result);
    };
    return {close:()=>ws.close(),on:(event,listener)=>listeners.set(event,listener),send(method,params={},timeout=12000){
        return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method))},timeout);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
    }};
}
function collect(selector) {
    const props=['display','position','width','max-width','min-width','height','float','grid-template-columns','gap','padding','margin','overflow'];
    const elements=[...document.querySelectorAll(selector)].slice(0,250);
    const layout=elements.map(element=>{
        const style=getComputedStyle(element), rect=element.getBoundingClientRect();
        return {tag:element.tagName,id:element.id,class:element.className,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},styles:Object.fromEntries(props.map(p=>[p,style.getPropertyValue(p)])),parent:element.parentElement?{tag:element.parentElement.tagName,id:element.parentElement.id,class:element.parentElement.className}:null};
    });
    const links=[...new Set([...document.querySelectorAll('a[href]')].map(a=>a.href))];
    const clone=document.documentElement.cloneNode(true);
    clone.querySelectorAll('script,iframe,object,embed,base,meta[http-equiv="refresh"]').forEach(n=>n.remove());
    const placeholder='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#555"/></svg>');
    for (const element of clone.querySelectorAll('*')) {
        for (const attribute of [...element.attributes]) {
            if (/^on/i.test(attribute.name) || /token|secret|password|csrf|nonce/i.test(attribute.name)) element.removeAttribute(attribute.name);
        }
        if (element.matches('input,textarea')) {element.removeAttribute('value');element.textContent='';}
        if (element.matches('video,audio,source')) {element.removeAttribute('src');element.removeAttribute('srcset');element.removeAttribute('poster');element.removeAttribute('autoplay');}
        if (element.matches('img')) {element.setAttribute('src',placeholder);element.removeAttribute('srcset');}
        for (const attr of ['href','action']) {
            const raw=element.getAttribute(attr);if(!raw)continue;
            try {const url=new URL(raw,location.href);if(url.protocol==='javascript:'){element.removeAttribute(attr);continue;}url.search='';url.hash='';element.setAttribute(attr,url.href);}catch{}
        }
    }
    const csp=document.createElement('meta');csp.httpEquiv='Content-Security-Policy';csp.content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'";clone.querySelector('head')?.prepend(csp);
    return {html:'<!doctype html>\n'+clone.outerHTML,links,layout,url:location.href,title:document.title,ready:document.readyState,count:document.querySelectorAll(selector).length};
}
async function run(config) {
    fs.mkdirSync(config.out,{recursive:true});
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),'site-layout-capture-'));
    const chrome=spawn(config.chrome,['--headless','--disable-gpu','--no-first-run','--disable-background-networking','--autoplay-policy=user-gesture-required','--window-size=1440,1000','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
    let launchError;chrome.on('error',error=>launchError=error);
    let page,browser;const manifest={created:new Date().toISOString(),selector:config.selector,pages:[],limitations:['Unauthenticated isolated Chrome; media blocked; inert DOM with image placeholders; no extension injection verification.','Sanitization is not a guarantee that visible private text or every site-specific secret has been removed.']};
    try {
        const active=path.join(profile,'DevToolsActivePort');
        for(let n=0;!fs.existsSync(active)&&n<100&&!launchError;n++)await pause(50);
        if(launchError)throw launchError;
        const port=fs.readFileSync(active,'utf8').split('\n')[0];
        const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        const version=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json();
        browser=await connect(version.webSocketDebuggerUrl);page=await connect(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
        await page.send('Page.enable');await page.send('DOM.enable');await page.send('CSS.enable');await page.send('Network.enable');
        await page.send('Network.setBlockedURLs',{urls:['*.mp4*','*.m3u8*','*.mpd*','*.webm*','*.m4s*','*.ts?*']});
        await page.send('Fetch.enable',{patterns:[{resourceType:'Media',urlPattern:'*'}]});
        page.on('Fetch.requestPaused',event=>page.send('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'}).catch(()=>{}));
        let sheets=new Map();page.on('CSS.styleSheetAdded',event=>sheets.set(event.header.styleSheetId,event.header));
        async function evaluate(expression) {
            const result=await page.send('Runtime.evaluate',{expression,returnByValue:true});
            if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
            return result.result.value;
        }
        const queue=[...new Set(config.urls.map(u=>u.href))],seen=new Set();
        for(let index=0;index<queue.length&&manifest.pages.length<config.maxPages;index++) {
            const requested=queue[index];if(seen.has(requested))continue;seen.add(requested);sheets=new Map();
            const record={requested:new URL(requested).origin+new URL(requested).pathname};
            try {
                const nav=await page.send('Page.navigate',{url:requested},config.timeoutMs);
                if(nav.errorText)throw Error(nav.errorText);
                const deadline=Date.now()+config.timeoutMs;let ready=false;
                while(Date.now()<deadline) {try {ready=await evaluate("document.readyState==='complete'");}catch{}if(ready)break;await pause(100);}
                if(!ready)throw Error('Navigation timed out before complete');
                await pause(config.settleMs);
                const result=await evaluate(`(${collect.toString()})(${JSON.stringify(config.selector)})`);
                if(new URL(result.url).origin!==config.urls[0].origin)throw Error('Redirected outside requested origin');
                if(/just a moment|access denied|verify you are human|sign in|log in/i.test(result.title))throw Error('Authentication or challenge page; no bypass attempted');
                const styles=[];
                for(const [id,header] of sheets) {
                    try {const css=await page.send('CSS.getStyleSheetText',{styleSheetId:id});const u=header.sourceURL;styles.push({source:u?u.split('?')[0]:'inline',origin:header.origin,text:css.text});}catch(error){styles.push({source:'unavailable',error:error.message});}
                }
                const prefix=`page-${manifest.pages.length+1}`;
                fs.writeFileSync(path.join(config.out,prefix+'.html'),result.html);
                fs.writeFileSync(path.join(config.out,prefix+'.styles.json'),JSON.stringify(styles,null,2));
                fs.writeFileSync(path.join(config.out,prefix+'.css'),styles.filter(s=>s.text).map(s=>s.text).join('\n'));
                fs.writeFileSync(path.join(config.out,prefix+'.layout.json'),JSON.stringify({count:result.count,layout:result.layout},null,2));
                Object.assign(record,{status:'captured',prefix,elements:result.count,styles:styles.length});
                if(index===0&&config.include) {
                    for(const raw of result.links) {try {const u=new URL(raw);u.hash='';if(u.origin===config.urls[0].origin&&config.include.test(u.pathname)&&!u.search&&!queue.includes(u.href))queue.push(u.href);}catch{}}
                }
            } catch(error) {record.status='failed';record.error=error.message;process.exitCode=1;}
            manifest.pages.push(record);fs.writeFileSync(path.join(config.out,'manifest.json'),JSON.stringify(manifest,null,2));
            console.log(`${record.status}: ${record.requested}${record.error?' — '+record.error:` (${record.elements} selected elements, ${record.styles} stylesheets)`}`);
        }
    } finally {
        fs.writeFileSync(path.join(config.out,'manifest.json'),JSON.stringify(manifest,null,2));
        if(browser){try{await browser.send('Browser.close',{},2000)}catch{}browser.close();}page?.close();chrome.kill();
    }
}
if(require.main===module) {try{run(options(process.argv.slice(2))).catch(error=>{console.error(error.message);process.exitCode=1})}catch(error){console.error(error.message);process.exitCode=1}}
module.exports={options,collect};
