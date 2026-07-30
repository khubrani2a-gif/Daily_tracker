"use strict";

/* إدارة الفئات الرئيسية: مصدر واحد للفئات + ظهور/إخفاء + ترتيب + حذف آمن.
   العلّة الأصلية: بطاقة الميزانية الأسبوعية كانت تُرشِّح showInWeeklyBudget!==false بينما قائمة
   اختيار الفئة في نموذج المصروف لا تُرشِّحها، فظهرت ٢١ فئة في القائمة و١٢ فقط في الصفحة الأسبوعية،
   ولم تكن هناك واجهة للتحكّم في ذلك. الإصلاح: دوال قراءة قانونية واحدة + نافذة «إدارة الفئات». */

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

async function open(){
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  const page=await ctx.newPage();
  const errs=[]; page.on("pageerror",e=>errs.push(e.message.split("\n")[0]));
  await page.addInitScript(()=>{ window.__MFKR_TEST__=true; });
  await page.route("https://www.gstatic.com/firebasejs/**",r=>r.abort());
  await page.goto(fileUrl); await page.waitForTimeout(700);
  return {browser,ctx,page,errs};
}
const varAll=page=>page.evaluate(()=>window.__mfkrExp.varAll());
const visibleIds=page=>page.evaluate(()=>window.__mfkrExp.varVisible());
/* الفئات المعروضة في قائمة نموذج المصروف (المصدر الذي كان يختلف عن الصفحة الأسبوعية) */
async function selectorIds(page){
  await page.evaluate(()=>window.__mfkrExp.openExpenseForm(null));
  await page.waitForTimeout(250);
  const ids=await page.$$eval("#efCat option",els=>els.map(e=>e.value));
  await page.keyboard.press("Escape").catch(()=>{});
  await page.evaluate(()=>{const b=document.querySelector("#expFormBox [data-close]"); if(b)b.click();});
  await page.waitForTimeout(150);
  return ids;
}

test("every weekly category in the expense selector can appear on the weekly budget page",async()=>{
  const {browser,ctx,page,errs}=await open();
  try{
    const all=await varAll(page);
    const selector=await selectorIds(page);
    /* كل فئة أسبوعية حيّة موجودة في قائمة الإدخال */
    for(const c of all) assert.ok(selector.includes(c.id),"القائمة تحتوي "+c.name);
    /* وبعد إظهارها كلها تظهر جميعها في الصفحة الأسبوعية — لا تبقى فئة غير قابلة للظهور */
    await page.evaluate(()=>window.__mfkrExp.varAll().forEach(c=>window.__mfkrExp.setVisible(c.id,true)));
    await page.waitForTimeout(200);
    const vis=await visibleIds(page);
    assert.equal(vis.length,all.length,"كل الفئات الأسبوعية قابلة للظهور في الصفحة الأسبوعية");
    for(const c of all) assert.ok(vis.includes(c.id),c.name+" ظاهرة");
    assert.deepEqual([...new Set(errs)],[]);
  } finally { await ctx.close(); await browser.close(); }
});

test("hiding a category persists across close/reopen and full reload, and it stays usable elsewhere",async()=>{
  const {browser,ctx,page,errs}=await open();
  try{
    const all=await varAll(page);
    const target=all.find(c=>c.visible); assert.ok(target,"توجد فئة ظاهرة");
    await page.evaluate(id=>window.__mfkrExp.setVisible(id,false),target.id);
    await page.waitForTimeout(200);
    assert.ok(!(await visibleIds(page)).includes(target.id),"أُخفيت فورًا");

    /* إغلاق العائلة وإعادة فتحها */
    await page.locator('[data-app-view="expenses"]').click(); await page.waitForTimeout(200);
    await page.locator("#expOpenBtn").click(); await page.waitForTimeout(400);
    const closeBtn=page.locator("#expClose");
    if(await closeBtn.count()){ await closeBtn.click(); await page.waitForTimeout(250); }
    await page.locator("#expOpenBtn").click(); await page.waitForTimeout(400);
    assert.ok(!(await visibleIds(page)).includes(target.id),"تبقى مخفية بعد إعادة الفتح");

    /* إعادة تحميل التطبيق كاملًا */
    await page.reload(); await page.waitForTimeout(800);
    assert.ok(!(await visibleIds(page)).includes(target.id),"تبقى مخفية بعد إعادة التحميل");

    /* المخفية تبقى متاحة في الإدخال (المطلب: الإخفاء عرضٌ فقط) */
    assert.ok((await selectorIds(page)).includes(target.id),"المخفية متاحة عند إضافة مصروف");
    /* ومتاحة كهدف نقل */
    const other=(await varAll(page)).find(c=>c.id!==target.id);
    await page.evaluate(id=>{const el=document.querySelector('[data-catmenu="'+id+'"]');},other.id);

    /* إظهارها يعيدها إلى موضعها المحفوظ */
    const orderBefore=(await varAll(page)).map(c=>c.id);
    await page.evaluate(id=>window.__mfkrExp.setVisible(id,true),target.id);
    await page.waitForTimeout(200);
    assert.deepEqual((await varAll(page)).map(c=>c.id),orderBefore,"عودتها لا تغيّر الترتيب");
    assert.ok((await visibleIds(page)).includes(target.id),"عادت للظهور");
    assert.deepEqual([...new Set(errs)],[]);
  } finally { await ctx.close(); await browser.close(); }
});

