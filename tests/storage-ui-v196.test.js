'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {device,chromium}=require('./audit-browser-helper.cjs');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function run(fn){const d=await device(browser,{'h2do-witr-text-cache':{temporary:'x'.repeat(10000)},'h2do-private-sentinel':'keep'});try{d.p.setDefaultTimeout(5000);await fn(d);assert.deepEqual(d.errors,[]);}finally{await d.c.close();}}
async function pressure(p){await p.evaluate(()=>{const cache='h2do-witr-text-cache';if(window.localStorage.getItem(cache)===null)throw Error('missing pressure fixture');window.cacheUnderPressure=cache;const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(!k.endsWith(cache)&&window.localStorage.getItem(cache)!==null)throw new DOMException('full','QuotaExceededError');return set.call(this,k,v);};});}
test('water and sport recover from cache pressure and remain saved after reload',()=>run(async({p})=>{
 await p.locator('[data-app-view="sport"]').first().click();await pressure(p);
 await p.locator('#water button').first().click();assert.equal(await p.locator('#waterCount').textContent(),'1');
 await p.locator('#spPlus5').evaluate(el=>el.closest('details').open=true);await p.locator('#spPlus5').click();
 assert.equal(await p.evaluate(()=>audit.get().sport.mins),5);
 await p.reload();assert.equal(await p.evaluate(()=>audit.get().water),1);assert.equal(await p.evaluate(()=>audit.get().sport.mins),5);
 assert.equal(await p.evaluate(()=>window.localStorage.getItem('h2do-private-sentinel')),'keep');
}));
test('a quick expense saves once under cache pressure and survives reload',()=>run(async({p})=>{
 await p.evaluate(()=>{audit.expOpenOverlay();audit.expOpenQuickExpense();});await p.locator('#fqAmount').fill('29');await pressure(p);await p.locator('#fqSave').click();
 assert.equal(await p.evaluate(()=>audit.expState().transactions.filter(t=>!t.deletedAt&&t.amountMinor===2900).length),1);
 await p.reload();assert.equal(await p.evaluate(()=>audit.expState().transactions.filter(t=>!t.deletedAt&&t.amountMinor===2900).length),1);
}));
test('bedtime reader opens and saves its first count under cache pressure',()=>run(async({p})=>{
 await p.locator('[data-app-view="iman"]').first().click();await pressure(p);await p.getByRole('button',{name:'قراءة أذكار النوم',exact:true}).click();await p.locator('[data-adhkar-count]').first().click();assert.equal(await p.evaluate(()=>audit.get().adhkar.sleep[0]),1);
 await p.reload();await p.evaluate(()=>audit.openAdhkar('sleep'));assert.match(await p.locator('[data-adhkar-count]').first().textContent(),/اكتمل/);
}));
test('Quran text cache stays bounded and keeps recent complete text unchanged',()=>run(async({p})=>{
 const saved=await p.evaluate(()=>{const row=ts=>({schema:3,ts,ayahs:[{n:1,g:1,text:'x'.repeat(250000)}]});audit.witrTextCacheSave({'1':row(1),'2':row(2),'3':row(3),'4':{schema:2,ts:4,ayahs:[]}});const raw=localStorage.getItem('h2do-witr-text-cache');return {length:raw.length,entries:JSON.parse(raw)};});
 assert.ok(saved.length<=512*1024);assert.deepEqual(Object.keys(saved.entries).sort(),['2','3']);assert.equal(saved.entries['2'].ayahs[0].text,'x'.repeat(250000));
}));
test('actual browser quota exhaustion releases only cached text and lets water save',()=>run(async({p})=>{
 await p.locator('[data-app-view="sport"]').first().click();
 const filled=await p.evaluate(()=>{let low=0,high=8*1024*1024,failures=0;while(low+1<high){const n=Math.floor((low+high)/2);try{localStorage.setItem('h2do-witr-text-cache','x'.repeat(n));low=n;}catch(e){if(e.name!=='QuotaExceededError')throw e;failures++;high=n;}}return {size:low,failures};});
 assert.ok(filled.failures>0&&filled.size>1000000);
 await p.locator('#water button').first().click();assert.equal(await p.locator('#waterCount').textContent(),'1');
 assert.equal(await p.evaluate(()=>localStorage.getItem('h2do-witr-text-cache')),null);assert.equal(await p.evaluate(()=>localStorage.getItem('h2do-private-sentinel')),'keep');
 await p.reload();assert.equal(await p.evaluate(()=>audit.get().water),1);
}));
test('irreducible financial storage failure preserves draft and old balance and states the reason',()=>run(async({p})=>{
 await p.evaluate(()=>{audit.expOpenOverlay();audit.expOpenQuickExpense();});await p.locator('#fqAmount').fill('29');
 await p.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.endsWith('h2do-expenses'))throw new DOMException('full','QuotaExceededError');return set.call(this,k,v);};});
 await p.locator('#fqSave').click();assert.match(await p.locator('#fqErr').textContent(),/مساحة/);assert.equal(await p.locator('#fqAmount').inputValue(),'29');assert.equal(await p.evaluate(()=>audit.expState().transactions.filter(t=>!t.deletedAt).length),0);
}));
test('new backups include personal records but never duplicate disposable text or stats caches',()=>run(async({p})=>{
 const snapshot=await p.evaluate(()=>{audit.get().notes='personal note';audit.save();localStorage.setItem('h2do-reading-stats-cache',JSON.stringify({derived:1}));return audit.dataBuildSnapshot('test');});
 assert.equal(snapshot.entries['h2do-witr-text-cache'],undefined);assert.equal(snapshot.entries['h2do-reading-stats-cache'],undefined);assert.equal(snapshot.entries['h2do-private-sentinel'],'keep');
 assert.ok(Object.entries(snapshot.entries).some(([key,value])=>key.startsWith('h2do-tracker:')&&JSON.parse(value).notes==='personal note'));
}));
