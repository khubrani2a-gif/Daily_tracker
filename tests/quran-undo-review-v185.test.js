'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module');
const hp=require.resolve('./audit-browser-helper.cjs'),m=new Module(hp,module);m.filename=hp;m.paths=module.paths;m._compile(fs.readFileSync(hp,'utf8').replace('qOpenReader,qNext,','qcRollbackComplete,qcOpenEditor,qcSaveEditor,qOpenReader,qNext,'),hp);const {device,chromium}=m.exports;
test('undo after a range edit offers correction when the recorded previous page is outside the new range',async()=>{
 const browser=await chromium.launch(),d=await device(browser),p=d.p;
 try{
 await p.evaluate(()=>{
  audit.wCustomSave([{id:'range',kind:'quran',group:'awrad',label:'ورد',startPage:2,endPage:49,currentPage:27,target:23,lastReadDate:'',completed:false}]);
  audit.openSurah('range');audit.qsMarkTodayDone();audit.qcOpenEditor('range');document.getElementById('qcEditStart').value='30';audit.qcSaveEditor();audit.qcRollbackComplete('range');
 });
 assert.equal(await p.locator('#qsUndoPage').count(),1,'old page 27 is outside edited range 30–49: user needs an explicit correction input');
 await p.locator('#qsUndoPage').fill('30');await p.locator('#qsUndoSave').click();
 const w=await p.evaluate(()=>audit.wCustom()[0]);assert.equal(w.currentPage,30);assert.equal(w.completed,false);assert.deepEqual(d.errors,[]);
 }finally{await d.c.close();await browser.close();}
});

test('manual fallback undo after range change cancels the actual completion rather than inventing a separate voided record',async()=>{
 const browser=await chromium.launch(),d=await device(browser),p=d.p;
 try{
 await p.evaluate(()=>{
  audit.wCustomSave([{id:'range',kind:'quran',group:'awrad',label:'ورد',startPage:2,endPage:49,currentPage:27,target:23,lastReadDate:'',completed:false}]);
  audit.openSurah('range');audit.qsMarkTodayDone();audit.qcOpenEditor('range');document.getElementById('qcEditEnd').value='40';audit.qcSaveEditor();audit.qcRollbackComplete('range');
 });
 await p.locator('#qsUndoPage').fill('27');await p.locator('#qsUndoSave').click();
 const w=await p.evaluate(()=>audit.wCustom()[0]);assert.equal(w.currentPage,27);assert.equal(w.completed,false);assert.equal(w.completedReadings.filter(x=>!x.voidedAt).length,0,'unchecked retain option must cancel the original completed reading');assert.deepEqual(d.errors,[]);
 }finally{await d.c.close();await browser.close();}
});