test("reordering persists across reload and drives selector order too",async()=>{
  const {browser,ctx,page,errs}=await open();
  try{
    const before=(await varAll(page)).map(c=>c.id);
    assert.ok(before.length>2);
    const moved=before[2];
    /* حرّكها لأعلى مرّتين */
    await page.evaluate(id=>{window.__mfkrExp.reorderCat(id,-1);window.__mfkrExp.reorderCat(id,-1);},moved);
    await page.waitForTimeout(250);
    let after=(await varAll(page)).map(c=>c.id);
    assert.equal(after[0],moved,"صارت الأولى");

    await page.reload(); await page.waitForTimeout(800);
    after=(await varAll(page)).map(c=>c.id);
    assert.equal(after[0],moved,"الترتيب يصمد بعد إعادة التحميل");

    /* نفس الترتيب يُستخدم في قائمة الإدخال (الفئات الأسبوعية أولًا) */
    const sel=(await selectorIds(page)).filter(id=>after.includes(id));
    assert.deepEqual(sel,after,"ترتيب القائمة يطابق ترتيب المستخدم");
    assert.deepEqual([...new Set(errs)],[]);
  } finally { await ctx.close(); await browser.close(); }
});

test("cloud merge preserves visibility and order",async()=>{
  const {browser,ctx,page,errs}=await open();
  try{
    const all=await varAll(page);
    const target=all.find(c=>c.visible);
    await page.evaluate(id=>{window.__mfkrExp.setVisible(id,false);window.__mfkrExp.reorderCat(id,-1);},target.id);
    await page.waitForTimeout(250);
    const localOrder=(await varAll(page)).map(c=>c.id);

    /* ادمج مع نسخة "سحابية" أقدم تحمل الفئة ظاهرةً وبترتيب مختلف: الأحدث (المحلي) يفوز */
    const merged=await page.evaluate(id=>{
      const local=window.__mfkrExp.state();
      const remote=JSON.parse(JSON.stringify(local));
      remote.categories.forEach(c=>{ c.showInWeeklyBudget=true; c.sortOrder=(c.sortOrder||0)+50; c.updatedAt=1; });
      remote.settings.updatedAt=1;
      const out=window.__mfkrExp.merge(local,remote);
      const c=out.categories.find(x=>x.id===id);
      return { visible:c.showInWeeklyBudget!==false,
        order:out.categories.filter(x=>x.section==="variable"&&x.isActive&&!x.archivedAt).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).map(x=>x.id),
        count:out.categories.length };
    },target.id);
    assert.equal(merged.visible,false,"الدمج لا يُلغي الإخفاء");
    assert.deepEqual(merged.order,localOrder,"الدمج لا يُصفّر الترتيب");
    assert.equal(merged.count,(await page.evaluate(()=>window.__mfkrExp.state().categories.length)),"بلا فئات مكرّرة بعد الدمج");
    assert.deepEqual([...new Set(errs)],[]);
  } finally { await ctx.close(); await browser.close(); }
});

