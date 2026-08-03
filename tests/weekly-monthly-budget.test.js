"use strict";

/* انحدار فعلي لبطاقة الميزانيات: الانتقال من أسبوع إلى آخر لا يبدّل الفئات أو
   المعاملات، فيما يبقى تجميع الشهر الميلادي شاملًا لصرف الأيام السابقة. */
function loadChromium(){
  for(const candidate of [process.env.PW_PATH,"playwright"]){
    try{return require(candidate).chromium;}catch(e){}
  }
  throw new Error("Playwright not found. Set PW_PATH=/path/to/playwright");
}

const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {chromium}={chromium:loadChromium()};
const fileUrl="file://"+path.resolve(__dirname,"..","index.html");
const launch=()=>chromium.launch(process.env.PW_EXECUTABLE_PATH?{executablePath:process.env.PW_EXECUTABLE_PATH}:undefined);

function fixture(){
  const now=1_700_000_000_000;
  const category={
    id:"restaurants",seedKey:"المطاعم والطلبات",name:"المطاعم والطلبات",section:"variable",
    parentCategoryId:null,budgetPeriod:"weekly",showInWeeklyBudget:true,
    budgets:[{from:"2026-01-01",amountMinor:22000}],icon:"🍽️",subcategories:[],isActive:true,
    sortOrder:1,createdAt:now,updatedAt:now,archivedAt:null
  };
  const tx=(id,date,amountMinor,type="expense",extra={})=>Object.assign({
    id,amountMinor,transactionDate:date,categoryId:"restaurants",transactionType:type,
    description:"اختبار",subcategory:null,subcategoryId:null,customSubcategory:null,sourceType:null,
    fixedTemplateId:null,fixedExpenseInstanceId:null,countAgainstWeeklyBudget:true,deletedAt:null,
    tripId:null,needsReview:false,createdAt:now,updatedAt:now
  },extra);
  return {
    version:16,
    settings:{currency:"SAR",weekStartDay:6,salaryCycleStartDay:27,salaryAmountMinor:0,numberFormat:"ar-EG",
      defaultPaymentMethod:null,familyMembers:[],familyBudgetMinor:0,currentBudgetVersion:1,migratedLegacy:true,
      pristineSeed:false,createdAt:now,updatedAt:now},
    categories:[category],fixedTemplates:[],instances:[],
    /* صرف يومي ١ و٢ أغسطس يبقى ضمن الشهر، لكن لا يدخل أسبوع ٣–٩ أغسطس. */
    transactions:[
      tx("aug1","2026-08-01",10000),
      tx("aug2","2026-08-02",5000),
      tx("refund","2026-08-02",2000,"refund"),
      tx("excluded","2026-08-03",9000,"expense",{countAgainstWeeklyBudget:false}),
      tx("deleted","2026-08-02",7000,"expense",{deletedAt:now+1})
    ],
    trips:[],savingsGoals:[],recurringTransactions:[],familyShopping:[],familyEvents:[],activityLog:[]
  };
}

test("weekly reset keeps configured categories and calendar-month progress without mutating data",async()=>{
  const browser=await launch();
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  const page=await ctx.newPage();
  const errors=[]; page.on("pageerror",error=>errors.push(error.message.split("\n")[0]));
  try{
    await page.addInitScript(data=>{
      const NativeDate=Date, fixed="2026-08-03T12:00:00";
      class FixedDate extends NativeDate{
        constructor(...args){ super(...(args.length?args:[fixed])); }
        static now(){ return new NativeDate(fixed).getTime(); }
      }
      window.Date=FixedDate;
      window.__MFKR_TEST__=true;
      localStorage.setItem("h2do-expenses",JSON.stringify(data));
      /* تفضيل قديم عالمي: كان يخفي الصرف الصفري بعد بداية الأسبوع الجديد. */
      localStorage.setItem("h2do-variable-expenses-view-v1",JSON.stringify({overOnly:true,sort:"custom"}));
    },fixture());
    await page.route("https://www.gstatic.com/firebasejs/**",route=>route.abort());
    await page.goto(fileUrl); await page.waitForTimeout(800);

    const before=await page.evaluate(()=>window.__mfkrExp.state());
    const result=await page.evaluate(()=>window.__mfkrExp.varProgress("2026-08-03"));
    const row=result.rows.find(item=>item.c.id==="restaurants");
    assert.ok(row,"الفئة ذات الميزانية تبقى في قائمة التقدّم حتى من دون صرف أسبوعي");
    assert.deepEqual(result.week,{start:"2026-08-03",end:"2026-08-09",cycleStart:"2026-07-27",cycleEnd:"2026-08-26"});
    assert.deepEqual(result.month,{start:"2026-08-01",end:"2026-08-31"});
    assert.equal(row.weeklyBudget,22000);
    assert.equal(row.weeklySpent,0,"المعاملات قبل ٣ أغسطس لا تدخل الأسبوع الجديد");
    assert.equal(row.monthlyBudget,Math.round(22000*31/7),"خطة أغسطس تشتق من ٣١ يومًا، لا من ×٤ أو دورة الراتب");
    assert.equal(row.monthlySpent,13000,"الشهر يحفظ ١ و٢ أغسطس ويستثني المسترد والمحذوف والمستبعد");

    const markup=await page.evaluate(()=>window.__mfkrExp.renderVarCard());
    assert.match(markup,/المطاعم والطلبات/);
    assert.match(markup,/هذا الأسبوع/);
    assert.match(markup,/هذا الشهر/);
    assert.match(markup,/لم يُصرف شيء من/);
    assert.doesNotMatch(markup,/دورة الراتب/);
    assert.doesNotMatch(markup,/NaN|Infinity/);

    const after=await page.evaluate(()=>window.__mfkrExp.state());
    assert.deepEqual(after.categories.map(c=>({id:c.id,budgets:c.budgets,visible:c.showInWeeklyBudget})),before.categories.map(c=>({id:c.id,budgets:c.budgets,visible:c.showInWeeklyBudget})));
    assert.deepEqual(after.transactions.map(t=>({id:t.id,amountMinor:t.amountMinor,transactionDate:t.transactionDate,categoryId:t.categoryId,deletedAt:t.deletedAt})),before.transactions.map(t=>({id:t.id,amountMinor:t.amountMinor,transactionDate:t.transactionDate,categoryId:t.categoryId,deletedAt:t.deletedAt})));
    assert.deepEqual([...new Set(errors)],[]);
  } finally { await ctx.close(); await browser.close(); }
});
