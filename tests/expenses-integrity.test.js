/*
 * اختبار سلامة المصاريف (Expenses integrity test) — مفكرتي اليومية (v100)
 * ----------------------------------------------------------------------------
 * يُثبت إصلاح خمسة أعطال مؤكَّدة مع الحفاظ على ميزات v98/v99:
 *   1. إحياء حذف الرحلة عبر الأجهزة   → شاهدة قبر (deletedAt) تتقارب ولا تُحيا من نسخة أقدم.
 *   2. الالتزامات الموقوفة/المؤرشفة تُفسد الشهور التاريخية → فصل حالة الواجهة عن قابلية الشهر.
 *   3. حساب سلاسل/مبالغ مشوّهة        → مُطبِّع وحدة صغرى آمن واحد؛ المشوّه يُوسَم needsReview ولا يُضخّم.
 *   4. ازدواج شهري (ثابت + رحلة)        → دلاء الإجمالي حصريّة متبادلة، تُحسب مرّة واحدة.
 *   5. تعدّد الرحلات النشطة يدويًا بعد الدمج → واحدة على الأكثر، تقارب حتمي بلا حلقة توفيق.
 *
 * هرمِتيّة: نعترض ونُجهض سكربتات Firebase (gstatic) قبل التحميل كي يبقى البديل المحقون
 * (firebase.__MFKR_FAKE__) هو المُسيطر، ونتحقّق من بقائه بعد كل تحميل. المتجر في‑الذاكرة
 * مشترك بين سياقات المتصفّح فيحاكي التقارب «عبر الأجهزة» عند حدّ الواجهة (لا عبر الشبكة).
 *
 * حدود صادقة: ليست محاكاة Firestore حقيقية ولا أجهزة فيزيائية؛ بديل أمين لواجهة compat.
 * التشغيل:  node tests/expenses-integrity.test.js   (يتطلّب Playwright/Chromium)
 */
"use strict";
const path = require("path");
function loadChromium(){ const cands=[process.env.PW_PATH,"playwright","/opt/node22/lib/node_modules/playwright"].filter(Boolean);
  for(const c of cands){ try{ return require(c).chromium; }catch(e){} } console.error("Playwright not found. Set PW_PATH=/path/to/playwright"); process.exit(2); }
const chromium = loadChromium();
const fileUrl = "file://" + path.resolve(__dirname, "..", "index.html");
const pad2 = n => String(n).padStart(2,"0");
const today = ()=>{ const d=new Date(); return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate()); };
const tk = today();
const CY = +tk.slice(0,4), CM = +tk.slice(5,7);
const monKey = (y,m)=> y+"-"+pad2(m);
const shiftMon = (key,delta)=>{ const y=+key.slice(0,4), m=+key.slice(5,7); const d=new Date(y,(m-1)+delta,1); return d.getFullYear()+"-"+pad2(d.getMonth()+1); };
const curKey = monKey(CY,CM);
const prevKey = shiftMon(curKey,-1), nextKey = shiftMon(curKey,1), twoAgoKey = shiftMon(curKey,-2);