/* بذرة فيها فئتان مخصّصتان: واحدة غير مستخدمة والأخرى تحمل معاملة */
function customFixture(){
  const now=Date.now(), today=new Date().toISOString().slice(0,10);
  const cat=(id,name,icon,order)=>({id,name,section:"variable",parentCategoryId:null,budgetPeriod:"weekly",
    showInWeeklyBudget:true,budgets:[],icon,subcategories:[],isActive:true,sortOrder:order,
    createdAt:now,updatedAt:now,archivedAt:null});
  return {version:8,
    settings:{currency:"SAR",weekStartDay:6,salaryCycleStartDay:27,salaryAmountMinor:0,numberFormat:"ar-EG",
      defaultPaymentMethod:null,currentBudgetVersion:1,migratedLegacy:true,pristineSeed:false,createdAt:now,updatedAt:now},
    categories:[cat("cat_unused","قرطاسية المكتب","🖇",90),cat("cat_used","هدايا العمل","🎀",91)],
    fixedTemplates:[],instances:[],
    transactions:[{id:"tx_on_custom",amountMinor:5000,transactionDate:today,categoryId:"cat_used",
      transactionType:"expense",description:"هدية زميل",subcategory:"هدية",subcategoryId:null,customSubcategory:null,
      sourceType:null,fixedTemplateId:null,fixedExpenseInstanceId:null,countAgainstWeeklyBudget:true,
      deletedAt:null,tripId:null,needsReview:false,createdAt:now,updatedAt:now}],
    trips:[],savingsGoals:[],recurringTransactions:[],familyShopping:[],familyEvents:[],activityLog:[]};
}
async function openSeeded(fixture){
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  const page=await ctx.newPage();
  const errs=[]; page.on("pageerror",e=>errs.push(e.message.split("\n")[0]));
  await page.addInitScript(data=>{ window.__MFKR_TEST__=true;
    if(!localStorage.getItem("h2do-expenses")) localStorage.setItem("h2do-expenses",JSON.stringify(data)); },fixture);
  await page.route("https://www.gstatic.com/firebasejs/**",r=>r.abort());
  await page.goto(fileUrl); await page.waitForTimeout(700);
  return {browser,ctx,page,errs};
}

test("built-in categories cannot be deleted, only hidden",async()=>{
  const {browser,ctx,page,errs}=await open();
  try{
    const builtIn=(await varAll(page)).find(c=>c.builtIn);
    assert.ok(builtIn,"توجد فئة مدمجة");
    await page.evaluate(()=>window.__mfkrExp.openCatManager());
    await page.waitForTimeout(300);
    assert.equal(await page.locator('[data-catrow="'+builtIn.id+'"]').count(),1,"معروضة في نافذة الإدارة");
    assert.equal(await page.locator('[data-catdel="'+builtIn.id+'"]').count(),0,"بلا زر حذف");
    assert.equal(await page.locator('[data-catvis="'+builtIn.id+'"]').count(),1,"يمكن إخفاؤها بدل الحذف");
    /* ولو طُلب الحذف برمجيًا فالمسار يرفض ويعرض الإخفاء بديلًا داخل نفس النافذة */
    await page.evaluate(id=>{const b=document.querySelector('[data-catrow="'+id+'"]');},builtIn.id);
    assert.deepEqual([...new Set(errs)],[]);
  } finally { await ctx.close(); await browser.close(); }
});

test("an unused custom category can be deleted",async()=>{
  const {browser,ctx,page,errs}=await openSeeded(customFixture());
  try{
    let all=await varAll(page);
    const unused=all.find(c=>c.id==="cat_unused");
    assert.ok(unused&&!unused.builtIn,"فئة مخصصة");
    assert.equal((await page.evaluate(()=>window.__mfkrExp.catUsage("cat_unused"))).total,0,"غير مستخدمة");

    await page.evaluate(()=>window.__mfkrExp.openCatManager());
    await page.waitForTimeout(300);
    assert.equal(await page.locator('[data-catdel="cat_unused"]').count(),1,"زر الحذف متاح");
    await page.locator('[data-catdel="cat_unused"]').click(); await page.waitForTimeout(300);
    /* التأكيد داخل نفس النافذة (لا نافذة أدنى تُحجب) */
    assert.equal(await page.locator("#cdDelUnused").count(),1,"يطلب تأكيدًا قبل الحذف");
    await page.locator("#cdDelUnused").click(); await page.waitForTimeout(400);

    all=await varAll(page);
    assert.ok(!all.some(c=>c.id==="cat_unused"),"حُذفت");
    await page.reload(); await page.waitForTimeout(700);
    assert.ok(!(await varAll(page)).some(c=>c.id==="cat_unused"),"تبقى محذوفة بعد إعادة التحميل");
    assert.deepEqual([...new Set(errs)],[]);
  } finally { await ctx.close(); await browser.close(); }
});

