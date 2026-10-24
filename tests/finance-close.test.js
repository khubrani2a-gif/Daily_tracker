const test=require('node:test'),assert=require('node:assert/strict');
const{device,chromium}=require('./audit-browser-helper.cjs');
async function run(fn){const b=await chromium.launch();try{const d=await device(b);d.p.setDefaultTimeout(4000);await d.p.evaluate(()=>{audit.expOpenOverlay();audit.expSetView('dash');});await fn(d,b);assert.deepEqual(d.errors,[]);}finally{await b.close();}}
async function waitWrites(p,control,n){for(let i=0;i<100&&((control.pendingWrites||[]).length<n);i++)await p.waitForTimeout(30);assert.ok((control.pendingWrites||[]).length>=n);}
async function login(p){await p.evaluate(async()=>{audit.login();sessionStorage.setItem('testUser',JSON.stringify({uid:'test'}));await audit.expPushRemote(audit.expState());});}
test('pending finance write is not called confirmed and an earlier acknowledgement cannot clear a newer write',()=>run(async({p,control})=>{
 await login(p);control.holdWrites=true;await p.evaluate(()=>{audit.expState().settings.salaryAmountMinor=10000;audit.expSave(audit.expState());});assert.match(await p.locator('#expSyncText').innerText(),/بانتظار المزامنة/);
 assert.match(await p.locator('#syncSummaryLabel').innerText(),/بانتظار مزامنة المالية/);await waitWrites(p,control,1);
 await p.evaluate(()=>{audit.expState().settings.salaryAmountMinor=20000;audit.expSave(audit.expState());});await waitWrites(p,control,2);
 control.pendingWrites.shift()();await p.waitForTimeout(80);assert.match(await p.locator('#expSyncText').innerText(),/بانتظار المزامنة/);control.holdWrites=false;control.pendingWrites.shift()();await p.waitForFunction(()=>document.querySelector('#expSyncText').textContent.includes('تم التأكيد من السحابة'));
}));
test('failed upload keeps durable pending status across reload and successful retry clears it',()=>run(async({p,control})=>{
 await login(p);control.rejectWrite='expenses';await p.evaluate(()=>{audit.expState().settings.salaryAmountMinor=33000;audit.expSave(audit.expState());});await p.waitForTimeout(550);assert.match(await p.locator('#expSyncText').innerText(),/محفوظ على الجهاز.*تعذّر/);assert.equal(await p.evaluate(()=>audit.expState().settings.salaryAmountMinor),33000);
 await p.reload();await p.evaluate(()=>{audit.expOpenOverlay();audit.expSetView('dash');});assert.doesNotMatch(await p.locator('#expSyncText').innerText(),/تم التأكيد من السحابة/);control.rejectWrite='';await p.evaluate(()=>audit.expPushRemote(audit.expState()));await p.waitForFunction(()=>document.querySelector('#expSyncText').textContent.includes('تم التأكيد من السحابة'));
}));
test('finance protection exposes external backup and review without modifying balances',()=>run(async({p})=>{
 const before=await p.evaluate(()=>JSON.stringify(audit.expState()));await p.locator('#expFinanceMore summary').click();await p.locator('#expProtectionBtn').click();assert.match(await p.locator('#financeProtection').innerText(),/داخل هذا المتصفح/);assert.equal(await p.locator('#fpBackupReminder').isChecked(),false);assert.equal(await p.locator('#fpReviewed').isChecked(),false);
 const download=p.waitForEvent('download');await p.locator('#fpDownload').click();assert.match((await download).suggestedFilename(),/backup.*json/);assert.equal(await p.evaluate(()=>JSON.stringify(audit.expState())),before);await p.getByText('مطابقة بيانات البداية مع سجلاتك',{exact:true}).click();await p.locator('#fpReviewed').check();assert.equal(await p.locator('#fpReviewed').isChecked(),true);
 await p.evaluate(()=>{audit.expState().settings.salaryAmountMinor=40000;});await p.keyboard.press('Escape');await p.locator('#expProtectionBtn').click();assert.equal(await p.locator('#fpReviewed').isChecked(),false);
}));
test('two independent browser contexts converge create edit delete undo and offline retry without duplicating money',async()=>{
 const b=await chromium.launch();try{
 const cloud={},a=await device(b,{},cloud),d=await device(b,{},cloud);await login(a.p);await login(d.p);
 const save=async(p,amount)=>p.evaluate(async amount=>{const e=audit.expState();let t=e.transactions.find(r=>r.id==='device-test');if(!t){t={id:'device-test',categoryId:e.categories[0].id,transactionDate:audit.todayStr(),transactionType:'expense',description:'اختبار جهازين'};e.transactions.push(t);}t.amountMinor=amount;audit.expSave(e);await audit.expPushRemote(e);},amount);
 const pull=p=>p.evaluate(()=>audit.expPullRemote({manual:true}));
 const money=p=>p.evaluate(()=>audit.expState().transactions.filter(t=>t.id==='device-test'&&!t.deletedAt).map(t=>t.amountMinor));
 await save(a.p,100);await pull(d.p);assert.deepEqual(await money(d.p),[100]);
 await save(d.p,200);await pull(a.p);assert.deepEqual(await money(a.p),[200]);
 await a.p.evaluate(async()=>{const e=audit.expState();e.transactions.find(t=>t.id==='device-test').deletedAt=Date.now();audit.expSave(e);await audit.expPushRemote(e);audit.expOpenOverlay();audit.expShowUndo('حذف','device-test');});await pull(d.p);assert.deepEqual(await money(d.p),[]);
 await a.p.locator('#expUndoBtn').click();await a.p.evaluate(()=>audit.expPushRemote(audit.expState()));await pull(d.p);assert.deepEqual(await money(d.p),[200]);
 await a.c.setOffline(true);a.control.rejectWrite='expenses';await save(a.p,300);assert.match(await a.p.locator('#expSyncText').innerText(),/محفوظ على الجهاز/);assert.deepEqual(await money(d.p),[200]);await a.c.setOffline(false);a.control.rejectWrite='';await a.p.evaluate(()=>audit.expPushRemote(audit.expState()));await pull(d.p);assert.deepEqual(await money(d.p),[300]);assert.deepEqual(a.errors.concat(d.errors),[]);
 }finally{await b.close();}
});
test('backup download is not a saved-file confirmation and stale review is refused',()=>run(async({p})=>{
 await p.locator('#expFinanceMore summary').click();await p.locator('#expProtectionBtn').click();await p.locator('#fpDownload').click();assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('h2do-finance-protection-v1')).confirmedBackupAt||null),null);await p.locator('#fpConfirmBackup').click();assert.ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('h2do-finance-protection-v1')).confirmedBackupAt));
 await p.getByText('مطابقة بيانات البداية مع سجلاتك',{exact:true}).click();await p.evaluate(()=>audit.expState().settings.salaryAmountMinor=123);await p.locator('#fpReviewed').check().catch(()=>{});assert.equal(await p.locator('#fpReviewed').isChecked(),false);assert.match(await p.locator('#fpError').innerText(),/تغيرت البيانات/);
}));
test('status metadata storage failure cannot keep a stale cloud-confirmed label after reload',()=>run(async({p,control})=>{
 await login(p);control.rejectWrite='expenses';await p.evaluate(()=>{const old=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.includes('expenses-syncmeta'))throw Error('quota');return old.call(this,k,v);};audit.expState().settings.salaryAmountMinor=876;audit.expSave(audit.expState());});await p.waitForTimeout(550);assert.doesNotMatch(await p.locator('#expSyncText').innerText(),/تم التأكيد من السحابة/);await p.reload();await p.evaluate(()=>audit.expOpenOverlay());assert.doesNotMatch(await p.locator('#expSyncText').innerText(),/تم التأكيد من السحابة/);
}));

