'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {device,chromium}=require('./audit-browser-helper.cjs');
let browser;
test.before(async()=>{browser=await chromium.launch();});
test.after(async()=>{await browser.close();});
async function withDevice(fn){const d=await device(browser);try{await fn(d);assert.deepEqual(d.errors,[]);}finally{await d.c.close();}}

test('Quran target changes reconcile current-day completion in memory and durable day record',()=>withDevice(async({p})=>{
const result=await p.evaluate(()=>{
 const day=audit.todayStr();audit.setDate(day);audit.setState(audit.blankState());
 audit.qSave({page:6,startPage:1,target:5,dayAnchor:day});audit.renderWorship();audit.save();
 document.getElementById('quranTarget').click();document.getElementById('qSettingsTarget').value='10';document.getElementById('qSettingsSave').click();
 return {memory:audit.get().worship.werd,saved:JSON.parse(localStorage.getItem(audit.storageKey(day))).worship.werd,target:audit.qLoad().target};
});
assert.equal(result.target,10);assert.equal(result.memory,false);assert.equal(result.saved,false);
}));

test('accepting remote Quran progress cannot let an old reader cursor invent pages',()=>withDevice(async({p,cloud})=>{
await p.evaluate(()=>{audit.login();audit.qSave({page:200,startPage:200,target:5,dayAnchor:audit.todayStr()});audit.openQuran();audit.qOpenReader();});
await p.waitForTimeout(60);
cloud['users/test/meta/quran']={page:100,startPage:100,target:5,dayAnchor:await p.evaluate(()=>audit.todayStr()),updatedAt:Date.now()+100000};
const result=await p.evaluate(async()=>{await audit.qPullRemote('regression');audit.qNext();return audit.qLoad();});
assert.ok(result.page<=101,`one navigation moved remotely accepted page 100 to ${result.page}`);
}));

test('custom Quran navigation preserves progress and recording preserves unrelated items',()=>withDevice(async({p})=>{
const result=await p.evaluate(()=>{
 const item={id:'quran-test',kind:'quran',label:'ورد',startPage:2,endPage:8,currentPage:2,target:2,lastReadDate:'',completed:false};
 const unrelated={id:'habit-test',kind:'habit',label:'habit',customValue:'preserved'};
 audit.wCustomSave([item,unrelated]);audit.openSurah(item.id);document.getElementById('surahContinueBtn').click();document.getElementById('surahNext').click();
 const afterNavigation=audit.wCustom()[0].currentPage;
 audit.qsMarkTodayDone();audit.qsMarkTodayDone();
 return {afterNavigation,items:audit.wCustom(),day:JSON.parse(localStorage.getItem(audit.storageKey(audit.todayStr())))};
});
assert.equal(result.afterNavigation,2);assert.equal(result.items[0].currentPage,4);assert.equal(result.items[1].customValue,'preserved');assert.equal(result.day.worship['quran-test'],true);
}));

test('previous day Quran anchor rolls over without deleting stored progress or metadata',()=>withDevice(async({p})=>{
const result=await p.evaluate(()=>{const saved={page:345,startPage:340,target:5,dayAnchor:'2026-01-01',finalPageReadDate:'2026-01-01',customMetadata:'preserved'};localStorage.setItem('h2do-quran',JSON.stringify(saved));return {loaded:audit.qLoad(),stored:JSON.parse(localStorage.getItem('h2do-quran'))};});
assert.equal(result.loaded.page,345);assert.equal(result.loaded.startPage,345);assert.equal(result.loaded.customMetadata,'preserved');assert.equal(result.stored.startPage,340);
}));

test('failed Quran upload retains local progress and reconciles after reconnection',()=>withDevice(async({p,cloud,control})=>{
control.rejectWrite='/meta/quran';await p.evaluate(()=>{audit.login();audit.qSave({page:27,startPage:25,target:5,dayAnchor:audit.todayStr(),note:'preserve'});});await p.waitForTimeout(50);
assert.equal(await p.evaluate(()=>audit.qLoad().page),27);control.rejectWrite='';await p.evaluate(()=>audit.qPullRemote('online'));
assert.equal(cloud['users/test/meta/quran'].page,27);assert.equal(cloud['users/test/meta/quran'].note,'preserve');
}));

test('Quran completion adopted at sign-in preserves concurrently hydrated prayer records',()=>withDevice(async({p,cloud})=>{
const day=await p.evaluate(()=>audit.todayStr());
cloud['users/test/days/'+day]={date:day,prayers:[true,false,false,false,false],worship:{},tasks:[],priorities:[],updatedAt:Date.now()+100000};
cloud['users/test/meta/quran']={page:6,startPage:1,target:5,dayAnchor:day,updatedAt:Date.now()+100000};
const result=await p.evaluate(async()=>{const query=window.serverQuery;window.serverQuery=async(...args)=>{await new Promise(resolve=>setTimeout(resolve,100));return query(...args);};audit.login();await audit.syncPullAllModules('quran-hydration-test');return {state:audit.get(),stored:JSON.parse(localStorage.getItem(audit.storageKey(audit.todayStr())))};});
assert.ok([true,'ontime'].includes(result.state.prayers[0]));assert.ok([true,'ontime'].includes(result.stored.prayers[0]));assert.equal(result.stored.worship.werd,true);
}));

test('unchanged incomplete Quran status does not rewrite the hydrated daily record',()=>withDevice(async({p,cloud})=>{
const day=await p.evaluate(()=>audit.todayStr());
cloud['users/test/days/'+day]={date:day,prayers:[true,false,false,false,false],worship:{},tasks:[],priorities:[],updatedAt:Date.now()+100000};
cloud['users/test/meta/quran']={page:1,startPage:1,target:5,dayAnchor:day,updatedAt:Date.now()+100000};
const result=await p.evaluate(async()=>{const query=window.serverQuery;window.serverQuery=async(...args)=>{await new Promise(resolve=>setTimeout(resolve,100));return query(...args);};audit.login();await audit.syncPullAllModules('quran-noop-hydration');return JSON.parse(localStorage.getItem(audit.storageKey(audit.todayStr())));});
assert.equal(result.prayers[0],true);assert.equal(Object.hasOwn(result.worship,'werd'),false);
}));
