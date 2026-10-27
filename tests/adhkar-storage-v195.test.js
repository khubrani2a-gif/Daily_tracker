'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {device,chromium}=require('./audit-browser-helper.cjs');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function run(fn){const d=await device(browser,{}, {}, {hasTouch:true,isMobile:true});try{d.p.setDefaultTimeout(4000);await fn(d);assert.deepEqual(d.errors,[]);}finally{await d.c.close();}}
async function block(p,kind){await p.evaluate(kind=>{
 audit.openAdhkar('am');window.originalStorageSet=Storage.prototype.setItem;
 Storage.prototype.setItem=function(k,v){if(kind==='journal'?k.endsWith('h2do-pending-days-v1'):k.endsWith(audit.storageKey(document.querySelector('#adhkarSessionDate').textContent.replace('جلسة يوم ',''))))throw new DOMException('quota','QuotaExceededError');return window.originalStorageSet.call(this,k,v);};
},kind);}
test('failed journal save rolls back repeated taps and reports local failure; retry counts once',()=>run(async({p})=>{
 await block(p,'journal');
 await p.locator('[data-adhkar-count]').first().tap();await p.locator('[data-adhkar-count]').first().tap();
 assert.equal(await p.evaluate(()=>audit.get().adhkar?.am?.[0]||0),0);
 assert.match(await p.locator('#adhkarSaveStatus').textContent(),/لم يُحفظ/);
 await p.evaluate(()=>Storage.prototype.setItem=window.originalStorageSet);
 await p.locator('[data-adhkar-count]').first().tap();
 assert.equal(await p.evaluate(()=>audit.get().adhkar.am[0]),1);
 assert.equal(await p.locator('#syncFailureDetails').evaluate(el=>el.hidden),true);
 await p.reload();await p.evaluate(()=>audit.openAdhkar('am'));
 assert.match(await p.locator('[data-adhkar-count]').first().textContent(),/اكتمل/);
}));
test('successful journal followed by failed day mirror keeps durable count visible across reload',()=>run(async({p})=>{
 await block(p,'mirror');await p.locator('[data-adhkar-count]').first().tap();
 assert.match(await p.locator('[data-adhkar-count]').first().textContent(),/اكتمل/);
 assert.match(await p.locator('#adhkarSaveStatus').textContent(),/محفوظ/);
 await p.reload();await p.evaluate(()=>audit.openAdhkar('am'));
 assert.equal(await p.evaluate(()=>audit.get().adhkar.am[0]),1);
}));
test('sync failure provides safe diagnostic reason while touch counting still saves locally',()=>run(async({p})=>{
 await p.evaluate(()=>{audit.login();audit.syncModule('daily').lastError='permission-denied users/private-person@example.com/token-secret';audit.renderGlobalSyncStatus({status:'failed'},false);audit.openAdhkar('sleep');});
 await p.locator('[data-adhkar-count]').first().tap();assert.equal(await p.evaluate(()=>audit.get().adhkar.sleep[0]),1);
 await p.evaluate(()=>audit.closeAdhkarUI());
 const reason=await p.locator('#syncFailureDetails').textContent();assert.match(reason,/صلاحيات/);assert.doesNotMatch(reason,/private-person|token-secret/);
}));
test('undo and adjustment keep the saved count when storage rejects the edit',()=>run(async({p})=>{
 await p.evaluate(()=>audit.openAdhkar('am'));await p.locator('[data-adhkar-count]').first().tap();
 await block(p,'journal');
 await p.locator('[data-adhkar-more]').first().tap();await p.locator('[data-adhkar-undo]').first().tap();
 assert.equal(await p.evaluate(()=>audit.get().adhkar.am[0]),1);
 await p.locator('[data-adhkar-more]').first().tap();await p.locator('[data-adhkar-adjust]').first().tap();
 await p.locator('#adhkarAdjustedCount').fill('0');await p.locator('#adhkarAdjustSave').tap();
 assert.match(await p.locator('#adhkarAdjustError').textContent(),/لم يُحفظ/);
 assert.equal(await p.evaluate(()=>audit.get().adhkar.am[0]),1);
 await p.reload();await p.evaluate(()=>audit.openAdhkar('am'));assert.equal(await p.evaluate(()=>audit.get().adhkar.am[0]),1);
}));
test('failed cloud daily reads leave a locally saved bedtime tap usable and recover on retry',()=>run(async({p,control})=>{
 control.rejectRead='/days';
 await p.evaluate(async()=>{audit.login();await audit.syncPullAllModules('manual');audit.openAdhkar('sleep');});
 await p.locator('[data-adhkar-count]').first().tap();assert.equal(await p.evaluate(()=>audit.get().adhkar.sleep[0]),1);
 control.rejectRead='';
 await p.evaluate(async()=>{await audit.syncPullAllModules('retry',{forceServer:true,bypassThrottle:true});});
 assert.equal(await p.evaluate(()=>audit.get().adhkar.sleep[0]),1);
 assert.equal(await p.evaluate(()=>Object.keys(audit.dailyPending()).length),0);
}));