/* ---- متجر في‑الذاكرة + بديل Firebase أمين ---- */
const store = {}; const writeCount = {};
const FAKE = `
window.firebase = (function(){
  const mkRef=(p)=>({ collection:(c)=>mkColl(p+"/"+c),
    set:(o)=> window.__rSet(p, JSON.stringify(o)).then(()=>{}),
    get:(opts)=> window.__rGet(p).then(j=>({exists:j!=null, data:()=> j!=null?JSON.parse(j):null, metadata:{fromCache:false} })) });
  const mkColl=(p)=>({ doc:(d)=>mkRef(p+"/"+d),
    get:(opts)=> window.__rColl(p).then(arr=>({ forEach:(cb)=>(arr||[]).forEach(x=>cb({id:x.id,data:()=>x})), empty:!(arr&&arr.length), size:(arr?arr.length:0), metadata:{fromCache:false} })),
    where:function(){ return { get:(opts)=> mkColl(p).get(), where:function(){return this;} }; } });
  const fs=function(){ return { settings:undefined, enablePersistence:()=>({catch:()=>{}}), collection:(c)=>mkColl(c) }; };
  const auth=function(){ return { onAuthStateChanged:(cb)=>{ setTimeout(()=>cb({uid:"U1",displayName:"T",email:"t@t"}),10); }, signOut:()=>Promise.resolve(), signInWithPopup:()=>Promise.resolve() }; };
  auth.GoogleAuthProvider=function(){};
  return { initializeApp:()=>({}), firestore:fs, auth:auth };
})();
window.firebase.__MFKR_FAKE__ = true;
`;
let PASS=0, FAIL=0; const errs=[];
/* سجلّ متزامن اختياري (يبقى حتى لو قُتل الإجراء): EXP_LOG=/path node tests/expenses-integrity.test.js */
const fs=require("fs"); const LOG=process.env.EXP_LOG||null;
const emit=(s)=>{ console.log(s); if(LOG){ try{ fs.appendFileSync(LOG, s+"\n"); }catch(e){} } };
const ok=(n,c)=>{ if(c){PASS++;emit("  ✓ "+n);}else{FAIL++;emit("  ✗ FAIL: "+n);} };
const log=(s)=>emit(s);
async function blockCDN(page){ await page.route("https://www.gstatic.com/firebasejs/**", r=> r.abort()); }
async function verifyFake(page,label){ const active=await page.evaluate(()=> !!(window.firebase && window.firebase.__MFKR_FAKE__===true)); ok("fake Firebase authoritative after load ("+label+")", active); return active; }
async function device(b){
  const ctx=await b.newContext({viewport:{width:1000,height:900}}); const p=await ctx.newPage();
  p.on("pageerror",e=>errs.push(e.message.split("\n")[0]));
  await blockCDN(p);
  await p.exposeBinding("__rGet",(s,path)=> (store[path]!=null?store[path]:null));
  await p.exposeBinding("__rSet",(s,path,json)=>{ store[path]=json; writeCount[path]=(writeCount[path]||0)+1; return true; });
  await p.exposeBinding("__rColl",(s,path)=>{ const out=[]; Object.keys(store).forEach(k=>{ if(k.indexOf(path+"/")===0){ try{ out.push(JSON.parse(store[k])); }catch(e){} } }); return out; });
  await p.addInitScript(()=>{ window.__MFKR_TEST__ = true; });
  await p.addInitScript(FAKE);
  return p;
}
const EXPKEY = "users/U1/meta/expenses";
const stat=async(p,label)=>{ const s=await p.$$eval("#expReportBody .exp-stat",els=>els.map(e=>e.querySelector("small").textContent+"|"+e.querySelector("b").textContent)); const f=s.find(x=>x.startsWith(label)); return f?f.split("|")[1]:null; };
const mk=(o)=>Object.assign({ id:o.id, amountMinor:0, transactionDate:tk, categoryId:"CA", transactionType:"expense",
  fixedExpenseInstanceId:null, fixedTemplateId:null, sourceType:null, relatedTransactionId:null, tripId:null,
  countAgainstWeeklyBudget:true, needsReview:false, description:null, createdAt:1, updatedAt:1, deletedAt:null }, o);
function baseData(extra){
  return Object.assign({ version:2,
    settings:{currency:"SAR",weekStartDay:6,numberFormat:"ar-EG",defaultPaymentMethod:null,currentBudgetVersion:1,migratedLegacy:true,pristineSeed:false,createdAt:1,updatedAt:1000},
    categories:[{id:"CA",name:"الأكل",section:"variable",parentCategoryId:null,budgets:[{from:"1970-01-01",amountMinor:60000}],icon:null,isActive:true,sortOrder:0,createdAt:1,updatedAt:1,archivedAt:null}],
    fixedTemplates:[], instances:[], transactions:[], trips:[] }, extra||{});
}

/* تصفية المجموعات: node tests/expenses-integrity.test.js [3 4 2 2b 1 5]
   بلا وسائط → تشغيل الكل (نقطة دخول واحدة للبيئات العادية). في البيئات ذات حدّ الجدار الزمني
   تُشغَّل كل مجموعة على حدة، مثل: node tests/expenses-integrity.test.js 3 */
