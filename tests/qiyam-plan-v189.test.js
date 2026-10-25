'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {device,chromium}=require('./audit-browser-helper.cjs');
test('qiyam goal cards preserve drafts, support keyboard sources and both themes',async()=>{
 const b=await chromium.launch();let d;
 try{
  d=await device(b);const p=d.p;p.setDefaultTimeout(2500);
  await p.locator('a[data-app-view="iman"]').click();
  await p.getByRole('button',{name:'🌙 قيام',exact:true}).click();
  assert.match(await p.locator('#witrTargets').innerText(),/لم يُكتب من الغافلين/);
  assert.doesNotMatch(await p.locator('#witrTargets').innerText(),/الذاكرين/);
  await p.locator('#witrTargets [data-t="100"]').click();
  await p.evaluate(()=>{audit.get().witr.readPage=2;audit.save();});
  const before=await p.evaluate(()=>JSON.stringify(audit.get().witr));
  await p.locator('#witrTargets [data-t="100"]').click();
  await p.locator('#witrPoolChips [data-p="all"]').click();
  assert.equal(await p.evaluate(()=>JSON.stringify(audit.get().witr)),before);
  assert.equal(await p.locator('#witrTargets [data-t="100"]').getAttribute('aria-pressed'),'true');
  await p.locator('#witrPoolChips [data-p="juzamma"]').focus();
  await p.keyboard.press('Enter');
  assert.equal(await p.evaluate(()=>audit.get().witr.pool),'juzamma');
  assert.equal(await p.locator('#witrPoolChips [data-p="juzamma"]').getAttribute('aria-pressed'),'true');
  assert.equal(await p.evaluate(()=>audit.get().witrSessions.length),0);
  await p.locator('#witrPlanOptions .witr-virtue summary').click();
  assert.equal(await p.locator('#witrPlanOptions .witr-virtue a').getAttribute('href'),'https://sunnah.com/abudawud:1398');
  await p.locator('#witrPlanOptions .witr-virtue summary').click();
  for(const dark of [false,true])for(const width of [320,390,820]){
   await p.setViewportSize({width,height:844});
   await p.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark);
   const layout=await p.locator('#witrOverlay').evaluate(el=>({overflow:el.scrollWidth>el.clientWidth,bg:getComputedStyle(el).backgroundColor,app:getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()}));
   assert.equal(layout.overflow,false,JSON.stringify({dark,width,layout}));
   assert.notEqual(layout.bg,'rgb(0, 0, 0)');
   assert.equal(await p.locator('#witrTargets button').count(),4);
  }
  assert.deepEqual(d.errors,[]);
 }finally{if(d)await d.c.close();await b.close();}
});
