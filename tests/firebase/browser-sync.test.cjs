const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const http=require('node:http');
const root=path.resolve(__dirname,'../..');
// Use the same compat SDK version as production, with real Firestore transport.
// Emulator-only tokens bypass Google login without exposing production credentials.
const sdkRoot=path.dirname(require.resolve('firebase-app-sdk/package.json'));
const expose=`window.integration={blankState,persistDay,pullRemote,syncPendingDays,syncPullAllModules,dailyPending,ready:()=>!!user&&!accountChanging};`;
const html=fs.readFileSync(path.join(root,'index.html'),'utf8')
 .replace('firebase.initializeApp(FIREBASE_CONFIG);','firebase.initializeApp({projectId:"demo-daily-tracker",apiKey:"demo-only",appId:"demo-only"});')
 .replace('db = firebase.firestore();','db = firebase.firestore(); db.useEmulator("127.0.0.1",8080,{mockUserToken:{sub:"browser-owner"}});')
 .replace('firebase.auth().onAuthStateChanged(u=>{','(cb=>cb({uid:"browser-owner"}))(u=>{')
 .replace('function storageKey(date){',expose+'\nfunction storageKey(date){');
async function openDevice(browser,origin){
 const context=await browser.newContext(),page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='127.0.0.1'&&u.port==='8080')return route.continue();
   if(u.hostname==='www.gstatic.com'&&u.pathname.startsWith('/firebasejs/10.14.1/')){
     return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(sdkRoot,path.basename(u.pathname)))});
   }
   if(u.origin===origin)return route.continue();
   return route.abort();
 });
 await page.goto(origin+'/index.html');
 await page.waitForFunction(()=>window.integration?.ready());
 await page.evaluate(()=>integration.syncPullAllModules('integration',{forceServer:true,bypassThrottle:true}));
 return {page,context,errors};
}
test('app sync across independent browsers preserves offline edits alongside remote edits',{timeout:90000},async()=>{
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080');
 const server=http.createServer((req,res)=>{
   const name=req.url.split('?')[0].slice(1);
   if(name==='index.html'){res.setHeader('Content-Type','text/html');res.end(html);}
   else if(['sync-core.js','data-core.js','planner-core.js','calendar-core.js'].includes(name)){res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync(path.join(root,name)));}
   else {res.end('');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch();
 try{
   const a=await openDevice(browser,origin),b=await openDevice(browser,origin);
   const day='2024-02-03';
   await a.page.evaluate(async day=>{
     integration.persistDay(day,{...integration.blankState(),notes:'initial',water:1});
     await integration.syncPendingDays('integration');
   },day);
   await b.page.evaluate(day=>integration.pullRemote(day,'integration'),day);
   assert.equal(await b.page.evaluate(day=>JSON.parse(localStorage.getItem('h2do-tracker:'+day)).notes,day),'initial');
   await b.page.evaluate(async day=>{
     await firebase.firestore().disableNetwork();
     const old=JSON.parse(localStorage.getItem('h2do-tracker:'+day));
     integration.persistDay(day,{...old,water:4});
   },day);
   await a.page.evaluate(async day=>{
     const old=JSON.parse(localStorage.getItem('h2do-tracker:'+day));
     integration.persistDay(day,{...old,notes:'edited on A while B offline'});
     await integration.syncPendingDays('integration');
   },day);
   await b.page.evaluate(async()=>{await firebase.firestore().enableNetwork();await integration.syncPendingDays('reconnect');});
   await a.page.evaluate(day=>integration.pullRemote(day,'integration'),day);
   for(const d of [a,b]){
     const value=await d.page.evaluate(day=>JSON.parse(localStorage.getItem('h2do-tracker:'+day)),day);
     assert.equal(value.water,4);assert.equal(value.notes,'edited on A while B offline');
     assert.deepEqual(await d.page.evaluate(()=>integration.dailyPending()),{});
     assert.deepEqual(d.errors,[]);
   }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
