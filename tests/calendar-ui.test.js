const {revealPlannerControl}=require('./planner-test-actions.cjs');
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {device,chromium}=require('./audit-browser-helper.cjs');let browser;
test.before(async()=>{browser=await chromium.launch({headless:true,args:['--no-sandbox']});});test.after(async()=>{await browser?.close();});
async function run(fn){const d=await device(browser);try{await d.p.goto('https://audit.local/index.html');await d.p.waitForTimeout(150);
 const api={events:new Map(),requests:[],version:0,fail:0,conflict:false,hold:null};
 await d.p.route('https://www.googleapis.com/calendar/v3/**',async route=>{
  const req=route.request(),u=new URL(req.url()),method=req.method(),body=req.postDataJSON(),path=u.pathname.replace('/calendar/v3/','');api.requests.push({path,method,body,headers:req.headers()});
  const reply=(status,value)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
  if(api.hold){const hold=api.hold;api.hold=null;await hold;}
  if(api.fail)return reply(api.fail,{});
  if(path==='users/me/calendarList')return reply(200,{items:[{id:'app-calendar',description:'Mufakkirati app calendar v1',accessRole:'owner'}]});
  const id=path.split('/').at(-1);
  if(method==='GET')return api.events.has(id)?reply(200,api.events.get(id)):reply(404,{});
  if(method==='POST'){if(api.events.has(body.id))return reply(409,{});const event={...body,etag:'"'+(++api.version)+'"'};api.events.set(body.id,event);if(api.dropInsert){api.dropInsert=false;return reply(503,{});}return reply(200,event);}
  if(method==='PATCH'){const event=api.events.get(id);if(api.conflict||req.headers()['if-match']!==event?.etag){api.conflict=false;return reply(412,{});}const next={...event,...body,etag:'"'+(++api.version)+'"'};api.events.set(id,next);return reply(200,next);}
  return reply(400,{});
 });
 await d.p.evaluate(()=>{audit.login();sessionStorage.setItem("testUser",JSON.stringify({uid:"test"}));audit.go(audit.todayStr());const original=firebase.auth;function auth(){return {...original(),currentUser:{uid:'test',reauthenticateWithPopup:async provider=>{window.requestedScopes=provider.scopes;return {user:{uid:'test'},credential:{accessToken:'TEST_MEMORY_ONLY_TOKEN'}};}}};}auth.GoogleAuthProvider=function(){this.scopes=[];this.addScope=s=>this.scopes.push(s);};firebase.auth=auth;});
 await fn(d.p,api,d);assert.deepEqual(d.errors,[]);
 }finally{await d.c.close();}}
