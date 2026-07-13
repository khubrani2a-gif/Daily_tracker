/*
 * اختبار عقد المزامنة (Sync-contract test) — مفكرتي اليومية
 * ----------------------------------------------------------------------------
 * يغطّي بنود المراجعة الحاجزة لإصلاح v99:
 *   1. عقد Expenses كبقيّة الأقسام: خادم أولًا ثم كاش صريح، عدم تخطّي الكاش عند عدم الاتصال،
 *      expPushRemote يُعيد وعدًا، انتظار كتابة المصالحة، عدم الدفع بعد الكاش، حالة مُهيكلة،
 *      وعدم تحديث وقت آخر مزامنة خادم بعد قراءة كاش.
 *   2. أقفال ذات انضمام (JOIN): التداخل يُنتج قراءةً واحدة، ونتيجةً صالحة تصل الحالة والواجهة،
 *      وأعلامَ inFlight تعود false، وحالةً عامّة لا تعلق على «جارٍ».
 *   3. محاسبة فشل كتابة المصالحة (Daily+Expenses): failed، reconWriteFailed، لا تقدّم lastServerSuccessAt/lastSyncAt.
 *   4. حراسة الجيل (_syncRunGen): للحالة المرئية فقط، لا تُسقط بيانات خادم صالحة.
 *   5. تصليب الإنتاج: طرائق الكتابة (pullAll/expPull/expPush) خلف العلم __MFKR_TEST__ فقط.
 *
 * هرمِتيّة: نعترض ونُجهض كل طلبات https://www.gstatic.com/firebasejs/** قبل التحميل كي لا
 * تستبدل سكربتات Firebase الحقيقية البديلَ المحقون؛ ونتحقّق بعد كل تحميل من بقاء العلامة __MFKR_FAKE__.
 *
 * حدود صادقة: هذه ليست محاكاة Firestore حقيقية ولا ثلاثة عملاء فيزيائيين — بل بديل
 * في‑الذاكرة أمين لواجهة compat يميّز {source:"server"} عن {source:"cache"}، ويحقن
 * أعطال الخادم/الكتابة والتأخير وعدّاد القراءات/الكتابات. التقارب عبر الأجهزة مُحاكى عند حدّ الواجهة.
 *
 * التشغيل:  node tests/sync-contract.test.js
 * يتطلّب Playwright (Chromium). يبحث عن الحزمة في PW_PATH ثم في مسارات شائعة.
 */
"use strict";
const path = require("path");
function loadChromium(){
  const cands = [process.env.PW_PATH, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean);
  for(const c of cands){ try{ return require(c).chromium; }catch(e){} }
  console.error("Playwright not found. Set PW_PATH=/path/to/playwright"); process.exit(2);
}
const chromium = loadChromium();
const fileUrl = "file://" + path.resolve(__dirname, "..", "index.html");
const today = ()=>{ const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };

/* ---- حالة تحكّم في‑الذاكرة (تُعدَّل من Node بين الخطوات) ---- */
const store = {};
const writeCount = {};
const readCount = {};           // عدّاد القراءات الفيزيائية (server/default) لكل مسار
let serverDown = false;         // إسقاط قراءات source:"server" فقط
let writeFailPath = null;       // سلسلة جزئية: أي set على مسار يحويها يفشل
let readDelayPath = null, readDelayMs = 0;   // إبطاء قراءات مسار (لاختبار الانضمام)

