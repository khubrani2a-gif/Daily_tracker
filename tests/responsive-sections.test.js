'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {device,chromium}=require('./audit-browser-helper.cjs');
let browser;test.before(async()=>{browser=await chromium.launch();});test.after(async()=>browser.close());
const views={today:['tasksCard','prioritiesCard'],iman:['prayerCard','ibadahCard','quranCard','hifzCard'],learning:['learningCard'],sport:['sportCard','healthCard','waterCard'],expenses:['expensesCard'],more:['readingCard','activityCard','intentionCard','memoryCard','notesCard','ratingCard']};
async function scenario(fn,seed){const d=await device(browser,seed);try{await fn(d);assert.deepEqual(d.errors,[]);}finally{await d.c.close();}}
async function visible(p){return p.locator('.grid .card:visible').evaluateAll(es=>es.map(e=>e.id));}
test('same section content and order on phones, iPad portrait/landscape and laptops, without empty columns or overflow',()=>scenario(async({p})=>{
for(const [width,height] of [[320,780],[390,844],[768,1024],[820,1180],[1024,768],[1180,820],[1366,900],[1512,982]]){
await p.setViewportSize({width,height});for(const [view,cards] of Object.entries(views)){
await p.locator('a[data-app-view="'+view+'"]').click();assert.deepEqual(await visible(p),cards,`${width}/${view}`);assert.equal(await p.locator('#todayOverview').isVisible(),view==='today');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}/${view} overflows`);
const layout=await p.evaluate(()=>{const grid=document.querySelector('.page>.grid'),rect=grid.getBoundingClientRect();return {grid:rect.width,cards:[...grid.querySelectorAll('.card')].filter(e=>e.getBoundingClientRect().width).map(e=>e.getBoundingClientRect().width)};});
assert.ok(layout.cards.every(w=>w>=layout.grid*(width>=1000?.45:.98)),JSON.stringify({width,view,layout}));
if(cards.length===1)assert.ok(layout.cards[0]>=layout.grid*.98);
} }
}));
test('rotating or resizing preserves the section, open inputs and saved edits',()=>scenario(async({p})=>{
await p.locator('a[data-app-view="more"]').click();const input=p.locator('#notes');assert.equal(await input.count(),1);await input.fill('ملاحظة ثابتة عند تدوير الآيباد');await input.dispatchEvent('input');
for(const [width,height] of [[820,1180],[1180,820],[768,1024],[1024,768],[1366,900],[390,844]]){await p.setViewportSize({width,height});assert.equal(await p.locator('a[data-app-view="more"]').getAttribute('aria-current'),'page');assert.equal(await input.inputValue(),'ملاحظة ثابتة عند تدوير الآيباد');assert.deepEqual(await visible(p),views.more);}
await p.reload();assert.equal(await p.locator('#notes').inputValue(),'ملاحظة ثابتة عند تدوير الآيباد');assert.equal(await p.locator('#sectionTitle').innerText(),'المزيد');
}));
test('desktop navigation persists, supports browser back/forward and direct card links',()=>scenario(async({p})=>{
await p.setViewportSize({width:1366,height:900});await p.locator('a[data-app-view="learning"]').click();await p.locator('a[data-app-view="sport"]').click();await p.goBack();assert.equal(await p.locator('#sectionTitle').innerText(),'التعلّم');await p.goForward();assert.equal(await p.locator('#sectionTitle').innerText(),'الصحة');await p.reload();assert.equal(await p.locator('#sectionTitle').innerText(),'الصحة');
await p.goto('https://audit.local/index.html#quranCard');assert.ok(await p.locator('#quranCard').isVisible());assert.equal(await p.locator('#todayOverview').isVisible(),false);assert.equal(await p.locator('a[data-app-view="iman"]').getAttribute('aria-current'),'page');
}));
test('custom card order and hidden sections remain accessible on iPad and laptop',()=>scenario(async({p})=>{
for(const width of [820,1180,1366]){await p.setViewportSize({width,height:1000});await p.locator('a[data-app-view="more"]').click();const cards=await visible(p);assert.ok(cards.includes('learningCard'));assert.equal(await p.locator('a[data-app-view="learning"]').isVisible(),false);await p.locator('a[data-app-view="sport"]').click();assert.deepEqual(await visible(p),['waterCard','sportCard']);}
},{'h2do-bottom-nav-v1':{hidden:['learning']},'h2do-card-layout-v1':{order:['waterCard','sportCard'],hidden:['healthCard']}}));
test('empty section provides customization and compact controls stay reachable outside Today',()=>scenario(async({p})=>{
await p.setViewportSize({width:820,height:1180});await p.locator('a[data-app-view="learning"]').click();assert.ok(await p.locator('#sectionEmpty').isVisible());await p.locator('#sectionModeBtn').click();assert.equal(await p.locator('#sectionModeBtn').getAttribute('aria-pressed'),'true');await p.locator('#sectionCustomize').click();assert.ok(await p.locator('#customizeOverlay').isVisible());
},{'h2do-card-layout-v1':{hidden:['learningCard']}}));
test('desktop and tablet navigation remains visible when scrolling and is keyboard accessible',()=>scenario(async({p})=>{
for(const width of [768,1024,1366]){await p.setViewportSize({width,height:800});const link=p.locator('a[data-app-view="iman"]');await link.focus();await p.keyboard.press('Enter');await p.evaluate(()=>scrollTo(0,800));await p.waitForTimeout(120);const rect=await p.locator('.quick-nav').boundingBox();assert.ok(rect.y>=0&&rect.y<20);assert.ok((await link.boundingBox()).height>=44);assert.deepEqual(await visible(p),views.iman);}
}));
test('progress shortcuts open cards in their customized section even when hidden by preferences',()=>scenario(async({p})=>{
for(const width of [390,820,1366]){await p.setViewportSize({width,height:1000});await p.locator('a[data-app-view="today"]').click();await p.locator('a.today-metric[href="#quranCard"]').click();assert.ok(await p.locator('#quranCard').isVisible());assert.equal(await p.locator('a[data-app-view="learning"]').getAttribute('aria-current'),'page');assert.equal(await p.locator('#todayOverview').isVisible(),false);}
},{'h2do-card-layout-v1':{views:{quranCard:'learning'},hidden:['quranCard']}}));
test('back returns to the initially restored section when opening the app without a hash',()=>scenario(async({p})=>{
assert.equal(await p.locator('#sectionTitle').innerText(),'المزيد');await p.locator('a[data-app-view="learning"]').click();await p.goBack();assert.equal(await p.locator('#sectionTitle').innerText(),'المزيد');assert.ok(await p.locator('#notesCard').isVisible());
},{'h2do-mobile-view':'more'}));
