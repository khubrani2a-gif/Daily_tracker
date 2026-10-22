const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const http=require('node:http');
const root=path.resolve(__dirname,'../..');
// Use the same compat SDK version as production, with real Firestore transport.
// Emulator-only tokens bypass Google login without exposing production credentials.
const sdkRoot=path.dirname(require.resolve('firebase-app-sdk/package.json'));
const expose=`window.integration={expState:()=>expState,expSave,expPushRemote,expPullRemote,blankState,persistDay,pullRemote,syncPendingDays,syncPullAllModules,dailyPending,learningLoad,learningSave,learningPullRemote,ready:()=>!!user&&!accountChanging};`;
const html=fs.readFileSync(path.join(root,'index.html'),'utf8')
 .replace('firebase.initializeApp(FIREBASE_CONFIG);','firebase.initializeApp({projectId:"demo-daily-tracker",apiKey:"demo-only",appId:"demo-only"});')
 .replace('db = firebase.firestore();','db = firebase.firestore(); db.useEmulator("127.0.0.1",8080,{mockUserToken:{sub:"browser-owner"}});')
 .replace('firebase.auth().onAuthStateChanged(u=>{','(cb=>cb({uid:"browser-owner"}))(u=>{')
 .replace('const snap=await transaction.get(ref);','const snap=await transaction.get(ref);if(window.holdLearningRead)await window.txnBarrier();')
 .replace('const remote=await transaction.get(targetRef);','const remote=await transaction.get(targetRef);if(window.holdFinanceRead)await window.financeBarrier();')
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
   else if(['sync-core.js','data-core.js','planner-core.js','calendar-core.js','learning-core.js'].includes(name)){res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync(path.join(root,name)));}
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
   await a.page.evaluate(async()=>{const d=integration.learningLoad();d.courses=[{id:'offline-course',name:'Original',notes:'Initial',updatedAt:1}];integration.learningSave(d);await integration.learningPullRemote('seed');});
   await b.page.evaluate(()=>integration.learningPullRemote('seed'));
   await b.page.evaluate(async()=>{await firebase.firestore().disableNetwork();const d=integration.learningLoad();d.courses[0].name='B offline';d.courses[0].updatedAt=Date.now();integration.learningSave(d);await integration.learningPullRemote('offline');});
   await a.page.evaluate(async()=>{const d=integration.learningLoad();d.courses[0].notes='A online';d.courses[0].updatedAt=Date.now();integration.learningSave(d);await integration.learningPullRemote('online');});
   await b.page.evaluate(async()=>{await firebase.firestore().enableNetwork();await integration.learningPullRemote('reconnect');});
   await a.page.evaluate(()=>integration.learningPullRemote('verify'));
   for(const d of [a,b]){const row=await d.page.evaluate(()=>integration.learningLoad().courses[0]);assert.equal(row.name,'B offline');assert.equal(row.notes,'A online');assert.deepEqual(d.errors,[]);}
   await a.page.evaluate(async()=>{const d=integration.learningLoad();d.academicYears=[{id:'year',name:'Year',startDate:'2026-01-01',endDate:'2027-12-31'}];integration.learningSave(d);await integration.learningPullRemote('academic-seed');});
   await b.page.evaluate(()=>integration.learningPullRemote('academic-seed'));
   await Promise.all([a.page.evaluate(async()=>{const d=integration.learningLoad();d.terms=[{id:'term-a',yearId:'year',name:'A',startDate:'2026-01-01',endDate:'2026-06-30'}];integration.learningSave(d);await integration.learningPullRemote('academic-a');}),b.page.evaluate(async()=>{const d=integration.learningLoad();d.terms=[{id:'term-b',yearId:'year',name:'B',startDate:'2026-07-01',endDate:'2026-12-31'}];integration.learningSave(d);await integration.learningPullRemote('academic-b');})]);
   for(const device of [a,b]){await device.page.evaluate(()=>integration.learningPullRemote('academic-verify'));assert.deepEqual(await device.page.evaluate(()=>integration.learningLoad().terms.map(t=>t.id).sort()),['term-a','term-b']);}
   // Force independent finance writers to read the same server revision before committing.
   await a.page.evaluate(async()=>{const d=integration.expState();d.settings.salaryAmountMinor=800000;integration.expSave(d);await integration.expPushRemote(d);});
   await b.page.evaluate(()=>integration.expPullRemote({manual:true}));
   let financeArrivals=0,financeRelease;const financeBarrier=new Promise(resolve=>financeRelease=resolve);
   for(const d of [a,b]){await d.page.exposeBinding('financeBarrier',async()=>{if(++financeArrivals>=2)financeRelease();await financeBarrier;});await d.page.evaluate(()=>window.holdFinanceRead=true);}
   await Promise.all([a.page.evaluate(async()=>{const d=integration.expState();d.transactions.push({id:'finance-a',amountMinor:10000,transactionType:'expense',transactionDate:'2026-10-01',createdAt:Date.now(),updatedAt:Date.now()});d.settings.salaryAmountMinor=900000;integration.expSave(d);const result=await integration.expPushRemote(d);if(!result.ok)throw new Error(result.error);}),b.page.evaluate(async()=>{const d=integration.expState();d.transactions.push({id:'finance-b',amountMinor:20000,transactionType:'expense',transactionDate:'2026-10-01',createdAt:Date.now(),updatedAt:Date.now()});d.settings.defaultPaymentMethod='نقد';d.financeEntries=[{id:'income-b',kind:'income',date:'2026-10-01',amountMinor:900000,updatedAt:Date.now()}];integration.expSave(d);const result=await integration.expPushRemote(d);if(!result.ok)throw new Error(result.error);})]);
   for(const d of [a,b]){await d.page.evaluate(()=>window.holdFinanceRead=false);await d.page.evaluate(()=>integration.expPullRemote({manual:true}));const finance=await d.page.evaluate(()=>integration.expState());assert.ok(finance.transactions.some(t=>t.id==='finance-a'));assert.ok(finance.transactions.some(t=>t.id==='finance-b'));assert.equal(finance.settings.salaryAmountMinor,900000);assert.equal(finance.settings.defaultPaymentMethod,'نقد');assert.ok(finance.financeEntries.some(t=>t.id==='income-b'));assert.deepEqual(d.errors,[]);}
   // An offline finance correction must survive alongside a new online plan/income.
   await b.page.evaluate(async()=>{
     await firebase.firestore().disableNetwork();
     const d=integration.expState(),now=Date.now();
     const old=d.transactions.find(t=>t.id==='finance-b');old.deletedAt=now;old.updatedAt=now;
     d.financeEntries.push({id:'offline-saving',kind:'saving',goalId:'offline-goal',date:'2026-10-02',amountMinor:25000,createdAt:now,updatedAt:now});
     d.savingsGoals.push({id:'offline-goal',name:'Offline reserve',targetMinor:100000,currentMinor:0,isActive:true,createdAt:now,updatedAt:now});
     integration.expSave(d);
   });
   await a.page.evaluate(async()=>{
     const d=integration.expState(),now=Date.now();
     d.financeEntries.push({id:'plan_2026-09-27',kind:'plan',cycleStart:'2026-09-27',expectedMinor:900000,savingMinor:100000,updatedAt:now});
     d.financeEntries.push({id:'online-bonus',kind:'income',name:'Bonus',date:'2026-10-02',amountMinor:50000,updatedAt:now});
     integration.expSave(d);const result=await integration.expPushRemote(d);if(!result.ok)throw new Error(result.error);
   });
   await b.page.evaluate(async()=>{await firebase.firestore().enableNetwork();const r=await integration.expPushRemote(integration.expState());if(!r.ok)throw new Error(r.error);});
   for(const d of [a,b]){
     await d.page.evaluate(()=>integration.expPullRemote({manual:true}));
     const state=await d.page.evaluate(()=>integration.expState());
     assert.ok(state.transactions.find(t=>t.id==='finance-b').deletedAt);
     assert.equal(state.financeEntries.filter(t=>t.id==='offline-saving').length,1);
     assert.equal(state.financeEntries.find(t=>t.id==='offline-saving').amountMinor,25000);
     assert.equal(state.financeEntries.find(t=>t.id==='plan_2026-09-27').savingMinor,100000);
     assert.ok(state.financeEntries.some(t=>t.id==='online-bonus'));
     assert.ok(state.savingsGoals.some(t=>t.id==='offline-goal'));
     assert.deepEqual(d.errors,[]);
   }
   let arrivals=0,release;const barrier=new Promise(resolve=>release=resolve);
   for(const d of [a,b]){await d.page.exposeBinding('txnBarrier',async()=>{if(++arrivals>=2)release();await barrier;});await d.page.evaluate(()=>window.holdLearningRead=true);}
   await Promise.all([a.page.evaluate(async()=>{const d=integration.learningLoad();d.courses[0].name='Concurrent A';d.courses[0].updatedAt=Date.now();integration.learningSave(d);await integration.learningPullRemote('race');}),b.page.evaluate(async()=>{const d=integration.learningLoad();d.courses[0].notes='Concurrent B';d.courses[0].updatedAt=Date.now();integration.learningSave(d);await integration.learningPullRemote('race');})]);
   for(const d of [a,b]){await d.page.evaluate(()=>window.holdLearningRead=false);await d.page.evaluate(()=>integration.learningPullRemote('converge'));const row=await d.page.evaluate(()=>integration.learningLoad().courses[0]);assert.equal(row.name,'Concurrent A');assert.equal(row.notes,'Concurrent B');assert.deepEqual(d.errors,[]);}
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
