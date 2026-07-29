"use strict";

/* انحدار: نقل المصروفات يدويًا بين الفئات يجب أن يصمد بعد الإغلاق وإعادة التحميل.
   العلّة الأصلية: تصحيحات البيانات التاريخية (V5 ثم V6 ثم V7) تُعاد على كل تحميل — وهو سلوك
   مقصود لمداواة النسخ السحابية — لكنها كانت تتعرّف على «السجل القديم» عبر حقول لا يغيّرها النقل
   اليدوي (createdAt، وبصمة التاريخ+العدد+المجموع)، فتسحب اختيار المستخدم إلى «احتياجات المنزل».
   السلسلة المرصودة: البقالة ← (V5) المطاعم والطلبات ← (V7) احتياجات المنزل، و(V6) تسحب ما في
   المطاعم بعد أن يُحدّث V5 ختمَه. الإصلاح: ختم categoryPinnedAt على أي إسناد يدوي، وكل ترحيل
   تلقائي يتخطّى السجلات المختومة. */

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

const HOME_ID="cat_home", GROCERY_ID="cat_grocery", REST_ID="cat_restaurants";

function buildFixture(){
  const now=Date.now();
  const CUTOFF=now-5e9;      /* createdAt الخاص بفئة المطاعم = الحدّ الزمني الذي يستخدمه V5 */
  const OLD=now-9e9;         /* فئات قديمة أُنشئت قبل الحدّ */
  const TX_CREATED=now-8e9;  /* معاملات قديمة أُنشئت قبل الحدّ */
  const MOVED_STAMP=now-4e9;
  const tx=(id,amountMinor,transactionDate,subcategory)=>({
    id,amountMinor,transactionDate,categoryId:HOME_ID,transactionType:"expense",
    description:subcategory,subcategory,subcategoryId:null,customSubcategory:null,
    sourceType:null,fixedTemplateId:null,fixedExpenseInstanceId:null,
    countAgainstWeeklyBudget:true,deletedAt:null,tripId:null,needsReview:false,
    createdAt:TX_CREATED,updatedAt:TX_CREATED
  });
  const cat=(id,seedKey,name,icon,sortOrder,budgets,createdAt)=>({
    id,seedKey,name,section:"variable",parentCategoryId:null,budgetPeriod:"weekly",
    showInWeeklyBudget:true,budgets,icon,subcategories:[],isActive:true,sortOrder,
    createdAt,updatedAt:createdAt,archivedAt:null
  });
  return {
    version:8,
    settings:{
      currency:"SAR",weekStartDay:6,salaryCycleStartDay:27,salaryAmountMinor:0,
      numberFormat:"ar-EG",defaultPaymentMethod:null,familyMembers:[],familyBudgetMinor:0,
      currentBudgetVersion:1,migratedLegacy:true,pristineSeed:false,createdAt:OLD,updatedAt:now-1e6,
      /* حساب قديم أُكملت فيه كل التصحيحات التاريخية مرّة واحدة */
      legacyBudgetPlacementV2:true,legacyBudgetPlacementV3:true,legacyBudgetPlacementV4:true,
      legacyFoodTransactionsV5:true,legacyFoodTransactionsMovedAtV5:MOVED_STAMP,
      legacyHomeTransactionsV6:true,legacyHomeBatchV7:true,
      legacyExceptionalToUnplannedV8:true,legacyExceptionalBudgetV9:true,legacyHistoryUnifiedV10:true
    },
    categories:[
      cat(GROCERY_ID,"البقالة","البقالة","🛒",0,[{from:"2026-06-01",amountMinor:25000}],OLD),
      cat(REST_ID,"المطاعم والطلبات","المطاعم والطلبات","🍽️",1,[{from:"2026-06-01",amountMinor:22000}],CUTOFF),
      cat(HOME_ID,"احتياجات المنزل","احتياجات المنزل","🏠",3,[],OLD)
    ],
    fixedTemplates:[],instances:[],
    /* نفس الدفعة المرصودة: ٣ معاملات بتاريخ ٢٠٢٦-٠٧-٢٧ مجموعها ٣٣٥٫٥٨ (بصمة V7) */
    transactions:[
      tx("tx_tamween_1",6673,"2026-07-27","تموين عام"),
      tx("tx_tamween_2",11325,"2026-07-27","تموين عام"),
      tx("tx_tamween_3",15560,"2026-07-27","تموين عام"),
      tx("tx_iftar",2800,"2026-07-28","إفطار"),
      tx("tx_futoor",2000,"2026-07-28","فطور")
    ],
    trips:[],savingsGoals:[],recurringTransactions:[],familyShopping:[],familyEvents:[],activityLog:[]
  };
}

