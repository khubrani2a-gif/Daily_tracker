'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const chromium=require('playwright')[process.env.STORAGE_TEST_BROWSER||'chromium'];let browser;
test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function setup(fn){const c=await browser.newContext();await c.route('**/*',r=>r.fulfill({contentType:r.request().url().endsWith('.js')?'application/javascript':'text/html',body:r.request().url().endsWith('.js')?fs.readFileSync('data-core.js','utf8'):'<script src="/data-core.js"></script>'}));const p=await c.newPage();await p.goto('https://durable.local/');try{await fn(p,c)}finally{await c.close()}}
test('legacy records migrate exactly and remain available after reload without occupying localStorage',()=>setup(async p=>{
 await p.evaluate(()=>localStorage.setItem('mfkr-account-v1:A:h2do-expenses','{"amount":12345}'));
 const r=await p.evaluate(async()=>{window.s=await MufDataCore.openDurableStorage(localStorage,indexedDB);return [s.getItem('mfkr-account-v1:A:h2do-expenses'),localStorage.getItem('mfkr-account-v1:A:h2do-expenses')];});assert.deepEqual(r,['{"amount":12345}',null]);
 await p.reload();assert.equal(await p.evaluate(async()=>(await MufDataCore.openDurableStorage(localStorage,indexedDB)).getItem('mfkr-account-v1:A:h2do-expenses')),'{"amount":12345}');
}));
test('failed checkpoint keeps durable journal for reload and retry',()=>setup(async p=>{
 await p.evaluate(async()=>{window.s=await MufDataCore.openDurableStorage(localStorage,indexedDB);window.put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('full','QuotaExceededError')};s.setItem('h2do-quran','saved before close');await s.flush().catch(()=>{});});
 await p.reload();assert.equal(await p.evaluate(async()=>{window.s=await MufDataCore.openDurableStorage(localStorage,indexedDB);return s.getItem('h2do-quran')}),'saved before close');
}));
test('records exceeding the old aggregate quota survive checkpoint and reload',()=>setup(async p=>{
 assert.equal(await p.evaluate(async()=>{const s=await MufDataCore.openDurableStorage(localStorage,indexedDB);for(let i=0;i<24;i++){s.setItem('h2do-day-'+i,String(i)+'x'.repeat(300000));await s.flush();}return s.length;}),24);
 await p.reload();assert.equal(await p.evaluate(async()=>{const s=await MufDataCore.openDurableStorage(localStorage,indexedDB);return Array.from({length:24},(_,i)=>s.getItem('h2do-day-'+i)).every((s,i)=>s===String(i)+'x'.repeat(300000))}),true);
}));
test('failed migration leaves every legacy value unchanged',()=>setup(async p=>{
 const result=await p.evaluate(async()=>{localStorage.setItem('h2do-private','old');IDBObjectStore.prototype.put=function(){throw Error('blocked write')};try{await MufDataCore.openDurableStorage(localStorage,indexedDB)}catch{}return localStorage.getItem('h2do-private');});assert.equal(result,'old');
}));
test('two tabs observe writes and deletion; late checkpoint cannot resurrect a record',()=>setup(async(p,c)=>{
 await p.evaluate(async()=>window.s=await MufDataCore.openDurableStorage(localStorage,indexedDB));const q=await c.newPage();await q.goto('https://durable.local/');await q.evaluate(async()=>window.s=await MufDataCore.openDurableStorage(localStorage,indexedDB));
 await p.evaluate(()=>s.setItem('h2do-note','first'));await q.waitForFunction(()=>s.getItem('h2do-note')==='first');await q.evaluate(()=>s.removeItem('h2do-note'));await p.waitForFunction(()=>s.getItem('h2do-note')===null);await p.evaluate(()=>s.flush());await q.evaluate(()=>s.flush());await p.reload();assert.equal(await p.evaluate(async()=>(await MufDataCore.openDurableStorage(localStorage,indexedDB)).getItem('h2do-note')),null);
}));
test('checkpoint keeps newest of several writes to the same key',()=>setup(async p=>{
 await p.evaluate(async()=>{window.s=await MufDataCore.openDurableStorage(localStorage,indexedDB);s.setItem('h2do-note','one');s.setItem('h2do-note','two');s.removeItem('h2do-note');await s.flush();});await p.reload();assert.equal(await p.evaluate(async()=>(await MufDataCore.openDurableStorage(localStorage,indexedDB)).getItem('h2do-note')),null);
}));
test('a committed journal update wins over a leftover legacy snapshot after interrupted migration',()=>setup(async p=>{
 await p.evaluate(async()=>{localStorage.setItem('h2do-note','old');const row={key:'h2do-note',value:'new',clock:100,id:'test-op'};localStorage.setItem('mfkr-write-v1:test-op',JSON.stringify(row));window.s=await MufDataCore.openDurableStorage(localStorage,indexedDB);});assert.equal(await p.evaluate(()=>s.getItem('h2do-note')),'new');
}));
test('large guest adoption is checkpointed and preserves every record across reload',()=>setup(async p=>{
 const result=await p.evaluate(async()=>{const s=await MufDataCore.openDurableStorage(localStorage,indexedDB);for(let i=0;i<24;i++){s.setItem('mfkr-account-v1:guest:h2do-day-'+i,'x'.repeat(300000));await s.flush();}const a=await MufDataCore.openAccountStorageAsync(s);await a.activateAsync('A');return a.storage.getItem('h2do-day-11')?.length;});assert.equal(result,300000);
 await p.reload();assert.equal(await p.evaluate(async()=>{const s=await MufDataCore.openDurableStorage(localStorage,indexedDB),a=await MufDataCore.openAccountStorageAsync(s);return a.owner==='A'&&Array.from({length:24},(_,i)=>a.storage.getItem('h2do-day-'+i)?.length===300000).every(Boolean);}),true);
}));
test('same large dataset exhausts native storage but is supported by durable storage',()=>setup(async p=>{
 assert.equal(await p.evaluate(()=>{try{for(let i=0;i<24;i++)localStorage.setItem('native-'+i,'x'.repeat(300000));return false;}catch(e){return e.name==='QuotaExceededError';}finally{localStorage.clear();}}),true);
}));
test('a newer legacy-tab edit is preserved and blocks ambiguous migration',()=>setup(async p=>{
 await p.evaluate(async()=>{const s=await MufDataCore.openDurableStorage(localStorage,indexedDB);s.setItem('h2do-note','durable');await s.flush();localStorage.setItem('h2do-note','legacy changed');});await p.reload();
 const result=await p.evaluate(async()=>{let failed=false;try{await MufDataCore.openDurableStorage(localStorage,indexedDB);}catch(e){failed=e.message.includes('legacy storage conflict');}return [failed,localStorage.getItem('h2do-note')];});assert.deepEqual(result,[true,'legacy changed']);
}));
test('checkpoint retains quota error classification and the complete journal',()=>setup(async p=>{
 const result=await p.evaluate(async()=>{const s=await MufDataCore.openDurableStorage(localStorage,indexedDB);IDBObjectStore.prototype.put=()=>{throw new DOMException('full','QuotaExceededError')};s.setItem('h2do-note','keep');try{await s.flush();}catch(e){return [e.name,s.getItem('h2do-note'),Object.keys(localStorage).some(k=>k.startsWith('mfkr-write-v1:'))];}});assert.deepEqual(result,['QuotaExceededError','keep',true]);
}));
test('atomic batch exceeds journal capacity and quota failure leaves the old dataset intact',()=>setup(async p=>{
 const r=await p.evaluate(async()=>{const s=await MufDataCore.openDurableStorage(localStorage,indexedDB);s.setItem('h2do-old','original');await s.flush();await s.writeBatch(Object.fromEntries(Array.from({length:24},(_,i)=>['h2do-day-'+i,'x'.repeat(300000)])));const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('full','QuotaExceededError')};let failed=false;try{await s.writeBatch({'h2do-old':null,'h2do-day-0':'changed'});}catch(e){failed=e.name==='QuotaExceededError';}IDBObjectStore.prototype.put=put;return [failed,s.getItem('h2do-old'),s.getItem('h2do-day-0')?.length];});assert.deepEqual(r,[true,'original',300000]);
 await p.reload();assert.equal(await p.evaluate(async()=>(await MufDataCore.openDurableStorage(localStorage,indexedDB)).getItem('h2do-old')),'original');
}));
test('stale tabs cannot overwrite an atomic restore with a single write or a second batch',()=>setup(async(p,c)=>{
 await p.evaluate(async()=>window.s=await MufDataCore.openDurableStorage(localStorage,indexedDB));const q=await c.newPage();await q.goto('https://durable.local/');await q.evaluate(async()=>window.s=await MufDataCore.openDurableStorage(localStorage,indexedDB));await p.evaluate(()=>s.writeBatch({'h2do-note':'restored'}));
 assert.equal(await q.evaluate(async()=>{let rejected=0;try{s.setItem('h2do-note','stale')}catch{rejected++}try{await s.writeBatch({'h2do-note':'stale'})}catch{rejected++}return rejected;}),2);
 await q.reload();assert.equal(await q.evaluate(async()=>(await MufDataCore.openDurableStorage(localStorage,indexedDB)).getItem('h2do-note')),'restored');
}));
test('incomplete adoption resumes after reload and blocks edits while the intent exists',()=>setup(async p=>{
 const result=await p.evaluate(async()=>{const s=await MufDataCore.openDurableStorage(localStorage,indexedDB);s.setItem('mfkr-account-v1:guest:h2do-note','original');await s.flush();localStorage.setItem('mfkr-adoption-v1',JSON.stringify({source:'guest',target:'A',phase:'copy'}));let rejected=false;try{s.setItem('mfkr-account-v1:guest:h2do-note','concurrent')}catch{rejected=true}return rejected;});assert.equal(result,true);
 await p.reload();assert.deepEqual(await p.evaluate(async()=>{const s=await MufDataCore.openDurableStorage(localStorage,indexedDB),a=await MufDataCore.openAccountStorageAsync(s);return [a.owner,a.storage.getItem('h2do-note'),s.getItem('mfkr-account-v1:guest:h2do-note')];}),['A','original',null]);
}));
