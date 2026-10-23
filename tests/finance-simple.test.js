const test=require('node:test'),assert=require('node:assert/strict');
const {device,chromium}=require('./audit-browser-helper.cjs');
async function run(fn){const b=await chromium.launch();try{const c=await device(b);c.p.setDefaultTimeout(3500);await c.p.clock.install({time:new Date('2026-10-28T09:00:00Z')});await c.p.evaluate(()=>{const e=audit.expState();Object.assign(e.settings,{weekStartDay:6,salaryCycleStartDay:27,salaryAmountMinor:800000});Object.assign(e,{transactions:[],financeEntries:[],instances:[],fixedTemplates:[],recurringTransactions:[],savingsGoals:[],categories:[{id:'c',name:'بقالة',section:'variable',isActive:true,subcategories:[{id:'sub',name:'تموين',isActive:true}],budgets:[{from:'2026-01-01',amountMinor:70000}]}]});audit.expSave(e);audit.expOpenOverlay();audit.expSetView('dash');});await fn(c);assert.deepEqual(c.errors,[]);}finally{await b.close();}}
const money=()=>{const x=audit.expFinancePeriods('2026-10-28');return [x.weekSpent,x.spent,x.weekRemaining,x.available];};
test('simple destinations expose existing ledger and plan without changing cross-cycle money',()=>run(async({p})=>{
 await p.evaluate(()=>{audit.expState().transactions=[{id:'old',transactionType:'expense',amountMinor:30000,categoryId:'c',transactionDate:'2026-10-26'},{id:'new',transactionType:'expense',amountMinor:20000,categoryId:'c',transactionDate:'2026-10-27'}];audit.expSetView('dash');});
 assert.deepEqual(await p.evaluate(money),[50000,20000,20000,780000]);
 assert.equal(await p.locator('#expFixedCard').isVisible(),false);
 await p.locator('#expFinanceNav [data-view="ledger"]').click();assert.equal(await p.locator('[data-ledger-id]').count(),2);
 await p.locator('#expFinanceNav [data-view="plan"]').click();assert.equal(await p.locator('#expFixedCard').isVisible(),true);
 await p.locator('#expFinanceNav [data-view="dash"]').click();assert.deepEqual(await p.evaluate(money),[50000,20000,20000,780000]);assert.equal(await p.locator('#expRecentRows [data-recent-record]').count(),2);
}));
test('main expense entry saves once and undo restores both weekly and cycle money through reload',()=>run(async({p})=>{
 await p.locator('#expAddBtn').click();assert.equal(await p.locator('#fqAmount').isVisible(),true);await p.locator('#fqAmount').fill('50');await p.locator('#fqSave').click();
 assert.deepEqual(await p.evaluate(money),[5000,5000,65000,795000]);assert.match(await p.locator('#expRecentRows').innerText(),/بقالة/);
 await p.locator('#expUndoBtn').click();assert.deepEqual(await p.evaluate(money),[0,0,70000,800000]);await p.reload();assert.deepEqual(await p.evaluate(money),[0,0,70000,800000]);
}));
test('new quick expense undo refuses later changes and related refunds',()=>run(async({p})=>{
 await p.evaluate(()=>audit.expOpenQuickExpense());await p.locator('#fqAmount').fill('50');await p.locator('#fqSave').click();await p.evaluate(()=>{const t=audit.expState().transactions[0];t.amountMinor=6000;t.updatedAt++;});await p.locator('#expUndoBtn').click();assert.deepEqual(await p.evaluate(money),[6000,6000,64000,794000]);
 await p.evaluate(()=>audit.expOpenQuickExpense());await p.locator('#fqAmount').fill('75');await p.locator('#fqSave').click();await p.evaluate(()=>{const e=audit.expState(),t=e.transactions.at(-1);e.transactions.push({id:'refund',transactionType:'refund',relatedTransactionId:t.id,categoryId:'c',amountMinor:1000,transactionDate:'2026-10-28'});});await p.locator('#expUndoBtn').click();assert.deepEqual(await p.evaluate(money),[12500,12500,57500,787500]);
}));
test('expense drafts retain amount date and description when moving to specialized details',()=>run(async({p})=>{
 await p.evaluate(()=>audit.expOpenQuickExpense());await p.locator('#fqAmount').fill('50');await p.locator('#fqDate').fill('2026-10-26');await p.locator('#fqDetails summary').click();await p.locator('#fqName').fill('مشتريات البيت');await p.locator('#fqAdvanced').click();assert.equal(await p.locator('#efAmount').inputValue(),'50');assert.equal(await p.locator('#efDate').inputValue(),'2026-10-26');assert.equal(await p.locator('#efDetails').inputValue(),'مشتريات البيت');assert.deepEqual(await p.evaluate(money),[0,0,70000,800000]);
}));
test('summary payment uses original obligation and never weekly spending',()=>run(async({p})=>{
 await p.evaluate(()=>{const e=audit.expState();e.fixedTemplates=[{id:'t',name:'كهرباء',isActive:true,startMonth:'2026-10',dueDay:28,defaultAmountMinor:20000}];e.instances=[{id:'i',templateId:'t',year:2026,month:10,dueDate:'2026-10-28',plannedAmountMinor:20000,paidAmountMinor:0,status:'unpaid'}];audit.expSetView('dash');});
 await p.locator('#expNextPay').click();await p.locator('#pfAmt').fill('100');await p.locator('#pfSave').click();assert.deepEqual(await p.evaluate(money),[0,10000,70000,780000]);assert.deepEqual(await p.evaluate(()=>{const t=audit.expState().transactions[0];return [t.fixedExpenseInstanceId,t.categoryId,t.countAgainstWeeklyBudget];}),['i',null,false]);await p.locator('#expUndoBtn').click();assert.deepEqual(await p.evaluate(money),[0,0,70000,780000]);
}));
test('quick save rollback preserves draft and retry records one expense only',()=>run(async({p})=>{
 await p.locator('#expAddBtn').click();await p.locator('#fqAmount').fill('50');await p.evaluate(()=>{const old=Storage.prototype.setItem;window.restoreStorage=()=>Storage.prototype.setItem=old;Storage.prototype.setItem=function(k,v){if(k.includes('h2do-expenses'))throw Error('quota');return old.call(this,k,v);};});
 await p.locator('#fqSave').click();assert.equal(await p.locator('#fqAmount').inputValue(),'50');assert.equal(await p.locator('#fqSave').isEnabled(),true);assert.deepEqual(await p.evaluate(money),[0,0,70000,800000]);await p.evaluate(()=>restoreStorage());await p.locator('#fqSave').click();assert.deepEqual(await p.evaluate(money),[5000,5000,65000,795000]);assert.equal(await p.evaluate(()=>audit.expState().transactions.length),1);
}));
test('ledger destination preserves refund filter during delete and monetary undo',()=>run(async({p})=>{
 await p.evaluate(()=>{audit.expState().transactions=[{id:'buy',transactionType:'expense',categoryId:'c',amountMinor:10000,transactionDate:'2026-10-26'},{id:'ref',transactionType:'refund',relatedTransactionId:'buy',categoryId:'c',amountMinor:2000,transactionDate:'2026-10-28'}];audit.expSetView('dash');});
 await p.locator('#expFinanceNav [data-view="ledger"]').click();await p.locator('#ulType').selectOption('refund');assert.equal(await p.locator('[data-ledger-id]').count(),1);
 await p.locator('[data-txmenu="ref"]').click();await p.locator('.prio-menu-item').filter({hasText:'حذف'}).click();assert.equal(await p.locator('[data-ledger-id]').count(),0);await p.locator('#expUndoBtn').click();assert.equal(await p.locator('#ulType').inputValue(),'refund');assert.equal(await p.locator('[data-ledger-id]').count(),1);assert.deepEqual(await p.evaluate(money),[8000,-2000,62000,802000]);
}));
test('quick addition undo tombstone wins stale-device merge and refuses changed owner',()=>run(async({p})=>{
 await p.locator('#expAddBtn').click();await p.locator('#fqAmount').fill('50');await p.locator('#fqSave').click();const stale=await p.evaluate(()=>JSON.parse(JSON.stringify(audit.expState())));await p.locator('#expUndoBtn').click();const undone=await p.evaluate(()=>JSON.parse(JSON.stringify(audit.expState())));for(const pair of [[stale,undone],[undone,stale]]){await p.evaluate(pair=>audit.expAdoptState(audit.expMerge(...pair)),pair);assert.deepEqual(await p.evaluate(money),[0,0,70000,800000]);}
 await p.evaluate(()=>audit.expOpenQuickExpense());await p.locator('#fqAmount').fill('60');await p.locator('#fqSave').click();await p.evaluate(()=>audit.login());await p.locator('#expUndoBtn').click();assert.equal(await p.evaluate(()=>audit.expState().transactions.filter(t=>!t.deletedAt).length),1);
}));
test('family keeps members and archived management available without adding financial writes',()=>run(async({p})=>{
 await p.evaluate(()=>audit.expSetView('family'));await p.locator('[data-family-manage] summary').click();await p.locator('[data-family-people]').click();assert.equal(await p.locator('#familyMemberName').isVisible(),true);assert.deepEqual(await p.evaluate(money),[0,0,70000,800000]);
}));
test('ordinary draft does not inherit active trip exclusions when opening advanced details',()=>run(async({p})=>{
 await p.evaluate(()=>{audit.expState().trips=[{id:'trip',name:'سفر',startDate:'2026-10-27',endDate:'2026-11-01',isManuallyActivated:true,includeInWeeklyBudgets:false,baseCurrency:'SAR'}];audit.expOpenQuickExpense();});await p.locator('#fqAmount').fill('50');await p.locator('#fqDetails summary').click();await p.locator('#fqAdvanced').click();assert.equal(await p.locator('#efTrip').inputValue(),'');assert.equal(await p.locator('#efCount').isChecked(),true);const chip=p.locator('[data-subchip]').first();if(await chip.count())await chip.click();await p.locator('#efSave').click();assert.deepEqual(await p.evaluate(money),[5000,5000,65000,795000]);assert.equal(await p.evaluate(()=>audit.expState().transactions[0].tripId),null);
}));
test('ledger correction restores row keyboard focus after cancellation and saving without losing filters',()=>run(async({p})=>{
 await p.evaluate(()=>{audit.expFinancePut({id:'income',kind:'income',name:'راتب',amountMinor:800000,date:'2026-10-28'});audit.expSetView('ledger');});await p.locator('#ulType').selectOption('income');await p.locator('[data-ledger-correct="income"]').click();await p.keyboard.press('Escape');assert.equal(await p.locator('[data-ledger-correct="income"]').evaluate(n=>n===document.activeElement),true);
 await p.locator('[data-ledger-correct="income"]').click();await p.locator('[data-income-edit="income"]').click();await p.locator('#fiAmount').fill('8100');await p.locator('#fiSave').click();assert.equal(await p.locator('#ulType').inputValue(),'income');assert.equal(await p.locator('[data-ledger-correct="income"]').evaluate(n=>n===document.activeElement),true);assert.equal(await p.evaluate(()=>audit.expFinancePeriods('2026-10-28').incomeReceived),810000);
}));
test('ledger keeps search visible and dates optional without losing filtering',()=>run(async({p})=>{
 await p.evaluate(()=>audit.expSetView('ledger'));assert.equal(await p.locator('#ulText').isVisible(),true);assert.equal(await p.locator('#ulStart').isVisible(),false);await p.locator('#ulDates summary').click();await p.locator('#ulStart').fill('2099-01-01');assert.equal(await p.locator('[data-ledger-id]').count(),0);assert.deepEqual(await p.evaluate(money),[0,0,70000,800000]);
}));
