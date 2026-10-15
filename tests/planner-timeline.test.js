const {revealPlannerControl}=require('./planner-test-actions.cjs');
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {device,chromium}=require('./audit-browser-helper.cjs');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser.close());
async function run(fn){const d=await device(browser);try{await fn(d.p);assert.deepEqual(d.errors,[]);}finally{await d.c.close();}}
async function seed(p){await p.evaluate(()=>{const date=audit.todayStr();audit.get().tasks=[{id:'point',text:'اتصال',plannerVersion:1,dueDate:date,dueTime:'11:01',status:'pending'}];audit.save();const data=audit.learningLoad();data.schedule=[{id:'lecture',courseName:'PHS111',day:new Date(date+'T12:00:00').getDay(),startTime:'09:00',endTime:'11:00',recurrence:'weekly',createdAt:1,updatedAt:1}];audit.learningSave(data);__mfkrPlanner.render();});}
test('timeline is one click from today, spans duration and marks occupied hours',()=>run(async p=>{
 await seed(p);await p.locator('[data-planner-mode="week"]').click();
 const event=p.locator('.planner-time-event').filter({hasText:'PHS111'});
 assert.equal(await event.count(),1);assert.equal(await event.evaluate(el=>parseFloat(el.style.height)),240);
 assert.equal(await p.locator('[data-planner-add-time="10:00"]').isDisabled(),true);
 assert.equal(await p.locator('[data-planner-add-time="11:00"]').isEnabled(),true);
 assert.match(await p.locator('.planner-time-event').filter({hasText:'اتصال'}).innerText(),/بلا مدة/);
 await p.locator('[data-planner-mode="list"]').click();assert.equal(await p.locator('.planner-timeline').count(),0);
 assert.match(await p.locator('#tasks').innerText(),/PHS111/);
}));
test('start-only task cannot silently save inside a learning appointment',()=>run(async p=>{
 await seed(p);await p.locator('#plannerAdd').click();await p.locator('#tmText').fill('اتصال جديد');await p.locator('#plannerTimeToggle').click();await p.locator('#tmTime').fill('10:00');await p.locator('#tmTime').press('Tab');
 assert.match(await p.locator('#plannerConflicts').innerText(),/PHS111/);await p.locator('#tmSave').click();assert.match(await p.locator('#tmErr').innerText(),/التعارض/);
 await p.locator('#tmTime').fill('11:30');await p.locator('#tmSave').click();assert.equal(await p.locator('#tmErr').count(),0);
}));
test('timeline handles overlapping events and current time without page overflow',()=>run(async p=>{
 await seed(p);await p.evaluate(()=>{audit.get().tasks.push({id:'overlap',text:'متداخل',dueDate:audit.todayStr(),dueTime:'10:00',endTime:'10:30',status:'pending'});audit.save();__mfkrPlanner.render();});await p.locator('[data-planner-mode="week"]').click();
 const events=p.locator('.planner-time-event');assert.equal(await events.count(),3);
 const boxes=await p.locator('.planner-time-event').filter({hasText:/PHS111|متداخل/}).evaluateAll(els=>els.map(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})));
 assert.ok(boxes[0].right<=boxes[1].left+1||boxes[1].right<=boxes[0].left+1);
 for(const width of [320,430,768,820,1366]){await p.setViewportSize({width,height:900});await p.evaluate(()=>__mfkrPlanner.render());assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 assert.equal(await p.locator('.planner-now').count(),1);
}));
test('timeline preference survives reload and current-time action returns from another date',()=>run(async p=>{
 await seed(p);await p.locator('[data-planner-mode="week"]').click();await p.reload();assert.equal(await p.locator('[data-planner-mode="week"]').getAttribute('aria-pressed'),'true');
 await p.locator('[data-planner-view="upcoming"]').click();await p.locator('#plannerCursor').fill('2027-01-01');await p.locator('#plannerCursor').press('Tab');assert.equal(await p.locator('.planner-now:not([hidden])').count(),0);
 await p.locator('#plannerNow').click();assert.equal(await p.locator('.planner-now:not([hidden])').count(),1);
}));
test('filtering the timeline cannot make an occupied hour available',()=>run(async p=>{
 await seed(p);await p.locator('[data-planner-mode="week"]').click();await p.locator('#plannerSearch').fill('اتصال');assert.equal(await p.locator('.planner-time-event').filter({hasText:'PHS111'}).count(),0);assert.equal(await p.locator('[data-planner-add-time="10:00"]').isDisabled(),true);
}));
test('switching month back to list keeps rendering and add controls functional',()=>run(async p=>{
 await seed(p);await p.locator('[data-planner-view="upcoming"]').click();await revealPlannerControl(p,'#plannerLayout');await p.locator('#plannerLayout').selectOption('month');await p.locator('[data-planner-mode="list"]').click();await p.locator('#plannerAdd').click();assert.equal(await p.locator('#tmText').isVisible(),true);await p.locator('.task-sheet-close').click();
}));
