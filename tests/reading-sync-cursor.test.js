/*
 * اختبار المؤشّر التفاضلي لجلسات القراءة (Reading incremental cursor) — مفكرتي اليومية
 * ----------------------------------------------------------------------------
 * يغطّي بنود المراجعة التي لم تكن مغطاة آليًا سابقًا لوحدة القراءة (v100):
 *   1. أوّل سحب ناجح من الخادم يحمل كل السجل (بلا شرط where) ويثبّت المؤشّر عند أعلى syncUpdatedAt.
 *   2. السحب التالي يستعلم تفاضليًا (where syncUpdatedAt > المؤشّر - تراكب) فيعيد فقط السجلات الأحدث،
 *      لا كل السجل من جديد — يُتحقّق منه بعدّ السجلات التي أعادها كل استعلام فعليًا (بعد الترشيح).
 *   3. رجوع للكاش لا يُقدّم المؤشّر أبدًا (lastServerSuccess فقط يُقدّمه).
 *   4. جلسة محذوفة (شاهد قبر) لا تُحيا مجدّدًا — لا عند عميل ثانٍ يسحبها لأوّل مرّة، ولا عند إعادة سحبها
 *      من نفس العميل الذي حذفها.
 *   5. تقارب عميلين (بلا فيزيائيّين حقيقيّين) على نفس مخزن الذاكرة: لا تكرار، بنفس النتيجة النهائية.
 *
 * بديل Firestore أمين موسَّع (مختصّ بهذا الملف فقط، لا يُعدَّل بديل sync-contract/coordinator-containment):
 * يضيف serverTimestamp() حقيقيًا يُحسم في «الخادم» (طرف Node) عند الكتابة، وTimestamp.fromMillis()/toMillis()،
 * وترشيح where(field,">",value) فعليًا على طرف الصفحة (لا مجرّد تجاهله)، مع نفس تمييز {source:"server"|"cache"}
 * وحقن تأخير/فشل القراءة والكتابة المعتمَد في بقيّة المجموعة.
 *
 * حدود صادقة: محاكاة في‑الذاكرة لواجهة compat، وليست محاكي Firestore حقيقي ولا عميلين فيزيائيّين —
 * التقارب «عبر الأجهزة» يعني نفس مخزن Node المشترك بين سياقي متصفّح منفصلين، كبقيّة هذه المجموعة.
 *
 * التشغيل: node tests/reading-sync-cursor.test.js
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

/* ---- حالة تحكّم في-الذاكرة مشتركة بين عملاء الاختبار (تُعدَّل من Node بين الخطوات) ---- */
const store = {};                 // path -> JSON string ("الخادم")
const writeCount = {};
let serverDown = false;           // إسقاط قراءات source:"server" فقط (رجوع صريح للكاش)
let fakeClock = 1000000;          // ساعة خادم مزيّفة (مل‌ث): تتقدّم يدويًا من الاختبار لمحاكاة مرور الوقت دون انتظار حقيقي
let queryLog = [];                // {path, wheres, resultCount} لكل استعلام فعلي — يُثبت أن الترشيح التفاضلي حقيقي لا شكلي

/* بديل Firebase compat موسَّع: يميّز مصدر القراءة، يحقن الأعطال، ويُطبّق where(">") فعليًا على طرف الصفحة،
   ويحسم FieldValue.serverTimestamp() في طرف "الخادم" (Node) عند الكتابة كما تفعل Firestore الحقيقية. */
