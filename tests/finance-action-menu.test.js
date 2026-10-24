const test=require('node:test'),assert=require('node:assert/strict');
const {device,chromium}=require('./audit-browser-helper.cjs');

test('fixed finance menu dismisses with Escape and backdrop without changing money',async()=>{
 const browser=await chromium.launch();
 try{
  const {p,errors}=await device(browser);
  p.setDefaultTimeout(3000);
  await p.clock.install({time:new Date('2026-10-28T09:00:00Z')});
  const before=await p.evaluate(()=>{
   const e=audit.expState();
   e.fixedTemplates=[{id:'menu-fixed',name:'إيجار',amountType:'fixed',defaultAmountMinor:100000,startMonth:'2026-10',dueDay:28,isActive:true}];
   e.instances=[{id:'menu-instance',templateId:'menu-fixed',year:2026,month:10,dueDate:'2026-10-28',plannedAmountMinor:100000,paidAmountMinor:25000,status:'partial'}];
   e.transactions=[{id:'menu-payment',transactionType:'expense',fixedExpenseInstanceId:'menu-instance',amountMinor:25000,transactionDate:'2026-10-28'}];
   audit.expSave(e);audit.expOpenOverlay();audit.expSetView('plan');
   return JSON.stringify(audit.expState());
  });
  const trigger=p.locator('[data-tplmenu="menu-fixed"]');
  await trigger.click();
  assert.equal(await p.locator('.prio-menu-backdrop [role="menu"]').count(),1);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(50);
  assert.deepEqual(errors,[]);
  assert.equal(await p.locator('.prio-menu-backdrop').count(),0);
  await trigger.click();
  assert.equal(await p.locator('.prio-menu-backdrop [role="menu"]').count(),1);
  await p.locator('.prio-menu-backdrop').click({position:{x:2,y:2}});
  assert.equal(await p.locator('.prio-menu-backdrop').count(),0);
  assert.deepEqual(errors,[]);
  assert.equal(await p.evaluate(()=>JSON.stringify(audit.expState())),before);
 }finally{await browser.close();}
});
