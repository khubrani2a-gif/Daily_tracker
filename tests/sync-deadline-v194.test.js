'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function env(){
  let now=1000,id=0,refreshes=0;const timers=new Map();
  class Clock extends Date{static now(){return now}}
  const set=(fn,ms)=>{const key=++id;timers.set(key,{fn,at:now+ms});return key;};
  const clear=key=>timers.delete(key);
  const segment=source.slice(source.indexOf('  function _tagSource'),source.indexOf('  /* أقفال ذات انضمام'));
  const summary=source.slice(source.indexOf('  function syncSummary(){'),source.indexOf('  /* تسجيل مشغّلات دورة الحياة'));
  const api=new Function('setTimeout','clearTimeout','Date','expRefreshSyncUI','safeRun','navigator',
    'let accountChanging=false;const SYNC_MODULES=["daily"];'+segment+summary+
    ';return {getDocServerFirst,getQueryServerFirst,syncBegin,syncEnd,syncSummary,syncModule,changeAccount:()=>accountChanging=true};'
  )(set,clear,Clock,()=>refreshes++,(_,fn)=>fn(),{onLine:true});
  async function tick(ms){now+=ms;for(const [key,t] of [...timers])if(t.at<=now){timers.delete(key);t.fn();}for(let n=0;n<12;n++)await Promise.resolve();}
  return {api,tick,timers,refreshes:()=>refreshes};
}
test('stalled document read falls back to cache and never labels it server-confirmed',async()=>{
 const e=env();let settled=false;const calls=[];
 const result=e.api.getDocServerFirst({get:({source})=>{calls.push(source);return source==='server'?new Promise(()=>{}):Promise.resolve({exists:true,metadata:{fromCache:true}})}}).then(x=>{settled=true;return x;});
 await e.tick(20000);assert.equal(settled,true,'server wait must be bounded');const snap=await result;assert.equal(snap._srcCache,true);assert.deepEqual(calls,['server','cache']);
});
test('stalled query and unavailable cache terminate without fabricated success',async()=>{
 const e=env();let error; e.api.getQueryServerFirst({get:()=>new Promise(()=>{})}).catch(x=>error=x);
 await e.tick(20000);await e.tick(10000);assert.ok(error,'both waits must be bounded');
});
test('delayed write stops the spinner but retains the in-flight operation until it really finishes',async()=>{
 const e=env();e.api.syncBegin('daily','manual');await e.tick(60000);
 assert.notEqual(e.api.syncSummary().state,'syncing','wait must not look busy forever');
 assert.equal(e.api.syncModule('daily').inFlight,true,'do not release the lock or duplicate a pending write');
 assert.equal(e.api.syncModule('daily').lastServerSuccessAt,0);
 assert.ok(e.refreshes()>0);
 e.api.syncEnd('daily',true,{metadata:{fromCache:false}});
 assert.equal(e.api.syncSummary().state,'ok');assert.equal(e.api.syncModule('daily').inFlight,false);assert.equal(e.timers.size,0);
});
test('successful reads and completed sync cancel deadline timers',async()=>{
 const e=env();const snap=await e.api.getDocServerFirst({get:()=>Promise.resolve({exists:true})});assert.equal(snap._srcServer,true);
 e.api.syncBegin('daily','test');e.api.syncEnd('daily',true,snap);await e.tick(60000);assert.equal(e.api.syncSummary().state,'ok');assert.equal(e.timers.size,0);
});