/* بديل Firebase compat أمين يميّز مصدر القراءة ويحقن الأعطال/التأخير */
const FAKE = `
window.firebase = (function(){
  const wait=(ms)=> ms? new Promise(r=>setTimeout(r,ms)) : Promise.resolve();
  const doc=(p,src)=> window.__rRead(p,src).then(ctl=> wait(ctl.delay).then(()=>{
    if(ctl.reject) throw new Error("sim "+src+" read fail "+p);
    return window.__rGet(p).then(j=>({ exists:j!=null, data:()=> j!=null?JSON.parse(j):null, metadata:{fromCache:ctl.fromCache} }));
  }));
  const coll=(p,src)=> window.__rRead(p,src).then(ctl=> wait(ctl.delay).then(()=>{
    if(ctl.reject) throw new Error("sim "+src+" query fail "+p);
    return window.__rColl(p).then(arr=>({ forEach:(cb)=>(arr||[]).forEach(x=>cb({id:x.id,data:()=>x})), empty:!(arr&&arr.length), size:(arr?arr.length:0), metadata:{fromCache:ctl.fromCache} }));
  }));
  const mkRef=(p)=>({ collection:(c)=>mkColl(p+"/"+c),
    set:(o)=> window.__rSet(p, JSON.stringify(o)).then(bad=>{ if(bad) throw new Error("sim write fail "+p); }),
    delete:()=> window.__rDel(p).then(bad=>{ if(bad) throw new Error("sim delete fail "+p); }),
    get:(opts)=> doc(p,(opts&&opts.source)||"default") });
  const mkColl=(p)=>({ doc:(d)=>mkRef(p+"/"+d),
    get:(opts)=> coll(p,(opts&&opts.source)||"default"),
    where:function(){ return { get:(opts)=> coll(p,(opts&&opts.source)||"default"), where:function(){return this;} }; } });
  const fs=function(){ return { settings:undefined, enablePersistence:()=>({catch:()=>{}}), collection:(c)=>mkColl(c) }; };
  const auth=function(){ return { onAuthStateChanged:(cb)=>{ setTimeout(()=>cb({uid:"U1",displayName:"T",email:"t@t"}),10); }, signOut:()=>Promise.resolve(), signInWithPopup:()=>Promise.resolve() }; };
  auth.GoogleAuthProvider=function(){};
  return { initializeApp:()=>({}), firestore:fs, auth:auth };
})();
window.firebase.__MFKR_FAKE__ = true;   /* علامة صريحة: يجب أن تبقى الحقيقية غير مُحمَّلة */
`;

let PASS=0, FAIL=0; const errs=[];
const ok=(n,c)=>{ if(c){PASS++;console.log("  ✓ "+n);}else{FAIL++;console.log("  ✗ FAIL: "+n);} };

/* هرمِتيّة: نمنع سكربتات Firebase من الشبكة (gstatic) كي لا تستبدل البديل المحقون بعد التحميل */
async function blockFirebaseCDN(page){ await page.route("https://www.gstatic.com/firebasejs/**", r=> r.abort()); }
/* تأكيد أنّ البديل ما زال هو المُسيطر بعد التحميل — يفشل بوضوح إن استبدلته الحقيقية */
async function verifyFake(page, label){ const active = await page.evaluate(()=> !!(window.firebase && window.firebase.__MFKR_FAKE__===true)); ok("fake Firebase authoritative after load ("+label+")", active); return active; }

async function device(b){
  const ctx = await b.newContext({viewport:{width:1000,height:900}});
  const p = await ctx.newPage();
  p.on("pageerror", e=> errs.push(e.message.split("\n")[0]));
  await blockFirebaseCDN(p);   // must run before goto so real Firebase never loads
  await p.exposeBinding("__rGet",(s,path)=> (store[path]!=null?store[path]:null));
  await p.exposeBinding("__rSet",(s,path,json)=>{ if(writeFailPath && path.indexOf(writeFailPath)>=0) return true; store[path]=json; writeCount[path]=(writeCount[path]||0)+1; return false; });
  await p.exposeBinding("__rDel",(s,path)=>{ if(writeFailPath && path.indexOf(writeFailPath)>=0) return true; delete store[path]; return false; });
  await p.exposeBinding("__rColl",(s,path)=>{ const out=[]; Object.keys(store).forEach(k=>{ if(k.indexOf(path+"/")===0){ try{ out.push(JSON.parse(store[k])); }catch(e){} } }); return out; });
  await p.exposeBinding("__rRead",(s,path,src)=>{ if(src!=="cache") readCount[path]=(readCount[path]||0)+1; return { reject: (serverDown && src==="server"), fromCache: (src==="cache"), delay: (readDelayPath && path.indexOf(readDelayPath)>=0)? readDelayMs : 0 }; });
  await p.addInitScript(()=>{ window.__MFKR_TEST__ = true; });   // enable write-capable sync test hook
  await p.addInitScript(FAKE);
  return p;
}

