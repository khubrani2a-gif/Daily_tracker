const {test}=require('node:test'),assert=require('node:assert/strict');
const {device,chromium}=require('./audit-browser-helper.cjs');
test('date arrows stay beside the date and header tools fit narrow and wide screens',async()=>{
 const b=await chromium.launch();try{const d=await device(b);for(const width of [320,390,768,1440]){
  await d.p.setViewportSize({width,height:900});
  const layout=await d.p.evaluate(()=>{
   const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {top:r.top,left:r.left,right:r.right,width:r.width,height:r.height};};
   return {prev:rect('prevDay'),date:rect('datePicker'),next:rect('nextDay'),header:rect('appHeader'),tools:['statsBtn','globalSearchBtn','notifyBtn','customizeBtn','themeBtn'].map(rect),overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  assert.ok(Math.abs(layout.prev.top-layout.next.top)<1);
  assert.ok(Math.abs(layout.prev.top-layout.date.top)<3);
  assert.ok(layout.next.right<=layout.date.left&&layout.prev.left>=layout.date.right);
  assert.equal(layout.overflow,false);
  for(const r of layout.tools){assert.ok(r.width>=44&&r.height>=44);assert.ok(r.left>=layout.header.left&&r.right<=layout.header.right);}
 }assert.deepEqual(d.errors,[]);await d.c.close();}finally{await b.close();}
});
test('header disclosure works by keyboard and day navigation retains local edits',async()=>{
 const b=await chromium.launch();try{const d=await device(b),p=d.p;
 assert.equal(await p.locator('#syncBtn').isVisible(),false);
 await p.locator('#headerSyncDetails summary').focus();await p.keyboard.press('Enter');
 assert.equal(await p.locator('#syncBtn').isVisible(),true);
 await p.keyboard.press('Enter');assert.equal(await p.locator('#syncBtn').isVisible(),false);
 const date=await p.locator('#datePicker').inputValue();
 await p.evaluate(()=>{audit.setState({...audit.get(),notes:'header navigation test'});audit.save();});
 await p.locator('#prevDay').click();assert.notEqual(await p.locator('#datePicker').inputValue(),date);
 await p.locator('#nextDay').click();assert.equal(await p.locator('#datePicker').inputValue(),date);
 assert.equal(await p.evaluate(()=>audit.get().notes),'header navigation test');assert.deepEqual(d.errors,[]);await d.c.close();
 }finally{await b.close();}
});
test('closed sync disclosure exposes progress, partial and failure states with retry inside',async()=>{
 const b=await chromium.launch();try{const d=await device(b),p=d.p;
 await p.evaluate(()=>{audit.login();audit.renderGlobalSyncStatus({status:'success'},false);});
 assert.match(await p.locator('#syncSummaryLabel').innerText(),/تمت المزامنة/);
 await p.evaluate(()=>audit.renderGlobalSyncStatus(null,true));assert.match(await p.locator('#syncSummaryLabel').innerText(),/جارٍ/);
 await p.evaluate(()=>audit.renderGlobalSyncStatus({status:'partial'},false));assert.match(await p.locator('#syncSummaryLabel').innerText(),/غير مكتملة/);
 await p.evaluate(()=>audit.renderGlobalSyncStatus({status:'failed'},false));assert.match(await p.locator('#syncSummaryLabel').innerText(),/تعذّرت/);
 assert.equal(await p.locator('#headerSyncDetails').getAttribute('open'),null);
 await p.locator('#headerSyncDetails summary').click();assert.equal(await p.locator('#syncRetry').isVisible(),true);assert.equal(await p.locator('#syncRetry').isEnabled(),true);
 await p.locator('#syncRetry').click();await p.waitForFunction(()=>!document.getElementById('syncSummaryLabel').textContent.includes('جارٍ'));
 assert.deepEqual(d.errors,[]);await d.c.close();
 }finally{await b.close();}
});