async function seed(p,extra={}){await p.evaluate(extra=>{audit.get().tasks=[{id:'calendar-task',text:'زيارة',kind:'appointment',plannerVersion:1,dueDate:audit.todayStr(),dueTime:'13:00',endTime:'13:30',durationMinutes:30,status:'pending',repeat:'none',reminders:[15],notes:'ملاحظات',...extra}];audit.save();__mfkrPlanner.render();},extra);}
async function connect(p){await p.evaluate(()=>__mfkrPlanner.calendar.settings());await p.locator('#plannerCalendarConnect').click();await p.waitForFunction(()=>document.querySelector('#plannerCalendarSync')?.disabled===false);}
async function link(p){await p.evaluate(()=>__mfkrPlanner.calendar.link(__mfkrPlanner.rows(null,null,false).find(r=>r.task.id==='calendar-task')));}
const current=p=>p.evaluate(()=>__mfkrPlanner.rows(null,null,false).find(r=>r.task.id==='calendar-task')?.task);
async function edit(p,fields){await p.evaluate(fields=>{Object.assign(audit.get().tasks.find(t=>t.id==='calendar-task'),fields);audit.save();},fields);}
const remote=api=>[...api.events.values()][0];
test('Google connection is explicit and tokens never enter local storage, backup or Firestore',()=>run(async(p,api,d)=>{
 await seed(p);assert.equal(api.requests.length,0);await connect(p);assert.equal(api.events.size,0);await link(p);assert.equal(api.events.size,1);assert.deepEqual(remote(api).reminders.overrides,[{method:'popup',minutes:15}]);assert.equal(await p.evaluate(()=>Array.from({length:window.localStorage.length},(_,i)=>window.localStorage.getItem(window.localStorage.key(i))).some(v=>String(v).includes('TEST_MEMORY_ONLY_TOKEN'))),false);assert.ok(!JSON.stringify(d.cloud).includes('TEST_MEMORY_ONLY_TOKEN'));assert.deepEqual(await p.evaluate(()=>requestedScopes),['https://www.googleapis.com/auth/calendar.app.created','https://www.googleapis.com/auth/calendar.calendarlist.readonly']);assert.equal((await current(p)).calendarBinding.ownerId,'calendar-task');
 await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal(api.requests.filter(r=>r.method==='POST').length,1);
}));
test('local edits upload and remote date changes move the same task with steps and deadline intact',()=>run(async(p,api)=>{
 await seed(p,{deadline:'2026-12-31',subtasks:[{id:'step',text:'تحليل',done:true}]});await connect(p);await link(p);await edit(p,{text:'عيادة'});await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal(remote(api).summary,'عيادة');const e=remote(api),date=await p.evaluate(()=>__mfkrPlanner.core.plus(audit.todayStr(),1));e.start={dateTime:date+'T14:00:00+03:00'};e.end={dateTime:date+'T14:45:00+03:00'};e.etag='"remote"';await p.evaluate(()=>__mfkrPlanner.calendar.sync());let t=await current(p);assert.equal(t.dueDate,date);assert.equal(t.dueTime,'14:00');assert.equal(t.durationMinutes,45);assert.equal(t.deadline,'2026-12-31');assert.equal(t.subtasks[0].done,true);await p.reload();assert.equal((await current(p)).dueDate,date);
}));
test('concurrent changes show both versions and require a deliberate choice',()=>run(async(p,api)=>{
 await seed(p);await connect(p);await link(p);await edit(p,{text:'محلي'});remote(api).summary='Google';remote(api).etag='"remote"';await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal((await current(p)).text,'محلي');assert.equal(remote(api).summary,'Google');assert.match(await p.locator('#plannerCalendarIssues').innerText(),/محلي/);assert.match(await p.locator('#plannerCalendarIssues').innerText(),/Google/);await p.locator('[data-calendar-choice="remote"]').click();await p.waitForFunction(()=>__mfkrPlanner.rows(null,null,false).find(r=>r.task.id==='calendar-task').task.text==='Google');assert.equal((await current(p)).calendarBinding.base.text,'Google');
}));
test('ETag rejects a Google edit made during upload without losing the local change',()=>run(async(p,api)=>{
 await seed(p);await connect(p);await link(p);await edit(p,{notes:'تعديل محلي'});api.conflict=true;await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal((await current(p)).notes,'تعديل محلي');assert.equal(remote(api).description,'ملاحظات');assert.match(await p.locator('#plannerCalendarIssues').innerText(),/أثناء الحفظ/);await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal(remote(api).description,'تعديل محلي');
}));
test('remote deletion cancels locally and local cancellation reaches Google',()=>run(async(p,api)=>{
 await seed(p);await connect(p);await link(p);await edit(p,{status:'cancelled'});await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal(remote(api).status,'cancelled');await edit(p,{status:'pending'});await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal(remote(api).status,'confirmed');api.events.clear();await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal((await current(p)).status,'cancelled');
}));
test('unlink retains Google appointment and stops further uploads; disconnect prevents all requests',()=>run(async(p,api)=>{
 await seed(p);await connect(p);await link(p);await p.locator('[data-calendar-unlink]').click();assert.equal((await current(p)).calendarBinding,undefined);assert.equal(api.events.size,1);await edit(p,{text:'بلا ربط'});await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal(remote(api).summary,'زيارة');await p.evaluate(()=>__mfkrPlanner.calendar.disconnect());const count=api.requests.length;await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal(api.requests.length,count);
}));
test('API setup and expired grants show actionable errors and retain local changes',()=>run(async(p,api)=>{
 await seed(p);api.fail=403;await p.evaluate(()=>__mfkrPlanner.calendar.settings());await p.locator('#plannerCalendarConnect').click();await p.waitForFunction(()=>document.querySelector('#plannerCalendarStatus').textContent.includes('Calendar API'));assert.equal(api.events.size,0);api.fail=0;await p.locator('#plannerCalendarConnect').click();await p.waitForFunction(()=>document.querySelector('#plannerCalendarSync').disabled===false);await link(p);await edit(p,{text:'محفوظ محليًا'});api.fail=401;await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal((await current(p)).text,'محفوظ محليًا');assert.match(await p.locator('#plannerCalendarIssues').innerText(),/انتهى إذن/);
}));
test('recurring link isolates one occurrence and future occurrences are not duplicated or linked',()=>run(async(p,api)=>{
 await seed(p,{repeat:'daily',repeatInterval:1});await connect(p);await link(p);assert.equal((await current(p)).occurrenceOnly,true);const next=await p.evaluate(()=>{const date=__mfkrPlanner.core.plus(audit.todayStr(),1);return __mfkrPlanner.rows(date,date).filter(r=>r.date===date);});assert.equal(next.length,1);assert.equal(next[0].task.calendarBinding,undefined);assert.equal(api.events.size,1);
}));
test('disconnect during an outstanding calendar read prevents applying its result',()=>run(async(p,api)=>{
 await seed(p);await connect(p);await link(p);remote(api).summary='لن يطبّق';let release;api.hold=new Promise(r=>release=r);const before=api.requests.length;const running=p.evaluate(()=>__mfkrPlanner.calendar.sync());while(api.requests.length===before)await new Promise(r=>setTimeout(r,10));await p.evaluate(()=>__mfkrPlanner.calendar.disconnect());release();await running;assert.equal((await current(p)).text,'زيارة');
}));
test('parsed recurrence and slot buffers reach the editor while manual choices remain intact',()=>run(async p=>{
 await p.locator('[data-app-view="today"]').first().click().catch(()=>{});await p.evaluate(()=>__mfkrPlanner.open());await p.locator('#tmText').fill('موعد كل أسبوعين الخميس الساعة ١٣:٠٠ لمدة نصف ساعة');assert.equal(await p.locator('#tmInterval').inputValue(),'2');assert.equal(await p.locator('#tmRepeat').inputValue(),'weekly');assert.equal(await p.locator('[data-planner-weekday="4"]').isChecked(),true);await p.locator('#plannerDetails').evaluate(el=>el.open=true);await revealPlannerControl(p,'#tmBuffer');await p.locator('#tmBuffer').fill('15');await p.locator('#tmBuffer').press('Tab');const suggestion=p.locator('[data-slot]').first();assert.ok(await suggestion.count());await suggestion.click();assert.equal(await p.locator('#plannerConflicts').isVisible(),false);
}));
test('linked tasks cannot silently drop their date and an explicit relink uses a new event identity',()=>run(async(p,api)=>{
 await seed(p,{kind:'task'});await connect(p);await link(p);const first=(await current(p)).calendarBinding.eventId;await p.evaluate(()=>{const r=__mfkrPlanner.rows(null,null,false).find(r=>r.task.id==='calendar-task');__mfkrPlanner.move(r,'');});assert.ok((await current(p)).dueDate);await p.locator('[data-calendar-unlink]').click();await link(p);assert.notEqual((await current(p)).calendarBinding.eventId,first);assert.equal(api.events.size,2);
}));
test('a lost insert response is recovered using the saved identity without creating another event',()=>run(async(p,api)=>{
 await seed(p);await connect(p);api.dropInsert=true;await link(p);assert.equal(api.events.size,1);assert.equal((await current(p)).calendarBinding.base,null);await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal(api.events.size,1);assert.equal(api.requests.filter(r=>r.method==='POST').length,1);assert.equal((await current(p)).calendarBinding.base.text,'زيارة');
}));
test('editing locally during a Google read prevents uploading an obsolete snapshot',()=>run(async(p,api)=>{
 await seed(p);await connect(p);await link(p);await edit(p,{text:'التعديل الأول'});let release;api.hold=new Promise(r=>release=r);const before=api.requests.length,patches=api.requests.filter(r=>r.method==='PATCH').length;const running=p.evaluate(()=>__mfkrPlanner.calendar.sync());while(api.requests.length===before)await new Promise(r=>setTimeout(r,10));await edit(p,{text:'التعديل الأحدث'});release();await running;assert.equal(api.requests.filter(r=>r.method==='PATCH').length,patches);assert.equal(remote(api).summary,'زيارة');assert.equal((await current(p)).text,'التعديل الأحدث');await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal(remote(api).summary,'التعديل الأحدث');
}));
test('linked status distinguishes pending, checked, disconnected and review with safe event links',()=>run(async(p,api)=>{
 await seed(p);await connect(p);await link(p);
 remote(api).htmlLink='https://www.google.com/calendar/event?eid=example';await p.evaluate(()=>__mfkrPlanner.calendar.sync());
 assert.match(await p.locator('[data-calendar-status]').first().innerText(),/تمت المزامنة/);
 assert.equal(await p.locator('[data-calendar-event-link]').first().getAttribute('href'),'https://www.google.com/calendar/event?eid=example');
 await p.locator('.task-sheet-close').click();await edit(p,{text:'موعد محدث'});await p.evaluate(()=>__mfkrPlanner.calendar.settings());assert.match(await p.locator('[data-calendar-status]').first().innerText(),/ينتظر المزامنة/);
 await p.locator('#plannerCalendarSync').click();await p.waitForFunction(()=>!document.querySelector('#plannerCalendarSync').disabled);assert.equal(remote(api).summary,'موعد محدث');
 await p.locator('#plannerCalendarDisconnect').click();assert.match(await p.locator('[data-calendar-status]').first().innerText(),/أعد الاتصال/);assert.match(await p.locator('#plannerCalendarStatus').innerText(),/لا يسحب/);
 assert.equal(await p.locator('#plannerCalendarPermissions').getAttribute('href'),'https://myaccount.google.com/connections');
 await p.locator('.task-sheet-close').click();await connect(p);api.fail=503;await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.match(await p.locator('[data-calendar-status]').first().innerText(),/تحتاج مراجعة/);
}));
test('unsafe Google event links are not rendered and summary includes connection status',()=>run(async(p,api)=>{
 await seed(p);await connect(p);await link(p);remote(api).htmlLink='javascript:alert(1)';await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal(await p.locator('[data-calendar-event-link]').count(),0);
 await p.locator('.task-sheet-close').click();await p.locator('.planner-row-main').first().click();assert.equal(await p.locator('#plannerSummary [data-calendar-status]').count(),1);
}));