const expKey = "users/U1/meta/expenses";
const dayKey = "users/U1/days/"+today();
const seedExp = (extraTx)=> JSON.stringify({ version:2,
  settings:{currency:"SAR",weekStartDay:6,numberFormat:"ar-EG",defaultPaymentMethod:null,currentBudgetVersion:1,migratedLegacy:true,pristineSeed:false,createdAt:1,updatedAt:1000},
  categories:[{id:"CA",name:"الأكل",section:"variable",budgets:[],isActive:true,archivedAt:null,createdAt:1,updatedAt:1}],
  fixedTemplates:[], instances:[],
  transactions:[{id:"R1",amountMinor:5000,transactionDate:today(),categoryId:"CA",transactionType:"expense",description:"عشاء",countAgainstWeeklyBudget:true,deletedAt:null,updatedAt:1}].concat(extraTx||[]),
  trips:[] });

(async()=>{
  const b = await chromium.launch();

  console.log("1. Expenses: server-first success then CACHE FALLBACK on resume (contract parity)");
  store[expKey] = seedExp();
  const A = await device(b); await A.goto(fileUrl); await A.waitForTimeout(900); await verifyFake(A,"1");
  let mExp = await A.evaluate(()=> window.__mfkrSync.module("expenses"));
  ok("expenses reached the coordinator (attempted)", !!mExp && (mExp.lastServerSuccessAt>0 || mExp.lastCacheFallbackAt>0));
  ok("first auth pull was a SERVER success (not cache)", mExp.lastServerSuccessAt>0 && mExp.lastServerSuccessAt>=mExp.lastCacheFallbackAt);
  const lastSyncBefore = await A.evaluate(()=>{ try{ return (JSON.parse(localStorage.getItem("h2do-expenses-syncmeta"))||{}).lastSyncAt||0; }catch(e){ return 0; } });
  ok("server read stamped a last-sync time", lastSyncBefore>0);

  // simulate resume with server unreachable → server read fails, cache read serves stale
  serverDown = true;
  await A.waitForTimeout(20);
  const res = await A.evaluate(()=> window.__mfkrSync.pullAll("test-resume", {}).then(r=>({trigger:r.trigger, isLatest:r.isLatest(), results:r.results})));
  mExp = await A.evaluate(()=> window.__mfkrSync.module("expenses"));
  ok("resume read fell back to CACHE (cacheFallback > serverSuccess)", mExp.lastCacheFallbackAt > mExp.lastServerSuccessAt);
  const expResult = (res.results||[]).find(r=> r && r.module==="expenses");
  ok("expenses result status = cacheFallback (not success)", expResult && expResult.status==="cacheFallback");
  const summ = await A.evaluate(()=> window.__mfkrSync.summary());
  ok("global summary treats cache as PARTIAL, not full success", summ.state==="partial" && /بعض/.test(summ.text));
  const lastSyncAfter = await A.evaluate(()=>{ try{ return (JSON.parse(localStorage.getItem("h2do-expenses-syncmeta"))||{}).lastSyncAt||0; }catch(e){ return 0; } });
  ok("cache-only read did NOT advance last server-sync time", lastSyncAfter===lastSyncBefore);
  serverDown = false;
  await A.close();

  console.log("2. Expenses: NEVER reconcile-push after a cache fallback");
  store[expKey] = seedExp();
  const C = await device(b);
  // local has an extra transaction the server lacks → would normally contribute a reconcile push
  await C.addInitScript((k)=>{ /* placeholder */ }, expKey);
  await C.goto(fileUrl); await C.waitForTimeout(900); await verifyFake(C,"2");
  // add a local-only transaction via the app storage, then force server-down and pull
  await C.evaluate(()=>{ const d=JSON.parse(localStorage.getItem("h2do-expenses")); d.transactions.push({id:"LOCAL1",amountMinor:9900,transactionDate:new Date().toISOString().slice(0,10),categoryId:"CA",transactionType:"expense",description:"محلي فقط",countAgainstWeeklyBudget:true,deletedAt:null,updatedAt:Date.now()}); d.settings.updatedAt=Date.now(); localStorage.setItem("h2do-expenses", JSON.stringify(d)); });
  const wBefore = writeCount[expKey]||0;
  serverDown = true; await C.waitForTimeout(20);
  await C.evaluate(()=> window.__mfkrSync.pullAll("cache-noPush", {}).then(r=>r.trigger));
  await C.waitForTimeout(200);
  const wAfter = writeCount[expKey]||0;
  ok("no expenses push happened during a cache-fallback pull", wAfter===wBefore);
  serverDown = false;
  await C.close();

  console.log("3. expPushRemote returns a Promise resolving {ok:true} on success, {ok:false} on failure");
  const D = await device(b); await D.goto(fileUrl); await D.waitForTimeout(700); await verifyFake(D,"3");
  const okRes = await D.evaluate(()=> window.__mfkrSync.expPush({version:2, settings:{updatedAt:Date.now()}, categories:[], fixedTemplates:[], instances:[], transactions:[], trips:[]}).then(r=>r).catch(e=>({thrown:String(e)})));
  ok("expPush resolves (never throws) with ok:true", okRes && okRes.ok===true);
  writeFailPath = "meta/expenses";
  const failRes = await D.evaluate(()=> window.__mfkrSync.expPush({version:2, settings:{updatedAt:Date.now()+1}, categories:[], fixedTemplates:[], instances:[], transactions:[], trips:[]}).then(r=>r).catch(e=>({thrown:String(e)})));
  ok("expPush resolves ok:false on write failure (no unhandled throw)", failRes && failRes.ok===false && !failRes.thrown);
  writeFailPath = null;
  await D.close();

  console.log("4. Reconciliation write failure accounting — DAILY (blocker 2)");
  // local day newer than remote → pullRemote reconciles via pushRemote; make that write fail
  store[dayKey] = JSON.stringify({date:today(), prayers:[false,false,false,false,false], worship:{}, water:0, tasks:[], priorities:[], updatedAt:1000});
  const E = await device(b);
  await E.addInitScript((tk)=>{ localStorage.setItem("h2do-tracker:"+tk, JSON.stringify({date:tk, prayers:[true,false,false,false,false], worship:{}, water:0, tasks:[], priorities:[], rating:0, updatedAt:9e14})); }, today());
  writeFailPath = "/days/";   // set BEFORE load so the reconcile write never succeeds (auth pull included)
  await E.goto(fileUrl); await E.waitForTimeout(400); await verifyFake(E,"4");
  await E.waitForFunction(()=> !window.__mfkrSync.inFlight("daily"), null, {timeout:5000}).catch(()=>{});
  const before4 = await E.evaluate(()=> window.__mfkrSync.module("daily").lastServerSuccessAt);
  const dRes = await E.evaluate(()=> window.__mfkrSync.pullAll("recon-fail", {}).then(r=> (r.results||[]).find(x=>x&&x.module==="daily")));
  ok("daily reconcile-write failure → status 'failed'", dRes && dRes.status==="failed" && dRes.reconWriteOk===false);
  const mDaily = await E.evaluate(()=> window.__mfkrSync.module("daily"));
  ok("daily lastError === 'reconWriteFailed'", mDaily && mDaily.lastError==="reconWriteFailed");
  ok("daily lastServerSuccessAt did NOT advance on failed reconcile", mDaily.lastServerSuccessAt===before4);
  const sum4 = await E.evaluate(()=> window.__mfkrSync.summary());
  ok("global summary is NOT 'ok' while a module failed", sum4.state!=="ok");
  writeFailPath = null;
  await E.close();

  console.log("4b. Reconciliation write failure accounting — EXPENSES (blocker 2)");
  store[expKey] = seedExp();
  const Eb = await device(b);
  await Eb.goto(fileUrl); await Eb.waitForTimeout(800); await verifyFake(Eb,"4b");
  await Eb.waitForFunction(()=> !window.__mfkrSync.inFlight("expenses"), null, {timeout:5000}).catch(()=>{});
  const beforeSrv = await Eb.evaluate(()=> window.__mfkrSync.module("expenses").lastServerSuccessAt);
  const beforeSync = await Eb.evaluate(()=>{ try{ return (JSON.parse(localStorage.getItem("h2do-expenses-syncmeta"))||{}).lastSyncAt||0; }catch(e){ return 0; } });
  // server doc now missing (server-empty branch) → app pushes local; make that push fail
  delete store[expKey];
  writeFailPath = "meta/expenses";
  const xRes = await Eb.evaluate(()=> window.__mfkrSync.expPull({trigger:"exp-recon-fail"}).then(r=>r));
  ok("expenses reconcile-write failure → status 'failed'", xRes && xRes.status==="failed" && xRes.reconWriteOk===false);
  const mExpF = await Eb.evaluate(()=> window.__mfkrSync.module("expenses"));
  ok("expenses lastError === 'reconWriteFailed'", mExpF && mExpF.lastError==="reconWriteFailed");
  ok("expenses lastServerSuccessAt did NOT advance", mExpF.lastServerSuccessAt===beforeSrv);
  const afterSync = await Eb.evaluate(()=>{ try{ return (JSON.parse(localStorage.getItem("h2do-expenses-syncmeta"))||{}).lastSyncAt||0; }catch(e){ return 0; } });
  ok("expenses visible lastSyncAt did NOT advance", afterSync===beforeSync);
  const sum4b = await Eb.evaluate(()=> window.__mfkrSync.summary());
  ok("global summary is NOT 'ok' after expenses reconcile failure", sum4b.state!=="ok");
  writeFailPath = null;
  await Eb.close();

  console.log("5. JOIN under overlap (blocker 1): newer data applied, one physical read, no stuck 'syncing'");
  // fresh remote day OLDER; we will bump it to NEWER right before the overlapping runs
  store[dayKey] = JSON.stringify({date:today(), prayers:[false,false,false,false,false], worship:{}, water:0, tasks:[], priorities:[], updatedAt:1000});
  const F = await device(b); await F.goto(fileUrl); await F.waitForTimeout(700); await verifyFake(F,"5");
  await F.waitForFunction(()=> !window.__mfkrSync.inFlight("daily"), null, {timeout:5000}).catch(()=>{});
  // newer data on server; delay the daily read so run B overlaps run A
  store[dayKey] = JSON.stringify({date:today(), prayers:[true,false,false,false,false], worship:{}, water:0, tasks:[], priorities:[], updatedAt:9e14});
  readCount[dayKey] = 0;
  readDelayPath = "/days/"; readDelayMs = 500;
  const joinRes = await F.evaluate(()=>{
    const rA = window.__mfkrSync.pullAll("A-owner", {});     // owns the slow real read
    return new Promise((resolve)=> setTimeout(()=>{
      const rB = window.__mfkrSync.pullAll("B-newer", {});   // starts while A in flight → joins A's daily promise
      Promise.all([rA, rB]).then(([a,bb])=> resolve({
        aDaily:(a.results||[]).find(r=>r&&r.module==="daily"),
        bDaily:(bb.results||[]).find(r=>r&&r.module==="daily"),
        bLatest: bb.isLatest()
      }));
    }, 80));
  });
  readDelayPath = null; readDelayMs = 0;
  await F.waitForTimeout(150);
  const ls = await F.evaluate((tk)=> JSON.parse(localStorage.getItem("h2do-tracker:"+tk)), today());
  ok("newer server data reached local state (prayers[0]=true)", ls && ls.prayers && ls.prayers[0]===true);
  const domChecked = await F.evaluate(()=> !!document.querySelector('#prayers .prayer.done'));
  ok("rendered UI reflects the newer data (a prayer shows done)", domChecked);
  ok("exactly one physical read for daily despite two overlapping runs", (readCount[dayKey]||0)===1);
  const st5 = await F.evaluate(()=> window.__mfkrSync.state());
  const allIdle = Object.keys(st5).every(k=> st5[k].inFlight===false);
  ok("all module inFlight flags are false after join settles", allIdle);
  const sum5 = await F.evaluate(()=> window.__mfkrSync.summary());
  ok("global status is NOT left on 'syncing'", sum5.state!=="syncing");
  ok("newer joined run reports valid daily result (not throttled)", joinRes.bDaily && joinRes.bDaily.status!=="throttled");
  await F.close();

  console.log("5b. JOIN generalises to a meta-doc module (Quran) — one physical read under overlap");
  store["users/U1/meta/quran"] = JSON.stringify({page:10,target:5,dayAnchor:today(),startPage:10,updatedAt:5});
  const qk = "users/U1/meta/quran";
  const G = await device(b); await G.goto(fileUrl); await G.waitForTimeout(700); await verifyFake(G,"5b");
  await G.waitForFunction(()=> !window.__mfkrSync.inFlight("quran"), null, {timeout:5000}).catch(()=>{});
  store[qk] = JSON.stringify({page:222,target:5,dayAnchor:today(),startPage:222,updatedAt:9e14});
  readCount[qk] = 0;
  readDelayPath = "meta/quran"; readDelayMs = 500;
  await G.evaluate(()=>{ const rA=window.__mfkrSync.pullAll("qA",{}); return new Promise(res=> setTimeout(()=>{ const rB=window.__mfkrSync.pullAll("qB",{}); Promise.all([rA,rB]).then(()=>res()); }, 80)); });
  readDelayPath = null; readDelayMs = 0;
  const qLocal = await G.evaluate(()=> JSON.parse(localStorage.getItem("h2do-quran")));
  ok("newer quran data reached local state (page=222)", qLocal && qLocal.page===222);
  ok("exactly one physical read for quran despite two overlapping runs", (readCount[qk]||0)===1);
  await G.close();

  console.log("6. Run-generation authority — only the LATEST run writes visible status");
  const H = await device(b); await H.goto(fileUrl); await H.waitForTimeout(700); await verifyFake(H,"6");
  const genRes = await H.evaluate(()=>{
    const g0 = window.__mfkrSync.runGen();
    const rA = window.__mfkrSync.pullAll("A", {});   // gen g0+1
    const rB = window.__mfkrSync.pullAll("B", {});   // gen g0+2 (supersedes A)
    return Promise.all([rA, rB]).then(([a,bb])=>({ g0, aGen:a.gen, bGen:bb.gen, aLatest:a.isLatest(), bLatest:bb.isLatest() }));
  });
  ok("run generation increments per coordinator run", genRes.bGen>genRes.aGen && genRes.aGen>genRes.g0);
  ok("older run is NOT latest (its visible-status write is suppressed)", genRes.aLatest===false);
  ok("newest run IS latest (it refreshes visible status)", genRes.bLatest===true);
  await H.close();

  console.log("7. Production hardening — write-capable hook gated behind __MFKR_TEST__ (blocker 3)");
  const prodCtx = await b.newContext({viewport:{width:800,height:700}});
  const P = await prodCtx.newPage(); P.on("pageerror", e=> errs.push(e.message.split("\n")[0]));
  await blockFirebaseCDN(P);   // production-hook page is hermetic too
  await P.exposeBinding("__rGet",(s,path)=> (store[path]!=null?store[path]:null));
  await P.exposeBinding("__rSet",(s,path,json)=>{ store[path]=json; return false; });
  await P.exposeBinding("__rDel",(s,path)=>{ delete store[path]; return false; });
  await P.exposeBinding("__rColl",(s,path)=>[]);
  await P.exposeBinding("__rRead",(s,path,src)=>({reject:false,fromCache:false,delay:0}));
  await P.addInitScript(FAKE);   // NOTE: __MFKR_TEST__ NOT set → production hook
  await P.goto(fileUrl); await P.waitForTimeout(600);
  await verifyFake(P, "prod");
  const hook = await P.evaluate(()=>({
    hasSummary: typeof (window.__mfkrSync&&window.__mfkrSync.summary)==="function",
    hasState: typeof (window.__mfkrSync&&window.__mfkrSync.state)==="function",
    expPushT: typeof (window.__mfkrSync&&window.__mfkrSync.expPush),
    pullAllT: typeof (window.__mfkrSync&&window.__mfkrSync.pullAll),
    expPullT: typeof (window.__mfkrSync&&window.__mfkrSync.expPull)
  }));
  ok("production: read-only diagnostics still available (summary/state)", hook.hasSummary && hook.hasState);
  ok("production: write-capable expPush is NOT exposed", hook.expPushT==="undefined");
  ok("production: pullAll/expPull are NOT exposed", hook.pullAllT==="undefined" && hook.expPullT==="undefined");
  await prodCtx.close();

  console.log("\nRESULT: "+PASS+" passed, "+FAIL+" failed");
  console.log("PAGE JS ERRORS:", errs.length? [...new Set(errs)] : "none");
  await b.close();
  process.exit(FAIL>0 || errs.length>0 ? 1 : 0);
})();