const readState=page=>page.evaluate(()=>JSON.parse(localStorage.getItem("h2do-expenses")));
const catOf=(state,id)=>{const t=state.transactions.find(x=>x.id===id);return t?t.categoryId:"(missing)";};
const spentIn=(state,categoryId)=>state.transactions
  .filter(t=>!t.deletedAt&&t.categoryId===categoryId)
  .reduce((sum,t)=>sum+(t.transactionType==="refund"?-t.amountMinor:t.amountMinor),0);

test("manual expense-category transfer survives close/reopen and full reload",async()=>{
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  const page=await ctx.newPage();
  const errs=[]; page.on("pageerror",e=>errs.push(e.message.split("\n")[0]));
  try{
    await page.addInitScript(data=>{
      window.__MFKR_TEST__=true;
      if(!localStorage.getItem("h2do-expenses")) localStorage.setItem("h2do-expenses",JSON.stringify(data));
    },buildFixture());
    await page.route("https://www.gstatic.com/firebasejs/**",r=>r.abort());
    await page.goto(fileUrl); await page.waitForTimeout(700);

    let state=await readState(page);
    assert.equal(catOf(state,"tx_tamween_1"),HOME_ID,"يبدأ في احتياجات المنزل");

    /* افتح العائلة ثم الشاشة التي تعرض الفئات الأسبوعية */
    await page.locator('[data-app-view="expenses"]').click(); await page.waitForTimeout(200);
    await page.locator("#expOpenBtn").click(); await page.waitForTimeout(400);
    for(const view of ["finance","dash","family"]){
      const tab=page.locator('.exp-tab[data-view="'+view+'"]');
      if(await tab.count()){
        await tab.click(); await page.waitForTimeout(350);
        if(await page.locator('[data-catmenu="'+HOME_ID+'"]').count()) break;
      }
    }

    /* نفس مسار المستخدم: قائمة الفئة ← «نقل مصروفات هذا الأسبوع» */
    await page.locator('[data-catmenu="'+HOME_ID+'"]').first().click(); await page.waitForTimeout(300);
    await page.locator(".prio-menu-item").filter({hasText:"نقل مصروفات"}).first().click(); await page.waitForTimeout(400);
    assert.equal(await page.locator("[data-var-move]").count(),5,"الحوار يعرض مصروفات الأسبوع الخمسة");

    await page.evaluate(({groceryId,restId})=>{
      document.querySelectorAll("[data-var-move]").forEach(sel=>{
        const id=sel.dataset.varMove;
        if(id.indexOf("tx_tamween")===0) sel.value=groceryId;
        else if(id==="tx_iftar"||id==="tx_futoor") sel.value=restId;
      });
    },{groceryId:GROCERY_ID,restId:REST_ID});
    await page.locator("#expMoveSave").click(); await page.waitForTimeout(500);

    /* بعد الحفظ مباشرة */
    state=await readState(page);
    assert.equal(catOf(state,"tx_tamween_1"),GROCERY_ID);
    assert.equal(catOf(state,"tx_iftar"),REST_ID);
    assert.ok(state.transactions.find(t=>t.id==="tx_tamween_1").categoryPinnedAt>0,"يُختم الإسناد اليدوي");
    /* المبالغ والتواريخ والمعرّفات لا تتغيّر بالنقل */
    assert.equal(state.transactions.find(t=>t.id==="tx_tamween_1").amountMinor,6673);
    assert.equal(state.transactions.find(t=>t.id==="tx_tamween_1").transactionDate,"2026-07-27");
    assert.equal(state.transactions.length,5);

    /* إغلاق العائلة وإعادة فتحها */
    const closeBtn=page.locator("#expClose");
    if(await closeBtn.count()){ await closeBtn.click(); await page.waitForTimeout(300); }
    await page.locator("#expOpenBtn").click(); await page.waitForTimeout(500);
    state=await readState(page);
    assert.equal(catOf(state,"tx_tamween_1"),GROCERY_ID,"يصمد بعد إعادة فتح العائلة");
    assert.equal(catOf(state,"tx_iftar"),REST_ID);

    /* إعادة تحميل التطبيق كاملًا — هنا كانت تُعاد التصحيحات التاريخية فتسحب النقل */
    await page.reload(); await page.waitForTimeout(800);
    state=await readState(page);
    for(const id of ["tx_tamween_1","tx_tamween_2","tx_tamween_3"]) assert.equal(catOf(state,id),GROCERY_ID,id+" يبقى في البقالة بعد إعادة التحميل");
    for(const id of ["tx_iftar","tx_futoor"]) assert.equal(catOf(state,id),REST_ID,id+" يبقى في المطاعم والطلبات بعد إعادة التحميل");

    /* إعادة تحميل ثانية: التصحيحات لا تُعاد تدريجيًا عبر التحميلات */
    await page.reload(); await page.waitForTimeout(800);
    state=await readState(page);
    assert.equal(catOf(state,"tx_tamween_1"),GROCERY_ID);
    assert.equal(catOf(state,"tx_futoor"),REST_ID);

    /* مجاميع الفئات تتبع الإسناد الجديد (الميزانيات وأشرطة التقدّم والتنبيهات تُحسب منها) */
    assert.equal(spentIn(state,GROCERY_ID),33558,"مجموع البقالة = ٣٣٥٫٥٨");
    assert.equal(spentIn(state,REST_ID),4800,"مجموع المطاعم والطلبات = ٤٨٫٠٠");
    assert.equal(spentIn(state,HOME_ID),0,"لم يبقَ شيء في احتياجات المنزل");

    assert.deepEqual([...new Set(errs)],[],"بلا أخطاء JS");
  } finally { await ctx.close(); await browser.close(); }
});

