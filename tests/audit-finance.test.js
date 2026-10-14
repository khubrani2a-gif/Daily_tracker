'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PW_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const expose = `window.financeAudit={expSig,expTxRow,expMerge,expGenerateRecurringDue,expOpenCategoryManager,expData,setState:d=>expState=d};`;
const html = fs.readFileSync(path.join(root,'index.html'),'utf8').replace('function storageKey(date){', expose+'\nfunction storageKey(date){');
(async()=>{
 const browser=await chromium.launch(process.env.PW_EXECUTABLE_PATH?{executablePath:process.env.PW_EXECUTABLE_PATH}:{});
 const page=await browser.newPage();
 await page.route('**/*',route=>route.fulfill({contentType:route.request().url().endsWith('index.html')?'text/html':'application/javascript',body:route.request().url().endsWith('index.html')?html:/\/(sync-core|data-core|planner-core)\.js$/.test(route.request().url())?fs.readFileSync(path.join(root,new URL(route.request().url()).pathname),'utf8'):''}));
 let failures=0;
 async function check(name,fn){try{await fn();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+'\n'+e.stack);}}
 try{
 await page.goto('http://finance.test/index.html');
 await page.waitForFunction(()=>!!window.financeAudit);
 await check('duplicate monthly instances preserve both device payments and converge',async()=>{
 const result=await page.evaluate(()=>{
  const base={settings:{updatedAt:1},categories:[],fixedTemplates:[],transactions:[],instances:[]};
  const a={...base,instances:[{id:'IA',templateId:'T',year:2026,month:1,updatedAt:1}],transactions:[{id:'PA',fixedExpenseInstanceId:'IA',amountMinor:3000,updatedAt:1}]};
  const b={...base,instances:[{id:'IB',templateId:'T',year:2026,month:1,updatedAt:1}],transactions:[{id:'PB',fixedExpenseInstanceId:'IB',amountMinor:7000,updatedAt:1}]};
  return [financeAudit.expMerge(a,b),financeAudit.expMerge(b,a)].map(m=>({id:m.instances[0].id,count:m.instances.length,paid:m.transactions.filter(t=>t.fixedExpenseInstanceId===m.instances[0].id).reduce((n,t)=>n+t.amountMinor,0)}));
 });
 assert.equal(result[0].paid,10000);assert.equal(result[0].count,1);assert.deepEqual(result[0],result[1]);
 });
 await check('equal timestamp transaction deletion wins in both merge directions',async()=>{
 const result=await page.evaluate(()=>{const live={transactions:[{id:'T',updatedAt:10,deletedAt:null}]},dead={transactions:[{id:'T',updatedAt:10,deletedAt:10}]};return [financeAudit.expMerge(live,dead),financeAudit.expMerge(dead,live)].map(d=>d.transactions[0].deletedAt);});
 assert.deepEqual(result,[10,10]);
 });
 await check('equal timestamp live edits converge independent of object key order',async()=>{
 const result=await page.evaluate(()=>{const a={transactions:[{id:'T',updatedAt:10,amountMinor:100}]},b={transactions:[{amountMinor:200,updatedAt:10,id:'T'}]};return [financeAudit.expMerge(a,b),financeAudit.expMerge(b,a)].map(d=>d.transactions[0].amountMinor);});assert.equal(result[0],result[1]);
 });
 await check('financial reconciliation detects same-version deletion',async()=>{
 const result=await page.evaluate(()=>[financeAudit.expSig({transactions:[{id:'T',updatedAt:1,deletedAt:null}]}),financeAudit.expSig({transactions:[{id:'T',updatedAt:1,deletedAt:1}]})]);assert.notEqual(result[0],result[1]);
 });
 await check('tied category budgets and trip allocations converge',async()=>{
 const result=await page.evaluate(()=>{const make=n=>({categories:[{id:'C',name:'Custom',section:'variable',updatedAt:1,budgets:[{from:'2026-01-01',amountMinor:n}]}],trips:[{id:'TR',updatedAt:1,allocations:[{categoryId:'C',budgetMinor:n}]}]});return [financeAudit.expMerge(make(1),make(2)),financeAudit.expMerge(make(2),make(1))].map(d=>({budget:d.categories.find(c=>c.id==='C').budgets,allocation:d.trips[0].allocations}));});assert.deepEqual(result[0],result[1]);
 });
 await check('imported foreign currency is inert in transaction rows',async()=>{
 const count=await page.evaluate(()=>{const el=document.createElement('div');el.innerHTML=financeAudit.expTxRow({id:'x',amountMinor:100,transactionType:'expense',transactionDate:'2026-01-01',originalAmountMinor:100,originalCurrency:'<img src=x onerror="window.financeInjected=1">'});return el.querySelectorAll('img').length;});assert.equal(count,0);
 });
 await check('monthly recurring dates retain day 31 across short months and reload',async()=>{
 const dates=await page.evaluate(()=>{let d={transactions:[],recurringTransactions:[{id:'R',nextDate:'2026-01-31',frequency:'monthly',isActive:true,amountMinor:100}]};financeAudit.expGenerateRecurringDue(d,'2026-02-28');d=JSON.parse(JSON.stringify(d));financeAudit.expGenerateRecurringDue(d,'2026-04-30');return d.transactions.map(t=>t.transactionDate);});
 assert.deepEqual(dates,['2026-01-31','2026-02-28','2026-03-31','2026-04-30']);
 });
 await check('imported category icon and identifier render as inert text and attributes',async()=>{
 const result=await page.evaluate(()=>{const d=financeAudit.expData();const icon='<img src=x onerror="window.financeInjected=1">',id='custom\"><img src=x onerror="window.financeInjected=1">';d.categories.push({id,name:'Custom',icon,section:'variable',isActive:true,sortOrder:999,budgets:[]});financeAudit.setState(d);financeAudit.expOpenCategoryManager();return {images:document.querySelectorAll('img[onerror]').length,text:document.body.textContent.includes(icon),id:[...document.querySelectorAll('[data-catrow]')].some(e=>e.dataset.catrow===id)};});
 assert.equal(result.images,0);assert.equal(result.text,true);assert.equal(result.id,true);
 });
 }finally{await browser.close();}if(failures)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
