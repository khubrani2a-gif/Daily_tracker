'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {device,chromium}=require('./audit-browser-helper.cjs');
let browser;test.before(async()=>{browser=await chromium.launch();});test.after(async()=>{await browser.close();});
async function withDevice(fn,seed){const d=await device(browser,seed);try{await fn(d);assert.deepEqual(d.errors,[]);}finally{await d.c.close();}}
test('rapid saves on different days are durable before debounce and replay both',()=>withDevice(async({p,cloud})=>{
await p.evaluate(()=>{for(const [date,note] of [['2026-10-11','one'],['2026-10-12','two']]){audit.setDate(date);audit.setState({...audit.blankState(),notes:note});audit.save();}audit.login();});
assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('h2do-tracker:2026-10-11')).notes),'one');
await p.evaluate(()=>audit.syncPendingDays('test'));assert.equal(cloud['users/test/days/2026-10-11'].notes,'one');assert.equal(cloud['users/test/days/2026-10-12'].notes,'two');assert.deepEqual(await p.evaluate(()=>audit.dailyPending()),{});
}));
test('new offline daily changes preserve unrelated cloud notes and tasks',()=>withDevice(async({p,cloud})=>{
cloud['users/test/days/2026-10-14']={notes:'remote note',tasks:[{id:'remote',text:'remote task'}],updatedAt:Date.now()+10000};
await p.evaluate(()=>{audit.login();const state={...audit.blankState(),tasks:[{id:'local',text:'local task'}]};audit.persistDay('2026-10-14',state);return audit.pullRemote('2026-10-14','test');});
const value=cloud['users/test/days/2026-10-14'];assert.equal(value.notes,'remote note');assert.deepEqual(new Set(value.tasks.map(t=>t.id)),new Set(['local','remote']));
}));
test('reset is propagated as replacement and survives server pull',()=>withDevice(async({p,cloud})=>{
cloud['users/test/days/2026-10-13']={notes:'old cloud note',tasks:[{id:'old',text:'old'}],updatedAt:Date.now()+9999};
await p.evaluate(async()=>{audit.login();audit.persistDay('2026-10-13',audit.blankState(),{replace:true});await audit.pullRemote('2026-10-13','test');await audit.pullRemote('2026-10-13','again');});
assert.equal(cloud['users/test/days/2026-10-13'].notes,'');assert.ok(cloud['users/test/days/2026-10-13'].tasks.every(t=>!t.text));
}));
test('failed day upload retains journal and retries without dropping target-day task',()=>withDevice(async({p,cloud,control})=>{
control.rejectWrite='/days/';await p.evaluate(async()=>{audit.login();audit.persistDay('2026-10-14',{...audit.blankState(),tasks:[{id:'moved',text:'moved'}]});await audit.pullRemote('2026-10-14','test');});
assert.ok(await p.evaluate(()=>audit.dailyPending()['2026-10-14']));control.rejectWrite='';await p.evaluate(()=>audit.syncPendingDays('retry'));assert.equal(cloud['users/test/days/2026-10-14'].tasks[0].id,'moved');
}));
test('old daily snapshot replaces newer cloud copy and clears remote-only days',()=>withDevice(async({p,cloud})=>{
cloud['users/test/days/2026-10-11']={notes:'new remote',updatedAt:Date.now()+99999};cloud['users/test/days/2026-10-12']={notes:'not in snapshot',updatedAt:10};
const ok=await p.evaluate(async()=>{audit.login();audit.dataApplySnapshot({scope:'daily',entries:{'h2do-tracker:2026-10-11':JSON.stringify({...audit.blankState(),notes:'restored',updatedAt:1})}});return audit.restoreToCloud();});assert.equal(ok,true);assert.equal(cloud['users/test/days/2026-10-11'].notes,'restored');assert.equal(cloud['users/test/days/2026-10-12'].notes,'');assert.equal(await p.evaluate(()=>audit.restorePending()),null);
}));
test('failed restore blocks direct module pulls and is retryable',()=>withDevice(async({p,cloud,control})=>{
cloud['users/test/meta/quran']={page:90,updatedAt:Date.now()};control.rejectRead='/days';
assert.equal(await p.evaluate(async()=>{audit.login();audit.dataApplySnapshot({entries:{'h2do-quran':JSON.stringify({page:8,updatedAt:1})}});return audit.restoreToCloud();}),false);
await p.evaluate(()=>audit.qPullRemote('direct'));assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('h2do-quran')).page),8);assert.equal(await p.evaluate(()=>document.body.inert),false);control.rejectRead='';assert.equal(await p.evaluate(()=>audit.restoreToCloud()),true);assert.equal(cloud['users/test/meta/quran'].page,8);
}));
test('full restore tombstones removed collection rows and replaces nested expense data',()=>withDevice(async({p,cloud})=>{
cloud['users/test/hifzSegments/h']={id:'h',updatedAt:99};cloud['users/test/readingItems/i']={id:'i',updatedAt:99};cloud['users/test/meta/expenses']={settings:{updatedAt:99},categories:[{id:'cat',name:'old',updatedAt:99}],transactions:[]};
assert.equal(await p.evaluate(async()=>{audit.login();audit.dataApplySnapshot({entries:{}});return audit.restoreToCloud();}),true);assert.ok(cloud['users/test/hifzSegments/h'].deletedAt);assert.ok(cloud['users/test/readingItems/i'].deletedAt);assert.ok(cloud['users/test/meta/expenses'].settings.restoredAt);assert.ok(cloud['users/test/meta/expenses'].categories.find(c=>c.id==='cat').deletedAt);
}));
test('malformed backup fails validation before deleting existing data',()=>withDevice(async({p})=>{
assert.equal(await p.evaluate(()=>{localStorage.setItem('h2do-quran',JSON.stringify({page:7}));try{audit.dataApplySnapshot({entries:{'h2do-learning-v1':'{"schedule":42}'}});}catch(e){return JSON.parse(localStorage.getItem('h2do-quran')).page;}return false;}),7);
}));
test('global sync includes historical server days and local-only history',()=>withDevice(async({p,cloud})=>{
cloud['users/test/days/2025-01-02']={notes:'historical remote',updatedAt:3};
await p.evaluate(async()=>{audit.login();audit.persistDay('2025-02-03',{...audit.blankState(),notes:'historical local'});await audit.syncDailyHistory('manual');});
assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('h2do-tracker:2025-01-02')).notes),'historical remote');assert.equal(cloud['users/test/days/2025-02-03'].notes,'historical local');
}));
test('moving a task journals both source and target and preserves remote target data',()=>withDevice(async({p,cloud})=>{
cloud['users/test/days/2026-10-15']={notes:'keep',tasks:[{id:'remote',text:'already there'}],updatedAt:Date.now()+10000};
await p.evaluate(async()=>{audit.login();audit.setDate('2026-10-14');const t={id:'source',text:'move me'};audit.setState({...audit.blankState(),tasks:[t]});audit.taskPostpone(t,'2026-10-15','09:00','');await audit.syncPendingDays('test');});
assert.equal(cloud['users/test/days/2026-10-14'].tasks[0].status,'deferred');const target=cloud['users/test/days/2026-10-15'];assert.equal(target.notes,'keep');assert.equal(target.tasks.length,2);assert.ok(target.tasks.some(t=>t.postponedFromDate==='2026-10-14'));
}));
test('browser account transition reloads into isolated storage',()=>withDevice(async({p,cloud})=>{
await p.evaluate(()=>{audit.login();sessionStorage.setItem('testUser',JSON.stringify({uid:'test'}));localStorage.setItem('h2do-private-note','only A');});
await p.evaluate(()=>{sessionStorage.setItem('testUser',JSON.stringify({uid:'B'}));authChange({uid:'B'});});
await p.waitForFunction(()=>sessionStorage.getItem('testUser')?.includes('B')&&localStorage.getItem('h2do-private-note')===null);
await p.waitForTimeout(300);assert.ok(!Object.keys(cloud).filter(k=>k.startsWith('users/B/')).some(k=>JSON.stringify(cloud[k]).includes('only A')));
await p.evaluate(()=>{sessionStorage.setItem('testUser',JSON.stringify({uid:'test'}));authChange({uid:'test'});});await p.waitForFunction(()=>localStorage.getItem('h2do-private-note')==='only A');
}));
test('first upload preserves pre-existing guest content before the journaled edit',()=>withDevice(async({p,cloud})=>{
await p.evaluate(async()=>{const date='2026-10-01',old={...audit.blankState(),notes:'older guest note',tasks:[{id:'old',text:'older guest task'}],water:1,updatedAt:10};localStorage.setItem(audit.storageKey(date),JSON.stringify(old));audit.persistDay(date,{...old,water:2});audit.login();await audit.syncPendingDays('firstLogin');});
const day=cloud['users/test/days/2026-10-01'];assert.equal(day.notes,'older guest note');assert.equal(day.tasks[0].id,'old');assert.equal(day.water,2);
}));
test('expense restoration rejects older data but preserves later offline transactions',()=>withDevice(async({p})=>{
const r=await p.evaluate(()=>audit.expMerge({settings:{updatedAt:100,restoredAt:100},transactions:[{id:'kept',updatedAt:100}]},{settings:{updatedAt:1},transactions:[{id:'old',updatedAt:50},{id:'new',updatedAt:101}]}));assert.deepEqual(new Set(r.transactions.map(t=>t.id)),new Set(['kept','new']));
}));
test('restore unlocks after stalled writes and late completion cannot replace new local edits',()=>withDevice(async({p,control})=>{
await p.clock.install();control.holdWrites=true;
await p.evaluate(()=>{audit.login();audit.dataApplySnapshot({entries:{'h2do-quran':'{"page":8,"updatedAt":1}'}});window.restoreAttempt=audit.restoreToCloud();});
await p.waitForFunction(()=>document.body.inert);await p.waitForTimeout(100);await p.clock.fastForward(16000);assert.equal(await p.evaluate(()=>window.restoreAttempt),false);assert.equal(await p.evaluate(()=>document.body.inert),false);
await p.evaluate(()=>audit.qSave({page:11,updatedAt:Date.now()}));control.holdWrites=false;(control.pendingWrites||[]).forEach(resolve=>resolve());await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('h2do-quran')).page),11);assert.ok(await p.evaluate(()=>audit.restorePending()));
}));