test('successful unchanged check refreshes displayed time without rewriting task data',()=>run(async(p,api)=>{
 await seed(p);await connect(p);await link(p);const before=await current(p);
 await p.clock.install({time:Date.now()+120000});await p.evaluate(()=>__mfkrPlanner.calendar.sync());
 assert.equal((await current(p)).calendarBinding.syncedAt,before.calendarBinding.syncedAt);
 const expected=await p.evaluate(()=>new Date().toLocaleString('ar'));assert.ok((await p.locator('[data-calendar-task]').first().innerText()).includes(expected));
}));
test('disconnect during sync retains reconnect guidance and disconnect explanation',()=>run(async(p,api)=>{
 await seed(p);await connect(p);await link(p);let release;api.hold=new Promise(r=>release=r);const before=api.requests.length;const running=p.evaluate(()=>__mfkrPlanner.calendar.sync());while(api.requests.length===before)await new Promise(r=>setTimeout(r,10));
 await p.evaluate(()=>__mfkrPlanner.calendar.disconnect());release();await running;
 assert.match(await p.locator('[data-calendar-status]').first().innerText(),/أعد الاتصال/);assert.match(await p.locator('#plannerCalendarStatus').innerText(),/لا يسحب/);
}));
test('visible Google shortcut connects directly and becomes connection management',()=>run(async(p,api)=>{
 await seed(p);assert.equal(await p.locator('#plannerCalendarQuick').isVisible(),true);await p.locator('#plannerCalendarQuick').click();await p.waitForFunction(()=>document.querySelector('#plannerCalendarSync')?.disabled===false);assert.match(await p.locator('#plannerCalendarQuick').innerText(),/متصل/);assert.equal(api.events.size,0);
 await p.locator('#plannerCalendarDisconnect').click();assert.match(await p.locator('#plannerCalendarQuick').innerText(),/تفعيل/);
}));
test('connecting from an appointment continues its requested link without reopening it',()=>run(async(p,api)=>{
 await seed(p);await link(p);assert.match(await p.locator('#plannerCalendarConnect').innerText(),/وربط هذا الموعد/);await p.locator('#plannerCalendarConnect').click();await p.waitForFunction(()=>!!__mfkrPlanner.rows(null,null,false).find(r=>r.task.id==='calendar-task')?.task.calendarBinding?.base);assert.equal(api.events.size,1);assert.equal(remote(api).summary,'زيارة');
}));
test('closing the pending appointment sheet before consent returns does not link it',()=>run(async(p,api)=>{
 await seed(p);await p.evaluate(()=>{const auth=firebase.auth,base=auth();function replacement(){return {...base,currentUser:{...base.currentUser,reauthenticateWithPopup:()=>new Promise(r=>window.finishConsent=()=>r({user:{uid:'test'},credential:{accessToken:'TEST_MEMORY_ONLY_TOKEN'}}))}};}replacement.GoogleAuthProvider=auth.GoogleAuthProvider;firebase.auth=replacement;});await link(p);await p.locator('#plannerCalendarConnect').click();await p.locator('.task-sheet-close').click();await p.evaluate(()=>finishConsent());await p.waitForFunction(()=>document.querySelector('#plannerCalendarQuick').textContent.includes('متصل'));assert.equal((await current(p)).calendarBinding,undefined);assert.equal(api.events.size,0);
}));