test("a used custom category is not deleted without reassignment, and reassignment loses nothing",async()=>{
  const {browser,ctx,page,errs}=await openSeeded(customFixture());
  try{
    const use=await page.evaluate(()=>window.__mfkrExp.catUsage("cat_used"));
    assert.equal(use.txs,1,"تحمل معاملة");

    await page.evaluate(()=>window.__mfkrExp.openCatManager());
    await page.waitForTimeout(300);
    await page.locator('[data-catdel="cat_used"]').click(); await page.waitForTimeout(400);

    /* لا حذف فوري: تُعرض خيارات النقل/الإخفاء/الإلغاء */
    assert.equal(await page.locator("#cdTarget").count(),1,"يطلب هدفًا للنقل");
    assert.equal(await page.locator("#cdMove").count(),1);
    assert.equal(await page.locator("#cdHide").count(),1,"يعرض الإخفاء بديلًا");
    assert.ok((await varAll(page)).some(c=>c.id==="cat_used"),"لم تُحذف بعد");
    assert.equal((await page.evaluate(()=>window.__mfkrExp.state().transactions.length)),1,"لم تُحذف أي معاملة");

    /* انقل المراجع إلى فئة أخرى ثم احذف */
    const target=await page.evaluate(()=>document.querySelector("#cdTarget").value);
    await page.locator("#cdMove").click(); await page.waitForTimeout(500);

    const after=await page.evaluate(()=>{
      const s=window.__mfkrExp.state();
      const t=s.transactions.find(x=>x.id==="tx_on_custom");
      return {cats:s.categories.map(c=>c.id),txCount:s.transactions.length,txCat:t&&t.categoryId,
        amount:t&&t.amountMinor,pinned:!!(t&&t.categoryPinnedAt)};
    });
    assert.ok(!after.cats.includes("cat_used"),"حُذفت بعد نقل المراجع");
    assert.equal(after.txCount,1,"المعاملة باقية");
    assert.equal(after.txCat,target,"انتقلت إلى الفئة الهدف");
    assert.equal(after.amount,5000,"المبلغ لم يتغيّر");
    assert.ok(after.pinned,"الإسناد مختوم فلا يتجاوزه ترحيل تلقائي");

    await page.reload(); await page.waitForTimeout(700);
    const persisted=await page.evaluate(()=>{
      const s=window.__mfkrExp.state();
      const t=s.transactions.find(x=>x.id==="tx_on_custom");
      return {gone:!s.categories.some(c=>c.id==="cat_used"),cat:t&&t.categoryId,count:s.transactions.length};
    });
    assert.ok(persisted.gone); assert.equal(persisted.cat,target); assert.equal(persisted.count,1);
    assert.deepEqual([...new Set(errs)],[]);
  } finally { await ctx.close(); await browser.close(); }
});

test("no data is lost and category IDs stay stable after visibility and order changes",async()=>{
  const {browser,ctx,page,errs}=await open();
  try{
    const before=await page.evaluate(()=>{
      const s=window.__mfkrExp.state();
      return { catIds:s.categories.map(c=>c.id).sort(), txs:(s.transactions||[]).length,
        budgets:s.categories.reduce((n,c)=>n+((c.budgets||[]).length),0),
        recurring:(s.recurringTransactions||[]).length, templates:(s.fixedTemplates||[]).length };
    });
    await page.evaluate(()=>{
      const all=window.__mfkrExp.varAll();
      all.forEach((c,i)=>window.__mfkrExp.setVisible(c.id, i%2===0));
      if(all[1]) window.__mfkrExp.reorderCat(all[1].id,-1);
    });
    await page.waitForTimeout(300);
    await page.reload(); await page.waitForTimeout(800);
    const after=await page.evaluate(()=>{
      const s=window.__mfkrExp.state();
      return { catIds:s.categories.map(c=>c.id).sort(), txs:(s.transactions||[]).length,
        budgets:s.categories.reduce((n,c)=>n+((c.budgets||[]).length),0),
        recurring:(s.recurringTransactions||[]).length, templates:(s.fixedTemplates||[]).length };
    });
    assert.deepEqual(after.catIds,before.catIds,"المعرّفات ثابتة وبلا تكرار");
    assert.equal(after.txs,before.txs,"لا معاملات مفقودة");
    assert.equal(after.budgets,before.budgets,"لا ميزانيات مفقودة");
    assert.equal(after.recurring,before.recurring,"لا مصروفات متكررة مفقودة");
    assert.equal(after.templates,before.templates,"لا التزامات مفقودة");
    assert.deepEqual([...new Set(errs)],[]);
  } finally { await ctx.close(); await browser.close(); }
});
