const test=require('node:test'),assert=require('node:assert/strict');
const {device,chromium}=require('./audit-browser-helper.cjs');
async function run(fn){const b=await chromium.launch();try{const c=await device(b);await c.p.clock.install({time:new Date('2026-10-28T09:00:00Z')});await c.p.evaluate(()=>{const e=audit.expState();Object.assign(e.settings,{weekStartDay:6,salaryCycleStartDay:27,salaryAmountMinor:800000});Object.assign(e,{transactions:[],financeEntries:[],instances:[],fixedTemplates:[],recurringTransactions:[],savingsGoals:[{id:'g',name:'احتياط',currentMinor:100000}],categories:[{id:'c',name:'منزل',section:'variable',isActive:true,budgets:[{from:'2026-01-01',amountMinor:70000}]}]});});await fn(c);assert.deepEqual(c.errors,[]);}finally{await b.close();}}

for(const type of ['expense','refund']) test(type+' undo restores actual totals after reload and stale-device merge',()=>run(async({p})=>{
 await p.evaluate(type=>{const e=audit.expState();e.transactions=[{id:'x',transactionType:type,amountMinor:12550,transactionDate:'2026-10-28',categoryId:'c',updatedAt:Date.now()+60000,deletedAt:Date.now()+60000}];audit.expSave(e);audit.expOpenOverlay();audit.expShowUndo('حذف','x');},type);
 const stale=await p.evaluate(()=>JSON.parse(JSON.stringify(audit.expState())));
 await p.locator('#expUndoBtn').click();
 const expected=type==='expense'?12550:-12550;
 const check=async()=>{const s=await p.evaluate(()=>{const x=audit.expFinancePeriods('2026-10-28');return {spent:x.spent,weekSpent:x.weekSpent,remaining:x.weekRemaining,available:x.available};});assert.deepEqual(s,{spent:expected,weekSpent:expected,remaining:70000-expected,available:800000-expected});};
 await check();await p.reload();await check();
 const restored=await p.evaluate(()=>JSON.parse(JSON.stringify(audit.expState())));
 for(const pair of [[restored,stale],[stale,restored]]){await p.evaluate(pair=>audit.expAdoptState(audit.expMerge(...pair)),pair);await check();}
}));
test('saving cancellation undo restores goal and available money after storage reload',()=>run(async({p})=>{
 await p.evaluate(()=>{audit.expFinancePut({id:'saving',kind:'saving',goalId:'g',date:'2026-10-28',amountMinor:20000});audit.expState().financeEntries.find(r=>r.id==='saving').updatedAt=Date.now()+60000;audit.expOpenOverlay();audit.expOpenFinanceLedger('saving');});
 const values=()=>p.evaluate(()=>({goal:audit.expSavingBalance('g'),available:audit.expFinancePeriods('2026-10-28').available}));
 assert.deepEqual(await values(),{goal:120000,available:780000});
 await p.locator('[data-finance-remove="saving"]').click();await p.locator('#hifzDialogOk').click();assert.deepEqual(await values(),{goal:100000,available:800000});
 const stale=await p.evaluate(()=>JSON.parse(JSON.stringify(audit.expState())));await p.locator('#flUndo').click();assert.deepEqual(await values(),{goal:120000,available:780000});await p.reload();assert.deepEqual(await values(),{goal:120000,available:780000});const restored=await p.evaluate(()=>JSON.parse(JSON.stringify(audit.expState())));for(const pair of [[restored,stale],[stale,restored]]){await p.evaluate(pair=>audit.expAdoptState(audit.expMerge(...pair)),pair);assert.deepEqual(await values(),{goal:120000,available:780000});}
}));

test('income undo restores received cash after reload and merge without doubling it',()=>run(async({p})=>{
 await p.evaluate(()=>{audit.expFinancePut({id:'income',kind:'income',name:'راتب',date:'2026-10-28',amountMinor:500000});audit.expState().financeEntries.find(r=>r.id==='income').updatedAt=Date.now()+60000;audit.expOpenOverlay();audit.expOpenFinanceLedger('income');});
 await p.locator('[data-finance-remove="income"]').click();await p.locator('#hifzDialogOk').click();const stale=await p.evaluate(()=>JSON.parse(JSON.stringify(audit.expState())));assert.equal(await p.evaluate(()=>audit.expFinancePeriods('2026-10-28').incomeReceived),0);
 await p.locator('#flUndo').click();await p.reload();const restored=await p.evaluate(()=>JSON.parse(JSON.stringify(audit.expState())));
 for(const pair of [[restored,stale],[stale,restored]]){await p.evaluate(pair=>audit.expAdoptState(audit.expMerge(...pair)),pair);assert.deepEqual(await p.evaluate(()=>{const x=audit.expFinancePeriods('2026-10-28');return [x.incomeReceived,x.available];}),[500000,500000]);}
}));

test('payment undo returns cash and reinstates the unpaid obligation after reload and merge',()=>run(async({p})=>{
 const result=await p.evaluate(()=>{const e=audit.expState();e.fixedTemplates=[{id:'t',name:'إيجار',isActive:true,startMonth:'2026-10',dueDay:28,defaultAmountMinor:100000}];e.instances=[{id:'i',templateId:'t',year:2026,month:10,dueDate:'2026-10-28',plannedAmountMinor:100000,paidAmountMinor:0,status:'unpaid'}];const before=audit.expFixedSnapshot('t');const tx=audit.expRecordPayment('i',40000,'2026-10-28');tx.updatedAt=Date.now()+60000;const activity=audit.expActivityPush({type:'payment',templateId:'t',txId:tx.id,before});const stale=JSON.parse(JSON.stringify(e)),paid=audit.expFinancePeriods('2026-10-28');audit.expActivityUndo(activity.id);return {stale,paid:[paid.spent,paid.outstanding,paid.remaining,paid.available]};});
 assert.deepEqual(result.paid,[40000,60000,760000,700000]);await p.reload();const restored=await p.evaluate(()=>JSON.parse(JSON.stringify(audit.expState())));
 for(const pair of [[restored,result.stale],[result.stale,restored]]){await p.evaluate(pair=>audit.expAdoptState(audit.expMerge(...pair)),pair);assert.deepEqual(await p.evaluate(()=>{const x=audit.expFinancePeriods('2026-10-28');return [x.spent,x.outstanding,x.remaining,x.available];}),[0,100000,800000,700000]);}
}));