test('disconnect during consent prevents reconnecting or linking the pending appointment',()=>run(async(p,api)=>{
 await seed(p);await p.evaluate(()=>{const auth=firebase.auth,base=auth();function replacement(){return {...base,currentUser:{...base.currentUser,reauthenticateWithPopup:()=>new Promise(r=>window.finishConsent=()=>r({user:{uid:'test'},credential:{accessToken:'TEST_MEMORY_ONLY_TOKEN'}}))}};}replacement.GoogleAuthProvider=auth.GoogleAuthProvider;firebase.auth=replacement;});await link(p);await p.locator('#plannerCalendarConnect').click();await p.locator('#plannerCalendarDisconnect').click();await p.evaluate(()=>finishConsent());await p.waitForTimeout(100);assert.match(await p.locator('#plannerCalendarQuick').innerText(),/تفعيل/);assert.match(await p.locator('#plannerCalendarStatus').innerText(),/الربط متوقف/);assert.equal((await current(p)).calendarBinding,undefined);assert.equal(api.events.size,0);
}));
test('empty sync explicitly says no appointments were sent',()=>run(async(p,api)=>{
 await seed(p);await connect(p);assert.match(await p.locator('#plannerCalendarStatus').innerText(),/لا توجد مواعيد مرتبطة/);assert.doesNotMatch(await p.locator('#plannerCalendarStatus').innerText(),/تمت مزامنة/);assert.equal(api.events.size,0);
}));
test('missing appointment end shows persistent actionable error instead of silent success',()=>run(async(p,api)=>{
 await seed(p,{endTime:'',durationMinutes:0});await link(p);assert.match(await p.locator('#plannerCalendarLinkProblem').innerText(),/حدد بداية ونهاية/);assert.equal(api.events.size,0);assert.equal((await current(p)).calendarBinding,undefined);await p.locator('#plannerCalendarLinkProblem button').click();assert.equal(await p.locator('#tmEnd').count(),1);
}));