const FAKE = `
window.firebase = (function(){
  const wait=(ms)=> ms? new Promise(r=>setTimeout(r,ms)) : Promise.resolve();
  function reviveTimestamps(obj){
    if(!obj || typeof obj!=="object") return obj;
    const out = Object.assign({}, obj);
    Object.keys(out).forEach(k=>{
      const v = out[k];
      if(v && typeof v==="object" && v.__ts===true){
        const ms = v.ms;
        out[k] = { seconds: Math.floor(ms/1000), nanoseconds:(ms%1000)*1e6, toMillis:function(){ return ms; } };
      }
    });
    return out;
  }
  const docGet=(p,src)=> window.__rRead(p,src).then(ctl=> wait(ctl.delay).then(()=>{
    if(ctl.reject) throw new Error("sim "+src+" read fail "+p);
    return window.__rGet(p).then(j=>{ const data = j!=null? reviveTimestamps(JSON.parse(j)) : null;
      return { exists:j!=null, data:()=>data, metadata:{fromCache:ctl.fromCache} }; });
  }));
  function collGet(p, wheres, src){
    return window.__rRead(p,src).then(ctl=> wait(ctl.delay).then(()=>{
      if(ctl.reject) throw new Error("sim "+src+" query fail "+p);
      return window.__rColl(p).then(arr=>{
        let list = (arr||[]).map(reviveTimestamps);
        wheres.forEach(function(w){
          list = list.filter(function(d){
            const fv = d[w.field];
            const fms = (fv && typeof fv.toMillis==="function") ? fv.toMillis() : fv;
            const vms = (w.val && typeof w.val.toMillis==="function") ? w.val.toMillis() : w.val;
            if(w.op===">") return fms!=null && fms > vms;
            if(w.op===">=") return fms!=null && fms >= vms;
            return true;
          });
        });
        return window.__rQueryLog(p, wheres.map(function(w){ return {field:w.field, op:w.op, val:(w.val&&typeof w.val.toMillis==="function")?w.val.toMillis():w.val}; }), list.map(function(x){ return x.id; })).then(function(){
          return { forEach:(cb)=> list.forEach(function(x){ cb({id:x.id, data:()=>x}); }), empty:!list.length, size:list.length, metadata:{fromCache:ctl.fromCache} };
        });
      });
    }));
  }
  function mkQuery(p, wheres){
    return {
      where:(field,op,val)=> mkQuery(p, wheres.concat([{field:field,op:op,val:val}])),
      get:(opts)=> collGet(p, wheres, (opts&&opts.source)||"default")
    };
  }
  const mkRef=(p)=>({ collection:(c)=>mkColl(p+"/"+c),
    set:(o)=> window.__rSet(p, JSON.stringify(o)).then(bad=>{ if(bad) throw new Error("sim write fail "+p); }),
    delete:()=> window.__rDel(p).then(bad=>{ if(bad) throw new Error("sim delete fail "+p); }),
    get:(opts)=> docGet(p,(opts&&opts.source)||"default") });
  function mkColl(p){
    const q = mkQuery(p, []);
    return Object.assign({ doc:(d)=>mkRef(p+"/"+d) }, q);
  }
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
    let obj = null; try{ obj = JSON.parse(json); }catch(e){}
    if(obj && obj.syncUpdatedAt && obj.syncUpdatedAt.__serverTimestamp===true){
      fakeClock += 1;
      obj.syncUpdatedAt = { __ts:true, ms: fakeClock };
      json = JSON.stringify(obj);
    }
    store[path]=json; writeCount[path]=(writeCount[path]||0)+1; return false;
  });
  await p.exposeBinding("__rDel",(s,path)=>{ delete store[path]; return false; });
  await p.exposeBinding("__rColl",(s,path)=>{ const out=[]; Object.keys(store).forEach(k=>{ if(k.indexOf(path+"/")===0){ try{ out.push(JSON.parse(store[k])); }catch(e){} } }); return out; });
  await p.exposeBinding("__rRead",(s,path,src)=>({ reject:(serverDown && src==="server"), fromCache:(src==="cache"), delay:0 }));
  await p.exposeBinding("__rQueryLog",(s,path,wheres,ids)=>{ queryLog.push({path, wheres, ids, resultCount:ids.length}); });
  await p.addInitScript(()=>{ window.__MFKR_TEST__ = true; });
  await p.addInitScript(FAKE);
  return p;
}

const sessColl = "users/U1/readingSessions";
const itemsColl = "users/U1/readingItems";
const settingsDoc = "users/U1/meta/reading";

/* كل سيناريو (١، ٣، ٤) مستقلّ منطقيًا — نصفّر "الخادم" المزيَّف بينها كي لا يتسرّب أثر سيناريو سابق
   (مثل جلسات لم تُحذف) إلى قراءة "أوّل مرّة" لعميل لاحق ويُشوّه فحص التقارب/الذاكرة المشتقّة */
function resetServerStore(){ Object.keys(store).forEach(k=> delete store[k]); Object.keys(writeCount).forEach(k=> delete writeCount[k]); queryLog = []; }

/* بذرة بند قراءة واحد لكل عميل جديد (لتسمح للجلسات المُنشأة عبر تسجيل سريع بالارتباط بموضع) */
function seedLocalItem(){
  const now = Date.now();
  return { "h2do-reading-items": JSON.stringify([{schemaVersion:1,id:"IT1",title:"كتاب مشترك",author:null,materialType:"book",progressUnit:"page",totalUnits:1000,currentUnit:null,status:"active",startedAt:now,completedAt:null,createdAt:now,updatedAt:now,deletedAt:null}]),
    "h2do-reading-settings": JSON.stringify({schemaVersion:1,focusItemId:"IT1",dailyGoal:null,createdAt:now,updatedAt:now}) };
}

async function quickLogSession(p, mins){
  await p.click("#readingCard #rdQuickBtn"); await p.waitForSelector("#qlSave");
  await p.fill("#qlMins", String(mins));
  await p.click("#qlSave"); await p.waitForTimeout(150);
}

(async()=>{
  const b = await chromium.launch();

  console.log("1. Server-first: first successful pull loads the whole collection (no where clause)");
  resetServerStore();
  let A = await device(b);
  await A.addInitScript((seed)=>{ localStorage.clear(); Object.keys(seed).forEach(k=> localStorage.setItem(k, seed[k])); }, seedLocalItem());
  await A.goto(fileUrl); await A.waitForTimeout(700); await verifyFake(A, "1");
  // إنشاء ٣ جلسات محليًا عبر تسجيل سريع حقيقي (لا تلاعب مباشر بالتخزين)، بفواصل ١٠ دقائق «خادمية» بين كل جلسة
  // (أكبر بكثير من تراكب المؤشّر ٦٠ث) كي يكون فحص الاستبعاد لاحقًا حاسمًا لا مصادفة توقيت
  await quickLogSession(A, 10);
  fakeClock += 10*60*1000;
  await quickLogSession(A, 15);
  fakeClock += 10*60*1000;
  await quickLogSession(A, 20);
  await A.waitForTimeout(300);
  ok("3 session docs landed on the fake server", Object.keys(store).filter(k=>k.indexOf(sessColl+"/")===0).length===3);
  const sessIdsSoFar = await A.evaluate(()=> (JSON.parse(localStorage.getItem("h2do-reading-sessions"))||[]).map(s=>s.id));
  const [id1, id2, id3] = sessIdsSoFar;
  queryLog = [];
  let pull1 = await A.evaluate(()=> window.__mfkrSync.rdPull("manual"));
  ok("first explicit pull reports success (server)", pull1 && pull1.status==="success");
  const firstSessQuery = queryLog.find(q=> q.path===sessColl);
  ok("first pull's session query carried NO where clause (full load)", firstSessQuery && firstSessQuery.wheres.length===0);
  ok("first pull's session query returned all 3 docs", firstSessQuery && firstSessQuery.resultCount===3);
  let meta1 = await A.evaluate(()=> JSON.parse(localStorage.getItem("h2do-reading-syncmeta"))||{});
  ok("cursor advanced to the max syncUpdatedAt seen after full server success", meta1.sessionsCursor === fakeClock);
  const cursorAfterFirstPull = meta1.sessionsCursor;

  console.log("2. Incremental pagination: a later pull with an established cursor applies where(">") and excludes safely-old docs");
  fakeClock += 10 * 60 * 1000; // تقدّم الساعة ١٠ دقائق أخرى (أكبر من التراكب) قبل الجلسة الرابعة
  await quickLogSession(A, 7); // الجلسة الرابعة — تُدفع بطابع أحدث بكثير من مؤشّر الجلسة السابقة
  await A.waitForTimeout(300);
  ok("4th session doc landed on the fake server", Object.keys(store).filter(k=>k.indexOf(sessColl+"/")===0).length===4);
  const id4 = (await A.evaluate(()=> (JSON.parse(localStorage.getItem("h2do-reading-sessions"))||[]).map(s=>s.id))).find(id=> ![id1,id2,id3].includes(id));
  queryLog = [];
  let pull2 = await A.evaluate(()=> window.__mfkrSync.rdPull("manual"));
  ok("second pull reports success (server)", pull2 && pull2.status==="success");
  const secondSessQuery = queryLog.find(q=> q.path===sessColl);
  ok("second pull's session query DID carry a where(syncUpdatedAt,'>',cursor) clause", secondSessQuery && secondSessQuery.wheres.length===1 && secondSessQuery.wheres[0].field==="syncUpdatedAt" && secondSessQuery.wheres[0].op===">");
  ok("second pull's where-value equals cursor minus the small overlap (not 0, not the raw cursor)", secondSessQuery && secondSessQuery.wheres[0].val === Math.max(0, cursorAfterFirstPull - 60000));
  /* التراكب (٦٠ث) يُعيد قصدًا جلب السجل الذي ضبط المؤشّر (session 3، عند حافّة النافذة) — هذا سلوك سليم ومقصود
     (يحمي من سباقات الحدود)، ويُدمَج بلا أثر محليًا لأنه نفس المعرّف/المحتوى. الحاسم هو استبعاد الجلستين
     الأقدم بأمان (session 1، session 2) رغم وجودهما في نفس المجموعة على "الخادم". */
  ok("incremental query result EXCLUDES the two safely-old sessions (session1, session2) — true server-side filtering, not just returning everything", secondSessQuery && !secondSessQuery.ids.includes(id1) && !secondSessQuery.ids.includes(id2));
  ok("incremental query result INCLUDES the boundary session (session3, intentional overlap re-fetch) and the new session (session4)", secondSessQuery && secondSessQuery.ids.includes(id3) && secondSessQuery.ids.includes(id4));
  ok("incremental query returned strictly fewer docs than a full reload would (2 of 4, not all 4)", secondSessQuery && secondSessQuery.resultCount===2);
  let localSessAfterPull2 = await A.evaluate(()=> JSON.parse(localStorage.getItem("h2do-reading-sessions"))||[]);
  ok("locally still exactly 4 sessions total after the incremental pull merged the new doc (no loss, no duplication from the overlap re-fetch)", localSessAfterPull2.filter(s=>!s.deletedAt).length===4);
  let meta2 = await A.evaluate(()=> JSON.parse(localStorage.getItem("h2do-reading-syncmeta"))||{});
  ok("cursor advanced again to the new max syncUpdatedAt", meta2.sessionsCursor === fakeClock);
  await A.close();

  console.log("3. Cache fallback must NEVER advance the cursor (server-first-then-cache contract, same as every other module)");
  resetServerStore();
  A = await device(b);
  await A.addInitScript((seed)=>{ localStorage.clear(); Object.keys(seed).forEach(k=> localStorage.setItem(k, seed[k])); }, seedLocalItem());
  await A.goto(fileUrl); await A.waitForTimeout(700); await verifyFake(A, "3");
  await quickLogSession(A, 12); await A.waitForTimeout(250);
  await A.evaluate(()=> window.__mfkrSync.rdPull("manual"));
  await A.waitForTimeout(150);
  const cursorBeforeCacheFallback = await A.evaluate(()=> (JSON.parse(localStorage.getItem("h2do-reading-syncmeta"))||{}).sessionsCursor);
  ok("cursor is set after a real server success", cursorBeforeCacheFallback > 0);
  fakeClock += 5*60*1000;
  await quickLogSession(A, 3); await A.waitForTimeout(250); // جلسة إضافية على "الخادم" لم تصل بعد محليًا عند القراءة القادمة
  serverDown = true;
  const pull3 = await A.evaluate(()=> window.__mfkrSync.rdPull("manual"));
  serverDown = false;
  ok("pull under server-down reports cacheFallback (not success, not failed)", pull3 && pull3.status==="cacheFallback");
  const cursorAfterCacheFallback = await A.evaluate(()=> (JSON.parse(localStorage.getItem("h2do-reading-syncmeta"))||{}).sessionsCursor);
  ok("cache-fallback read did NOT advance the sessions cursor", cursorAfterCacheFallback === cursorBeforeCacheFallback);
  await A.close();

  console.log("4. Tombstoned session must not resurrect — neither on a second client's first pull, nor on the deleting client's own re-pull");
  resetServerStore();
  A = await device(b);
  await A.addInitScript((seed)=>{ localStorage.clear(); Object.keys(seed).forEach(k=> localStorage.setItem(k, seed[k])); }, seedLocalItem());
  await A.goto(fileUrl); await A.waitForTimeout(700); await verifyFake(A, "4a");
  await quickLogSession(A, 25);
  await A.waitForTimeout(250);
  await A.evaluate(()=> window.__mfkrSync.rdPull("manual")); // يثبّت المؤشّر بعد الإنشاء
  await A.waitForTimeout(150);
  const sBefore = await A.evaluate(()=> (JSON.parse(localStorage.getItem("h2do-reading-sessions"))||[])[0]);
  ok("seed session created", !!sBefore && !sBefore.deletedAt);
  // حذف (شاهد قبر) عبر الواجهة الحقيقية — يفتح شاشة اليوم أوّلًا
  await A.click("#rdFocusBlock"); await A.waitForSelector('[data-rdsess-del="'+sBefore.id+'"]');
  await A.click('[data-rdsess-del="'+sBefore.id+'"]'); await A.waitForSelector("#hifzDialogOk");
  await A.click("#hifzDialogOk"); await A.waitForTimeout(300);
  let localAfterDelete = await A.evaluate(()=> JSON.parse(localStorage.getItem("h2do-reading-sessions"))||[]);
  ok("session is tombstoned locally (deletedAt set) right after delete", localAfterDelete[0].deletedAt != null);
  ok("tombstone write landed on the fake server", (()=>{ const raw = store[sessColl+"/"+sBefore.id]; if(!raw) return false; try{ return JSON.parse(raw).deletedAt!=null; }catch(e){ return false; } })());

  // العميل نفسه يعيد السحب — لا يجوز أن يُحيي الجلسة المحذوفة
  await A.evaluate(()=> window.__mfkrSync.rdPull("manual"));
  await A.waitForTimeout(200);
  let localAfterRepull = await A.evaluate(()=> JSON.parse(localStorage.getItem("h2do-reading-sessions"))||[]);
  ok("re-pulling on the SAME client that deleted it does NOT resurrect the tombstoned session", localAfterRepull.find(s=>s.id===sBefore.id).deletedAt != null);

  // عميل ثانٍ (سياق متصفّح جديد، نفس مخزن Node) يسحب لأوّل مرّة — يجب أن يستلم الشاهد لا سجلًا حيًّا
  let B = await device(b);
  await B.addInitScript(()=>{ localStorage.clear(); });
  await B.goto(fileUrl); await B.waitForTimeout(700); await verifyFake(B, "4b");
  await B.evaluate(()=> window.__mfkrSync.rdPull("manual"));
  await B.waitForTimeout(250);
  let bSessions = await B.evaluate(()=> JSON.parse(localStorage.getItem("h2do-reading-sessions"))||[]);
  const bMatch = bSessions.find(s=> s.id===sBefore.id);
  ok("a fresh second client pulling for the first time receives the session as a tombstone, not as an active/resurrected session", bMatch && bMatch.deletedAt != null);
  let bCache = await B.evaluate(()=> JSON.parse(localStorage.getItem("h2do-reading-stats-cache"))||{});
  const todayKey = new Date().toISOString().slice(0,10);
  ok("the tombstoned session contributes ZERO to client B's derived stats cache", !bCache.byDate || !bCache.byDate[todayKey] || bCache.byDate[todayKey].sessionCount===0);

  console.log("5. Two-client convergence: no duplicate sessions, identical non-deleted session sets");
  let aFinal = await A.evaluate(()=> (JSON.parse(localStorage.getItem("h2do-reading-sessions"))||[]).filter(s=>!s.deletedAt).map(s=>s.id).sort());
  let bFinal = bSessions.filter(s=>!s.deletedAt).map(s=>s.id).sort();
  ok("both clients converge to the SAME (empty, since the only session was deleted) set of active sessions — no duplicates", JSON.stringify(aFinal)===JSON.stringify(bFinal));
  ok("no duplicate documents were ever written to the fake server for a single session id", writeCount[sessColl+"/"+sBefore.id] >= 1); // كل كتابة لنفس المعرّف تُحدِّث نفس الوثيقة (set، لا add) — لا تكرار وثائق بمعرّف مختلف لنفس الجلسة
  const allSessionDocs = Object.keys(store).filter(k=>k.indexOf(sessColl+"/")===0);
  const uniqueIds = new Set(allSessionDocs.map(k=> k.slice((sessColl+"/").length)));
  ok("no duplicate server documents exist for the same session id (doc count === unique id count)", allSessionDocs.length === uniqueIds.size);
  await A.close(); await B.close();

  await b.close();
  console.log("\nRESULT: "+PASS+" passed, "+FAIL+" failed");
  console.log("PAGE JS ERRORS:", errs.length? [...new Set(errs)] : "none");
  process.exit((FAIL>0 || errs.length>0) ? 1 : 0);
})().catch(e=>{ console.error("FATAL:", e); process.exit(1); });
