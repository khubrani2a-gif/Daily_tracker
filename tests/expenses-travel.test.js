function __loadChromium(){const c=[process.env.PW_PATH,"playwright","/opt/node22/lib/node_modules/playwright"].filter(Boolean);for(const x of c){try{return require(x).chromium;}catch(e){}}console.error("Playwright not found. Set PW_PATH=/path/to/playwright");process.exit(2);}
const { chromium } = { chromium: __loadChromium() };
const path=require("path");
const fileUrl = "file://" + path.resolve(__dirname, "..", "index.html");
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
const rd=(p)=>p.evaluate(()=>JSON.parse(localStorage.getItem("h2do-expenses")));
let PASS=0,FAIL=0; const ok=(n,c)=>{ if(c){PASS++;console.log("  ✓ "+n);}else{FAIL++;console.log("  ✗ FAIL: "+n);} };
const errs=[];
/* بعد إعادة تنظيم واجهة العائلة: بطاقة «العائلة» تظهر بعد اختيار قسم العائلة من الشريط السفلي.
   الدالة مُتسامحة: إن كانت النافذة مفتوحة سلفًا لا تعيد فتحها (الزر يكون محجوبًا خلفها). */
const showFamilyCard=async(p)=>{ await p.locator('a[data-app-view="expenses"]').click(); await p.waitForTimeout(250); };
const openFamily=async(p)=>{
  const open=await p.evaluate(()=>{const e=document.getElementById("expOverlay"); return !!(e&&!e.hidden);});
  if(open) return;
  await showFamilyCard(p);
  await p.click("#expOpenBtn"); await p.waitForTimeout(350);
};
/* تبويب المالية: فيه بطاقات الميزانية والالتزامات وزر «＋ إضافة مصروف» */
const openFinance=async(p)=>{ await openFamily(p); await p.click('.exp-tab[data-view="dash"]'); await p.waitForTimeout(300); };
// everything in TODAY's day/week/month/year -> no navigation needed
function seed(extra){ return (a)=>{ localStorage.clear(); const now=Date.now(); const tk=a.tk;
  const mk=(o)=>Object.assign({id:o.id,amountMinor:0,transactionDate:tk,categoryId:"CA",transactionType:"expense",fixedExpenseInstanceId:null,relatedTransactionId:null,tripId:null,countAgainstWeeklyBudget:true,originalAmountMinor:null,originalCurrency:null,exchangeRate:null,exchangeRateSource:null,merchantCountry:null,createdAt:now,updatedAt:now,deletedAt:null},o);
  const data={version:2,settings:{currency:"SAR",weekStartDay:6,numberFormat:"ar-EG",defaultPaymentMethod:null,currentBudgetVersion:1,migratedLegacy:true,createdAt:now,updatedAt:now},
    categories:[{id:"CA",name:"الأكل",section:"variable",parentCategoryId:null,budgets:[{from:"1970-01-01",amountMinor:60000}],icon:null,isActive:true,sortOrder:0,createdAt:now,updatedAt:now,archivedAt:null},{id:"CH",name:"السكن",section:"variable",parentCategoryId:null,budgets:[],icon:null,isActive:true,sortOrder:1,createdAt:now,updatedAt:now,archivedAt:null}],
    fixedTemplates:[],instances:[],
    trips:[{id:"TRIP",name:"البحرين",destination:"المنامة",startDate:tk,endDate:tk,totalBudgetMinor:300000,includeInWeeklyBudgets:false,baseCurrency:"SAR",preferredForeignCurrency:"BHD",note:null,icon:null,isManuallyActivated:false,allocations:[{id:"AL1",categoryId:"CH",budgetMinor:100000,sortOrder:0}],createdAt:now,updatedAt:now,archivedAt:null}],
    transactions:[
      mk({id:"T1",amountMinor:80000,categoryId:"CH",tripId:"TRIP",countAgainstWeeklyBudget:false}),
      mk({id:"T2",amountMinor:50000,categoryId:"CA",tripId:"TRIP",countAgainstWeeklyBudget:false}),
      mk({id:"T5",amountMinor:20000,categoryId:"CH",tripId:"TRIP",countAgainstWeeklyBudget:false,transactionType:"refund",relatedTransactionId:"T1"}),
      mk({id:"T6",amountMinor:99900,categoryId:"CH",tripId:"TRIP",countAgainstWeeklyBudget:false,transactionType:"transfer"}),
      mk({id:"N1",amountMinor:30000,categoryId:"CA",tripId:null,countAgainstWeeklyBudget:true})
    ]};
  localStorage.setItem("h2do-expenses",JSON.stringify(data)); }; }