async function seedLearning(p,kind='schedule',extra={}){return p.evaluate(({kind,extra})=>{const data=audit.learningLoad(),date=audit.todayStr();data[{schedule:'schedule',prep:'preparations',course:'courses',read:'professionalReading'}[kind]]=[{id:'lecture',courseName:'فيزياء',title:'تحضير',name:'دورة',day:new Date(date+'T12:00:00').getDay(),startTime:'09:00',endTime:'11:00',recurrence:'weekly',targetDate:date,createdAt:1,updatedAt:1,...extra}];audit.learningSave(data);__mfkrPlanner.render();return date;},{kind,extra});}
const learningRow=p=>p.evaluate(()=>__mfkrPlanner.rows(audit.todayStr(),__mfkrPlanner.core.plus(audit.todayStr(),10)).find(r=>r.external));
test('learning lecture links once without a daily copy and remote moves affect only its occurrence',()=>run(async(p,api)=>{
 const date=await seedLearning(p);await connect(p);await p.evaluate(()=>__mfkrPlanner.calendar.link(__mfkrPlanner.rows(audit.todayStr(),audit.todayStr()).find(r=>r.external)));assert.equal(api.events.size,1);assert.equal(await p.evaluate(()=>audit.get().tasks.filter(t=>t.text==='فيزياء').length),0);
 const e=remote(api),tomorrow=await p.evaluate(()=>__mfkrPlanner.core.plus(audit.todayStr(),1));e.start={dateTime:tomorrow+'T10:00:00+03:00'};e.end={dateTime:tomorrow+'T12:00:00+03:00'};e.summary='فيزياء مؤجلة';e.etag='"remote"';await p.evaluate(()=>__mfkrPlanner.calendar.sync());
 const rows=await p.evaluate(()=>__mfkrPlanner.rows(audit.todayStr(),__mfkrPlanner.core.plus(audit.todayStr(),7)).filter(r=>r.external));assert.equal(rows.length,2);assert.equal(rows[0].date,tomorrow);assert.equal(rows[0].task.text,'فيزياء مؤجلة');assert.equal(rows[1].task.text,'فيزياء');assert.equal(await p.evaluate(()=>audit.learningLoad().schedule[0].startTime),'09:00');
 await p.reload();assert.equal((await learningRow(p)).date,tomorrow);assert.equal(await p.evaluate(()=>audit.learningLoad().calendarOccurrences.length),1);
}));
test('learning source edits upload, conflicts are explicit, deletion cancels Google',()=>run(async(p,api)=>{
 await seedLearning(p);await connect(p);await p.evaluate(()=>__mfkrPlanner.calendar.link(__mfkrPlanner.rows(audit.todayStr(),audit.todayStr()).find(r=>r.external)));
 await p.evaluate(()=>{const d=audit.learningLoad();d.schedule[0].courseName='اسم محلي';d.schedule[0].updatedAt=Date.now();audit.learningSave(d);});remote(api).summary='اسم Google';remote(api).etag='"remote"';await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal(api.requests.filter(r=>r.method==='PATCH').length,0);assert.match(await p.locator('#plannerCalendarIssues').innerText(),/اسم محلي/);await p.locator('[data-calendar-choice="remote"]').click();await p.waitForFunction(()=>__mfkrPlanner.rows(audit.todayStr(),audit.todayStr()).find(r=>r.external).task.text==='اسم Google');
 await p.evaluate(()=>{const d=audit.learningLoad();d.schedule[0].deletedAt=Date.now();d.schedule[0].updatedAt=Date.now();audit.learningSave(d);});await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal(remote(api).status,'cancelled');
}));
test('weekly range preview deduplicates linked occurrences and unlink retains Google and the override',()=>run(async(p,api)=>{
 const date=await seedLearning(p);await connect(p);await p.locator('.task-sheet-close').click();await p.evaluate(()=>__mfkrPlanner.calendar.learning('schedule','lecture',audit.todayStr()));await p.locator('#learningCalendarMode').selectOption('range');const end=await p.evaluate(()=>__mfkrPlanner.core.plus(audit.todayStr(),14));await p.locator('#learningCalendarEnd').fill(end);await p.locator('#learningCalendarEnd').dispatchEvent('change');assert.match(await p.locator('#learningCalendarPreview').innerText(),/3 مواعيد/);await p.locator('#learningCalendarSave').click();await p.waitForFunction(()=>document.querySelector('#learningCalendarError').textContent.includes('تمت مزامنة 3 مواعيد'));assert.equal(api.events.size,3);await p.locator('#learningCalendarSave').click();await p.waitForFunction(()=>!document.querySelector('#learningCalendarSave').disabled);assert.equal(api.events.size,3);
 await p.locator('#learningCalendarManage').click();await p.locator('[data-calendar-unlink]').first().click();assert.equal(await p.evaluate(()=>audit.learningLoad().calendarOccurrences.filter(r=>r.binding).length),2);assert.equal(api.events.size,3);
}));
test('dated learning preparation, course and reading targets link as all-day and show in planner',()=>run(async(p,api)=>{
 await connect(p);await p.locator('.task-sheet-close').click();for(const kind of ['prep','course','read']){await seedLearning(p,kind);await p.evaluate(kind=>__mfkrPlanner.calendar.learning(kind,'lecture'),kind);await p.locator('#learningCalendarSave').click();await p.waitForFunction(()=>document.querySelector('#learningCalendarError').textContent.includes('تمت مزامنة 1 مواعيد'));await p.locator('.task-sheet-close').click();}assert.equal(api.events.size,3);assert.ok([...api.events.values()].every(e=>e.start.date&&!e.start.dateTime));assert.equal(await p.evaluate(()=>__mfkrPlanner.rows(audit.todayStr(),audit.todayStr()).filter(r=>r.external).length),3);
}));
test('learning validation blocks missing end/date and excessive ranges before any Google writes',()=>run(async(p,api)=>{
 await seedLearning(p,'schedule',{endTime:''});await p.evaluate(()=>__mfkrPlanner.calendar.learning('schedule','lecture',audit.todayStr()));assert.equal(await p.locator('#learningCalendarSave').isDisabled(),true);assert.match(await p.locator('#learningCalendarError').innerText(),/نهاية/);assert.equal(api.requests.length,0);await p.locator('.task-sheet-close').click();await seedLearning(p);await p.evaluate(()=>__mfkrPlanner.calendar.learning('schedule','lecture',audit.todayStr()));await p.locator('#learningCalendarMode').selectOption('range');await p.locator('#learningCalendarEnd').fill('2099-01-01');await p.locator('#learningCalendarEnd').dispatchEvent('change');assert.equal(await p.locator('#learningCalendarSave').isDisabled(),true);assert.equal(api.requests.length,0);
}));
test('learning independent occurrence records merge and preserve unlink tombstones',()=>run(async(p)=>{
 await seedLearning(p);const result=await p.evaluate(()=>{const d=audit.learningLoad(),date=audit.todayStr(),id='learning|schedule|lecture|'+date;const record={id,kind:'schedule',sourceId:'lecture',date,updatedAt:10,binding:{ownerId:id,calendarId:'c',eventId:'e'}};const a={...d,calendarOccurrences:[record]},b={...d,calendarOccurrences:[{...record,binding:null,updatedAt:11}]};return __mfkrLearning.merge(a,b).calendarOccurrences;});assert.equal(result.length,1);assert.equal(result[0].binding,null);
}));
test('once lecture date edits keep one binding and the learning action remains usable',()=>run(async(p,api)=>{
 const date=await p.evaluate(()=>audit.todayStr());await seedLearning(p,'schedule',{recurrence:'once',date});await connect(p);await p.evaluate(()=>__mfkrPlanner.calendar.link(__mfkrPlanner.rows(audit.todayStr(),audit.todayStr()).find(r=>r.external)));await p.evaluate(()=>{const d=audit.learningLoad();d.schedule[0].date=__mfkrPlanner.core.plus(audit.todayStr(),1);d.schedule[0].updatedAt=Date.now();audit.learningSave(d);});await p.evaluate(()=>__mfkrPlanner.calendar.sync());await p.locator('.task-sheet-close').click();await p.evaluate(()=>__mfkrPlanner.calendar.learning('schedule','lecture',audit.todayStr()));assert.equal(await p.locator('#learningCalendarSave').isEnabled(),true);assert.match(await p.locator('#learningCalendarPreview').innerText(),/1 مرتبطة/);await p.locator('#learningCalendarSave').click();await p.waitForFunction(()=>!document.querySelector('#learningCalendarSave').disabled);assert.equal(api.events.size,1);
}));
test('two devices reserve the same initial learning event identity',()=>run(async(p,api)=>{
 await seedLearning(p);await connect(p);const before=await p.evaluate(()=>audit.learningLoad());await p.evaluate(()=>__mfkrPlanner.calendar.link(__mfkrPlanner.rows(audit.todayStr(),audit.todayStr()).find(r=>r.external)));const id=remote(api).id;
 // Restore the same pre-link local data, as on a second device before Firestore reconciliation.
 await p.evaluate(data=>{localStorage.setItem('h2do-learning-v1',JSON.stringify(data));},before);await p.evaluate(()=>__mfkrPlanner.calendar.link(__mfkrPlanner.rows(audit.todayStr(),audit.todayStr()).find(r=>r.external)));assert.equal(api.events.size,1);assert.equal(remote(api).id,id);
}));
test('weekly to once adopts metadata even unchanged, then a date edit moves the existing event',()=>run(async(p,api)=>{
 await seedLearning(p);await connect(p);await p.evaluate(()=>__mfkrPlanner.calendar.link(__mfkrPlanner.rows(audit.todayStr(),audit.todayStr()).find(r=>r.external)));
 await p.evaluate(()=>{const d=audit.learningLoad();Object.assign(d.schedule[0],{recurrence:'once',date:audit.todayStr(),updatedAt:Date.now()});audit.learningSave(d);});await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal(await p.evaluate(()=>audit.learningLoad().calendarOccurrences[0].sourceRecurrence),'once');
 const next=await p.evaluate(()=>{const d=audit.learningLoad(),date=__mfkrPlanner.core.plus(audit.todayStr(),1);d.schedule[0].date=date;d.schedule[0].updatedAt=Date.now()+1;audit.learningSave(d);return date;});await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal(api.events.size,1);assert.equal(remote(api).status,'confirmed');assert.match(remote(api).start.dateTime,new RegExp('^'+next));
}));
test('learning calendar controls fit phone, tablet and laptop without horizontal clipping',()=>run(async(p)=>{
 await seedLearning(p);await p.evaluate(()=>__mfkrPlanner.calendar.learning('schedule','lecture',audit.todayStr()));await p.locator('#learningCalendarMode').selectOption('range');
 for(const width of [320,390,768,1024,1366]){await p.setViewportSize({width,height:900});await p.waitForTimeout(180);const size=await p.locator('.task-sheet').last().evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));assert.ok(size.scroll<=size.width+1,JSON.stringify({width,...size}));assert.equal(await p.locator('#learningCalendarSave').isVisible(),true);}
}));
test('deleted learning source cannot accept a Google restoration that the next sync would silently reverse',()=>run(async(p,api)=>{
 await seedLearning(p);await connect(p);await p.evaluate(()=>__mfkrPlanner.calendar.link(__mfkrPlanner.rows(audit.todayStr(),audit.todayStr()).find(r=>r.external)));
 await p.evaluate(()=>{const d=audit.learningLoad();d.schedule[0].deletedAt=Date.now();d.schedule[0].updatedAt=Date.now();audit.learningSave(d);});remote(api).summary='تعديل Google';remote(api).etag='"changed"';await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal(await p.locator('[data-calendar-choice="remote"]').isDisabled(),true);assert.match(await p.locator('#plannerCalendarIssues').innerText(),/أوقف الربط/);assert.equal(remote(api).status,'confirmed');await p.locator('[data-calendar-choice="local"]').click();await p.waitForFunction(()=>!document.querySelector('#plannerCalendarSync').disabled);assert.equal(remote(api).status,'cancelled');
 remote(api).status='confirmed';remote(api).etag='"restored"';await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal(await p.locator('[data-calendar-choice="remote"]').isDisabled(),true);assert.equal(remote(api).status,'confirmed');await p.locator('[data-calendar-unlink]').click();await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal(remote(api).status,'confirmed');
}));
test('unresolved learning cloud conflict pauses Google writes until reviewed',()=>run(async(p,api,d)=>{
 await seedLearning(p);await p.evaluate(()=>audit.learningPullRemote('seed'));await connect(p);await p.evaluate(()=>__mfkrPlanner.calendar.link(__mfkrPlanner.rows(audit.todayStr(),audit.todayStr()).find(r=>r.external)));await p.evaluate(()=>audit.learningPullRemote('linked'));
 d.control.rejectRead='meta/learning';await p.evaluate(()=>{const data=audit.learningLoad();data.schedule[0].courseName='اسم محلي';data.schedule[0].updatedAt=Date.now();audit.learningSave(data);});await p.evaluate(()=>audit.learningPullRemote('offline'));
 d.cloud['users/test/meta/learning'].schedule[0].courseName='اسم بعيد';d.cloud['users/test/meta/learning'].schedule[0].updatedAt=Date.now()+1;d.control.rejectRead='';await p.evaluate(()=>audit.learningPullRemote('reconnect'));const patches=api.requests.filter(r=>r.method==='PATCH').length;await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.equal(api.requests.filter(r=>r.method==='PATCH').length,patches);assert.equal(remote(api).summary,'فيزياء');
}));
test('calendar conflict displays differing notes and keeps independent remote location when choosing local',()=>run(async(p,api)=>{await seed(p);await connect(p);await link(p);const event=[...api.events.values()][0];event.description='بعيد';event.location='قاعة جديدة';event.etag='"remote-note"';await edit(p,{notes:'محلي'});await p.evaluate(()=>__mfkrPlanner.calendar.sync());assert.match(await p.locator('#plannerCalendarIssues').innerText(),/بعيد/);await p.locator('[data-calendar-choice="local"]').click();await p.waitForFunction(()=>!document.querySelector('[data-calendar-choice]'));assert.equal((await current(p)).notes,'محلي');assert.equal((await current(p)).location,'قاعة جديدة');}));
test('initial calendar conflict honors explicit field choice over default acceptance',()=>run(async(p,api)=>{await seed(p,{text:'LOCAL'});await connect(p);await link(p);const event=[...api.events.values()][0];event.summary='REMOTE';event.etag='"initial-change"';await p.evaluate(()=>{audit.get().tasks[0].calendarBinding.base=null;audit.save();});await p.evaluate(()=>__mfkrPlanner.calendar.sync());await p.locator('[data-conflict-field="text"]').selectOption('remote');await p.locator('[data-calendar-choice="local"]').click();await p.waitForFunction(()=>!document.querySelector('[data-calendar-choice]'));assert.equal((await current(p)).text,'REMOTE');assert.equal([...api.events.values()][0].summary,'REMOTE');}));
