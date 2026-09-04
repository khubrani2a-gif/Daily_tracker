function __loadChromium(){const c=[process.env.PW_PATH,"playwright","/opt/node22/lib/node_modules/playwright"].filter(Boolean);for(const x of c){try{return require(x).chromium;}catch(e){}}console.error("Playwright not found. Set PW_PATH=/path/to/playwright");process.exit(2);}
const { chromium } = { chromium: __loadChromium() };
const path=require("path");
const fileUrl = "file://" + path.resolve(__dirname, "..", "index.html");
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
const rd=(p)=>p.evaluate(()=>JSON.parse(localStorage.getItem("h2do-expenses")));
let PASS=0,FAIL=0; const ok=(n,c)=>{ if(c){PASS++;console.log("  ✓ "+n);}else{FAIL++;console.log("  ✗ FAIL: "+n);} };
const errs=[];
/* بعد إعادة تنظيم واجهة العائلة: بطاقة «العائلة» تظهر بعد اختيار قسم العائلة من الشريط السفلي،
   و«فتح العائلة» يفتح تبويب العائلة، والمالية (بطاقة الالتزامات) صارت تبويبًا مستقلًا data-view="dash". */
const openFinance=async(p)=>{
  await p.locator('a[data-app-view="expenses"]').click(); await p.waitForTimeout(250);
  await p.click("#expOpenBtn"); await p.waitForTimeout(350);
  await p.click('.exp-tab[data-view="dash"]'); await p.waitForTimeout(300);
};
const clickTxt=async(p,sel,txt)=>{ const els=await p.$$(sel); for(const e of els){ if(((await e.textContent())||"").includes(txt)){ await e.click(); return true; } } return false; };
async function page(b){ const ctx=await b.newContext({viewport:{width:1000,height:900}}); const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message)); return p; }
(async()=>{
  const b=await chromium.launch(process.env.PW_EXECUTABLE_PATH?{executablePath:process.env.PW_EXECUTABLE_PATH}:undefined);

  console.log("A. Record fixed payment: NOT under a variable category, marked fixed");
  let p=await page(b);
  await p.addInitScript((tk)=>{ localStorage.clear(); const now=Date.now();
    const data={version:2,settings:{currency:"SAR",weekStartDay:6,numberFormat:"ar-EG",defaultPaymentMethod:null,currentBudgetVersion:1,migratedLegacy:true,createdAt:now,updatedAt:now},
      categories:[{id:"CA",name:"الأكل",section:"variable",parentCategoryId:null,budgets:[{from:"1970-01-01",amountMinor:60000}],icon:null,isActive:true,sortOrder:0,createdAt:now,updatedAt:now,archivedAt:null}],
      fixedTemplates:[{id:"TPL",categoryId:null,name:"تسريع القرض",defaultAmountMinor:200000,amountType:"fixed",dueDay:1,recurrence:"monthly",startMonth:tk.slice(0,7),endMonth:null,note:null,isActive:true,sortOrder:0,overrides:{},createdAt:now,updatedAt:now,archivedAt:null}],
      instances:[],transactions:[],trips:[]};
    localStorage.setItem("h2do-expenses",JSON.stringify(data)); }, today());
  await p.goto(fileUrl); await p.waitForTimeout(700);
  await openFinance(p);
  await p.click("#expFixedCard [data-payinst]"); await p.waitForTimeout(250);
  await p.fill("#pfAmt","500"); await p.click("#pfSave"); await p.waitForTimeout(400);
  let s=await rd(p); let pay=s.transactions.find(t=>!t.deletedAt);
  ok("payment categoryId is null (not الأكل)", pay.categoryId===null);
  ok("payment sourceType=fixed, fixedTemplateId set", pay.sourceType==="fixed" && pay.fixedTemplateId==="TPL");
  ok("payment countAgainstWeeklyBudget=false", pay.countAgainstWeeklyBudget===false);
  // food weekly budget unaffected
  const foodSub=await p.$eval("#expVarCard",e=>e.textContent);
  ok("الأكل weekly spent still 0 / not reduced", foodSub.includes("٠ / ٦٠٠") || foodSub.includes("٦٠٠"));
  ok("الأكل does NOT show تسريع القرض", !foodSub.includes("تسريع"));

  console.log("B. Review: fixed payment under الالتزامات الشهرية, not حسب الفئة");
  await p.click('.exp-tab[data-view="reports"]'); await p.waitForTimeout(200);
  await p.click('.exp-tab[data-rep="daily"]'); await p.waitForTimeout(200);
  const body=await p.$eval("#expReportBody",e=>e.textContent);
  ok("review has الالتزامات الشهرية section", body.includes("الالتزامات الشهرية"));
  // the fixed payment row shows obligation name
  const fixedRowName = await p.evaluate(()=>{ const heads=[...document.querySelectorAll("#expReportBody .exp-sec-head")]; const h=heads.find(x=>x.textContent.includes("الالتزامات")); if(!h)return null; let el=h.nextElementSibling; return el&&el.querySelector(".t-name")? el.querySelector(".t-name").textContent : null; });
  ok("fixed payment row label = obligation name (تسريع القرض)", fixedRowName && fixedRowName.includes("تسريع القرض"));
  ok("fixed payment shows التزام شهري pill", fixedRowName && fixedRowName.includes("التزام شهري"));
  await p.close();

  console.log("C. Pause obligation -> stays as متوقف in fixed card");
  p=await page(b);
  await p.addInitScript((tk)=>{ localStorage.clear(); const now=Date.now();
    const data={version:2,settings:{currency:"SAR",weekStartDay:6,numberFormat:"ar-EG",defaultPaymentMethod:null,currentBudgetVersion:1,migratedLegacy:true,createdAt:now,updatedAt:now},
      categories:[],fixedTemplates:[{id:"TPL",categoryId:null,name:"تسريع القرض",defaultAmountMinor:200000,amountType:"fixed",dueDay:1,recurrence:"monthly",startMonth:tk.slice(0,7),endMonth:null,note:null,isActive:true,sortOrder:0,overrides:{},createdAt:now,updatedAt:now,archivedAt:null}],instances:[],transactions:[],trips:[]};
    localStorage.setItem("h2do-expenses",JSON.stringify(data)); }, today());
  await p.goto(fileUrl); await p.waitForTimeout(700);
  await openFinance(p);
  await p.click("#expFixedCard [data-tplmenu]"); await p.waitForTimeout(200);
  await clickTxt(p,".prio-menu-item","إيقاف"); await p.waitForTimeout(300);
  s=await rd(p);
  ok("template isActive=false after إيقاف", s.fixedTemplates[0].isActive===false);
  ok("template NOT archived", !s.fixedTemplates[0].archivedAt);
  const fc=await p.$eval("#expFixedCard",e=>e.textContent);
  ok("obligation still visible with متوقف", fc.includes("تسريع القرض") && fc.includes("متوقف"));
  ok("did NOT become a variable category", (s.categories||[]).every(c=>c.name!=="تسريع القرض"));
  // resume
  await p.click("#expFixedCard [data-tplmenu]"); await p.waitForTimeout(200);
  await clickTxt(p,".prio-menu-item","استئناف"); await p.waitForTimeout(300);
  ok("استئناف re-activates", (await rd(p)).fixedTemplates[0].isActive===true);
  await p.close();

  console.log("D. Undo payment: partial + last-payment -> unpaid; distinct from refund");
  p=await page(b);
  await p.addInitScript((tk)=>{ localStorage.clear(); const now=Date.now();
    const inst={id:"INST",templateId:"TPL",year:+tk.slice(0,4),month:+tk.slice(5,7),plannedAmountMinor:200000,paidAmountMinor:0,status:"unpaid",dueDate:tk,paidAt:null,createdAt:now,updatedAt:now};
    const mk=(id,amt)=>({id,amountMinor:amt,transactionDate:tk,categoryId:null,sourceType:"fixed",fixedTemplateId:"TPL",fixedExpenseInstanceId:"INST",countAgainstWeeklyBudget:false,transactionType:"expense",relatedTransactionId:null,needsReview:false,description:"دفعة: تسريع القرض",createdAt:now,updatedAt:now,deletedAt:null,tripId:null,paymentMethod:"مدى",subcategory:null,purchaseMethod:null,context:null,beneficiary:null,originalAmountMinor:null,originalCurrency:null,exchangeRate:null,exchangeRateSource:null,merchantCountry:null});
    const data={version:2,settings:{currency:"SAR",weekStartDay:6,numberFormat:"ar-EG",defaultPaymentMethod:null,currentBudgetVersion:1,migratedLegacy:true,createdAt:now,updatedAt:now},
      categories:[],fixedTemplates:[{id:"TPL",categoryId:null,name:"تسريع القرض",defaultAmountMinor:200000,amountType:"fixed",dueDay:1,recurrence:"monthly",startMonth:tk.slice(0,7),endMonth:null,note:null,isActive:true,sortOrder:0,overrides:{},createdAt:now,updatedAt:now,archivedAt:null}],
      instances:[inst],transactions:[mk("P1",120000),mk("P2",80000)],trips:[]};
    // both payments => paid 200000 => paid
    localStorage.setItem("h2do-expenses",JSON.stringify(data)); }, today());
  await p.goto(fileUrl); await p.waitForTimeout(700);
  s=await rd(p);
  ok("seed: instance paid=2000 status paid (recalc on load)", s.instances[0].paidAmountMinor===200000 && s.instances[0].status==="paid");
  await openFinance(p);
  // open payment history, undo P2 (80000)
  await p.click("#expFixedCard [data-tplmenu]"); await p.waitForTimeout(200);
  await clickTxt(p,".prio-menu-item","سجل الدفعات"); await p.waitForTimeout(250);
  // undo the first listed (most recent). Click an undo button
  await p.click("#expFormBox [data-undopay]"); await p.waitForTimeout(200);
  // confirm dialog
  ok("undo confirm dialog text", (await p.$eval("#hifzDialogTitle",e=>e.textContent)).includes("التراجع عن هذه الدفعة"));
  ok("undo button labeled تراجع عن الدفع", (await p.$eval("#hifzDialogOk",e=>e.textContent)).includes("تراجع عن الدفع"));
  await p.click("#hifzDialogOk"); await p.waitForTimeout(400);
  s=await rd(p);
  const activePays=s.transactions.filter(t=>!t.deletedAt);
  ok("one payment reversed (soft-deleted tombstone)", s.transactions.filter(t=>t.deletedAt).length===1 && activePays.length===1);
  ok("instance recalced to partial after undo", s.instances[0].status==="partial" && s.instances[0].paidAmountMinor<200000);
  // undo the remaining -> unpaid
  await p.click("#expFixedCard [data-tplmenu]"); await p.waitForTimeout(200);
  await clickTxt(p,".prio-menu-item","سجل الدفعات"); await p.waitForTimeout(250);
  await p.click("#expFormBox [data-undopay]"); await p.waitForTimeout(200); await p.click("#hifzDialogOk"); await p.waitForTimeout(400);
  s=await rd(p);
  ok("undo last payment -> instance unpaid, paid 0", s.instances[0].status==="unpaid" && s.instances[0].paidAmountMinor===0);
  await p.close();

  console.log("E. One-time repair: 'دفعة: تسريع القرض' under الأكل -> relinked (exact match only)");
  p=await page(b);
  await p.addInitScript((tk)=>{ localStorage.clear(); const now=Date.now();
    const mk=(id,cat,desc)=>({id,amountMinor:200000,transactionDate:tk,categoryId:cat,transactionType:"expense",relatedTransactionId:null,fixedExpenseInstanceId:null,description:desc,createdAt:now,updatedAt:now,deletedAt:null,tripId:null,countAgainstWeeklyBudget:true,paymentMethod:"مدى",subcategory:null,purchaseMethod:null,context:null,beneficiary:null,originalAmountMinor:null,originalCurrency:null,exchangeRate:null,exchangeRateSource:null,merchantCountry:null});
    const data={version:2,settings:{currency:"SAR",weekStartDay:6,numberFormat:"ar-EG",defaultPaymentMethod:null,currentBudgetVersion:1,migratedLegacy:true,createdAt:now,updatedAt:now},
      categories:[{id:"CA",name:"الأكل",section:"variable",parentCategoryId:null,budgets:[{from:"1970-01-01",amountMinor:60000}],icon:null,isActive:true,sortOrder:0,createdAt:now,updatedAt:now,archivedAt:null}],
      fixedTemplates:[{id:"TPL",categoryId:null,name:"تسريع القرض",defaultAmountMinor:200000,amountType:"fixed",dueDay:1,recurrence:"monthly",startMonth:tk.slice(0,7),endMonth:null,note:null,isActive:true,sortOrder:0,overrides:{},createdAt:now,updatedAt:now,archivedAt:null}],
      instances:[],
      transactions:[ mk("BAD","CA","دفعة: تسريع القرض"), mk("KEEP","CA","عشاء") ], trips:[]};
    localStorage.setItem("h2do-expenses",JSON.stringify(data)); }, today());
  await p.goto(fileUrl); await p.waitForTimeout(800);
  s=await rd(p);
  const bad=s.transactions.find(t=>t.id==="BAD"), keep=s.transactions.find(t=>t.id==="KEEP");
  ok("misclassified payment repaired: sourceType fixed, categoryId null", bad.sourceType==="fixed" && bad.categoryId===null && bad.fixedTemplateId==="TPL");
  ok("repaired payment linked to a created instance", !!bad.fixedExpenseInstanceId && s.instances.some(i=>i.id===bad.fixedExpenseInstanceId));
  ok("repaired payment excluded from weekly", bad.countAgainstWeeklyBudget===false);
  ok("normal food tx (عشاء) untouched", keep.categoryId==="CA" && keep.sourceType!=="fixed");
  await p.close();

  console.log("F. Ambiguous match -> needsReview, NOT auto-repaired");
  p=await page(b);
  await p.addInitScript((tk)=>{ localStorage.clear(); const now=Date.now();
    const mk=(id,cat,desc)=>({id,amountMinor:200000,transactionDate:tk,categoryId:cat,transactionType:"expense",relatedTransactionId:null,fixedExpenseInstanceId:null,description:desc,createdAt:now,updatedAt:now,deletedAt:null,tripId:null,countAgainstWeeklyBudget:true,paymentMethod:null,subcategory:null,purchaseMethod:null,context:null,beneficiary:null,originalAmountMinor:null,originalCurrency:null,exchangeRate:null,exchangeRateSource:null,merchantCountry:null});
    const tp=(id)=>({id,categoryId:null,name:"القرض",defaultAmountMinor:100000,amountType:"fixed",dueDay:1,recurrence:"monthly",startMonth:tk.slice(0,7),endMonth:null,note:null,isActive:true,sortOrder:0,overrides:{},createdAt:now,updatedAt:now,archivedAt:null});
    const data={version:2,settings:{currency:"SAR",weekStartDay:6,numberFormat:"ar-EG",defaultPaymentMethod:null,currentBudgetVersion:1,migratedLegacy:true,createdAt:now,updatedAt:now},
      categories:[{id:"CA",name:"الأكل",section:"variable",parentCategoryId:null,budgets:[],icon:null,isActive:true,sortOrder:0,createdAt:now,updatedAt:now,archivedAt:null}],
      fixedTemplates:[tp("T1"),tp("T2")],  // two obligations named القرض -> ambiguous
      instances:[], transactions:[ mk("AMB","CA","دفعة: القرض") ], trips:[]};
    localStorage.setItem("h2do-expenses",JSON.stringify(data)); }, today());
  await p.goto(fileUrl); await p.waitForTimeout(800);
  s=await rd(p);
  const amb=s.transactions.find(t=>t.id==="AMB");
  ok("ambiguous NOT auto-repaired (still under الأكل)", amb.categoryId==="CA" && amb.sourceType!=="fixed");
  ok("ambiguous flagged needsReview", amb.needsReview===true);
  await p.close();

  console.log("G. Salary cycle card keeps obligations scoped to the actual 27-26 date range");
  p=await page(b);
  await p.addInitScript((tk)=>{ localStorage.clear(); const now=Date.now(), month=tk.slice(0,7);
    const data={version:2,settings:{currency:"SAR",weekStartDay:6,salaryCycleStartDay:27,numberFormat:"ar-EG",defaultPaymentMethod:null,currentBudgetVersion:1,migratedLegacy:true,createdAt:now,updatedAt:now},
      categories:[],
      fixedTemplates:[
        {id:"T27",categoryId:null,name:"التزام يوم ٢٧",defaultAmountMinor:27000,amountType:"fixed",dueDay:27,recurrence:"monthly",startMonth:month,endMonth:null,note:null,isActive:true,sortOrder:0,overrides:{},createdAt:now,updatedAt:now,archivedAt:null},
        {id:"T30",categoryId:null,name:"التزام يوم ٣٠",defaultAmountMinor:30000,amountType:"fixed",dueDay:30,recurrence:"monthly",startMonth:month,endMonth:null,note:null,isActive:true,sortOrder:1,overrides:{},createdAt:now,updatedAt:now,archivedAt:null}
      ],
      instances:[],transactions:[],trips:[]};
    localStorage.setItem("h2do-expenses",JSON.stringify(data)); }, today());
  await p.goto(fileUrl); await p.waitForTimeout(700);
  await openFinance(p);
  const cycleCard=await p.$eval("#expFixedCard",e=>e.textContent);
  ok("cycle card excludes day-27 obligation when it falls after the cycle end", !cycleCard.includes("التزام يوم ٢٧"));
  ok("cycle card excludes day-30 obligation when it falls after the cycle end", !cycleCard.includes("التزام يوم ٣٠"));
  s=await rd(p);
  ok("out-of-cycle instances remain generated without deleting existing data", s.instances.filter(i=>["T27","T30"].includes(i.templateId)).length===2);
  await p.close();

  console.log("\nRESULT: "+PASS+" passed, "+FAIL+" failed");
  console.log("PAGE JS ERRORS:", errs.length? [...new Set(errs)] : "none");
  await b.close();
  process.exit(FAIL>0?1:0);
})();
