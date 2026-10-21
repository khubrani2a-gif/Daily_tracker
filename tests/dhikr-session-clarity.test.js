'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {device,chromium}=require('./audit-browser-helper.cjs');
let b;test.before(async()=>b=await chromium.launch());test.after(async()=>b.close());
async function run(fn){const d=await device(b);try{d.p.setDefaultTimeout(2000);await d.p.locator('a[data-app-view="iman"]').click();await fn(d.p);assert.deepEqual(d.errors,[]);}finally{await d.c.close();}}
test('daily summary distinguishes all rounds of this dhikr from the current round',()=>run(async p=>{await p.evaluate(()=>{const c=audit.dhikrCounterState();audit.get().dhikrSessions.push({id:'previous',text:c.text,target:100,base:100,deltas:{}});audit.dhikrCount();});assert.match(await p.locator('#dhikrDailySummary').innerText(),/١٠١/);assert.equal(await p.locator('#dhikrCounterNumber').innerText(),'١');await p.locator('#dhikrMore').click();await p.locator('#dhikrStatsBtn').click();assert.match(await p.locator('.task-sheet-overlay').innerText(),/الجولة الحالية/);}));
test('resume restores chosen round and survives reload without losing another round',()=>run(async p=>{await p.evaluate(()=>{audit.dhikrCount();audit.get().dhikrSessions.push({id:'old',text:'الحمد لله',target:33,base:12,deltas:{}});audit.save();audit.renderWorship();});await p.locator('#dhikrMore').click();await p.locator('#dhikrResume').click();await p.locator('[data-dhikr-resume="old"]').click();assert.equal(await p.locator('#dhikrCounterNumber').innerText(),'١٢');await p.locator('#dhikrCountBtn').click();await p.reload();await p.locator('a[data-app-view="iman"]').click();assert.equal(await p.locator('#dhikrCounterNumber').innerText(),'١٣');assert.equal(await p.evaluate(()=>audit.get().dhikrSessions.length),2);}));
test('historical counter explicitly labels recording date without moving the count to today',()=>run(async p=>{await p.evaluate(()=>{audit.setDate('2026-10-01');audit.setState(audit.blankState());audit.renderWorship();audit.dhikrCount();});assert.match(await p.locator('#dhikrDailySummary').innerText(),/2026-10-01/);assert.match(await p.locator('#dhikrDailySummary').innerText(),/تاريخ التسجيل/);}));
test('personal goals and verified source links are distinguished from prescribed counts',()=>run(async p=>{await p.evaluate(()=>audit.openDhikrCounterSettings());assert.match(await p.locator('.task-sheet-overlay').innerText(),/اختيار شخصي/);await p.keyboard.press('Escape');await p.evaluate(()=>audit.openAdhkar('am'));const source=p.locator('a[href="https://sunnah.com/muslim:2702b"]');assert.equal(await source.count(),1);assert.match(await source.locator('..').innerText(),/لليوم كله/);assert.equal(await source.getAttribute('rel'),'noopener noreferrer');}));
test('offline increments from two devices merge once after retry and keep the daily total',async()=>{const a=await device(b),z=await device(b);try{
 await a.p.evaluate(async()=>{audit.login();audit.dhikrCount();await audit.syncPendingDays('seed');});
 Object.assign(z.cloud,JSON.parse(JSON.stringify(a.cloud)));
 await z.p.evaluate(async()=>{audit.login();await audit.pullRemote(audit.todayStr(),'seed');});
 a.control.rejectWrite='/days/';z.control.rejectWrite='/days/';
 await a.p.evaluate(async()=>{audit.dhikrCount();audit.dhikrCount();await audit.syncPendingDays('offline');});
 await z.p.evaluate(async()=>{audit.dhikrCount();await audit.syncPendingDays('offline');});
 a.control.rejectWrite='';await a.p.evaluate(()=>audit.syncPendingDays('online'));
 Object.assign(z.cloud,JSON.parse(JSON.stringify(a.cloud)));z.control.rejectWrite='';
 await z.p.evaluate(async()=>{await audit.syncPendingDays('online');await audit.pullRemote(audit.todayStr(),'verify');await audit.syncPendingDays('retry');});
 Object.assign(a.cloud,JSON.parse(JSON.stringify(z.cloud)));await a.p.evaluate(()=>audit.pullRemote(audit.todayStr(),'verify'));
 for(const d of [a,z]){assert.equal(await d.p.evaluate(()=>audit.dhikrCounterState().count),4);assert.deepEqual(d.errors,[]);}
}finally{await a.c.close();await z.c.close();}});
