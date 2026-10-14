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
 await p.locator('[data-app-view="today"]').first().click().catch(()=>{});await p.evaluate(()=>__mfkrPlanner.open());await p.locator('#tmText').fill('موعد كل أسبوعين الخميس الساعة ١٣:٠٠ لمدة نصف ساعة');assert.equal(await p.locator('#tmInterval').inputValue(),'2');assert.equal(await p.locator('#tmRepeat').inputValue(),'weekly');assert.equal(await p.locator('[data-planner-weekday="4"]').isChecked(),true);await p.locator('#plannerDetails').evaluate(el=>el.open=true);await p.locator('#tmBuffer').fill('15');await p.locator('#tmBuffer').press('Tab');const suggestion=p.locator('[data-slot]').first();assert.ok(await suggestion.count());await suggestion.click();assert.equal(await p.locator('#plannerConflicts').isVisible(),false);
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
