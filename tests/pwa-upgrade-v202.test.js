'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script[^>]+src="https:[^"]+"[^>]*><\/script>/g,'');
for(const delayedCache of [false,true])test('upgrade replaces HTTP-cached legacy HTML before offline reopen (delayed cache '+delayedCache+')',async()=>{
 let upgraded=false;
 const legacy='<script>window.legacyPage=true;localStorage.setItem("h2do-upgrade-record","legacy-preserved");</script>Legacy reader';
 const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),name=u.pathname==='/'?'index.html':u.pathname.slice(1);res.setHeader('Cache-Control',name==='sw.js'?'no-store':'public, max-age=3600');
  if(name==='index.html'){res.setHeader('Content-Type','text/html');return res.end(upgraded?source+(u.searchParams.has('fresh')?'<script>window.navigationRevision="fresh";</script>':''):legacy);}
  if(name==='sw.js'){res.setHeader('Content-Type','application/javascript');return res.end((delayedCache?'const realOpen=caches.open.bind(caches);caches.open=async(...args)=>{await new Promise(r=>setTimeout(r,250));return realOpen(...args);};':'')+fs.readFileSync(path.join(root,name),'utf8'));}
  try{res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':'application/octet-stream');res.end(fs.readFileSync(path.join(root,name)));}catch{res.statusCode=404;res.end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(),context=await browser.newContext();
 try{const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/index.html');assert.equal(await p.evaluate(()=>window.legacyPage),true);
  // Keep the old HTML fresh in HTTP cache while the server releases the new app.
  upgraded=true;await p.goto(base+'/?upgrade=1');await p.waitForFunction(()=>window.__appReady===true);
  await p.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});await navigator.serviceWorker.ready;});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const offlineHTML=await p.evaluate(async()=>{const c=await caches.open((await caches.keys()).find(k=>k.startsWith('mufakkirati-v')));return (await c.match('./index.html')).text();});
  assert.ok(offlineHTML.includes('window.__appReady=true'),'offline HTML must be the upgraded app, not a fresh HTTP-cache copy of the legacy page');
  await p.goto(base+'/?fresh=1');await p.waitForFunction(()=>window.__appReady===true);
  assert.equal(await p.evaluate(async()=>{const c=await caches.open((await caches.keys()).find(k=>k.startsWith('mufakkirati-v')));return (await(await c.match('./index.html')).text()).includes('window.navigationRevision="fresh"');}),true,'navigation must commit its offline response before returning');
  await p.evaluate(async()=>{await (await caches.open('retired-release')).put('./retired-only.js',new Response('obsolete'));});
  await context.setOffline(true);assert.equal(await p.evaluate(async()=>{try{return await(await fetch('./retired-only.js')).text();}catch{return 'unavailable';}}),'unavailable','a retired cache must never supply current-release resources');await p.reload();await p.waitForFunction(()=>window.__appReady===true);assert.equal(await p.evaluate(()=>localStorage.getItem('h2do-upgrade-record')),'legacy-preserved');assert.equal(await p.evaluate(()=>window.navigationRevision),'fresh');assert.deepEqual(errors,[]);
 }finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
});