test('cache-only read does not confirm a pending write or advance cloud timestamp',()=>run(async({p,control})=>{
 await login(p);const before=await p.evaluate(()=>JSON.parse(localStorage.getItem('h2do-expenses-syncmeta')).lastSyncAt);control.rejectWrite='expenses';await p.evaluate(async()=>{audit.expState().settings.salaryAmountMinor=555;audit.expSave(audit.expState());await audit.expPushRemote(audit.expState());});control.rejectServerRead=true;await p.evaluate(()=>audit.expPullRemote({manual:true}));assert.doesNotMatch(await p.locator('#expSyncText').innerText(),/تم التأكيد من السحابة/);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('h2do-expenses-syncmeta')).lastSyncAt),before);
}));
test('expanded More menu stays clickable above report tabs',()=>run(async({p})=>{
 await p.locator('#expFinanceMore summary').click();await p.locator('#expFinanceMore [data-view="reports"]').click();await p.locator('[data-rep="yearly"]').click();await p.locator('#expFinanceMore summary').click();await p.locator('#expFinanceMore [data-view="trips"]').click();assert.equal(await p.locator('#expViewTrips').isVisible(),true);
}));

test('closing existing backup manager returns focus to finance and preserves its scroll lock',()=>run(async({p})=>{
 await p.locator('#expFinanceMore summary').click();await p.locator('#expProtectionBtn').click();const overflow=await p.evaluate(()=>document.body.style.overflow);await p.locator('#fpManage').click();assert.equal(await p.locator('#dataOverlay').isVisible(),true);await p.locator('#dataClose').click();assert.equal(await p.locator('#expOverlay').isVisible(),true);assert.equal(await p.locator('#expProtectionBtn').evaluate(e=>e===document.activeElement),true);assert.equal(await p.evaluate(()=>document.body.style.overflow),overflow);
}));