test("automatic legacy correction still heals unpinned transactions",async()=>{
  /* حماية من الإفراط في الإصلاح: السجلات غير المختومة يجب أن تظل قابلة للمداواة التلقائية،
     كي لا نُبطل سلوك التصحيح التاريخي المقصود للنسخ السحابية. */
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  const page=await ctx.newPage();
  try{
    const fixture=buildFixture();
    /* معاملة قديمة في البقالة بلا ختم يدوي: يجب أن ينقلها V5 إلى المطاعم والطلبات */
    fixture.transactions=[Object.assign({},fixture.transactions[3],{id:"tx_unpinned",categoryId:GROCERY_ID,amountMinor:1000,transactionDate:"2026-07-28",subcategory:"وجبة",description:"وجبة"})];
    await page.addInitScript(data=>{
      window.__MFKR_TEST__=true;
      if(!localStorage.getItem("h2do-expenses")) localStorage.setItem("h2do-expenses",JSON.stringify(data));
    },fixture);
    await page.route("https://www.gstatic.com/firebasejs/**",r=>r.abort());
    await page.goto(fileUrl); await page.waitForTimeout(700);
    const state=await readState(page);
    assert.equal(catOf(state,"tx_unpinned"),REST_ID,"السجل غير المختوم ما زال يُداوى تلقائيًا");
  } finally { await ctx.close(); await browser.close(); }
});
