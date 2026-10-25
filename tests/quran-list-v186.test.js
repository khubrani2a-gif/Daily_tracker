const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module');
const hp=require.resolve('./audit-browser-helper.cjs'),m=new Module(hp,module);m.filename=hp;m.paths=module.paths;m._compile(fs.readFileSync(hp,'utf8').replace('qOpenReader,qNext,','qcRollbackComplete,qsOpenReader,qsNext,qsPrev,qOpenReader,qNext,'),hp);const {device,chromium}=m.exports;
let b;test.before(async()=>b=await chromium.launch());test.after(async()=>b.close());async function run(fn){const d=await device(b);d.p.setDefaultTimeout(1500);try{await d.p.locator('[data-app-view="iman"]').first().click();await fn(d.p);assert.deepEqual(d.errors,[]);}finally{await d.c.close();}}
const item={id:'q185',kind:'quran',group:'awrad',label:'البقرة',startPage:2,endPage:49,currentPage:27,target:23,lastReadDate:'',completed:false};
async function seed(p,extra={}){await p.evaluate(w=>{audit.wCustomSave([w]);audit.openSurah(w.id);},{...item,...extra});}

test('list distinguishes next page from pages read for both screenshot ranges',()=>run(async p=>{
 await p.evaluate(()=>{audit.wCustomSave([{id:'first',kind:'quran',group:'awrad',label:'البقرة 1',startPage:2,endPage:26,currentPage:26,target:23,completed:false,lastReadDate:''},{id:'second',kind:'quran',group:'awrad',label:'البقرة 2',startPage:27,endPage:49,currentPage:49,target:23,completed:false,lastReadDate:''}]);audit.renderWorship();});
 assert.match(await p.locator('[data-id="first"] .read-chip').innerText(),/المقروء.*٢٤.*٢٥/);
 assert.match(await p.locator('[data-id="second"] .read-chip').innerText(),/المقروء.*٢٢.*٢٣/);
}));
test('undo of final page leaves that page unread in list rather than showing full progress',()=>run(async p=>{
 await seed(p,{startPage:27,currentPage:49,target:23});await p.locator('#surahMarkDone').click();await p.locator('#surahUndo').click();await p.locator('#qsUndoSave').click();await p.locator('#surahClose').click();
 assert.equal(await p.evaluate(()=>audit.wCustom()[0].currentPage),49);
 assert.match(await p.locator('[data-id="q185"] .read-chip').innerText(),/المقروء.*٢٢.*٢٣/);
}));
test('known completion permits return to the beginning and removes earlier daily credit',()=>run(async p=>{
 await p.clock.setFixedTime(new Date('2026-10-24T12:00:00Z'));await seed(p,{startPage:27,currentPage:27,target:22});await p.locator('#surahMarkDone').click();await p.clock.setFixedTime(new Date('2026-10-25T12:00:00Z'));await p.locator('#surahMarkDone').click();await p.locator('#surahUndo').click();await p.locator('#qsUndoStart').click();await p.locator('#qsUndoSave').click();const w=await p.evaluate(()=>audit.wCustom()[0]);assert.equal(w.currentPage,27);assert.equal(w.lastReadDate,'');assert.equal(w.readingEntries.filter(x=>!x.undoneAt).length,0);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(audit.storageKey('2026-10-24'))).worship.q185),false);
}));
test('known completion accepts a user-selected page with Arabic digits',()=>run(async p=>{
 await seed(p,{startPage:27});await p.locator('#surahMarkDone').click();await p.locator('#surahUndo').click();await p.locator('#qsUndoPage').fill('٣٠');await p.locator('#qsUndoSave').click();const w=await p.evaluate(()=>audit.wCustom()[0]);assert.equal(w.currentPage,30);assert.equal(w.completed,false);assert.equal(w.readingEntries.filter(x=>!x.undoneAt).at(-1).to,29);assert.equal(w.completedReadings.filter(x=>!x.voidedAt).length,0);
}));
test('an already unchecked legacy segment still exposes position correction',()=>run(async p=>{
 await seed(p,{currentPage:49,lastReadDate:'',completed:false});assert.equal(await p.locator('#surahUndo').isVisible(),true);await p.locator('#surahUndo').click();await p.locator('#qsUndoStart').click();await p.locator('#qsUndoSave').click();assert.equal(await p.evaluate(()=>audit.wCustom()[0].currentPage),2);
}));
test('custom-page rollback retains completion only when explicitly selected and survives reload',()=>run(async p=>{
 await seed(p,{startPage:27});await p.locator('#surahMarkDone').click();await p.locator('#surahUndo').click();await p.locator('#qsUndoStart').click();await p.locator('#qsUndoKeep').check();await p.locator('#qsUndoSave').click();await p.reload();const w=await p.evaluate(()=>audit.wCustom()[0]);assert.equal(w.currentPage,27);assert.equal(w.completed,false);assert.equal(w.completedReadings.filter(x=>!x.voidedAt&&x.retained).length,1);
}));
test('invalid manually selected rollback page leaves reading and history unchanged',()=>run(async p=>{
 await seed(p,{startPage:27});await p.locator('#surahMarkDone').click();const before=await p.evaluate(()=>audit.wCustom());await p.locator('#surahUndo').click();await p.locator('#qsUndoPage').fill('٢');await p.locator('#qsUndoSave').click();assert.deepEqual(await p.evaluate(()=>audit.wCustom()),before);assert.match(await p.locator('#qsUndoError').innerText(),/داخل نطاق/);
}));
