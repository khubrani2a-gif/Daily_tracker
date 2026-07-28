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
    categories:[{id:"expdcat_0",name:"الأكل",section:"variable",budgets:[{from:"1970-01-01",amountMinor:50000}],isActive:true,sortOrder:0,createdAt:now,updatedAt:now,archivedAt:null},{id:"expdcat_1",name:"مشتريات المنزل",section:"variable",budgets:[{from:"1970-01-01",amountMinor:30000}],isActive:true,sortOrder:1,createdAt:now,updatedAt:now,archivedAt:null}],
    fixedTemplates:[],instances:[],transactions:[{id:"old",amountMinor:1000,transactionDate:today(),categoryId:"expdcat_0",transactionType:"expense",subcategory:"",createdAt:now,updatedAt:now,deletedAt:null}],trips:[]};
  const browser=await chromium.launch(); const ctx=await browser.newContext({viewport:{width:390,height:844}}); const page=await ctx.newPage();
  try{
    await page.addInitScript(data=>localStorage.setItem("h2do-expenses",JSON.stringify(data)),legacy);
    await page.goto(fileUrl); await page.waitForTimeout(350);
    let state=await page.evaluate(()=>JSON.parse(localStorage.getItem("h2do-expenses")));
    const food=state.categories.find(c=>c.id==="expdcat_0");
    assert.equal(food.name,"البقالة");
    assert.equal(food.budgets[0].amountMinor,30000);
    assert.equal(state.categories.find(c=>c.name==="المطاعم والطلبات").budgets[0].amountMinor,50000);
    assert.ok(food.subcategories.some(s=>s.name==="خضار وفواكه"));
    assert.equal(state.transactions.find(t=>t.id==="old").subcategoryId,null);

    await page.locator("#expOpenBtn").click(); await page.locator("#expAddBtn").click();
    await page.locator("#efAmount").fill("25"); await page.locator("#efCat").selectOption("expdcat_0");
    await page.locator("[data-subchip]").filter({hasText:"خضار وفواكه"}).click(); await page.locator("#efDetails").fill("تموين الأسبوع");
    await page.locator("#efSave").click(); await page.waitForTimeout(80);
    state=await page.evaluate(()=>JSON.parse(localStorage.getItem("h2do-expenses")));
    let tx=state.transactions.at(-1); assert.equal(tx.categoryId,"expdcat_0"); assert.ok(tx.subcategoryId); assert.equal(tx.customSubcategory,null); assert.equal(tx.description,"تموين الأسبوع");

    await page.locator("#expAddBtn").click(); await page.locator("#efAmount").fill("10"); await page.locator("#efCat").selectOption("expdcat_0");
    await page.locator("[data-subchip]").filter({hasText:"أخرى"}).click(); await page.locator("#efSave").click();
    assert.match(await page.locator("#efErr").textContent(),/اكتب نوع المصروف/);
    await page.locator("#efCustomSub").fill("منتج موسمي"); await page.locator("#efSave").click(); await page.waitForTimeout(80);
    state=await page.evaluate(()=>JSON.parse(localStorage.getItem("h2do-expenses"))); tx=state.transactions.at(-1);
    assert.equal(tx.customSubcategory,"منتج موسمي"); assert.equal(state.categories.find(c=>c.id==="expdcat_0").subcategories.some(s=>s.name==="منتج موسمي"),false);

    await page.locator("#expAddBtn").click(); await page.locator("#efAmount").fill("12"); await page.locator("#efCat").selectOption("expdcat_0");
    await page.locator("[data-subchip]").filter({hasText:"أخرى"}).click(); await page.locator("#efCustomSub").fill("قسم المخبز"); await page.locator("#efSaveCustom").check(); await page.locator("#efSave").click(); await page.waitForTimeout(80);
    state=await page.evaluate(()=>JSON.parse(localStorage.getItem("h2do-expenses")));
    assert.equal(state.categories.find(c=>c.id==="expdcat_0").subcategories.filter(s=>s.name==="قسم المخبز").length,1);
  } finally { await ctx.close(); await browser.close(); }
});
