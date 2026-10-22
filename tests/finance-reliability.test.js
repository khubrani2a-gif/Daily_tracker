const test=require('node:test'),assert=require('node:assert/strict');
const {device,chromium}=require('./audit-browser-helper.cjs');
test('money parsing rejects ambiguous and malformed input without magnifying it',async()=>{
 const b=await chromium.launch();try{const{p}=await device(b);const r=await p.evaluate(()=>['12.3.4','100-50','1e3','12,50','1,234.50','١٬٢٣٤٫٥٠','12.50','0.001','9007199254740992'].map(v=>Number.isNaN(audit.expParseAmount(v))?null:audit.expParseAmount(v)));assert.deepEqual(r,[null,null,null,null,123450,123450,1250,null,null]);}finally{await b.close();}
});
test('settings merge respects field clocks rather than unrelated newer saves',async()=>{
 const b=await chromium.launch();try{const{p}=await device(b);const r=await p.evaluate(()=>{const a=audit.expDefault(),b=audit.expDefault();a.settings={salaryAmountMinor:900000,defaultPaymentMethod:'مدى',updatedAt:20,fieldUpdatedAt:{salaryAmountMinor:20,defaultPaymentMethod:1}};b.settings={salaryAmountMinor:800000,defaultPaymentMethod:'نقد',updatedAt:30,fieldUpdatedAt:{salaryAmountMinor:1,defaultPaymentMethod:30}};return audit.expMerge(a,b).settings;});assert.equal(r.salaryAmountMinor,900000);assert.equal(r.defaultPaymentMethod,'نقد');}finally{await b.close();}
});
test('legacy activity ordering cannot evict the newest financial undo record',async()=>{const b=await chromium.launch();try{const{p}=await device(b);const r=await p.evaluate(()=>{const e=audit.expState();e.activityLog=Array.from({length:80},(_,i)=>({id:'old-'+(80-i),type:'payment',createdAt:80-i,updatedAt:80-i}));audit.expActivityPush({type:'payment',templateId:'t'});return e.activityLog.map(r=>r.id);});assert.equal(r.length,80);assert.ok(r.includes('old-80'));assert.ok(!r.includes('old-1'));}finally{await b.close();}});
