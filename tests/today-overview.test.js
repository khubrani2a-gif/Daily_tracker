'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {device,chromium}=require('./audit-browser-helper.cjs');
let browser;test.before(async()=>{browser=await chromium.launch();});test.after(async()=>{await browser.close();});
async function scenario(fn){const d=await device(browser);try{await d.p.clock.setFixedTime(new Date('2026-10-14T06:00:00Z'));await d.p.evaluate(()=>{audit.setDate('2026-10-14');audit.setState(audit.blankState());audit.renderTodayOverview();});await fn(d);assert.deepEqual(d.errors,[]);}finally{await d.c.close();}}
async function seed(p,tasks,priorities=[],route={}){await p.evaluate(({tasks,priorities,route})=>{audit.setState({...audit.blankState(),tasks,priorities,dailyRoute:route});audit.save();audit.renderTodayOverview();},{tasks,priorities,route});}
const task=(id,extra={})=>({id,text:'مهمة '+id,status:'pending',done:false,...extra});
test('next step deduplicates linked priorities, excludes cancelled/deferred tasks and prefers available work',()=>scenario(async({p})=>{
await seed(p,[task('future',{dueTime:'13:05'}),task('now'),task('cancel',{status:'cancelled'}),task('later',{status:'deferred'})],[{id:'priority',sourceTaskId:'now'}]);
assert.match(await p.locator('#dailyRouteTask').innerText(),/مهمة now/);
assert.equal(await p.locator('#todayTaskValue').innerText(),'٠ من ٣');
assert.equal(await p.locator('#overviewRemainingList').getByText('مهمة now',{exact:true}).count(),0);
assert.deepEqual(await p.evaluate(()=>audit.dailyRouteCandidates().map(t=>t.id)),['now','future']);
await p.locator('#dailyRouteDone').click();assert.match(await p.locator('#dailyRouteStatus').innerText(),/موعد قادم/);
assert.equal(await p.locator('#dailyRouteStart').innerText(),'عرض التفاصيل');
}));
test('choosing a pinned task survives reload and completing it selects the next task',()=>scenario(async({p})=>{
await seed(p,[task('one'),task('two')]);await p.locator('#dailyRouteOptions summary').click();await p.locator('#dailyRouteChoose').click();await p.locator('#overviewChoices button').filter({hasText:'مهمة two'}).click();
assert.match(await p.locator('#dailyRouteTask').innerText(),/مهمة two/);await p.reload();await p.waitForFunction(()=>window.audit);
assert.match(await p.locator('#dailyRouteTask').innerText(),/مهمة two/);await p.locator('#dailyRouteDone').click();assert.match(await p.locator('#dailyRouteTask').innerText(),/مهمة one/);
await p.locator('#overviewUndo').click();assert.match(await p.locator('#dailyRouteTask').innerText(),/مهمة two/);
}));
test('completion undo preserves unrelated changes and cannot affect a different day',()=>scenario(async({p})=>{
await seed(p,[task('one',{status:'in_progress'})]);await p.locator('#dailyRouteDone').click();
await p.evaluate(()=>{audit.get().tasks[0].text='عنوان معدّل';audit.get().notes='keep';audit.save();});
await p.locator('#overviewUndo').click();assert.deepEqual(await p.evaluate(()=>({status:audit.get().tasks[0].status,text:audit.get().tasks[0].text,notes:audit.get().notes})),{status:'in_progress',text:'عنوان معدّل',notes:'keep'});
await p.locator('#dailyRouteDone').click();await p.evaluate(()=>{audit.setDate('2026-10-15');audit.setState(audit.blankState());audit.renderTodayOverview();});assert.equal(await p.locator('#overviewUndo').isVisible(),false);
}));
test('water undo persists across rendering, stops at the goal and refuses to overwrite later water edits',()=>scenario(async({p})=>{
await p.locator('#quickWaterBtn').click();assert.equal(await p.evaluate(()=>audit.get().water),1);await p.locator('#overviewUndo').click();assert.equal(await p.evaluate(()=>audit.get().water),0);
await p.locator('#quickWaterBtn').click();await p.evaluate(()=>{audit.get().water=4;audit.save();});await p.locator('#overviewUndo').click();assert.equal(await p.evaluate(()=>audit.get().water),4);
await p.evaluate(()=>{audit.get().water=8;audit.renderTodayOverview();});await p.locator('#quickWaterBtn').click();assert.equal(await p.evaluate(()=>audit.get().water),8);
}));
test('past and future dates have distinct behavior and never present current Quran pages as historical data',()=>scenario(async({p})=>{
await seed(p,[task('one'),task('two',{done:true,status:'done'})]);
await p.evaluate(()=>{audit.setDate('2026-10-13');audit.renderTodayOverview();});assert.match(await p.locator('#dailyRouteTitle').innerText(),/سجل الإنجاز/);assert.equal(await p.locator('#dailyRouteStart').isVisible(),false);assert.equal(await p.locator('#dailyRouteDone').isVisible(),false);assert.equal(await p.locator('#todayQuranValue').innerText(),'—');assert.equal(await p.locator('.overview-rest-row').count(),2);
await p.evaluate(()=>{audit.setDate('2026-10-15');audit.renderTodayOverview();});assert.match(await p.locator('#dailyRouteTitle').innerText(),/خطة/);assert.equal(await p.locator('#dailyRouteStart').innerText(),'عرض التفاصيل');assert.equal(await p.locator('#dailyRouteDone').isVisible(),false);assert.equal(await p.locator('#dailyRouteClose').isVisible(),false);
}));
test('review transfers only selected tasks, preserves destination data and supports undo',()=>scenario(async({p})=>{
await seed(p,[task('one'),task('two')]);await p.evaluate(()=>{localStorage.setItem(audit.storageKey('2026-10-15'),JSON.stringify({...audit.blankState(),notes:'keep tomorrow',tasks:[{id:'existing',text:'existing'}]}));});
await p.locator('#dailyRouteClose').click();assert.equal(await p.locator('[data-carry]:checked').count(),0);await p.locator('[data-carry="0"]').check();await p.locator('#dailyReviewSave').click();
const result=await p.evaluate(()=>({today:audit.get().tasks,next:JSON.parse(localStorage.getItem(audit.storageKey('2026-10-15')))}));assert.equal(result.today[0].status,'deferred');assert.equal(result.today[1].status,'pending');assert.equal(result.next.notes,'keep tomorrow');assert.equal(result.next.tasks.length,2);assert.ok(!result.next.tasks.some(t=>t.text==='مهمة two'));
await p.locator('#overviewPlanning summary').click();await p.locator('#dailyRouteUndo').click();assert.equal(await p.evaluate(()=>audit.get().tasks[0].status),'pending');assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(audit.storageKey('2026-10-15'))).tasks.length),1);
}));
test('replan previews names and destination before changes, supports all tasks and requires explicit transfer',()=>scenario(async({p})=>{
await seed(p,Array.from({length:14},(_,i)=>task('t'+i)));await p.locator('#overviewPlanning summary').click();await p.locator('#dailyRouteReplan').click();assert.equal(await p.locator('[data-replan]').count(),14);assert.equal(await p.locator('#dailyReplanMove').isChecked(),false);await p.locator('#dailyReplanMove').check();assert.match(await p.locator('#dailyReplanPreview').innerText(),/2026-10-15/);assert.match(await p.locator('#dailyReplanPreview').innerText(),/مهمة t13/);assert.equal(await p.evaluate(()=>audit.get().tasks.filter(t=>t.status==='deferred').length),0);await p.locator('#dailyReplanMove').uncheck();await p.locator('#dailyReplanSave').click();assert.equal(await p.evaluate(()=>audit.get().tasks.filter(t=>t.status==='deferred').length),0);
}));
test('remaining list is limited to three, reveals extra tasks with keyboard and escapes task text',()=>scenario(async({p})=>{
await seed(p,[task('one',{text:'<img src=x onerror=alert(1)>'}),...Array.from({length:5},(_,i)=>task('t'+i))]);assert.equal(await p.locator('#dailyRouteTask img').count(),0);assert.equal(await p.locator('#overviewRemainingList button').count(),3);assert.equal(await p.locator('#overviewRemainingExtra button:visible').count(),0);await p.locator('#overviewRemainingMore summary').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#overviewRemainingExtra button:visible').count(),2);
}));
test('overview fits mobile and desktop widths, disclosures and metric links remain usable',()=>scenario(async({p})=>{
await seed(p,[task('one',{text:'مهمة طويلة لاختبار عرض النص داخل البطاقة وتجنّب تجاوز حواف الشاشة'}),task('two')]);
for(const width of [320,390,768,1440]){await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);const targets=await p.locator('.today-overview button:visible,.today-overview summary:visible').evaluateAll(es=>es.map(e=>({id:e.id,h:e.getBoundingClientRect().height})));assert.ok(targets.every(e=>e.h>=44),JSON.stringify(targets));}
await p.setViewportSize({width:390,height:900});await p.locator('#overviewMoreActions summary').focus();await p.keyboard.press('Enter');assert.ok(await p.locator('#quickActionsCatalogBtn').isVisible());await p.keyboard.press('Enter');
await p.locator('a.today-metric[href="#waterCard"]').click();assert.ok(await p.locator('#waterCard').isVisible());
}));
test('review keeps distinct same-title tasks and undo preserves edits made after transfer',()=>scenario(async({p})=>{
await seed(p,[task('one',{text:'same'}),task('two',{text:'same'})]);await p.locator('#dailyRouteClose').click();await p.locator('[data-carry="0"]').check();await p.locator('[data-carry="1"]').check();await p.locator('#dailyReviewSave').click();
assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(audit.storageKey('2026-10-15'))).tasks.filter(t=>t.text==='same').length),2);
await p.evaluate(()=>{const key=audit.storageKey('2026-10-15'),s=JSON.parse(localStorage.getItem(key));s.tasks.find(t=>t.carriedFromTaskId==='one').text='edited later';localStorage.setItem(key,JSON.stringify(s));});await p.locator('#overviewPlanning summary').click();await p.locator('#dailyRouteUndo').click();
const result=await p.evaluate(()=>({source:audit.get().tasks,next:JSON.parse(localStorage.getItem(audit.storageKey('2026-10-15'))).tasks}));assert.equal(result.source[0].status,'deferred');assert.equal(result.source[1].status,'pending');assert.ok(result.next.some(t=>t.text==='edited later'));assert.ok(!result.next.some(t=>t.carriedFromTaskId==='two'));
}));
