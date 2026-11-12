'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {device}=require('./audit-browser-helper.cjs');const chromium=require('playwright')[process.env.STORAGE_TEST_BROWSER||'chromium'];let browser;
test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('prayer and adhkar save and reload with history larger than native localStorage',async()=>{
 const d=await device(browser);try{
  await d.p.evaluate(async()=>{await localStorage.writeBatch(Object.fromEntries(Array.from({length:24},(_,i)=>['h2do-history-fixture-'+i,'x'.repeat(300000)])));audit.openAdhkar('sleep');});
  await d.p.locator('[data-adhkar-count]').first().click();assert.equal(await d.p.evaluate(()=>audit.get().adhkar.sleep[0]),1);
  await d.p.evaluate(()=>audit.closeAdhkarUI());await d.p.locator('[data-app-view="iman"]').first().click();await d.p.locator('[data-prayer-index="0"]').click();assert.equal(await d.p.evaluate(()=>audit.get().prayers[0]),'ontime');
  await d.p.reload();assert.deepEqual(await d.p.evaluate(()=>[audit.get().adhkar.sleep[0],audit.get().prayers[0],localStorage.getItem('h2do-history-fixture-23').length]),[1,'ontime',300000]);assert.deepEqual(d.errors,[]);
 }finally{await d.c.close();}
});
test('failed local save takes precedence over success and offline synchronization labels',async()=>{
 const d=await device(browser);try{
  await d.p.evaluate(()=>{audit.openAdhkar('sleep');const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.endsWith('h2do-pending-days-v1'))throw new DOMException('full','QuotaExceededError');return set.call(this,k,v);};});
  await d.p.locator('[data-adhkar-count]').first().click();
  await d.p.evaluate(()=>audit.renderGlobalSyncStatus({status:'success'},false));assert.match(await d.p.locator('#syncSummaryLabel').textContent(),/تعذّر الحفظ/);
  await d.c.setOffline(true);await d.p.evaluate(()=>audit.renderGlobalSyncStatus({status:'success'},false));assert.match(await d.p.locator('#syncLast').textContent(),/لم يكتمل الحفظ/);assert.deepEqual(d.errors,[]);
 }finally{await d.c.close();}
});
test('unavailable IndexedDB preserves legacy records and blocks empty application startup',async()=>{
 const c=await browser.newContext();try{const p=await c.newPage();await p.route('**/*',r=>{const name=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({contentType:name.endsWith('.js')?'application/javascript':'text/html',body:['index.html','data-core.js','sync-core.js','planner-core.js','learning-core.js','calendar-core.js'].includes(name)?fs.readFileSync(name):''});});await p.addInitScript(()=>{localStorage.setItem('h2do-note','preserve');indexedDB.open=()=>{throw new DOMException('blocked','SecurityError')};});await p.goto('https://startup.local/index.html');await p.getByRole('button',{name:'إعادة المحاولة',exact:true}).last().waitFor();assert.equal(await p.evaluate(()=>localStorage.getItem('h2do-note')),'preserve');assert.equal(await p.evaluate(()=>window.__appReady===true),false);assert.match(await p.locator('[role="alert"]').last().textContent(),/لم نحذف سجلاتك/);}finally{await c.close();}
});
