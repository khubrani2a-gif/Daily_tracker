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
  if(method==='POST'){if(api.failDate&&body.start?.dateTime?.startsWith(api.failDate))return reply(503,{});if(api.events.has(body.id))return reply(409,{});const event={...body,etag:'"'+(++api.version)+'"'};api.events.set(body.id,event);if(api.dropInsert){api.dropInsert=false;return reply(503,{});}return reply(200,event);}
  if(method==='PATCH'){const event=api.events.get(id);if(api.conflict||req.headers()['if-match']!==event?.etag){api.conflict=false;return reply(412,{});}const next={...event,...body,etag:'"'+(++api.version)+'"'};api.events.set(id,next);return reply(200,next);}
  return reply(400,{});
 });
 await d.p.evaluate(()=>{audit.login();sessionStorage.setItem("testUser",JSON.stringify({uid:"test"}));audit.go(audit.todayStr());const original=firebase.auth;function auth(){return {...original(),currentUser:{uid:'test',reauthenticateWithPopup:async provider=>{window.requestedScopes=provider.scopes;return {user:{uid:'test'},credential:{accessToken:'TEST_MEMORY_ONLY_TOKEN'}};}}};}auth.GoogleAuthProvider=function(){this.scopes=[];this.addScope=s=>this.scopes.push(s);};firebase.auth=auth;});
 await fn(d.p,api,d);assert.deepEqual(d.errors,[]);
 }finally{await d.c.close();}}
async function connect(p){await p.evaluate(()=>__mfkrPlanner.calendar.settings());await p.locator('#plannerCalendarConnect').click();await p.waitForFunction(()=>document.querySelector('#plannerCalendarSync')?.disabled===false);}


// Regressions: occurrence IDs must include dates; retry must retain its first ID;
// scope edits must patch existing events instead of adding series duplicates.
const dates=['2026-08-30','2026-09-06','2026-09-13','2026-09-27','2026-10-04','2026-10-11','2026-10-18','2026-10-25','2026-11-01','2026-11-08','2026-11-15','2026-11-22','2026-11-29','2026-12-06','2026-12-13'];
async function seed(p){await p.evaluate(()=>{const d=audit.learningLoad();d.academicYears=[{id:'y',name:'2026',startDate:'2026-08-01',endDate:'2027-07-31'}];d.terms=[{id:'term',yearId:'y',name:'Term',startDate:'2026-08-30',endDate:'2026-12-17'}];d.subjects=[{id:'physics',termId:'term',name:'PHSH111'}];d.schedule=[{id:'phsh111',subjectId:'physics',courseName:'PHSH111',recurrence:'weekly',day:0,startTime:'09:00',endTime:'10:00',termStart:'2026-08-30',termEnd:'2026-12-17',excludedDates:['2026-09-20']}];audit.learningSave(d);});}
async function link(p,date){await p.evaluate(async date=>{await __mfkrPlanner.calendar.link(__mfkrPlanner.rows(date,date).find(r=>r.external?.id==='phsh111'));},date);}
async function sync(p){await p.evaluate(()=>__mfkrPlanner.calendar.sync());}
async function openCoverage(p){await p.locator('[data-app-view="learning"]').first().click();await p.locator('#learningSubjectsBtn').click();await p.getByRole('button',{name:'فتح المقرر',exact:true}).click();await p.locator('#learningSubjectCoverage').click();await p.locator('#learningCoverageFrom').fill('2026-08-30');await p.locator('#learningCoverageFrom').dispatchEvent('change');await p.locator('#learningCoverageTo').fill('2026-12-17');await p.locator('#learningCoverageTo').dispatchEvent('change');}
async function batch(p){await p.locator('#learningCoverageExtend').click();await p.locator('#learningCoverageConfirm').click();await p.waitForFunction(()=>document.querySelector('#learningCoverageConfirm')?.hidden===true);}
async function edit(p,date,scope,selector,value){await p.evaluate(date=>__mfkrPlanner.open(__mfkrPlanner.rows(date,date).find(r=>r.external?.id==='phsh111')),date);await p.locator('#learningScope'+scope).click();await p.locator(selector).fill(value);await p.locator(scope==='All'?'#learningFormSave':'#learningOccurrenceSave').click();await p.waitForFunction(()=>!document.querySelector('#learningOccurrenceSave')&&!document.querySelector('#learningFormSave'));await sync(p);}
function byDate(api,date){return [...api.events.values()].find(e=>e.extendedProperties.private.mufIdentity.endsWith('|'+date));}
test('full Aug30-Dec17 coverage links 15 dated occurrences in two bounded batches without holidays or duplicates',()=>run(async(p,api)=>{
 await seed(p);await connect(p);await p.locator('.task-sheet-close').last().click();await openCoverage(p);
 assert.match(await p.locator('#learningCoverageSummary').innerText(),/المطلوب: 15/);
 await batch(p);assert.equal(api.events.size,12);await batch(p);assert.equal(api.events.size,15);
 assert.deepEqual([...api.events.values()].map(e=>e.start.dateTime.slice(0,10)).sort(),dates);
 const before=[...api.events.keys()];await sync(p);await link(p,'2026-08-30');assert.deepEqual([...api.events.keys()],before);
 assert.equal(api.requests.filter(r=>r.method==='POST').length,15);
 const local=await p.evaluate(()=>audit.learningLoad());assert.equal(local.schedule.length,1);assert.equal(local.calendarOccurrences.length,15);assert.equal(new Set(local.calendarOccurrences.map(r=>r.binding.eventId)).size,15);
}));
test('single, future, and full schedule UI edits preserve linked occurrence identities',()=>run(async(p,api)=>{
 await seed(p);await connect(p);for(const date of ['2026-08-30','2026-10-25','2026-12-13'])await link(p,date);await p.locator('.task-sheet-close').last().click();const ids=[...api.events.keys()];
 await edit(p,'2026-10-25','One','#loLocation','One room');assert.equal(byDate(api,'2026-10-25').location,'One room');assert.equal(byDate(api,'2026-08-30').location,'');
 await edit(p,'2026-10-25','Future','#loName','Future PHSH111');assert.equal(byDate(api,'2026-08-30').summary,'PHSH111');assert.equal(byDate(api,'2026-10-25').summary,'Future PHSH111');assert.equal(byDate(api,'2026-12-13').summary,'Future PHSH111');
 await edit(p,'2026-08-30','All','#lfRoom','All room');assert.equal(byDate(api,'2026-08-30').location,'All room');assert.equal(byDate(api,'2026-12-13').location,'All room');assert.deepEqual([...api.events.keys()],ids);assert.equal(api.requests.filter(r=>r.method==='POST').length,3);
}));
test('lost insert response and failed later link retry adopt original occurrence IDs',()=>run(async(p,api)=>{
 await seed(p);await connect(p);api.dropInsert=true;await link(p,'2026-08-30');assert.equal(api.events.size,1);let records=await p.evaluate(()=>audit.learningLoad().calendarOccurrences);assert.equal(records[0].binding.base,null);const first=records[0].binding.eventId;await sync(p);records=await p.evaluate(()=>audit.learningLoad().calendarOccurrences);assert.ok(records[0].binding.base);assert.equal(records[0].binding.eventId,first);
 api.fail=503;await link(p,'2026-10-25');records=await p.evaluate(()=>audit.learningLoad().calendarOccurrences);const pending=records.find(r=>r.date==='2026-10-25');assert.equal(pending.binding.base,null);api.fail=0;await sync(p);assert.equal(api.events.size,2);assert.equal(byDate(api,'2026-10-25').id,pending.binding.eventId);assert.equal(api.requests.filter(r=>r.method==='POST').length,2);
}));
test('cancelling a linked occurrence and shrinking term cancels existing Google events without new identities',()=>run(async(p,api)=>{
 await seed(p);await connect(p);for(const date of ['2026-08-30','2026-10-25','2026-12-13'])await link(p,date);const ids=[...api.events.keys()];
 await p.evaluate(()=>{const d=audit.learningLoad();d.calendarOccurrences.find(r=>r.date==='2026-10-25').outcome='cancelled';d.schedule[0].termEnd='2026-11-30';audit.learningSave(d);});await sync(p);assert.equal(byDate(api,'2026-10-25').status,'cancelled');assert.equal(byDate(api,'2026-12-13').status,'cancelled');assert.notEqual(byDate(api,'2026-08-30').status,'cancelled');assert.deepEqual([...api.events.keys()],ids);
}));

