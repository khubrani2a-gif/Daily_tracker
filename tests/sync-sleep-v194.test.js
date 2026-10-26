'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {device,chromium}=require('./audit-browser-helper.cjs');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function run(fn){const d=await device(browser);try{d.p.setDefaultTimeout(5000);await fn(d);assert.deepEqual(d.errors,[]);}finally{await d.c.close();}}
test('bedtime adhkar opens from the visible button, counts offline, undoes and survives reload',()=>run(async({p,c})=>{
 await p.locator('[data-app-view="iman"]').first().click();
 await p.getByRole('button',{name:'قراءة أذكار النوم',exact:true}).click();
 assert.equal(await p.locator('#adhkarOverlay').isVisible(),true);
 await c.setOffline(true);
 await p.locator('[data-adhkar-count]').first().click();
 assert.equal(await p.evaluate(()=>audit.get().adhkar.sleep[0]),1);
 await p.locator('[data-adhkar-more]').first().click();await p.locator('[data-adhkar-undo]').first().click();
 assert.equal(await p.evaluate(()=>audit.get().adhkar.sleep[0]),0);
 await p.locator('[data-adhkar-count]').first().click();
 await c.setOffline(false);await p.reload();await p.evaluate(()=>audit.openAdhkar('sleep'));
 assert.equal(await p.evaluate(()=>audit.get().adhkar.sleep[0]),1);
}));
test('stalled cloud reads stop the waiting UI and leave bedtime adhkar usable',()=>run(async({p})=>{
 await p.clock.install();
 await p.evaluate(()=>{
   const get=window.serverGet,query=window.serverQuery;
   window.serverGet=(key,opts)=>opts.source==='server'?new Promise(()=>{}):get(key,opts);
   window.serverQuery=(key,opts,filter)=>opts.source==='server'?new Promise(()=>{}):query(key,opts,filter);
   audit.login();window.testSync=audit.syncPullAllModules('manual');
 });
 await p.clock.fastForward(20000);await p.clock.fastForward(15000);
 await p.waitForFunction(()=>!document.querySelector('#syncAllBtn').disabled);
 assert.doesNotMatch(await p.locator('#syncLast').textContent(),/جارٍ التحقق/);
 await p.evaluate(()=>audit.openAdhkar('sleep'));await p.locator('[data-adhkar-count]').first().click();
 assert.equal(await p.evaluate(()=>audit.get().adhkar.sleep[0]),1);
}));
test('delayed daily upload keeps its journal then confirms once the original write returns',()=>run(async({p,control,writes})=>{
 await p.clock.install();control.holdWrites=true;
 await p.evaluate(()=>{const set=window.serverSet;window.serverSet=(key,value)=>{if(key.includes('/days/'))window.testWriteStarted=true;return set(key,value);};audit.login();audit.get().notes='pending bedtime audit';audit.save();window.testSync=audit.syncPullAllModules('manual');});
 await p.waitForFunction(()=>audit.syncModule('daily').inFlight);
 await p.waitForFunction(()=>window.testWriteStarted===true);
 await p.clock.fastForward(35000);
 await p.waitForFunction(()=>!document.querySelector('#syncAllBtn').disabled);
 assert.ok(await p.evaluate(()=>Object.keys(audit.dailyPending()).length)>0);
 assert.equal(writes.filter(x=>x.includes('/days/')).length,0);
 control.holdWrites=false;for(const resolve of control.pendingWrites||[])resolve();
 await p.waitForFunction(()=>Object.keys(audit.dailyPending()).length===0);
 assert.equal(await p.evaluate(()=>audit.get().notes),'pending bedtime audit');
 assert.equal(writes.filter(x=>x.includes('/days/')).length,1);
}));
