'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {device,chromium}=require('./audit-browser-helper.cjs');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser.close());
async function run(fn){const d=await device(browser);try{await fn(d.p,d);assert.deepEqual(d.errors,[]);}finally{await d.c.close();}}
async function course(p){await p.evaluate(()=>{const data=audit.learningLoad();data.courses=[{id:'c',name:'دورة',notes:'قديم',updatedAt:1}];audit.learningSave(data);});await p.locator('[data-app-view="learning"]').first().click();await p.locator('#learningCoursesBtn').click();await p.getByRole('button',{name:'تعديل',exact:true}).click();}
test('learning editor merges disjoint cloud changes and keeps them on upload',()=>run(async(p,d)=>{
 await p.evaluate(()=>audit.login());await course(p);await p.evaluate(()=>audit.learningPullRemote('seed'));
 const remote=d.cloud['users/test/meta/learning'];remote.courses[0].notes='جديد من الجهاز الثاني';remote.courses[0].updatedAt=Date.now()+1;remote.updatedAt=Date.now()+1;
 await p.evaluate(()=>audit.learningPullRemote('other-device'));await p.locator('#lfName').fill('اسم جديد');await p.locator('#learningFormSave').click();await p.evaluate(()=>audit.learningPullRemote('verify'));
 const item=await p.evaluate(()=>audit.learningLoad().courses[0]);assert.equal(item.name,'اسم جديد');assert.equal(item.notes,'جديد من الجهاز الثاني');assert.equal(d.cloud['users/test/meta/learning'].courses[0].notes,item.notes);
}));
test('same-field conflict preserves remote and draft until explicit reload',()=>run(async p=>{
 await course(p);await p.locator('#lfNotes').fill('محلي');await p.evaluate(()=>{const d=audit.learningLoad();d.courses[0].notes='بعيد';audit.learningSave(d);});await p.locator('#learningFormSave').click();assert.match(await p.locator('#learningFormErr').innerText(),/نفس الحقل/);assert.equal(await p.locator('#lfNotes').inputValue(),'محلي');assert.equal(await p.evaluate(()=>audit.learningLoad().courses[0].notes),'بعيد');await p.getByRole('button',{name:'فتح أحدث نسخة (إلغاء تعديلاتي الحالية)',exact:true}).click();assert.equal(await p.locator('#lfNotes').inputValue(),'بعيد');
}));
test('deleted learning item cannot be resurrected by stale editor',()=>run(async p=>{
 await course(p);await p.evaluate(()=>{const d=audit.learningLoad();d.courses[0].deletedAt=Date.now();audit.learningSave(d);});await p.locator('#lfName').fill('لا تعد');await p.locator('#learningFormSave').click();assert.match(await p.locator('#learningFormErr').innerText(),/حُذف/);assert.ok(await p.evaluate(()=>audit.learningLoad().courses[0].deletedAt));
}));
for(const [kind,key,name,field] of [['course','courses','name','lfName'],['prep','preparations','title','lfTitle'],['read','professionalReading','title','lfTitle']])test('planner opens correct '+kind+' editor and saves original source',()=>run(async p=>{
 await p.evaluate(({kind,key,name})=>{const d=audit.learningLoad(),date=audit.todayStr();d[key]=[{id:'source',[name]:'عنصر اختبار',targetDate:date,updatedAt:1}];d.calendarOccurrences=[{id:'learning|'+kind+'|source|target',kind,sourceId:'source',date,sourceRecurrence:'once',binding:{ownerId:'owner',calendarId:'mock',eventId:'mock'},updatedAt:1}];audit.learningSave(d);__mfkrPlanner.render();},{kind,key,name});
 await p.locator('.planner-row-main').filter({hasText:'عنصر اختبار'}).click();await p.locator('#plannerSummaryEdit').click();await p.locator('#'+field).fill('تم التعديل');await p.locator('#learningFormSave').click();assert.equal(await p.evaluate(({key,name})=>audit.learningLoad()[key][0][name],{key,name}),'تم التعديل');assert.equal(await p.evaluate(()=>audit.learningLoad().schedule.length),0);
}));
test('lecture rejects backwards/equal intervals and treats concurrent time edits atomically',()=>run(async p=>{
 await p.evaluate(()=>{const d=audit.learningLoad();d.schedule=[{id:'s',courseName:'محاضرة',day:new Date().getDay(),startTime:'09:00',endTime:'11:00',recurrence:'weekly',updatedAt:1}];audit.learningSave(d);__mfkrPlanner.open(__mfkrPlanner.rows(audit.todayStr(),audit.todayStr()).find(r=>r.external));});
 for(const end of ['08:00','09:00']){await p.locator('#lfEnd').fill(end);await p.locator('#learningFormSave').click();assert.match(await p.locator('#learningFormErr').innerText(),/بعد وقت البداية/);assert.equal(await p.evaluate(()=>audit.learningLoad().schedule[0].endTime),'11:00');}
 await p.locator('#lfEnd').fill('12:00');await p.evaluate(()=>{const d=audit.learningLoad();d.schedule[0].startTime='10:00';audit.learningSave(d);});await p.locator('#learningFormSave').click();assert.match(await p.locator('#learningFormErr').innerText(),/نفس الحقل/);
}));
test('learning editor fits small phone, keyboard-height viewport, iPad and laptop',()=>run(async p=>{
 await course(p);for(const [width,height] of [[320,480],[390,300],[820,1180],[1180,820],[1366,768]]){await p.setViewportSize({width,height});await p.locator('#lfNotes').focus();await p.locator('#learningFormSave').scrollIntoViewIfNeeded();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.ok(await p.locator('#learningFormSave').isVisible());}
}));
test('learning edit survives network failure, reload and reconnect without duplicates',()=>run(async(p,d)=>{
 await p.evaluate(()=>{audit.login();sessionStorage.setItem('testUser',JSON.stringify({uid:'test'}));});await course(p);await p.evaluate(()=>audit.learningPullRemote('seed'));
 d.control.rejectRead='meta/learning';d.control.rejectWrite='meta/learning';await d.c.setOffline(true);await p.locator('#lfName').fill('تعديل دون اتصال');await p.locator('#learningFormSave').click();await p.evaluate(()=>audit.learningPullRemote('offline'));
 assert.equal(await p.evaluate(()=>audit.learningLoad().courses[0].name),'تعديل دون اتصال');assert.equal(d.cloud['users/test/meta/learning'].courses[0].name,'دورة');
 await d.c.setOffline(false);d.control.rejectRead='';d.control.rejectWrite='';await p.reload();await p.evaluate(()=>audit.learningPullRemote('reconnect'));assert.equal(d.cloud['users/test/meta/learning'].courses.length,1);assert.equal(d.cloud['users/test/meta/learning'].courses[0].name,'تعديل دون اتصال');
}));