test('partial term batch failure remains reviewable and retries without duplicating successful weeks',()=>run(async(p,api)=>{
 await seed(p);await connect(p);await p.locator('.task-sheet-close').last().click();await openCoverage(p);api.failDate='2026-09-06';await batch(p);assert.equal(api.events.size,11);assert.match(await p.locator('#learningCoverageSummary').innerText(),/يحتاج مراجعة: 1/);api.failDate='';await p.locator('#learningCoverageSync').click();await p.waitForFunction(()=>document.querySelector('#learningCoverageSync')?.disabled===false);assert.equal(api.events.size,12);assert.match(await p.locator('#learningCoverageSummary').innerText(),/يحتاج مراجعة: 0/);await batch(p);assert.equal(api.events.size,15);assert.equal(new Set([...api.events.values()].map(e=>e.extendedProperties.private.mufIdentity)).size,15);
}));
test('moving one linked lecture keeps source-date identity and does not leave an old-date planner duplicate',()=>run(async(p,api)=>{
 await seed(p);await connect(p);await link(p,'2026-10-25');await p.locator('.task-sheet-close').last().click();const id=[...api.events.keys()][0];await edit(p,'2026-10-25','One','#loDate','2026-10-26');assert.equal(api.events.size,1);assert.equal(api.events.get(id).start.dateTime.slice(0,10),'2026-10-26');assert.equal(api.events.get(id).extendedProperties.private.mufIdentity,'learning|schedule|phsh111|2026-10-25');
 const rows=await p.evaluate(()=>({old:__mfkrPlanner.rows('2026-10-25','2026-10-25').filter(r=>r.external?.id==='phsh111').length,moved:__mfkrPlanner.rows('2026-10-26','2026-10-26').filter(r=>r.external?.id==='phsh111').length}));assert.deepEqual(rows,{old:0,moved:1});
}));