const stat=async(p,label)=>{ const s=await p.$$eval("#expReportBody .exp-stat",els=>els.map(e=>e.querySelector("small").textContent+"|"+e.querySelector("b").textContent)); const f=s.find(x=>x.startsWith(label)); return f?f.split("|")[1]:null; };
(async()=>{
  const b=await chromium.launch();
  let p=await b.newPage({viewport:{width:1000,height:900}}); p.on("pageerror",e=>errs.push(e.message));
  await p.addInitScript(seed(), {tk:today()});
  await p.goto(fileUrl); await p.waitForTimeout(700);
  await openFamily(p);
  await p.click('.exp-tab[data-view="reports"]'); await p.waitForTimeout(150);

  console.log("Weekly (single-count, travel excluded, refund reduces)");
  await p.click('.exp-tab[data-rep="weekly"]'); await p.waitForTimeout(200);
  ok("normal budget 600", (await stat(p,"الميزانية العادية"))==="٦٠٠ ر.س");
  ok("normal consumption 300", (await stat(p,"المصروفات العادية"))==="٣٠٠ ر.س");
  ok("remaining 300 (travel NOT subtracted)", (await stat(p,"المتبقي"))==="٣٠٠ ر.س");
  ok("travel spending 1100 net (800+500-200 refund, transfer excluded)", (await stat(p,"✈️ مصروفات السفر"))==="١٬١٠٠ ر.س");
  ok("total actual 1400 (300+1100)", (await stat(p,"إجمالي المصروف الفعلي"))==="١٬٤٠٠ ر.س");

  console.log("Monthly (travel line, single count, year no separator)");
  await p.click('.exp-tab[data-rep="monthly"]'); await p.waitForTimeout(200);
  ok("month label year has no thousands sep", !(await p.$eval("#expReportBody .exp-rep-label",e=>e.textContent)).includes("٬٠"));
  ok("variable normal 300", (await stat(p,"المتغيّرة العادية"))==="٣٠٠ ر.س");
  ok("travel 1100", (await stat(p,"✈️ السفر"))==="١٬١٠٠ ر.س");
  ok("total net 1400 (counted once)", (await stat(p,"الإجمالي الصافي"))==="١٬٤٠٠ ر.س");

  console.log("Yearly (travel metrics, year format)");
  await p.click('.exp-tab[data-rep="yearly"]'); await p.waitForTimeout(200);
  ok("year label no separator", !(await p.$eval("#expReportBody .exp-rep-label",e=>e.textContent)).includes("٬"));
  ok("travel total 1100", (await stat(p,"إجمالي السفر"))==="١٬١٠٠ ر.س");
  ok("trip count 1", (await stat(p,"عدد الرحلات"))==="١");
  ok("total year 1400", (await stat(p,"إجمالي السنة"))==="١٬٤٠٠ ر.س");

  console.log("Daily dashboard breakdown normal/trip");
  await p.click('.exp-tab[data-rep="daily"]'); await p.waitForTimeout(200);
  const dtxt=await p.$eval("#expReportBody",e=>e.textContent);
  ok("daily shows normal/trip split", dtxt.includes("✈️ سفر") && dtxt.includes("عادي"));
  ok("daily net 1400 total (real money incl travel)", (await stat(p,"صافي الصرف"))==="١٬٤٠٠ ر.س");
  await p.close();

  console.log("Regression: existing features intact");
  p=await b.newPage({viewport:{width:1000,height:900}}); p.on("pageerror",e=>errs.push(e.message));
  await p.addInitScript(()=>localStorage.clear());
  await p.goto(fileUrl); await p.waitForTimeout(700);
  ok("tasks card exists", !!(await p.$("#tasks")));
  ok("priorities card exists", !!(await p.$("#priorities")));
  ok("quran card exists", !!(await p.$("#quranCard")));
  // add a normal expense (no trip) still works & counts weekly
  /* زر «＋ إضافة مصروف» انتقل من بطاقة الإطلاق (#expQuickAdd) إلى تبويب المالية (#expAddBtn) */
  await openFinance(p);
  await p.click("#expAddBtn"); await p.waitForTimeout(200);
  await p.fill("#efAmount","45.75");
  /* الفئات الهرمية تُلزم باختيار فئة فرعية قبل الحفظ — نختار أول شريحة متاحة */
  const chip=await p.$("[data-subchip]"); if(chip){ await chip.click(); await p.waitForTimeout(120); }
  await p.click("#efSave"); await p.waitForTimeout(400);
  let s=await rd(p);
  ok("normal expense: tripId null, countWeekly true", s.transactions[0].tripId===null && s.transactions[0].countAgainstWeeklyBudget===true && s.transactions[0].amountMinor===4575);
  // no trip -> no trip select shown (no active trips, no trips)
  await p.click("#expAddBtn"); await p.waitForTimeout(200);
  ok("no trip selector when no trips exist", !(await p.$("#efTrip")));
  await p.click("[data-close]").catch(()=>{});
  // mobile no overflow for exp elements
  await openFamily(p);
  await p.click('.exp-tab[data-view="trips"]'); await p.waitForTimeout(150);
  await p.setViewportSize({width:390,height:820}); await p.waitForTimeout(200);
  const ovf=await p.evaluate(()=>{ let bad=0; document.querySelectorAll("#expOverlay *").forEach(el=>{const r=el.getBoundingClientRect(); if(r.width>0&&r.right>window.innerWidth+1)bad++;}); return bad; });
  ok("no exp element horizontal overflow on mobile", ovf===0);
  console.log("\nRESULT: "+PASS+" passed, "+FAIL+" failed");
  console.log("PAGE JS ERRORS:", errs.length? [...new Set(errs)] : "none");
  await b.close();
  process.exit(FAIL>0?1:0);
})();
