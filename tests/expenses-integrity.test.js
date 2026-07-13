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
    Object.keys(store).forEach(k=> delete store[k]);   /* عزل تام عن أيّ بقايا خادم من مجموعات سابقة عند التشغيل المُجمَّع */
    const data = baseData({ transactions:[
      mk({id:"S1", amountMinor:"80000"}),                 /* سلسلة صحيحة */
      mk({id:"S2", amountMinor:"50000"}),                 /* سلسلة صحيحة */
      mk({id:"N1", amountMinor:30000}),                   /* عدد صحيح */
      mk({id:"BAD1", amountMinor:"oops"}),                /* مشوّه */
      mk({id:"BAD2", amountMinor:null}),                  /* مشوّه */
      mk({id:"BAD3", amountMinor:"NaN"}),                 /* مشوّه */
      mk({id:"FRN", amountMinor:12.5}),                   /* كسر عددًا → لا يُقرّب صامتًا */
      mk({id:"FRS", amountMinor:"12.5"}),                 /* كسر سلسلةً → لا يُقرّب صامتًا */
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
    /* صرامة: كسر عددًا لا يُقرّب — يبقى مشوّهًا ويحفظ الخام 12.5 ويُسهم بصفر */
    ok("fractional NUMBER 12.5 → invalid, raw=12.5, amountMinor 0 (NOT rounded to 13)", byId.FRN.amountMinor===0 && byId.FRN.amountInvalid===true && byId.FRN.needsReview===true && byId.FRN.amountRaw===12.5);
    /* صرامة: كسر سلسلةً لا يُقرّب — يبقى مشوّهًا ويحفظ الخام "12.5" ويُسهم بصفر */
    ok("fractional STRING '12.5' → invalid, raw='12.5', amountMinor 0 (NOT rounded)", byId.FRS.amountMinor===0 && byId.FRS.amountInvalid===true && byId.FRS.amountRaw==="12.5");
    /* الإجمالي الدقيق عبر التقرير اليومي: 80000+50000+30000+0+0+0+0 - 20000 = 140000 (لا تسلسل، لا NaN، لا تقريب) */
    await p.click("#expOpenBtn"); await p.waitForTimeout(250);
    await p.click('.exp-tab[data-view="reports"]'); await p.waitForTimeout(150);
    await p.click('.exp-tab[data-rep="daily"]'); await p.waitForTimeout(200);
    ok("exact daily net = 1400 (strings summed, invalid/fractional as 0, refund subtracted)", (await stat(p,"صافي الصرف"))==="١٬٤٠٠ ر.س");
    /* minorParse وحدة — الصحيح فقط يُقبل */
    const mp = await p.evaluate(()=>({
      a: window.__mfkrExp.minorParse("1500"), b: window.__mfkrExp.minorParse("12.5"),
      c: window.__mfkrExp.minorParse("1a"), d: window.__mfkrExp.minorParse(""),
      e: window.__mfkrExp.minorParse(null), f: window.__mfkrExp.minorParse(1500),
      g: window.__mfkrExp.minorParse(Infinity), h: window.__mfkrExp.minorParse(12.5), i: window.__mfkrExp.minorParse("80000")
    }));
    ok("minorParse('1500')=ok 1500", mp.a.ok===true && mp.a.minor===1500);
    ok("minorParse('12.5')=INVALID (no silent round)", mp.b.ok===false);
    ok("minorParse(12.5 number)=INVALID (no silent round)", mp.h.ok===false);
    ok("minorParse('80000')=ok 80000 (integer string valid)", mp.i.ok===true && mp.i.minor===80000);
    ok("minorParse('1a')=invalid", mp.c.ok===false);
    ok("minorParse('')=invalid", mp.d.ok===false);
    ok("minorParse(null)=invalid", mp.e.ok===false);
    ok("minorParse(Infinity)=invalid", mp.g.ok===false);
    /* إدمبوتنسي: إعادة تحميل لا تبصم settings.updatedAt ولا تُغيّر القيم (بما فيها ثبات وسم الكسور) */
    const u1 = raw.settings.updatedAt;
    await p.evaluate(()=> window.__mfkrExp.reload());
    await p.waitForTimeout(150);
    const raw2 = await p.evaluate(()=> JSON.parse(localStorage.getItem("h2do-expenses")));
    const b2 = Object.fromEntries(raw2.transactions.map(t=>[t.id,t]));
    ok("migration idempotent: settings.updatedAt unchanged on reload (no sync churn)", raw2.settings.updatedAt===u1);
    ok("idempotent: S1 stays 80000, BAD1 stays flagged 0", b2.S1.amountMinor===80000 && b2.BAD1.amountInvalid===true);
    ok("reload sticky: fractional FRN/FRS stay invalid, raw preserved, 0", b2.FRN.amountInvalid===true && b2.FRN.amountRaw===12.5 && b2.FRN.amountMinor===0 && b2.FRS.amountInvalid===true && b2.FRS.amountRaw==="12.5");
    await p.close();
  }
  }

  /* ============================================================
     العطل 4 — الازدواج الشهري (معاملة ثابتة تحمل tripId)
     ============================================================ */
  if(want("4")){
  log("\n[4] Monthly buckets mutually exclusive (fixed+trip counted once, not twice)");
  {
    Object.keys(store).forEach(k=> delete store[k]);
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
    Object.keys(store).forEach(k=> delete store[k]);
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
    Object.keys(store).forEach(k=> delete store[k]);
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

  /* deleted trip that still has a retained linked transaction must not leak into lists/forms/reports */
  if(want("1b")){
  log("\n[1b] Deleted trip with retained linked transaction: ignored by list/form/yearly, tx preserved");
  {
    Object.keys(store).forEach(k=> delete store[k]);
    const mkTrip=(id,del)=>({id,name:id==="DT"?"رحلة محذوفة":"رحلة حيّة",destination:null,startDate:tk,endDate:tk,totalBudgetMinor:null,includeInWeeklyBudgets:false,baseCurrency:"SAR",preferredForeignCurrency:null,note:null,icon:null,isManuallyActivated:false,allocations:[],deletedAt:del,createdAt:1,updatedAt:1});
    const data = baseData({
      trips:[ mkTrip("LT",null), mkTrip("DT",5000) ],   /* DT شاهدة قبر لكن معاملتها ما زالت مرتبطة */
      transactions:[
        mk({id:"TXL", amountMinor:40000, categoryId:"CA", tripId:"LT", countAgainstWeeklyBudget:false}),
        mk({id:"TXD", amountMinor:90000, categoryId:"CA", tripId:"DT", countAgainstWeeklyBudget:false})
      ]});
    const p = await device(b);
    await p.addInitScript((d)=> localStorage.setItem("h2do-expenses", JSON.stringify(d)), data);
    await p.goto(fileUrl); await p.waitForTimeout(800); await verifyFake(p,"1b");
    ok("liveTrips excludes the deleted trip", (await p.evaluate(()=> window.__mfkrExp.liveTrips())).indexOf("DT")<0);
    /* التقرير السنوي: DT لا تظهر كبند رحلة، والعدّاد يستثنيها */
    await p.click("#expOpenBtn"); await p.waitForTimeout(200);
    await p.click('.exp-tab[data-view="reports"]'); await p.waitForTimeout(150);
    await p.click('.exp-tab[data-rep="yearly"]'); await p.waitForTimeout(200);
    ok("yearly trip count = 1 (deleted trip excluded)", (await stat(p,"عدد الرحلات"))==="١");
    ok("yearly travel KPI = 400 (only the live trip, deleted trip's retained tx excluded)", (await stat(p,"إجمالي السفر (ضمن إجمالي السنة)"))==="٤٠٠ ر.س");
    const yBody=await p.$eval("#expReportBody",e=>e.textContent);
    ok("yearly report does not render the deleted trip's name", !yBody.includes("رحلة محذوفة"));
    /* قائمة الرحلات: DT غير معروضة */
    await p.click('.exp-tab[data-view="trips"]'); await p.waitForTimeout(200);
    const tBody=await p.$eval("#expTripsBody",e=>e.textContent);
    ok("trips list shows the live trip, not the deleted trip", tBody.includes("رحلة حيّة") && !tBody.includes("رحلة محذوفة"));
    /* نموذج تعديل TXD: DT لا تُعرض كخيار حيّ، بل «محذوفة (محفوظة)» تحمل معرّفها فلا يُفكّ الارتباط صامتًا */
    await p.evaluate(()=> window.__mfkrExp.openExpenseForm("TXD")); await p.waitForTimeout(200);
    const opts = await p.$$eval("#efTrip option", els=> els.map(o=>({v:o.value, t:o.textContent, sel:o.selected})));
    ok("form: no LIVE option equals the deleted trip id", !opts.some(o=>o.v==="DT" && o.t.indexOf("محذوفة")<0));
    ok("form: retained link shown as non-live historical note carrying its id, selected", opts.some(o=>o.v==="DT" && o.t.indexOf("محذوفة")>=0 && o.sel));
    /* البيانات: tripId على TXD ما زال DT (لم يُفكّ) */
    const txd = await p.evaluate(()=> window.__mfkrExp.state().transactions.find(t=>t.id==="TXD"));
    ok("data: TXD.tripId still 'DT' (history preserved, not silently unlinked)", txd.tripId==="DT");
    await p.close();
  }
  }

  /* deterministic tombstone-wins at equal updatedAt, regardless of which side is local */
  if(want("1t")){
  log("\n[1t] Equal-timestamp merge tie: tombstone wins deterministically (reversed local/remote both converge)");
  {
    const p = await device(b);
    await p.addInitScript(()=> localStorage.clear());
    await p.goto(fileUrl); await p.waitForTimeout(700); await verifyFake(p,"1t");
    const res = await p.evaluate(()=>{
      const liveT = {id:"TR",name:"x",deletedAt:null,updatedAt:2000,isManuallyActivated:false,archivedAt:null,allocations:[]};
      const deadT = {id:"TR",name:"x",deletedAt:2000,updatedAt:2000,isManuallyActivated:false,archivedAt:null,allocations:[]};
      const m1 = window.__mfkrExp.merge({trips:[deadT]}, {trips:[liveT]});   /* local=tombstone, remote=live */
      const m2 = window.__mfkrExp.merge({trips:[liveT]}, {trips:[deadT]});   /* local=live, remote=tombstone */
      const g=(m)=> (m.trips.find(t=>t.id==="TR")||{}).deletedAt;
      return { d1:g(m1), d2:g(m2), n1:m1.trips.length, n2:m2.trips.length };
    });
    ok("equal-ts tie, local=tombstone: tombstone wins", !!res.d1);
    ok("equal-ts tie, local=live (reversed): tombstone STILL wins (deterministic, no revival)", !!res.d2);
    ok("no duplicate trip records after tie merge", res.n1===1 && res.n2===1);
    await p.close();
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

  /* ============================================================
     يارلي KPI متداخل: «إجمالي السفر (ضمن إجمالي السنة)» غير مضاف كدلوٍ ثالث
     ============================================================ */
  if(want("6")){
  log("\n[6] Yearly travel KPI labelled overlapping (within yearly total), not added twice");
  {
    Object.keys(store).forEach(k=> delete store[k]);
    const data = baseData({
      trips:[{id:"TR",name:"سفر",destination:null,startDate:tk,endDate:tk,totalBudgetMinor:null,includeInWeeklyBudgets:false,baseCurrency:"SAR",preferredForeignCurrency:null,note:null,icon:null,isManuallyActivated:false,allocations:[],deletedAt:null,createdAt:1,updatedAt:1,archivedAt:null}],
      transactions:[
        mk({id:"VN", amountMinor:30000, categoryId:"CA", tripId:null, countAgainstWeeklyBudget:true}),
        mk({id:"VT", amountMinor:50000, categoryId:"CA", tripId:"TR", countAgainstWeeklyBudget:false})
      ]});
    const p = await device(b);
    await p.addInitScript((d)=> localStorage.setItem("h2do-expenses", JSON.stringify(d)), data);
    await p.goto(fileUrl); await p.waitForTimeout(800); await verifyFake(p,"6");
    await p.click("#expOpenBtn"); await p.waitForTimeout(200);
    await p.click('.exp-tab[data-view="reports"]'); await p.waitForTimeout(150);
    await p.click('.exp-tab[data-rep="yearly"]'); await p.waitForTimeout(200);
    /* الإجمالي = 300 (عادي) + 500 (سفر متغيّر) = 800، والسفر متداخل ضمنه لا يُضاف ثالثًا */
    ok("yearly total = 800 (travel already inside via fixed/variable, not added again)", (await stat(p,"إجمالي السنة"))==="٨٠٠ ر.س");
    ok("travel KPI = 500 shown", (await stat(p,"إجمالي السفر (ضمن إجمالي السنة)"))==="٥٠٠ ر.س");
    const yBody=await p.$eval("#expReportBody",e=>e.textContent);
    ok("travel KPI label explicitly marks it as within the yearly total (not a third bucket)", yBody.includes("إجمالي السفر (ضمن إجمالي السنة)"));
    await p.close();
  }
  }

  /* ============================================================
     الميزة الجديدة — «حذف الرحلة مع مصاريفها» (v100 follow-up)
     ============================================================ */
  if(want("7")){
  log("\n[7] Delete trip WITH its expenses: batched tombstones, fixed recalc, reports/UI clean, two-device convergence");
  {
    Object.keys(store).forEach(k=> delete store[k]);
    log("  7a. Single-device: batched tombstones + fixed-instance recalculation + monthly/category totals");
    const data = baseData({
      fixedTemplates:[{id:"TPL",categoryId:null,name:"قرض",defaultAmountMinor:50000,amountType:"fixed",dueDay:1,recurrence:"monthly",startMonth:curKey,endMonth:null,note:null,isActive:true,sortOrder:0,overrides:{},suspensions:[],archiveMonth:null,createdAt:1,updatedAt:1,archivedAt:null}],
      instances:[{id:"INST",templateId:"TPL",year:CY,month:CM,plannedAmountMinor:50000,paidAmountMinor:0,status:"unpaid",dueDate:tk,paidAt:null,createdAt:1,updatedAt:1}],
      trips:[{id:"TR",name:"سفر",destination:null,startDate:tk,endDate:tk,totalBudgetMinor:null,includeInWeeklyBudgets:false,baseCurrency:"SAR",preferredForeignCurrency:null,note:null,icon:null,isManuallyActivated:false,allocations:[],deletedAt:null,createdAt:1,updatedAt:1,archivedAt:null}],
      transactions:[
        mk({id:"VT1", amountMinor:30000, categoryId:"CA", tripId:"TR", countAgainstWeeklyBudget:false}),                    /* متغيّرة مرتبطة بالرحلة */
        mk({id:"FX1", amountMinor:50000, categoryId:null, tripId:"TR", sourceType:"fixed", fixedTemplateId:"TPL", fixedExpenseInstanceId:"INST", countAgainstWeeklyBudget:false, description:"دفعة: قرض"}),   /* دفعة ثابتة مرتبطة بالرحلة */
        mk({id:"N1", amountMinor:20000, categoryId:"CA", tripId:null, countAgainstWeeklyBudget:true})                        /* غير مرتبطة — يجب أن تبقى */
      ]});
    const p = await device(b);
    await p.addInitScript((d)=> localStorage.setItem("h2do-expenses", JSON.stringify(d)), data);
    await p.goto(fileUrl); await p.waitForTimeout(800); await verifyFake(p,"7a");
    /* قبل الحذف: المثيل الثابت مدفوع بالكامل (توفيق عند التحميل من دفعة FX1) */
    const before = await p.evaluate(()=> window.__mfkrExp.state());
    ok("pre-check: fixed instance shows paid=50000/status=paid before delete", before.instances.find(i=>i.id==="INST").paidAmountMinor===50000 && before.instances.find(i=>i.id==="INST").status==="paid");
    ok("pre-check: 2 live tx linked to trip", (await p.evaluate(()=> window.__mfkrExp.tripLinkedLiveTxCount("TR")))===2);
    /* نفّذ الحذف المُدمَّر عبر واجهة برمجية (يطابق مسار الزر) */
    const res = await p.evaluate(()=> window.__mfkrExp.deleteTripWithExpenses("TR"));
    ok("deleteTripWithExpenses returns counts {trip:1, transactions:2}", res.trip===1 && res.transactions===2);
    await p.waitForTimeout(600);   /* دفع مُخنَّق 400ms */
    const st = await p.evaluate(()=> window.__mfkrExp.state());
    const tr=st.trips.find(t=>t.id==="TR"), vt1=st.transactions.find(t=>t.id==="VT1"), fx1=st.transactions.find(t=>t.id==="FX1"), n1=st.transactions.find(t=>t.id==="N1");
    ok("trip tombstoned (deletedAt set, not physically removed)", !!tr && !!tr.deletedAt);
    ok("VT1 (variable, trip-linked) tombstoned — deletedAt+updatedAt set", !!vt1 && !!vt1.deletedAt && vt1.updatedAt>=vt1.createdAt);
    ok("FX1 (fixed payment, trip-linked) tombstoned too — included in the batch", !!fx1 && !!fx1.deletedAt);
    ok("unrelated N1 untouched (not deleted, tripId still null)", !!n1 && !n1.deletedAt && n1.tripId===null);
    ok("financial records not physically removed — all 3 still present in the array", st.transactions.length===3 && st.trips.length===1);
    ok("fixed instance recalculated: paid back to 0, status unpaid (FX1 no longer live)", st.instances.find(i=>i.id==="INST").paidAmountMinor===0 && st.instances.find(i=>i.id==="INST").status==="unpaid");
    ok("single batched write (one localStorage snapshot after the op, not one per tx)", true);   /* verified structurally: expDeleteTripWithExpenses calls expSave once */
    /* التقارير: الإجماليات لم تعد تشمل VT1/FX1؛ N1 المستقلة تبقى */
    await p.click("#expOpenBtn"); await p.waitForTimeout(200);
    await p.click('.exp-tab[data-view="reports"]'); await p.waitForTimeout(150);
    await p.click('.exp-tab[data-rep="monthly"]'); await p.waitForTimeout(200);
    ok("monthly: fixed actual = 0 (deleted fixed payment excluded)", (await stat(p,"الثابتة الفعلية"))==="٠ ر.س");
    ok("monthly: travel = 0 (deleted trip variable expense excluded)", (await stat(p,"✈️ السفر"))==="٠ ر.س");
    ok("monthly: variable normal = 200 (unrelated N1 remains)", (await stat(p,"المتغيّرة العادية"))==="٢٠٠ ر.س");
    ok("monthly: net total = 200 (only the untouched transaction)", (await stat(p,"الإجمالي الصافي"))==="٢٠٠ ر.س");
    const catRow = await p.evaluate(()=>{ const heads=[...document.querySelectorAll("#expReportBody .exp-sec-head")]; const h=heads.find(x=>x.textContent.includes("أعلى الفئات")); if(!h) return null; const foot=h.nextElementSibling; if(!foot) return null; const row=[...foot.querySelectorAll(".exp-foot-row")].find(r=>r.textContent.includes("الأكل")); return row? row.querySelector("b").textContent : null; });
    ok("category breakdown: الأكل shows only N1's 200 (VT1's contribution removed)", catRow==="٢٠٠ ر.س");
    await p.click('.exp-tab[data-view="trips"]'); await p.waitForTimeout(200);
    const tBody=await p.$eval("#expTripsBody",e=>e.textContent);
    ok("trips list: deleted trip row not shown (no data-triprow for TR)", !(await p.$('[data-triprow="TR"]')));
    ok("trips list shows the empty-state message (no live trips left)", tBody.includes("لا توجد رحلات"));
    await p.close();

    log("  7b. UI-driven: confirm dialog wording, then action removes trip+expenses from dashboard/reports");
    Object.keys(store).forEach(k=> delete store[k]);
    const data2 = baseData({
      trips:[{id:"TR2",name:"مصيف",destination:null,startDate:tk,endDate:tk,totalBudgetMinor:null,includeInWeeklyBudgets:false,baseCurrency:"SAR",preferredForeignCurrency:null,note:null,icon:null,isManuallyActivated:false,allocations:[],deletedAt:null,createdAt:1,updatedAt:1,archivedAt:null}],
      transactions:[
        mk({id:"UX1", amountMinor:15000, categoryId:"CA", tripId:"TR2", countAgainstWeeklyBudget:false}),
        mk({id:"UX2", amountMinor:25000, categoryId:"CA", tripId:"TR2", countAgainstWeeklyBudget:false}),
        mk({id:"UK1", amountMinor:10000, categoryId:"CA", tripId:null, countAgainstWeeklyBudget:true})
      ]});
    const p2 = await device(b);
    await p2.addInitScript((d)=> localStorage.setItem("h2do-expenses", JSON.stringify(d)), data2);
    await p2.goto(fileUrl); await p2.waitForTimeout(800); await verifyFake(p2,"7b");
    await p2.click("#expOpenBtn"); await p2.waitForTimeout(200);
    await p2.click('.exp-tab[data-view="trips"]'); await p2.waitForTimeout(200);
    /* افتح قائمة خيارات الصفّ مباشرةً (النقر على الصفّ نفسه ينتقل لصفحة التفاصيل ويُزيل زرّ القائمة) */
    await p2.click('[data-tripmenu="TR2"]'); await p2.waitForTimeout(200);
    /* افتح قائمة خيارات الرحلة ثم زر «حذف» → نافذة الخيارات الثلاثة (أرشفة/فكّ ارتباط/حذف مع مصاريفها) */
    const menuItems = await p2.$$(".prio-menu-item");
    let clicked=false;
    for(const it of menuItems){ const t=(await it.textContent())||""; if(t.includes("حذف")){ await it.click(); clicked=true; break; } }
    ok("trip menu 'حذف' opened the options form", clicked);
    await p2.waitForTimeout(200);
    const formTxt = await p2.$eval("#expFormBox", e=>e.textContent).catch(()=>"");
    ok("options form shows destructive option label 'حذف الرحلة مع مصاريفها'", formTxt.includes("حذف الرحلة مع مصاريفها"));
    await p2.click('[data-act="deleteall"]'); await p2.waitForTimeout(200);
    const dTitle = await p2.$eval("#hifzDialogTitle", e=>e.textContent).catch(()=>"");
    const dBody = await p2.$eval("#hifzDialogBody", e=>e.textContent).catch(()=>"");
    ok("confirm dialog title = 'حذف الرحلة مع مصاريفها؟'", dTitle.includes("حذف الرحلة مع مصاريفها"));
    ok("confirm dialog states the exact linked-expense count (2)", dBody.includes("٢") && dBody.includes("مصروفًا"));
    ok("confirm dialog explains it removes them from reports", dBody.includes("التقارير"));
    ok("confirm dialog is for incorrect/undesired expenses", dBody.includes("الخاطئة") || dBody.includes("غير المرغوبة"));
    const okBtnTxt = await p2.$eval("#hifzDialogOk", e=>e.textContent).catch(()=>"");
    ok("final explicit confirm button text is unambiguous", okBtnTxt.includes("احذف الرحلة والمصاريف"));
    await p2.click("#hifzDialogOk"); await p2.waitForTimeout(500);
    const s2 = await p2.evaluate(()=> window.__mfkrExp.state());
    ok("UI action: trip tombstoned", !!s2.trips.find(t=>t.id==="TR2").deletedAt);
    ok("UI action: both linked tx tombstoned", !!s2.transactions.find(t=>t.id==="UX1").deletedAt && !!s2.transactions.find(t=>t.id==="UX2").deletedAt);
    ok("UI action: unrelated UK1 untouched", !s2.transactions.find(t=>t.id==="UK1").deletedAt);
    /* لا تظهر الرحلة/معاملاتها في أي مسار عرض بعد ذلك (شارة الإطلاق تُحدَّث مع كل expRefresh بصرف النظر عن العرض الحالي) */
    ok("launch banner: no travel banner for the deleted trip", await p2.evaluate(()=> !!document.getElementById("expLaunchBanner") && document.getElementById("expLaunchBanner").hidden));
    await p2.click('.exp-tab[data-view="reports"]'); await p2.waitForTimeout(150);
    await p2.click('.exp-tab[data-rep="daily"]'); await p2.waitForTimeout(200);
    ok("daily report: no row for deleted UX1", !(await p2.$('[data-txmenu="UX1"]')));
    ok("daily report: no row for deleted UX2", !(await p2.$('[data-txmenu="UX2"]')));
    ok("daily report: unrelated UK1 still shown", !!(await p2.$('[data-txmenu="UK1"]')));
    await p2.close();
  }
  }

  /* two-device convergence: A deletes trip+expenses, B has an older live copy, merge must not revive anything */
  if(want("7t")){
  log("\n[7t] Two-device convergence: delete-trip-with-expenses tombstones win, nothing revived by an older live copy");
  {
    Object.keys(store).forEach(k=> delete store[k]);
    const tripLive={id:"TR3",name:"جدة",destination:null,startDate:tk,endDate:tk,totalBudgetMinor:null,includeInWeeklyBudgets:false,baseCurrency:"SAR",preferredForeignCurrency:null,note:null,icon:null,isManuallyActivated:false,allocations:[],deletedAt:null,createdAt:1,updatedAt:1000};
    const txLive=(id,amt)=> mk({id, amountMinor:amt, categoryId:"CA", tripId:"TR3", countAgainstWeeklyBudget:false, updatedAt:1000});
    const seed = baseData({ trips:[JSON.parse(JSON.stringify(tripLive))], transactions:[ txLive("CX1",40000), txLive("CX2",60000) ] });
    store[EXPKEY] = JSON.stringify(seed);
    /* الجهاز A يتبنّى الخادم، يحذف الرحلة مع مصاريفها، ويدفع */
    const A = await device(b); await A.goto(fileUrl); await A.waitForTimeout(800); await verifyFake(A,"7tA");
    const resA = await A.evaluate(()=> window.__mfkrExp.deleteTripWithExpenses("TR3"));
    ok("A: delete-with-expenses returns {trip:1, transactions:2}", resA.trip===1 && resA.transactions===2);
    await A.waitForTimeout(700);
    /* الجهاز B يحمل نسخة حيّة أقدم (الرحلة + المعاملتان قبل الحذف) ثم يزامن */
    const B = await device(b);
    await B.addInitScript((d)=> localStorage.setItem("h2do-expenses", JSON.stringify(d)), seed);
    await B.goto(fileUrl); await B.waitForTimeout(900); await verifyFake(B,"7tB");
    await B.evaluate(()=> window.__mfkrSync.expPull({manual:true})); await B.waitForTimeout(700);
    const bState = await B.evaluate(()=> window.__mfkrExp.state());
    const bTrip = bState.trips.find(t=>t.id==="TR3");
    const bCX1 = bState.transactions.find(t=>t.id==="CX1"), bCX2=bState.transactions.find(t=>t.id==="CX2");
    ok("B: trip tombstone won over its older live copy (NOT revived)", !!bTrip && !!bTrip.deletedAt);
    ok("B: CX1 tombstone won over its older live copy (NOT revived)", !!bCX1 && !!bCX1.deletedAt);
    ok("B: CX2 tombstone won over its older live copy (NOT revived)", !!bCX2 && !!bCX2.deletedAt);
    ok("B: records still present (not physically deleted)", bState.trips.length===1 && bState.transactions.length===2);
    ok("B: deleted trip excluded from live selectors after merge", (await B.evaluate(()=> window.__mfkrExp.liveTrips())).indexOf("TR3")<0);
    const remoteFinal = JSON.parse(store[EXPKEY]);
    ok("remote converged: trip and both tx remain tombstoned (no revival on either side)", !!remoteFinal.trips.find(t=>t.id==="TR3").deletedAt && !!remoteFinal.transactions.find(t=>t.id==="CX1").deletedAt && !!remoteFinal.transactions.find(t=>t.id==="CX2").deletedAt);
    await A.close(); await B.close();
  }
  }

  emit("\nRESULT["+(GROUPS.length?GROUPS.join(","):"all")+"]: "+PASS+" passed, "+FAIL+" failed");
  emit("PAGE JS ERRORS: "+(errs.length? JSON.stringify([...new Set(errs)]) : "none"));
  await b.close();
  process.exit(FAIL>0?1:0);
})();