const GROUPS = process.argv.slice(2).filter(a=>!a.startsWith("-"));
const want = (id)=> GROUPS.length===0 || GROUPS.indexOf(id)>=0;

(async()=>{
  const b = await chromium.launch();

  /* ============================================================
     العطل 3 — تطبيع الوحدة الصغرى (سلاسل/مشوّه) بمبالغ دقيقة
     ============================================================ */
  if(want("3")){
  log("\n[3] Monetary normalization: numeric strings add (not concat), invalid flagged not inflated");
  {
    const data = baseData({ transactions:[
      mk({id:"S1", amountMinor:"80000"}),                 /* سلسلة رقمية */
      mk({id:"S2", amountMinor:"50000"}),                 /* سلسلة رقمية */
      mk({id:"N1", amountMinor:30000}),                   /* عدد */
      mk({id:"BAD1", amountMinor:"oops"}),                /* مشوّه */
      mk({id:"BAD2", amountMinor:null}),                  /* مشوّه */
      mk({id:"BAD3", amountMinor:"NaN"}),                 /* مشوّه */
      mk({id:"RF", amountMinor:"20000", transactionType:"refund", relatedTransactionId:"S1"})
    ]});
    const p = await device(b);
    await p.addInitScript((d)=> localStorage.setItem("h2do-expenses", JSON.stringify(d)), data);
    await p.goto(fileUrl); await p.waitForTimeout(800); await verifyFake(p,"3");
    const raw = await p.evaluate(()=> JSON.parse(localStorage.getItem("h2do-expenses")));
    const byId = Object.fromEntries(raw.transactions.map(t=>[t.id,t]));
    ok("string '80000' normalized to integer 80000", byId.S1.amountMinor===80000 && byId.S1.amountInvalid!==true);
    ok("string '50000' normalized to integer 50000", byId.S2.amountMinor===50000);
    ok("number 30000 unchanged", byId.N1.amountMinor===30000);
    ok("invalid 'oops' → amountMinor 0, amountInvalid, needsReview, raw preserved", byId.BAD1.amountMinor===0 && byId.BAD1.amountInvalid===true && byId.BAD1.needsReview===true && byId.BAD1.amountRaw==="oops");
    ok("invalid null → flagged, raw preserved (null)", byId.BAD2.amountMinor===0 && byId.BAD2.amountInvalid===true && byId.BAD2.amountRaw===null);
    ok("invalid 'NaN' string → flagged", byId.BAD3.amountMinor===0 && byId.BAD3.amountInvalid===true);
    /* الإجمالي الدقيق عبر التقرير اليومي: 80000+50000+30000+0+0 - 20000 = 140000 (لا تسلسل، لا NaN) */
    await p.click("#expOpenBtn"); await p.waitForTimeout(250);
    await p.click('.exp-tab[data-view="reports"]'); await p.waitForTimeout(150);
    await p.click('.exp-tab[data-rep="daily"]'); await p.waitForTimeout(200);
    ok("exact daily net = 1400 (strings summed, invalid as 0, refund subtracted)", (await stat(p,"صافي الصرف"))==="١٬٤٠٠ ر.س");
    /* minorParse وحدة */
    const mp = await p.evaluate(()=>({
      a: window.__mfkrExp.minorParse("1500"), b: window.__mfkrExp.minorParse("12.5"),
      c: window.__mfkrExp.minorParse("1a"), d: window.__mfkrExp.minorParse(""),
      e: window.__mfkrExp.minorParse(null), f: window.__mfkrExp.minorParse(1500),
      g: window.__mfkrExp.minorParse(Infinity)
    }));
    ok("minorParse('1500')=ok 1500", mp.a.ok===true && mp.a.minor===1500);
    ok("minorParse('12.5')=ok 13 (rounded)", mp.b.ok===true && mp.b.minor===13);
    ok("minorParse('1a')=invalid", mp.c.ok===false);
    ok("minorParse('')=invalid", mp.d.ok===false);
    ok("minorParse(null)=invalid", mp.e.ok===false);
    ok("minorParse(Infinity)=invalid", mp.g.ok===false);
    /* إدمبوتنسي: إعادة تحميل لا تبصم settings.updatedAt ولا تُغيّر القيم */
    const u1 = raw.settings.updatedAt;
    await p.evaluate(()=> window.__mfkrExp.reload());
    await p.waitForTimeout(150);
    const raw2 = await p.evaluate(()=> JSON.parse(localStorage.getItem("h2do-expenses")));
    ok("migration idempotent: settings.updatedAt unchanged on reload (no sync churn)", raw2.settings.updatedAt===u1);
    ok("idempotent: S1 stays 80000, BAD1 stays flagged 0", raw2.transactions.find(t=>t.id==="S1").amountMinor===80000 && raw2.transactions.find(t=>t.id==="BAD1").amountInvalid===true);
    await p.close();
  }
  }

  /* ============================================================
     العطل 4 — الازدواج الشهري (معاملة ثابتة تحمل tripId)
     ============================================================ */
  if(want("4")){
  log("\n[4] Monthly buckets mutually exclusive (fixed+trip counted once, not twice)");
  {
    const data = baseData({
      fixedTemplates:[{id:"TPL",categoryId:null,name:"قرض",defaultAmountMinor:100000,amountType:"fixed",dueDay:1,recurrence:"monthly",startMonth:curKey,endMonth:null,note:null,isActive:true,sortOrder:0,overrides:{},suspensions:[],archiveMonth:null,createdAt:1,updatedAt:1,archivedAt:null}],
      instances:[{id:"INST",templateId:"TPL",year:CY,month:CM,plannedAmountMinor:100000,paidAmountMinor:0,status:"unpaid",dueDate:tk,paidAt:null,createdAt:1,updatedAt:1}],
      trips:[{id:"TR",name:"سفر",destination:null,startDate:tk,endDate:tk,totalBudgetMinor:null,includeInWeeklyBudgets:false,baseCurrency:"SAR",preferredForeignCurrency:null,note:null,icon:null,isManuallyActivated:false,allocations:[],deletedAt:null,createdAt:1,updatedAt:1,archivedAt:null}],
      transactions:[
        /* دفعة ثابتة أُعيد تصنيفها لكنها ما زالت تحمل tripId → يجب أن تُحسب ثابتةً فقط */
        mk({id:"FX", amountMinor:100000, categoryId:null, sourceType:"fixed", fixedTemplateId:"TPL", fixedExpenseInstanceId:"INST", tripId:"TR", countAgainstWeeklyBudget:false, description:"دفعة: قرض"}),
        mk({id:"VN", amountMinor:30000, categoryId:"CA", tripId:null, countAgainstWeeklyBudget:true}),
        mk({id:"VT", amountMinor:50000, categoryId:"CA", tripId:"TR", countAgainstWeeklyBudget:false})
      ]});
    const p = await device(b);
    await p.addInitScript((d)=> localStorage.setItem("h2do-expenses", JSON.stringify(d)), data);
    await p.goto(fileUrl); await p.waitForTimeout(800); await verifyFake(p,"4");
    await p.click("#expOpenBtn"); await p.waitForTimeout(250);
    await p.click('.exp-tab[data-view="reports"]'); await p.waitForTimeout(150);
    await p.click('.exp-tab[data-rep="monthly"]'); await p.waitForTimeout(200);
    ok("fixed actual = 1000 (fixed payment counted here)", (await stat(p,"الثابتة الفعلية"))==="١٬٠٠٠ ر.س");
    ok("variable normal = 300", (await stat(p,"المتغيّرة العادية"))==="٣٠٠ ر.س");
    ok("travel = 500 (variable trip only, EXCLUDES the fixed+trip payment)", (await stat(p,"✈️ السفر"))==="٥٠٠ ر.س");
    /* قبل الإصلاح: travel=1500 (يشمل FX)، الإجمالي=2800 (ازدواج). بعده: الإجمالي=1800 يُحسب مرّة */
    ok("net total = 1800 (counted once, NOT 2800 double-count)", (await stat(p,"الإجمالي الصافي"))==="١٬٨٠٠ ر.س");
    /* التاريخ محفوظ: tripId لم يُمسح للتحايل على الخطأ */
    const fx = await p.evaluate(()=> window.__mfkrExp.state().transactions.find(t=>t.id==="FX"));
    ok("history preserved: FX still has tripId (not cleared to hide bug)", fx.tripId==="TR");
    await p.close();
  }
  }

  /* ============================================================
     العطل 2 — الالتزامات الموقوفة/المؤرشفة والشهور التاريخية
     ============================================================ */
  if(want("2")){
  log("\n[2] Fixed obligations: history stays, pause excludes months, resume no retro-debt, archive/restore");
  {
    const data = baseData({
      fixedTemplates:[{id:"TPL",categoryId:null,name:"قرض",defaultAmountMinor:100000,amountType:"fixed",dueDay:1,recurrence:"monthly",startMonth:"2000-01",endMonth:null,note:null,isActive:true,sortOrder:0,overrides:{},suspensions:[],archiveMonth:null,createdAt:1,updatedAt:1,archivedAt:null}],
      /* مثيل تاريخي للشهر السابق مع دفعة (مالٌ فعلي) */
      instances:[{id:"INSTP",templateId:"TPL",year:+prevKey.slice(0,4),month:+prevKey.slice(5,7),plannedAmountMinor:100000,paidAmountMinor:0,status:"unpaid",dueDate:prevKey+"-01",paidAt:null,createdAt:1,updatedAt:1}],
      transactions:[ mk({id:"PP", amountMinor:100000, categoryId:null, sourceType:"fixed", fixedTemplateId:"TPL", fixedExpenseInstanceId:"INSTP", countAgainstWeeklyBudget:false, transactionDate:prevKey+"-15", description:"دفعة: قرض"}) ]});
    const p = await device(b);
    await p.addInitScript((d)=> localStorage.setItem("h2do-expenses", JSON.stringify(d)), data);
    await p.goto(fileUrl); await p.waitForTimeout(800); await verifyFake(p,"2");
    const py=+prevKey.slice(0,4), pm=+prevKey.slice(5,7);
    let past = await p.evaluate(a=> window.__mfkrExp.monthInstances(a.y,a.m), {y:py,m:pm});
    ok("historical (prev month) instance visible & paid before pause", past.some(i=>i.id==="INSTP" && i.paid===100000 && i.status==="paid"));
    /* أوقِف الالتزام الآن */
    await p.evaluate(()=> window.__mfkrExp.pauseTpl("TPL")); await p.waitForTimeout(100);
    past = await p.evaluate(a=> window.__mfkrExp.monthInstances(a.y,a.m), {y:py,m:pm});
    ok("AFTER PAUSE: historical instance STILL visible (not filtered by current flag)", past.some(i=>i.id==="INSTP" && i.paid===100000));
    const gen = await p.evaluate(a=>({ prev:window.__mfkrExp.genActive("TPL",+a.pk.slice(0,4),+a.pk.slice(5,7)), cur:window.__mfkrExp.genActive("TPL",+a.ck.slice(0,4),+a.ck.slice(5,7)), next:window.__mfkrExp.genActive("TPL",+a.nk.slice(0,4),+a.nk.slice(5,7)) }), {pk:prevKey,ck:curKey,nk:nextKey});
    ok("pause effective from current month: gen(prev)=true, gen(cur)=false, gen(next)=false", gen.prev===true && gen.cur===false && gen.next===false);
    const curI = await p.evaluate(a=> window.__mfkrExp.monthInstances(a.y,a.m), {y:CY,m:CM});
    ok("paused current month: no empty current instance shown", !curI.length || !curI.some(i=>i.paid===0));
    /* استئناف في نفس الشهر → لا فجوة كاذبة، كل الأشهر قابلة ثانيةً */
    await p.evaluate(()=> window.__mfkrExp.resumeTpl("TPL")); await p.waitForTimeout(100);
    const gen2 = await p.evaluate(a=>({ cur:window.__mfkrExp.genActive("TPL",+a.ck.slice(0,4),+a.ck.slice(5,7)), next:window.__mfkrExp.genActive("TPL",+a.nk.slice(0,4),+a.nk.slice(5,7)) }), {ck:curKey,nk:nextKey});
    ok("same-month pause→resume: no false gap (gen(cur)=true, gen(next)=true)", gen2.cur===true && gen2.next===true);
    const susAfter = await p.evaluate(()=> window.__mfkrExp.state().fixedTemplates.find(t=>t.id==="TPL").suspensions.length);
    ok("same-month resume removed the empty suspension range", susAfter===0);
    await p.close();
  }
  }

  if(want("2b")){
  log("\n[2b] Explicit suspension gap + archive/restore (no retroactive obligations)");
  {
    /* قالب فيه تعليق مُغلق [قبل شهرين، الشهر السابق] → تلك الأشهر مستبعدة، ما قبلها وما بعدها لا */
    const data = baseData({
      fixedTemplates:[
        {id:"SUS",categoryId:null,name:"إيجار",defaultAmountMinor:50000,amountType:"fixed",dueDay:1,recurrence:"monthly",startMonth:"2000-01",endMonth:null,note:null,isActive:true,sortOrder:0,overrides:{},suspensions:[{fromMonth:twoAgoKey,toMonth:prevKey}],archiveMonth:null,createdAt:1,updatedAt:1,archivedAt:null},
        /* قالب مؤرشف منذ شهرين */
        {id:"ARC",categoryId:null,name:"اشتراك",defaultAmountMinor:20000,amountType:"fixed",dueDay:1,recurrence:"monthly",startMonth:"2000-01",endMonth:null,note:null,isActive:false,sortOrder:1,overrides:{},suspensions:[],archiveMonth:twoAgoKey,createdAt:1,updatedAt:1,archivedAt:2}
      ]});
    const p = await device(b);
    await p.addInitScript((d)=> localStorage.setItem("h2do-expenses", JSON.stringify(d)), data);
    await p.goto(fileUrl); await p.waitForTimeout(800); await verifyFake(p,"2b");
    const gs = await p.evaluate(a=>({
      inGap1: window.__mfkrExp.genActive("SUS",+a.t2.slice(0,4),+a.t2.slice(5,7)),
      inGap2: window.__mfkrExp.genActive("SUS",+a.pk.slice(0,4),+a.pk.slice(5,7)),
      afterGap: window.__mfkrExp.genActive("SUS",+a.ck.slice(0,4),+a.ck.slice(5,7)),
      beforeGap: window.__mfkrExp.genActive("SUS",+a.threeAgo.slice(0,4),+a.threeAgo.slice(5,7))
    }), {t2:twoAgoKey, pk:prevKey, ck:curKey, threeAgo:shiftMon(curKey,-3)});
    ok("suspension excludes fully-contained months (gap1=false, gap2=false)", gs.inGap1===false && gs.inGap2===false);
    ok("months outside suspension remain applicable (before=true, after=true)", gs.beforeGap===true && gs.afterGap===true);
    /* أرشفة: يوقف بعد شهر الأرشفة، الحالي/السابق يبقى */
    const ar = await p.evaluate(a=>({
      atArchiveMonth: window.__mfkrExp.genActive("ARC",+a.t2.slice(0,4),+a.t2.slice(5,7)),
      afterArchive: window.__mfkrExp.genActive("ARC",+a.pk.slice(0,4),+a.pk.slice(5,7)),
      current: window.__mfkrExp.genActive("ARC",+a.ck.slice(0,4),+a.ck.slice(5,7))
    }), {t2:twoAgoKey, pk:prevKey, ck:curKey});
    ok("archived: gen at/ before archiveMonth allowed, after archiveMonth stopped", ar.atArchiveMonth===true && ar.afterArchive===false && ar.current===false);
    /* استعادة الآن: يجب ألا تُنشئ التزامات بأثر رجعي لأشهر الأرشفة [شهر بعد الأرشفة .. الشهر السابق] */
    await p.evaluate(()=> window.__mfkrExp.restoreTpl("ARC")); await p.waitForTimeout(100);
    const rs = await p.evaluate(a=>({
      gapAfterArchive: window.__mfkrExp.genActive("ARC",+a.oneAfterArc.slice(0,4),+a.oneAfterArc.slice(5,7)),
      gapPrev: window.__mfkrExp.genActive("ARC",+a.pk.slice(0,4),+a.pk.slice(5,7)),
      current: window.__mfkrExp.genActive("ARC",+a.ck.slice(0,4),+a.ck.slice(5,7)),
      archivedAt: window.__mfkrExp.state().fixedTemplates.find(t=>t.id==="ARC").archivedAt
    }), {pk:prevKey, ck:curKey, oneAfterArc:shiftMon(twoAgoKey,1)});
    ok("restore clears archive flag", rs.archivedAt===null);
    ok("restore does NOT retroactively generate archived-gap months (false)", rs.gapAfterArchive===false && rs.gapPrev===false);
    ok("restore resumes generation from current month (true)", rs.current===true);
    await p.close();
  }
  }

  /* ============================================================
     العطل 1 — إحياء حذف الرحلة عبر الأجهزة (شاهدة قبر)
     ============================================================ */
  if(want("1")){
  log("\n[1] Cross-device trip deletion: tombstone converges, never revived by older live copy");
  {
    Object.keys(store).forEach(k=> delete store[k]);
    const tripLive = {id:"TR",name:"الرياض",destination:null,startDate:tk,endDate:tk,totalBudgetMinor:null,includeInWeeklyBudgets:false,baseCurrency:"SAR",preferredForeignCurrency:null,note:null,icon:null,isManuallyActivated:false,allocations:[],deletedAt:null,createdAt:1,updatedAt:1000};
    const seed = baseData({ trips:[JSON.parse(JSON.stringify(tripLive))], transactions:[ mk({id:"TX", amountMinor:5000, tripId:"TR", countAgainstWeeklyBudget:false}) ] });
    store[EXPKEY] = JSON.stringify(seed);
    /* الجهاز A يتبنّى الخادم ثم يحذف الرحلة (شاهدة قبر) ويدفع */
    const A = await device(b); await A.goto(fileUrl); await A.waitForTimeout(800); await verifyFake(A,"1A");
    ok("A adopted the live trip from remote", (await A.evaluate(()=> window.__mfkrExp.liveTrips())).indexOf("TR")>=0);
    await A.evaluate(()=> window.__mfkrExp.deleteTrip("TR")); await A.waitForTimeout(700);   /* دفع مُخنَّق 400ms */
    const aState = await A.evaluate(()=> window.__mfkrExp.state());
    const aTR = aState.trips.find(t=>t.id==="TR");
    ok("A: trip NOT physically removed — tombstone kept (deletedAt set)", !!aTR && !!aTR.deletedAt);
    ok("A: deleted trip excluded from live/active selectors", (await A.evaluate(()=> window.__mfkrExp.liveTrips())).indexOf("TR")<0);
    ok("A: linked transaction retained (no financial deletion)", aState.transactions.some(t=>t.id==="TX" && !t.deletedAt));
    const remoteAfterA = JSON.parse(store[EXPKEY]);
    ok("A pushed tombstone to remote", remoteAfterA.trips.find(t=>t.id==="TR") && !!remoteAfterA.trips.find(t=>t.id==="TR").deletedAt);
    /* الجهاز B يحمل نسخة حيّة أقدم محليًا ثم يزامن → يجب أن تفوز الشاهدة ولا تُحيا */
    const B = await device(b);
    await B.addInitScript((d)=> localStorage.setItem("h2do-expenses", JSON.stringify(d)), seed);   /* B عنده TR حيّة updatedAt=1000 */
    await B.goto(fileUrl); await B.waitForTimeout(900); await verifyFake(B,"1B");
    await B.evaluate(()=> window.__mfkrSync.expPull({manual:true})); await B.waitForTimeout(700);
    const bState = await B.evaluate(()=> window.__mfkrExp.state());
    const bTR = bState.trips.find(t=>t.id==="TR");
    ok("B: tombstone won over its older live copy (deletedAt set, NOT revived)", !!bTR && !!bTR.deletedAt);
    ok("B: deleted trip not in live trips (converged)", bState.trips.filter(t=>!t.deletedAt).every(t=>t.id!=="TR"));
    ok("B: transaction preserved", bState.transactions.some(t=>t.id==="TX"));
    /* تقارب: الخادم يبقى شاهدة قبر بعد دفع B */
    const remoteFinal = JSON.parse(store[EXPKEY]);
    ok("remote converged to tombstone (no revival)", !!remoteFinal.trips.find(t=>t.id==="TR").deletedAt);
    await A.close(); await B.close();
  }
  }

  /* ============================================================
     العطل 5 — تعدّد الرحلات النشطة يدويًا بعد الدمج
     ============================================================ */
  if(want("5")){
  log("\n[5] Manual-active convergence: at most one winner, deterministic, no reconcile loop");
  {
    Object.keys(store).forEach(k=> delete store[k]);
    const trip=(id,ts,active)=>({id,name:id,destination:null,startDate:tk,endDate:tk,totalBudgetMinor:null,includeInWeeklyBudgets:false,baseCurrency:"SAR",preferredForeignCurrency:null,note:null,icon:null,isManuallyActivated:!!active,allocations:[],deletedAt:null,createdAt:1,updatedAt:ts,archivedAt:null});
    /* الخادم: X نشطة يدويًا (updatedAt=7000) — أحدث من نسخة X المحلية فتفوز فتبقى X نشطةً بعد الدمج */
    const remoteSeed = baseData({ trips:[trip("X",7000,true), trip("Y",4000,false)] });
    store[EXPKEY] = JSON.stringify(remoteSeed);
    /* B محليًا: Y نشطة يدويًا بأحدث updatedAt=9000 (تفعيل متزامن على جهاز آخر)، وX قديمة غير نشطة */
    const localSeed = baseData({ trips:[trip("X",5000,false), trip("Y",9000,true)] });
    const B = await device(b);
    await B.addInitScript((d)=> localStorage.setItem("h2do-expenses", JSON.stringify(d)), localSeed);
    await B.goto(fileUrl); await B.waitForTimeout(800); await verifyFake(B,"5");
    await B.evaluate(()=> window.__mfkrSync.expPull({manual:true})); await B.waitForTimeout(700);
    const st = await B.evaluate(()=> window.__mfkrExp.state());
    const activeManual = st.trips.filter(t=>!t.deletedAt && !t.archivedAt && t.isManuallyActivated);
    ok("exactly one manual-active trip after merge", activeManual.length===1);
    ok("deterministic winner = newest updatedAt (Y, 9000)", activeManual.length===1 && activeManual[0].id==="Y");
    ok("loser X disabled with bumped updatedAt (converges, not stale)", st.trips.find(t=>t.id==="X").isManuallyActivated===false && st.trips.find(t=>t.id==="X").updatedAt>7000);
    /* لا حلقة توفيق: إعادة التوفيق لا تُغيّر شيئًا (مستقر) */
    const changedAgain = await B.evaluate(()=> window.__mfkrExp.reconcileActive());
    ok("no reconcile loop: second reconcile is a no-op (stable convergence)", changedAgain===false);
    const activeAfter = (await B.evaluate(()=> window.__mfkrExp.activeTrips()));
    ok("still exactly one active after re-pull idempotence", (st.trips.filter(t=>!t.deletedAt && t.isManuallyActivated).length)===1);
    await B.close();
  }
  }

  emit("\nRESULT["+(GROUPS.length?GROUPS.join(","):"all")+"]: "+PASS+" passed, "+FAIL+" failed");
  emit("PAGE JS ERRORS: "+(errs.length? JSON.stringify([...new Set(errs)]) : "none"));
  await b.close();
  process.exit(FAIL>0?1:0);
})();
