'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module');
// Private instrumentation; shared helper is neither edited nor cached under its name.
const helperPath=require.resolve('./audit-browser-helper.cjs'),privateHelper=new Module(helperPath,module);
privateHelper.filename=helperPath;privateHelper.paths=module.paths;
privateHelper._compile(fs.readFileSync(helperPath,'utf8').replace('qOpenReader,qNext,','qcSaveOrder,qcCommitOrder,qcRollbackComplete,qcDeleteSegment,qcOpenEditor,qcSaveEditor,qOpenReader,qNext,'),helperPath);
const {device,chromium}=privateHelper.exports;
let browser;test.before(async()=>{browser=await chromium.launch();});test.after(async()=>{if(browser)await browser.close();});
async function run(fn){const d=await device(browser);try{await fn(d.p);assert.deepEqual(d.errors,[]);}finally{await d.c.close();}}
const item=(id,extra={})=>({id,kind:'quran',label:id,startPage:1,endPage:10,currentPage:11,target:1,lastReadDate:'2026-10-24',completed:true,...extra});

test('stale Quran ordering preserves every existing record exactly once',()=>run(async p=>{
 const items=[item('remote-added'),{id:'habit',kind:'habit',label:'keep'},item('a'),item('b')];
 const result=await p.evaluate(items=>{audit.wCustomSave(items);audit.qcSaveOrder(['b','a']);return audit.wCustom();},items);
 assert.deepEqual(result.map(x=>x.id).sort(),items.map(x=>x.id).sort());assert.equal(result[1].id,'habit');
}));

test('Quran rollback confirmation must not overwrite later edits or reading history',()=>run(async p=>{
 const result=await p.evaluate(original=>{
  audit.wCustomSave([original]);audit.qcRollbackComplete('a');
  audit.wCustomSave([{...original,label:'latest title',target:3,lastReadDate:audit.todayStr(),remoteNote:'keep'}]);
  document.getElementById('hifzDialogOk').click();return audit.wCustom()[0];
 },item('a'));
 assert.equal(result.label,'latest title');assert.equal(result.target,3);assert.equal(result.remoteNote,'keep');
}));

test('stale Quran editor must not truncate newer expanded range and reading progress',()=>run(async p=>{
 const result=await p.evaluate(original=>{
  audit.wCustomSave([original]);audit.qcOpenEditor('a');document.getElementById('qcEditTitle').value='draft title';
  audit.wCustomSave([{...original,endPage:100,currentPage:80,label:'latest title',target:7,remoteNote:'keep'}]);
  audit.qcSaveEditor();return audit.wCustom()[0];
 },item('a',{currentPage:5,completed:false}));
 assert.equal(result.endPage,100);assert.equal(result.currentPage,80);assert.equal(result.label,'latest title');
}));

test('Quran deletion confirmation preserves unrelated concurrent additions',()=>run(async p=>{
 const original=item('a'),added=item('new');
 const result=await p.evaluate(({original,added})=>{audit.wCustomSave([original]);audit.qcDeleteSegment('a');audit.wCustomSave([original,added]);document.getElementById('hifzDialogOk').click();return audit.wCustom();},{original,added});
 assert.deepEqual(result,[added]);
}));
