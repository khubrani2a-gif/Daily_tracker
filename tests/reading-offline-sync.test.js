/*
 * اختبار القراءة دون اتصال ثم إعادة الاتصال (Offline/Reconnect) — مفكرتي اليومية
 * ----------------------------------------------------------------------------
 * يغطّي: إنشاء تغيير محلي أثناء انقطاع الاتصال (يعمل فورًا، محليًا أولًا)، عدم وصول أي كتابة
 * إلى "الخادم" أثناء الانقطاع، ثم إعادة الاتصال وتصريف الكتابة المعلَّقة تلقائيًا (كما تفعل
 * دائمية Firestore الحقيقية enablePersistence — غير مُعطَّلة هنا ولا في أي مكان بالتطبيق)،
 * وتحقّق تقارب مرّة واحدة بالضبط بلا جلسة مكرّرة بعد المزامنة اللاحقة للاتصال.
 *
 * بديل Firestore أمين مختصّ بهذا الملف: يحاكي طابور الكتابة دون اتصال الحقيقي — set() تنجح فورًا
 * (تفاؤليًا، كما تفعل Firestore الحقيقية مع enablePersistence) لكن الكتابة الفعلية تبقى معلَّقة في
 * طرف Node حتى «إعادة الاتصال» فتُصرَّف. القراءات ذات source:"server" تُرفض أثناء الانقطاع فترجع للكاش.
 * يُستخدم أيضًا context.setOffline() الحقيقي لـ Playwright لمحاكاة navigator.onLine/أحداث
 * online/offline بصدق (خطّاف الصفحة عبر exposeBinding لا يتأثّر بذلك، فيبقى البديل يعمل أثناءه).
 *
 * التشغيل: node tests/reading-offline-sync.test.js
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

let PASS=0, FAIL=0;
const ok = (n,c)=>{ if(c){ PASS++; console.log("  ✓ "+n); } else { FAIL++; console.log("  ✗ FAIL: "+n); } };
const errs = [];

const store = {};
const writeCount = {};
let pendingWrites = [];   // كتابات معلَّقة أثناء الانقطاع (تُحاكي طابور Firestore الداخلي دون اتصال)
let offline = false;

const FAKE = `
window.firebase = (function(){
  const wait=(ms)=> ms? new Promise(r=>setTimeout(r,ms)) : Promise.resolve();
  const doc=(p,src)=> window.__rRead(p,src).then(ctl=> wait(ctl.delay).then(()=>{
    if(ctl.reject) throw new Error("sim "+src+" read fail "+p);
    return window.__rGet(p).then(j=>({ exists:j!=null, data:()=>(j!=null?JSON.parse(j):null), metadata:{fromCache:ctl.fromCache} }));
  }));
  const coll=(p,src)=> window.__rRead(p,src).then(ctl=> wait(ctl.delay).then(()=>{
    if(ctl.reject) throw new Error("sim "+src+" query fail "+p);
    return window.__rColl(p).then(arr=>({ forEach:(cb)=>(arr||[]).forEach(x=>cb({id:x.id,data:()=>x})), empty:!(arr&&arr.length), size:(arr?arr.length:0), metadata:{fromCache:ctl.fromCache} }));
  }));
  const mkRef=(p)=>({ collection:(c)=>mkColl(p+"/"+c),
    /* تفاؤلي كما في Firestore الحقيقية مع enablePersistence: set() ينجح فورًا حتى أثناء الانقطاع؛
       الكتابة الفعلية تُصرَّف داخليًا عند عودة الاتصال — لا يُميَّز هذا عن أي فشل حقيقي (صلاحيات مثلًا) */
    set:(o)=> window.__rSet(p, JSON.stringify(o)).then(()=>undefined),
    delete:()=> window.__rDel(p).then(()=>undefined),
    get:(opts)=> doc(p,(opts&&opts.source)||"default") });
  const mkColl=(p)=>({ doc:(d)=>mkRef(p+"/"+d),
    get:(opts)=> coll(p,(opts&&opts.source)||"default"),
    where:function(){ return { get:(opts)=> coll(p,(opts&&opts.source)||"default"), where:function(){return this;} }; } });
  const fs=function(){ return { settings:undefined, enablePersistence:()=>({catch:()=>{}}), collection:(c)=>mkColl(c) }; };
  fs.FieldValue = { serverTimestamp: function(){ return {__serverTimestamp:true}; } };
  fs.Timestamp = { fromMillis: function(ms){ return {__ts:true, ms:ms, toMillis:function(){ return ms; }}; } };
  const auth=function(){ return { onAuthStateChanged:(cb)=>{ setTimeout(()=>cb({uid:"U1",displayName:"T",email:"t@t"}),10); }, signOut:()=>Promise.resolve(), signInWithPopup:()=>Promise.resolve() }; };
  auth.GoogleAuthProvider=function(){};
  return { initializeApp:()=>({}), firestore:fs, auth:auth };
})();
window.firebase.__MFKR_FAKE__ = true;
`;

async function blockFirebaseCDN(page){ await page.route("https://www.gstatic.com/firebasejs/**", r=> r.abort()); }
async function verifyFake(page, label){ const active = await page.evaluate(()=> !!(window.firebase && window.firebase.__MFKR_FAKE__===true)); ok("fake Firebase authoritative after load ("+label+")", active); return active; }

async function device(b){
  const ctx = await b.newContext({viewport:{width:1000,height:900}});
  const p = await ctx.newPage();
  p.on("pageerror", e=> errs.push(e.message.split("\n")[0]));
  await blockFirebaseCDN(p);
  await p.exposeBinding("__rGet",(s,path)=> (store[path]!=null?store[path]:null));
  await p.exposeBinding("__rSet",(s,path,json)=>{
    /* دون اتصال: الكتابة تبقى معلَّقة (لا تصل "الخادم" فورًا) — تُصرَّف صراحةً عند إعادة الاتصال أدناه */
    if(offline){ pendingWrites.push({path, json}); return; }
    let obj = null; try{ obj = JSON.parse(json); }catch(e){}
    if(obj && obj.syncUpdatedAt && obj.syncUpdatedAt.__serverTimestamp===true){ obj.syncUpdatedAt = { __ts:true, ms: Date.now() }; json = JSON.stringify(obj); }
    store[path]=json; writeCount[path]=(writeCount[path]||0)+1;
  });
  await p.exposeBinding("__rDel",(s,path)=>{ if(offline){ pendingWrites.push({path, json:null}); return; } delete store[path]; });
  await p.exposeBinding("__rColl",(s,path)=>{ const out=[]; Object.keys(store).forEach(k=>{ if(k.indexOf(path+"/")===0){ try{ out.push(JSON.parse(store[k])); }catch(e){} } }); return out; });
  await p.exposeBinding("__rRead",(s,path,src)=>({ reject:(offline && src==="server"), fromCache:(src==="cache"), delay:0 }));
  await p.addInitScript(()=>{ window.__MFKR_TEST__ = true; });
  await p.addInitScript(FAKE);
  return p;
}

function flushPending(){
  pendingWrites.forEach(w=>{
    if(w.json===null){ delete store[w.path]; return; }
    let obj = null; try{ obj = JSON.parse(w.json); }catch(e){}
    if(obj && obj.syncUpdatedAt && obj.syncUpdatedAt.__serverTimestamp===true){ obj.syncUpdatedAt = { __ts:true, ms: Date.now() }; w.json = JSON.stringify(obj); }
    store[w.path] = w.json;
    writeCount[w.path] = (writeCount[w.path]||0) + 1;
  });
  const n = pendingWrites.length;
  pendingWrites = [];
  return n;
}

const sessColl = "users/U1/readingSessions";

function seedLocalItem(){
  const now = Date.now();
  return { "h2do-reading-items": JSON.stringify([{schemaVersion:1,id:"IT1",title:"كتاب دون اتصال",author:null,materialType:"book",progressUnit:"page",totalUnits:500,currentUnit:null,status:"active",startedAt:now,completedAt:null,createdAt:now,updatedAt:now,deletedAt:null}]),
    "h2do-reading-settings": JSON.stringify({schemaVersion:1,focusItemId:"IT1",dailyGoal:null,createdAt:now,updatedAt:now}) };
}

(async()=>{
  const b = await chromium.launch(process.env.PW_EXECUTABLE_PATH?{executablePath:process.env.PW_EXECUTABLE_PATH}:undefined);

  console.log("A. Offline: local Reading change works immediately, local-first, with zero pending server writes visible");
  const ctx = await b.newContext({viewport:{width:1000,height:900}});
  const p = await ctx.newPage();
  p.on("pageerror", e=> errs.push(e.message.split("\n")[0]));
  await blockFirebaseCDN(p);
  await p.exposeBinding("__rGet",(s,path)=> (store[path]!=null?store[path]:null));
  await p.exposeBinding("__rSet",(s,path,json)=>{
    if(offline){ pendingWrites.push({path, json}); return; }
    let obj = null; try{ obj = JSON.parse(json); }catch(e){}
    if(obj && obj.syncUpdatedAt && obj.syncUpdatedAt.__serverTimestamp===true){ obj.syncUpdatedAt = { __ts:true, ms: Date.now() }; json = JSON.stringify(obj); }
    store[path]=json; writeCount[path]=(writeCount[path]||0)+1;
  });
  await p.exposeBinding("__rDel",(s,path)=>{ if(offline){ pendingWrites.push({path, json:null}); return; } delete store[path]; });
  await p.exposeBinding("__rColl",(s,path)=>{ const out=[]; Object.keys(store).forEach(k=>{ if(k.indexOf(path+"/")===0){ try{ out.push(JSON.parse(store[k])); }catch(e){} } }); return out; });
  await p.exposeBinding("__rRead",(s,path,src)=>({ reject:(offline && src==="server"), fromCache:(src==="cache"), delay:0 }));
  await p.addInitScript(()=>{ window.__MFKR_TEST__ = true; });
  await p.addInitScript(FAKE);
  await p.addInitScript((seed)=>{ localStorage.clear(); Object.keys(seed).forEach(k=> localStorage.setItem(k, seed[k])); }, seedLocalItem());

  await p.goto(fileUrl); await p.waitForTimeout(700); await verifyFake(p, "A");
  // ننتظر أوّل مزامنة تلقائية عند الإقلاع (المخزن فارغ فهي بلا أثر)، ثم نقطع الاتصال فعليًا وعبر البديل معًا
  await p.waitForTimeout(300);
  offline = true;
  await ctx.setOffline(true);
  await p.waitForTimeout(150);
  ok("navigator.onLine reflects the real offline state", (await p.evaluate(()=> navigator.onLine)) === false);

  await p.click("#readingCard #rdQuickBtn"); await p.waitForSelector("#qlSave");
  await p.fill("#qlMins", "18");
  await p.click("#qlSave"); await p.waitForTimeout(300);
  let localSessions = await p.evaluate(()=> JSON.parse(localStorage.getItem("h2do-reading-sessions"))||[]);
  ok("offline: the session was created locally immediately (local-first, works without network)", localSessions.length===1 && !localSessions[0].deletedAt);
  const createdId = localSessions[0].id;
  const cacheWhileOffline = await p.evaluate(()=> JSON.parse(localStorage.getItem("h2do-reading-stats-cache"))||{});
  const todayKey = new Date().toISOString().slice(0,10);
  ok("offline: the local derived-stats cache already reflects the new session (no dependency on network)", cacheWhileOffline.byDate && cacheWhileOffline.byDate[todayKey] && cacheWhileOffline.byDate[todayKey].sessionCount===1);
  ok("offline: NOTHING reached the fake server yet (write queued, not lost, not silently duplicated)", Object.keys(store).filter(k=>k.indexOf(sessColl+"/")===0).length===0);
  ok("offline: exactly 1 write is pending (queued for flush on reconnect)", pendingWrites.length===1);

  console.log("B. Reconnect: pending write flushes naturally, a foreground sync converges exactly once (no duplicate session)");
  offline = false;
  await ctx.setOffline(false);
  const flushedCount = flushPending();
  ok("reconnect: the pending write flushed to the fake server (Firestore-style automatic flush, not app-level retry code)", flushedCount===1);
  ok("navigator.onLine reflects the real online state after reconnect", (await p.evaluate(()=> navigator.onLine)) === true);
  // محاكاة مزامنة مقدّمة عند العودة للاتصال (نفس ما يُشغّله مستمع window 'online' في التطبيق، عبر خطّاف الاختبار المباشر)
  const pullResult = await p.evaluate(()=> window.__mfkrSync.rdPull("online"));
  await p.waitForTimeout(250);
  ok("post-reconnect pull reports success (server)", pullResult && pullResult.status==="success");
  let sessionsAfterReconnect = await p.evaluate(()=> JSON.parse(localStorage.getItem("h2do-reading-sessions"))||[]);
  ok("EXACTLY ONE session locally after reconnect+sync — no duplicate created by the reconcile pull merging the just-flushed doc", sessionsAfterReconnect.filter(s=>!s.deletedAt).length===1);
  ok("it is the SAME session id created while offline (not a second one)", sessionsAfterReconnect[0].id===createdId);
  const serverDocsAfter = Object.keys(store).filter(k=>k.indexOf(sessColl+"/")===0);
  ok("EXACTLY ONE document exists on the fake server for that session (no duplicate remote doc)", serverDocsAfter.length===1);
  const cacheAfterReconnect = await p.evaluate(()=> JSON.parse(localStorage.getItem("h2do-reading-stats-cache"))||{});
  ok("derived stats cache still shows exactly 1 session today (not double-counted by the merge)", cacheAfterReconnect.byDate[todayKey].sessionCount===1);

  // مزامنة أخرى إضافية (كما يحدث عند تركيز النافذة مجدّدًا) يجب ألّا تُكرّر شيئًا كذلك
  await p.evaluate(()=> window.__mfkrSync.rdPull("focus"));
  await p.waitForTimeout(200);
  let sessionsAfterSecondPull = await p.evaluate(()=> JSON.parse(localStorage.getItem("h2do-reading-sessions"))||[]);
  ok("a further repeated foreground pull still shows exactly 1 session (idempotent convergence)", sessionsAfterSecondPull.filter(s=>!s.deletedAt).length===1);

  await p.close();
  await b.close();
  console.log("\nRESULT: "+PASS+" passed, "+FAIL+" failed");
  console.log("PAGE JS ERRORS:", errs.length? [...new Set(errs)] : "none");
  process.exit((FAIL>0 || errs.length>0) ? 1 : 0);
})().catch(e=>{ console.error("FATAL:", e); process.exit(1); });
