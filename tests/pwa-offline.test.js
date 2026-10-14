'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PW_PATH||'playwright');
test('service worker caches data core and reopens saved app offline',async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');const file=path.join(root,url.pathname==='/'?'index.html':url.pathname);try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(file));}catch(e){res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch(),context=await browser.newContext();
 try{const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());const base='http://127.0.0.1:'+server.address().port;await page.goto(base);await page.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.evaluate(()=>localStorage.setItem('h2do-offline-regression','durable'));assert.equal(await page.evaluate(async()=>!!await caches.match('./data-core.js')),true);
 await context.setOffline(true);await page.reload();await page.waitForSelector('#datePicker');assert.equal(await page.evaluate(()=>localStorage.getItem('h2do-offline-regression')),'durable');assert.equal(await page.evaluate(()=>typeof MufDataCore.openAccountStorage),'function');assert.deepEqual(errors,[]);
 }finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
});
