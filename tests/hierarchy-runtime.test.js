"use strict";

function loadChromium(){
  for(const candidate of [process.env.PW_PATH,"playwright"]){
    try{return require(candidate).chromium;}catch(e){}
  }
  throw new Error("Playwright not found. Set PW_PATH=/path/to/playwright");
}

const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {chromium}= {chromium:loadChromium()};
const fileUrl="file://"+path.resolve(__dirname,"..","index.html");
const today=()=>new Date().toISOString().slice(0,10);

test("expense hierarchy migrates legacy data and saves predefined and custom subcategories",async()=>{
  const now=Date.now();
  const legacy={version:6,settings:{currency:"SAR",weekStartDay:6,salaryCycleStartDay:27,numberFormat:"ar-EG",updatedAt:now},
    categories:[{id:"legacy_food",name:"الأكل",section:"variable",budgets:[{from:"1970-01-01",amountMinor:50000}],isActive:true,sortOrder:0,createdAt:now,updatedAt:now,archivedAt:null},{id:"legacy_home",name:"مشتريات المنزل",section:"variable",budgets:[{from:"1970-01-01",amountMinor:30000}],isActive:true,sortOrder:1,createdAt:now,updatedAt:now,archivedAt:null},{id:"legacy_home_dup",name:"مشتريات المنزل",section:"variable",budgets:[{from:"1970-01-01",amountMinor:30000}],isActive:true,sortOrder:2,createdAt:now,updatedAt:now,archivedAt:null},{id:"legacy_exceptional",name:"المشتريات الاستثنائية",section:"variable",budgets:[{from:"1970-01-01",amountMinor:30000}],isActive:true,sortOrder:7,createdAt:now,updatedAt:now,archivedAt:null}],
    fixedTemplates:[],instances:[],transactions:[{id:"old",amountMinor:1000,transactionDate:today(),categoryId:"legacy_food",transactionType:"expense",subcategory:"",createdAt:now,updatedAt:now,deletedAt:null},{id:"old_exceptional",amountMinor:28060,transactionDate:today(),categoryId:"legacy_exceptional",transactionType:"expense",subcategory:"",createdAt:now,updatedAt:now,deletedAt:null}],trips:[]};
  const browser=await chromium.launch(); const ctx=await browser.newContext({viewport:{width:390,height:844}}); const page=await ctx.newPage();
  try{
    await page.addInitScript(data=>{ if(!localStorage.getItem("h2do-expenses")) localStorage.setItem("h2do-expenses",JSON.stringify(data)); },legacy);
    await page.goto(fileUrl); await page.waitForTimeout(350);
    let state=await page.evaluate(()=>JSON.parse(localStorage.getItem("h2do-expenses")));
    const food=state.categories.find(c=>c.id==="legacy_food");
    assert.equal(food.name,"البقالة");
    assert.equal(food.budgets[0].amountMinor,30000);
    assert.equal(state.categories.find(c=>c.name==="المطاعم والطلبات").budgets[0].amountMinor,50000);
    assert.ok(state.categories.filter(c=>c.name==="احتياجات المنزل").every(c=>!(c.budgets||[]).length));
    assert.ok(food.subcategories.some(s=>s.name==="خضار وفواكه"));
    assert.equal(state.transactions.find(t=>t.id==="old").subcategoryId,null);
    assert.equal(state.transactions.find(t=>t.id==="old").categoryId,state.categories.find(c=>c.name==="المطاعم والطلبات").id);
    assert.equal(state.categories.find(c=>c.name==="غير مخطط").budgets[0].amountMinor,30000);
    assert.equal(state.transactions.find(t=>t.id==="old_exceptional").categoryId,state.categories.find(c=>c.name==="غير مخطط").id);
    assert.ok(state.categories.filter(c=>c.name==="مشتريات غير متكررة").every(c=>!(c.budgets||[]).length));
    await page.evaluate(()=>{ const data=JSON.parse(localStorage.getItem("h2do-expenses")); const home=data.categories.find(c=>c.name==="احتياجات المنزل"), grocery=data.categories.find(c=>c.name==="البقالة"); home.budgets=[{from:"1970-01-01",amountMinor:30000}]; data.transactions.find(t=>t.id==="old").categoryId=grocery.id; data.settings.legacyBudgetPlacementV4=true; data.settings.legacyFoodTransactionsV5=true; localStorage.setItem("h2do-expenses",JSON.stringify(data)); });
    await page.reload(); await page.waitForTimeout(350);
    state=await page.evaluate(()=>JSON.parse(localStorage.getItem("h2do-expenses")));
    assert.ok(state.categories.filter(c=>c.name==="احتياجات المنزل").every(c=>!(c.budgets||[]).length));
    assert.equal(state.transactions.find(t=>t.id==="old").categoryId,state.categories.find(c=>c.name==="المطاعم والطلبات").id);
    await page.evaluate(()=>{ const data=JSON.parse(localStorage.getItem("h2do-expenses")), restaurants=data.categories.find(c=>c.name==="المطاعم والطلبات"), moved=data.transactions.find(t=>t.id==="old"), stamp=Number(moved.updatedAt); [[6673,"a"],[11325,"b"],[15560,"c"]].forEach(([amount,suffix])=>data.transactions.push({id:"old_home_cloud_"+suffix,amountMinor:amount,transactionDate:"2026-07-27",categoryId:restaurants.id,transactionType:"expense",createdAt:stamp-3000,updatedAt:stamp,deletedAt:null})); data.settings.legacyFoodTransactionsMovedAtV5=stamp; data.settings.legacyHomeTransactionsV6=true; localStorage.setItem("h2do-expenses",JSON.stringify(data)); });
    await page.reload(); await page.waitForTimeout(350);
    state=await page.evaluate(()=>JSON.parse(localStorage.getItem("h2do-expenses")));
    assert.ok(state.transactions.filter(t=>t.id.startsWith("old_home_cloud_")).every(t=>t.categoryId===state.categories.find(c=>c.name==="احتياجات المنزل").id));
    assert.equal(state.transactions.find(t=>t.id==="old").categoryId,state.categories.find(c=>c.name==="المطاعم والطلبات").id);

    await page.locator('[data-app-view="expenses"]').click();
    await page.locator("#expOpenBtn").click(); await page.locator('.exp-tab[data-view="dash"]').click(); await page.locator("#expAddBtn").click();
    await page.locator("#efAmount").fill("25"); await page.locator("#efCat").selectOption("legacy_food");
    await page.locator("[data-subchip]").filter({hasText:"خضار وفواكه"}).click(); await page.locator("#efDetails").fill("تموين الأسبوع");
    await page.locator("#efSave").click(); await page.waitForTimeout(80);
    state=await page.evaluate(()=>JSON.parse(localStorage.getItem("h2do-expenses")));
    let tx=state.transactions.at(-1); assert.equal(tx.categoryId,"legacy_food"); assert.ok(tx.subcategoryId); assert.equal(tx.customSubcategory,null); assert.equal(tx.description,"تموين الأسبوع");

    await page.locator("#expAddBtn").click(); await page.locator("#efAmount").fill("10"); await page.locator("#efCat").selectOption("legacy_food");
    await page.locator("[data-subchip]").filter({hasText:"أخرى"}).click(); await page.locator("#efSave").click();
    assert.match(await page.locator("#efErr").textContent(),/اكتب نوع المصروف/);
    await page.locator("#efCustomSub").fill("منتج موسمي"); await page.locator("#efSave").click(); await page.waitForTimeout(80);
    state=await page.evaluate(()=>JSON.parse(localStorage.getItem("h2do-expenses"))); tx=state.transactions.at(-1);
    assert.equal(tx.customSubcategory,"منتج موسمي"); assert.equal(state.categories.find(c=>c.id==="legacy_food").subcategories.some(s=>s.name==="منتج موسمي"),false);

    await page.locator("#expAddBtn").click(); await page.locator("#efAmount").fill("12"); await page.locator("#efCat").selectOption("legacy_food");
    await page.locator("[data-subchip]").filter({hasText:"أخرى"}).click(); await page.locator("#efCustomSub").fill("قسم المخبز");
    await page.locator("#efSaveCustom").evaluate(el=>{ el.checked=true; el.dispatchEvent(new Event("change",{bubbles:true})); });
    await page.locator("#efSave").click(); await page.waitForTimeout(80);
    state=await page.evaluate(()=>JSON.parse(localStorage.getItem("h2do-expenses")));
    assert.equal(state.categories.find(c=>c.id==="legacy_food").subcategories.filter(s=>s.name==="قسم المخبز").length,1);
  } finally { await ctx.close(); await browser.close(); }
});
