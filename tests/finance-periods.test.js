const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {device,chromium}=require('./audit-browser-helper.cjs');
test('salary and weekly periods preserve transactions, boundaries and obligations',async()=>{
 const b=await chromium.launch();try{
 const {p}=await device(b);
 const r=await p.evaluate(()=>{const a=audit,e=audit.expState();e.settings.weekStartDay=6;e.settings.salaryCycleStartDay=27;e.settings.salaryAmountMinor=800000;e.categories=[{id:'c',name:'منزل',section:'variable',isActive:true,budgets:[{from:'2026-01-01',amountMinor:70000}]}];e.fixedTemplates=[];e.instances=[];e.transactions=[{id:'a',transactionType:'expense',amountMinor:50000,categoryId:'c',transactionDate:'2026-10-26'},{id:'b',transactionType:'expense',amountMinor:10000,categoryId:'c',transactionDate:'2026-10-27'}];const before=JSON.stringify(e.transactions),x=a.expFinancePeriods('2026-10-27'),next=a.expFinancePeriods('2026-10-31');a.setExpMode('salary');a.setExpDate('2026-10-27');a.expRenderReport();const range=a.expCurrentReportRange(),text=document.getElementById('expReportBody').textContent;const unchanged=before===JSON.stringify(e.transactions);
 e.fixedTemplates=[{id:'T',name:'التزام',startMonth:'2026-10',dueDay:28,defaultAmountMinor:300000,isActive:true}];e.instances=[{id:'i',templateId:'T',year:2026,month:10,dueDate:'2026-10-28',plannedAmountMinor:300000,paidAmountMinor:0}];const unpaid=a.expFinancePeriods('2026-10-27');a.expRecordPayment('i',100000,'2026-10-27');const partial=a.expFinancePeriods('2026-10-27');return{x,next,range,text,unchanged,unpaid,partial};});
 assert.equal(r.x.weekSpent,60000);assert.equal(r.x.weekRemaining,10000);assert.equal(r.x.spent,10000);assert.equal(r.next.weekSpent,0);assert.equal(r.next.spent,10000);assert.equal(r.range.start,'2026-10-27');assert.equal(r.range.end,'2026-11-26');assert.ok(r.unchanged);assert.match(r.text,/دورة الراتب/);assert.equal(r.unpaid.outstanding,300000);assert.equal(r.partial.outstanding,200000);assert.equal(r.unpaid.available,r.partial.available);
 }finally{await b.close();}
});

test('period boundaries, overdue debt, hidden budgets and historical plans',async()=>{
 const b=await chromium.launch();try{const{p}=await device(b);const r=await p.evaluate(()=>{
 const a=audit,e=a.expState();e.settings.weekStartDay=6;e.settings.salaryCycleStartDay=27;e.settings.salaryAmountMinor=800000;e.transactions=[];e.instances=[];e.fixedTemplates=[];
 e.categories=[{id:'c',section:'variable',isActive:true,showInWeeklyBudget:false,budgets:[{from:'2026-01-01',amountMinor:70000}]}];
 const cases=['2026-06-27','2026-11-27','2027-01-01','2028-02-29'].map(d=>a.expFinancePeriods(d));
 e.fixedTemplates=[{id:'T',name:'إيجار',startMonth:'2026-09',dueDay:1,defaultAmountMinor:10000,isActive:true,overrides:{}}];
 const debt=a.expFinancePeriods('2026-10-22');a.expMonthInstances(2026,11);a.expOpenFixedForm('T');document.getElementById('ffAmt').value='200';document.getElementById('ffSave').click();document.querySelector('[data-scopeval="fromNext"]').click();
 const nov=e.instances.find(i=>i.month===11).plannedAmountMinor,sep=a.expPlannedForMonth(e.fixedTemplates[0],2026,9);
 const edit=e.activityLog.find(x=>x.type==='fixed-edit');a.expActivityUndo(edit.id);const undoFuture=a.expPlannedForMonth(e.fixedTemplates[0],2026,11);
 return{cases,debt,nov,sep,undoFuture};});
 assert.equal(r.cases[0].week.start,'2026-06-27');assert.equal(r.cases[1].week.end,'2026-11-27');assert.equal(r.cases[2].cycle.start,'2026-12-27');assert.equal(r.cases[3].cycle.end,'2028-03-26');assert.equal(r.cases[0].weekBudget,70000);assert.equal(r.debt.outstanding,20000);assert.equal(r.debt.overdue,10000);assert.equal(r.nov,20000);assert.equal(r.sep,10000);assert.equal(r.undoFuture,10000);
 }finally{await b.close();}
});
test('old payment reversal preserves later payments and rounding conserves weekly budget',async()=>{
 const b=await chromium.launch();try{const{p}=await device(b);const r=await p.evaluate(()=>{
 const a=audit,e=a.expState();e.settings.weekStartDay=6;e.settings.salaryCycleStartDay=27;e.transactions=[];e.instances=[];e.fixedTemplates=[{id:'t',name:'التزام',startMonth:'2026-10',dueDay:1,defaultAmountMinor:50000,isActive:true}];a.expMonthInstances(2026,10);const i=e.instances[0],before=a.expFixedSnapshot('t');const tx=a.expRecordPayment(i.id,10000,'2026-10-22'),rec=a.expActivityPush({type:'payment',templateId:'t',txId:tx.id,before});a.expRecordPayment(i.id,20000,'2026-10-22');a.expActivityUndo(rec.id);
 const cat={budgets:[{from:'2026-01-01',amountMinor:10001}]};return {paid:i.paidAmountMinor,total:e.transactions.filter(t=>!t.deletedAt).reduce((n,t)=>n+t.amountMinor,0),parts:a.expCategoryPlanInRange(cat,{start:'2026-10-24',end:'2026-10-26'})+a.expCategoryPlanInRange(cat,{start:'2026-10-27',end:'2026-10-30'})};});assert.equal(r.paid,20000);assert.equal(r.total,20000);assert.equal(r.parts,10001);
 }finally{await b.close();}
});
