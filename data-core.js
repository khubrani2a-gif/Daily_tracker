(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MufDataCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const ACTIVE='mfkr-active-account-v1', PREFIX='mfkr-account-v1:';
  const accountLock=fn=>globalThis.navigator?.locks?globalThis.navigator.locks.request('mfkr-account-operation-v1',fn):fn();
  const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  // IndexedDB checkpoint + immutable, synchronous write-ahead journal.
  // A successful setItem is durable even if the page closes before checkpointing.
  async function openDurableStorage(raw,factory,options={}){
    const JOURNAL='mfkr-write-v1:',DB='mufakkirati-records-v1',STORE='records';
    const caches=['h2do-witr-text-cache','h2do-reading-stats-cache'];
    const managed=k=>(k.startsWith('h2do-')||k.startsWith(PREFIX))&&!caches.some(c=>k===c||k.endsWith(':'+c));
    const nativeKeys=()=>Array.from({length:raw.length},(_,i)=>raw.key(i)).filter(Boolean);
    const records=new Map();let clock=0,db,timer,flushing,revision=raw.getItem('mfkr-bulk-revision-v1');
    const newer=(a,b)=>!b||a.clock>b.clock||a.clock===b.clock&&a.id>b.id;
    const valid=r=>r&&typeof r.key==='string'&&managed(r.key)&&Number.isSafeInteger(r.clock)&&typeof r.id==='string'&&(r.value===null||typeof r.value==='string');
    const apply=r=>{if(!valid(r))throw Error('invalid durable journal');clock=Math.max(clock,r.clock);if(newer(r,records.get(r.key)))records.set(r.key,r);};
    const operation=(key,value)=>({key,value,clock:clock=Math.max(Date.now(),clock+1),id:crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('')});
    const journals=()=>nativeKeys().filter(k=>k.startsWith(JOURNAL)).map(key=>{const text=raw.getItem(key),record=JSON.parse(text);if(!valid(record))throw Error('invalid durable journal');return {key,text,record};});
    const lock=fn=>globalThis.navigator?.locks?globalThis.navigator.locks.request('mfkr-records-maintenance-v1',fn):fn();
    const transaction=(mode,work)=>new Promise((resolve,reject)=>{
      let tx,result,settled=false;
      const finish=err=>{if(settled)return;settled=true;clearTimeout(deadline);err?reject(err):resolve(result);};
      const deadline=setTimeout(()=>{try{tx?.abort();}catch{}finish(Error('durable storage timeout'));},15000);
      try{tx=db.transaction(STORE,mode);tx.oncomplete=()=>finish();tx.onabort=()=>finish(tx.error||Error('durable storage aborted'));tx.onerror=()=>{};work(tx.objectStore(STORE),v=>result=v,finish);}catch(e){try{tx?.abort();}catch{}finish(e);}
    });
    async function commit(rows){
      const latest=new Map();for(const row of rows)if(newer(row,latest.get(row.key)))latest.set(row.key,row);rows=[...latest.values()];
      await transaction('readwrite',(store,set,fail)=>{for(const row of rows){const req=store.get(row.key);req.onsuccess=()=>{try{if(newer(row,req.result))store.put(row,row.key);}catch(e){fail(e);store.transaction.abort();}};}});
      const checked=await transaction('readonly',(store,set)=>{const result=[];set(result);for(const row of rows){const req=store.get(row.key);req.onsuccess=()=>result.push(req.result);}});
      const byKey=new Map(checked.filter(Boolean).map(r=>[r.key,r]));
      for(const row of rows){const saved=byKey.get(row.key);if(!saved||newer(row,saved)||saved.id===row.id&&saved.value!==row.value)throw Error('durable verification failed');apply(saved);}
    }
    async function checkpoint(){
      const batch=journals();if(!batch.length)return;
      for(const row of batch)apply(row.record);
      await commit(batch.map(r=>r.record));
      for(const row of batch)if(raw.getItem(row.key)===row.text)raw.removeItem(row.key);
    }
    function schedule(){if(timer)return;timer=setTimeout(()=>{timer=null;flush().catch(e=>options.onError?.(e));},25);}
    function flush(){
      if(flushing)return flushing.then(()=>journals().length?flush():undefined);
      flushing=lock(checkpoint).then(()=>options.onSuccess?.()).finally(()=>{flushing=null;});
      return flushing;
    }
    const onStorage=e=>{if(e.key?.startsWith(JOURNAL)&&e.newValue){try{const row=JSON.parse(e.newValue);apply(row);globalThis.dispatchEvent?.(new StorageEvent("storage",{key:row.key,newValue:row.value}));schedule();}catch(error){options.onError?.(error);}}};
    globalThis.addEventListener?.('storage',onStorage);
    try{
      db=await new Promise((resolve,reject)=>{
        let settled=false;const finish=(err,value)=>{if(settled){value?.close();return;}settled=true;clearTimeout(deadline);err?reject(err):resolve(value);};
        const deadline=setTimeout(()=>finish(Error('durable storage open timeout')),15000);
        try{const req=factory.open(DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};req.onsuccess=()=>finish(null,req.result);req.onerror=()=>finish(req.error||Error('durable storage unavailable'));req.onblocked=()=>finish(Error('durable storage blocked'));}catch(error){finish(error);}
      });
      db.onversionchange=()=>{db.close();options.onError?.(Error('durable storage version changed'));};
      await accountLock(()=>lock(async()=>{
        revision=raw.getItem("mfkr-bulk-revision-v1");
        const saved=await transaction('readonly',(store,set)=>{const req=store.getAll();req.onsuccess=()=>set(req.result);});saved.forEach(apply);
        const legacy=nativeKeys().filter(managed).map(key=>({key,value:raw.getItem(key)}));
        if(legacy.length){
          for(const r of legacy){const prior=records.get(r.key);if(prior&&prior.value!==r.value)throw Error('legacy storage conflict: '+r.key);}
          const rows=legacy.map(r=>({key:r.key,value:r.value,clock:0,id:'legacy:'+r.key}));await commit(rows);
          // A legacy tab that changed a value during migration keeps its newer value.
          for(const r of legacy)if(raw.getItem(r.key)===r.value)raw.removeItem(r.key);
        }
        await checkpoint();
      }));
    }catch(error){globalThis.removeEventListener?.('storage',onStorage);db?.close();throw error;}
    const keys=()=>[...new Set([...nativeKeys().filter(k=>!k.startsWith(JOURNAL)),...Array.from(records.values()).filter(r=>r.value!==null).map(r=>r.key)])];
    function write(key,value,migration=false){
      key=String(key);
      if(!migration&&raw.getItem('mfkr-bulk-revision-v1')!==revision)throw Error('storage changed in another tab; reload required');
      if(managed(key)&&!migration&&(raw.getItem('mfkr-adoption-v1')||raw.getItem('mfkr-bulk-v1')))throw Error('storage migration in progress');
      if(!managed(key)){value===null?raw.removeItem(key):raw.setItem(key,String(value));return;}
      const row=operation(key,value===null?null:String(value));
      // Immutable keys prevent one tab's checkpoint from removing another tab's edit.
      try{raw.setItem(JOURNAL+row.id+':'+key,JSON.stringify(row));}catch(error){schedule();throw error;}
      apply(row);schedule();
    }
    async function writeBatch(entries,expectedOwner){
      return accountLock(async()=>{
        if(raw.getItem('mfkr-bulk-revision-v1')!==revision)throw Error('storage changed in another tab; reload required');
        if(expectedOwner!==undefined&&raw.getItem(ACTIVE)!==expectedOwner)throw Error('account changed; reload required');
        if(raw.getItem('mfkr-adoption-v1'))throw Error('account migration pending');
        const pairs=Object.entries(entries);if(pairs.some(([k,v])=>!managed(k)||(v!==null&&typeof v!=='string')))throw Error('invalid durable batch');
        raw.setItem('mfkr-bulk-v1','pending');
        try{raw.setItem('mfkr-bulk-revision-v1',String(Date.now())+Math.random());revision=raw.getItem('mfkr-bulk-revision-v1');
          await flush();await lock(()=>commit(pairs.map(([k,v])=>operation(k,v))));
        }finally{raw.removeItem('mfkr-bulk-v1');}
      });
    }
    return {keys,writeBatch,migrationWrite:(key,value)=>write(key,value,true),get length(){return keys().length;},key:i=>keys()[i]??null,
      getItem:key=>{key=String(key);const legacy=raw.getItem(key);return legacy!==null?legacy:records.get(key)?.value??null;},
      setItem:(key,value)=>write(key,String(value)),removeItem:key=>write(key,null),
      clear:()=>keys().forEach(k=>write(k,null)),flush};
  }

  const ADOPTION='mfkr-adoption-v1';
  async function resumeAdoption(raw,move){
    const prefix=id=>PREFIX+encodeURIComponent(id)+':';
    if(!move||move.source!=='guest'||typeof move.target!=='string'||!move.target||move.target==='guest')throw Error('invalid account migration');
    const source=prefix(move.source),target=prefix(move.target);
    await raw.flush();
    if(move.phase!=='cleanup'){
      for(const key of raw.keys().filter(k=>k.startsWith(source))){raw.migrationWrite(target+key.slice(source.length),raw.getItem(key));await raw.flush();}
      raw.setItem(ADOPTION,JSON.stringify({...move,phase:'cleanup'}));
    }
    raw.setItem(ACTIVE,move.target);
    for(const key of raw.keys().filter(k=>k.startsWith(source))){raw.migrationWrite(target+key.slice(source.length),raw.getItem(key));await raw.flush();raw.migrationWrite(key,null);await raw.flush();}
    raw.removeItem(ADOPTION);
  }
  async function openAccountStorageAsync(raw,options={}){return accountLock(async()=>{
    raw.removeItem('mfkr-bulk-v1');
    const owner=raw.getItem(ACTIVE)||'guest',prefix=PREFIX+encodeURIComponent(owner)+':';
    for(const key of raw.keys().filter(k=>k.startsWith('h2do-'))){
      if(raw.getItem(prefix+key)===null){raw.setItem(prefix+key,raw.getItem(key));await raw.flush();}
      raw.removeItem(key);await raw.flush();
    }
    const pending=raw.getItem(ADOPTION);if(pending)await resumeAdoption(raw,JSON.parse(pending));
    return openAccountStorage(raw,options);
  });}

  function openAccountStorage(raw,options={}){
    let owner=raw.getItem(ACTIVE)||'guest';
    const prefix=id=>PREFIX+encodeURIComponent(id)+':';
    const owned=key=>typeof key==='string'&&key.startsWith('h2do-');
    const nativeKeys=()=>typeof raw.keys==='function'?raw.keys():Array.from({length:raw.length},(_,i)=>raw.key(i)).filter(Boolean);
    // Upgrade the pre-account store once. Never replace an existing account value.
    const legacy=nativeKeys().filter(owned);
    legacy.forEach(key=>{if(raw.getItem(prefix(owner)+key)===null)raw.setItem(prefix(owner)+key,raw.getItem(key));});
    legacy.forEach(key=>raw.removeItem(key));
    raw.setItem(ACTIVE,owner);
    const keyFor=key=>owned(String(key))?prefix(owner)+String(key):String(key);
    const visibleKeys=()=>nativeKeys().flatMap(key=>key.startsWith(prefix(owner))?[key.slice(prefix(owner).length)]:key.startsWith(PREFIX)||key===ACTIVE?[]:[key]);
    // Reclaim only explicitly designated, rebuildable cache values for this owner.
    // Personal records, pending journals and backups are never candidates.
    const disposable=new Set((options.disposableKeys||[]).filter(owned));
    function write(key,value){
      key=String(key);value=String(value);
      try{return raw.setItem(keyFor(key),value);}catch(error){
        const quota=error&&(error.name==='QuotaExceededError'||error.name==='NS_ERROR_DOM_QUOTA_REACHED'||error.code===22||error.code===1014);
        if(!quota||disposable.has(key))throw error;
        let reclaimed=false;
        for(const cache of disposable){const physical=keyFor(cache);if(raw.getItem(physical)!==null){raw.removeItem(physical);reclaimed=true;}}
        if(!reclaimed)throw error;
        return raw.setItem(keyFor(key),value); // One retry; the storage API remains atomic.
      }
    }
    const storage={writeBatch:entries=>raw.writeBatch(Object.fromEntries(Object.entries(entries).map(([k,v])=>[keyFor(k),v])),owner),keys:visibleKeys,get length(){return visibleKeys().length;},key:i=>visibleKeys()[i]??null,
      getItem:key=>raw.getItem(keyFor(key)),setItem:write,removeItem:key=>raw.removeItem(keyFor(key)),clear:()=>visibleKeys().forEach(key=>raw.removeItem(keyFor(key)))};
    function activate(uid){
      const target=uid?String(uid):'guest';
      if(target===owner)return {reload:false};
      const targetKeys=nativeKeys().filter(key=>key.startsWith(prefix(target)));
      // First sign-in may adopt anonymous work. Signing out never copies private data to guest.
      if(owner==='guest'&&target!=='guest'&&!targetKeys.length){
        const guestKeys=nativeKeys().filter(key=>key.startsWith(prefix(owner)));
        guestKeys.forEach(key=>raw.setItem(prefix(target)+key.slice(prefix(owner).length),raw.getItem(key)));
        raw.setItem(ACTIVE,target);
        guestKeys.forEach(key=>raw.removeItem(key));
        owner=target;
        return {reload:false,adoptedGuest:true};
      }
      raw.setItem(ACTIVE,target);
      // The old facade deliberately remains bound to its old owner until the document reloads.
      return {reload:true};
    }
    async function activateAsync(uid){return accountLock(async()=>{
      const target=uid?String(uid):'guest';
      if(target===owner)return {reload:false};
      await raw.flush();
      const pending=raw.getItem(ADOPTION);if(pending){const move=JSON.parse(pending);if(move.target!==target)throw Error('account migration pending');await resumeAdoption(raw,move);owner=target;return {reload:false,adoptedGuest:true};}
      if(owner==='guest'&&target!=='guest'&&!nativeKeys().some(key=>key.startsWith(prefix(target)))){
        const move={source:owner,target,phase:'copy'};raw.setItem(ADOPTION,JSON.stringify(move));
        await resumeAdoption(raw,move);owner=target;return {reload:false,adoptedGuest:true};
      }
      raw.setItem(ACTIVE,target);return {reload:true};
    });}
    return {storage,activate,activateAsync,get owner(){return owner;}};
  }
  function openBackupVault(factory){
    function operation(owner,id,mode,value){
      return new Promise((resolve,reject)=>{
        let db,tx,settled=false,result;
        const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);if(db)db.close();error?reject(error):resolve(result);};
        const timer=setTimeout(()=>{if(tx)try{tx.abort();}catch(e){}finish(new Error('backup archive timeout'));},10000);
        try{
          const request=factory.open('mufakkirati-backup-vault-v1',1);
          request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('snapshots'))request.result.createObjectStore('snapshots');};
          request.onerror=()=>finish(request.error||new Error('archive unavailable'));
          request.onblocked=()=>finish(new Error('backup archive blocked'));
          request.onsuccess=()=>{
            db=request.result;if(settled){db.close();return;}
            try{
              tx=db.transaction('snapshots',mode==='get'?'readonly':'readwrite');
              const store=tx.objectStore('snapshots'),key=[String(owner),String(id)];
              const req=mode==='put'?store.put(value,key):mode==='remove'?store.delete(key):store.get(key);
              req.onsuccess=()=>{result=req.result;};
              tx.oncomplete=()=>finish();tx.onabort=()=>finish(tx.error||new Error('archive transaction aborted'));tx.onerror=()=>{};
            }catch(error){finish(error);}
          };
        }catch(error){finish(error);}
      });
    }
    return {put:(owner,id,value)=>operation(owner,id,'put',value),get:(owner,id)=>operation(owner,id,'get'),remove:(owner,id)=>operation(owner,id,'remove')};
  }
  function storageKeys(storage){
    if(typeof storage.keys==='function')return storage.keys();
    return Array.from({length:storage.length},(_,i)=>storage.key(i)).filter(Boolean);
  }
  // Only exact rebuildable keys may be removed; unknown backup metadata is retained.
  function cacheFreeBackup(raw,keys){
    let rows;try{rows=JSON.parse(raw);}catch(e){return raw;}
    if(!Array.isArray(rows))return raw;
    let changed=false;
    for(const row of rows){
      const entries=row?.snapshot?.entries;
      if(!entries||typeof entries!=='object'||Array.isArray(entries))continue;
      let touched=false;
      for(const key of keys)if(Object.prototype.hasOwnProperty.call(entries,key)){delete entries[key];changed=true;touched=true;}
      if(touched&&row.stats&&typeof row.stats==='object'&&!Array.isArray(row.stats))row.stats.size=new TextEncoder().encode(JSON.stringify(row.snapshot)).length;
    }
    return changed?JSON.stringify(rows):raw;
  }
  function storageReport(storage,keys,backupKey){
    const report={records:0,backups:0,caches:0,embeddedCaches:0,total:0};
    for(const key of storageKeys(storage)){
      if(!key||!key.startsWith('h2do-'))continue;
      const raw=storage.getItem(key);if(raw===null)continue;
      const bytes=2*(key.length+raw.length),kind=key===backupKey?'backups':keys.includes(key)?'caches':'records';
      report[kind]+=bytes;report.total+=bytes;
      if(key===backupKey)report.embeddedCaches=Math.max(0,2*(raw.length-cacheFreeBackup(raw,keys).length));
    }
    return report;
  }
  function cleanStorageCaches(storage,keys,backupKey){
    const raw=storage.getItem(backupKey);
    if(raw!==null){const next=cacheFreeBackup(raw,keys);if(next!==raw&&next.length<raw.length)storage.setItem(backupKey,next);}
    for(const key of keys)storage.removeItem(key);
    return storageReport(storage,keys,backupKey);
  }
  function equal(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  function record(v){return v&&typeof v==='object'&&!Array.isArray(v);}
  // Reading and actual prayer are separate records. Tombstones are permanent.
  function qiyamRows(rows){return (Array.isArray(rows)?rows:[]).filter(record).map(r=>({...copy(r),id:typeof r.id==='string'&&r.id?r.id:'legacy:'+JSON.stringify([r.completedAt,r.key,r.target,r.ayat,Array.isArray(r.parts)?r.parts.map(p=>[p?.n,p?.from,p?.to]):null])}));}
  function qiyamActive(rows){return qiyamRows(rows).filter(r=>!r.deletedAt);}
  function qiyamMerge(base,local,remote){
    const b=qiyamRows(base),l=qiyamRows(local),r=qiyamRows(remote),out=new Map();
    for(const row of r.concat(l)){
      const prev=out.get(row.id);
      if(!prev||(!prev.deletedAt&&row.deletedAt)||(!prev.deletedAt&&!row.deletedAt&&+(row.updatedAt||row.completedAt||0)>=+(prev.updatedAt||prev.completedAt||0)))out.set(row.id,row);
    }
    for(const row of b)if(!l.some(x=>x.id===row.id))out.set(row.id,{...row,deletedAt:Math.max(1,+(row.updatedAt||row.completedAt||0)+1)});
    return [...out.values()].sort((a,b)=>(a.completedAt||0)-(b.completedAt||0)||a.id.localeCompare(b.id));
  }
  function qiyamNight(date,minutes,fajr){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(fajr||''))return null;
    const [h,m]=fajr.split(':').map(Number);
    return minutes<h*60+m?new Date(Date.parse(date+'T12:00:00Z')-86400000).toISOString().slice(0,10):date;
  }
  function qiyamSlice(parts,offset,count){
    const out=[];
    for(const p of parts){const size=p.to-p.from+1;if(offset>=size){offset-=size;continue;}const take=Math.min(count,size-offset);if(take>0)out.push({...p,from:p.from+offset,to:p.from+offset+take-1});count-=take;offset=0;if(!count)break;}
    return out;
  }
  function qiyamPlanValid(w){return record(w)&&Array.isArray(w.parts)&&w.parts.length>0&&w.parts.length<=1000&&w.parts.every(p=>record(p)&&Number.isInteger(p.n)&&p.n>=1&&p.n<=114&&Number.isInteger(p.from)&&Number.isInteger(p.to)&&p.from>=1&&p.to>=p.from&&p.to<=286)&&Number.isInteger(w.readCount||0)&&(w.readCount||0)>=0;}
  function qiyamStable(value){const normalize=v=>Array.isArray(v)?v.map(normalize):record(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])])):v;return JSON.stringify(normalize(value));}
  function qiyamSignature(w){return qiyamStable(w&&[w.id,w.key,w.parts,w.target,w.readCount||0,w.distribution||null]);}
  function qiyamDraftEqual(a,b){const clean=w=>{if(!w)return w;const out=copy(w);delete out.readPage;delete out.startedAt;return out;};return qiyamStable(clean(a))===qiyamStable(clean(b));}
  function qiyamRead(day,count,id,at){
    if(!qiyamPlanValid(day.witr))throw Error('invalidReading');
    const w=day.witr,rows=qiyamRows(day.witrSessions),total=(w?.parts||[]).reduce((n,p)=>n+p.to-p.from+1,0),prior=+(w?.readCount||0);
    if(!w||!Number.isInteger(count)||count<1||count>total-prior||!id||rows.some(x=>x.id===id))throw Error('invalidReading');
    const next=prior+count,after=next===total?null:{...copy(w),readCount:next};
    return {...copy(day),witr:after,witrSessions:rows.concat({id,kind:'reading',target:w.target,parts:qiyamSlice(w.parts,prior,count),key:w.key,ayat:count,completedAt:at,updatedAt:at,before:copy(w),after:copy(after)})};
  }
  function qiyamUndo(day,id,at,retained){
    const rows=qiyamRows(day.witrSessions),active=rows.filter(x=>!x.deletedAt),last=active[active.length-1];
    if(!last||last.id!==id||!qiyamPlanValid(last.before)||!qiyamDraftEqual(day.witr,last.after))throw Error('staleReading');
    return {...copy(day),witr:copy(last.before),witrSessions:rows.map(r=>r.id===id?{...r,deletedAt:at,updatedAt:at,retained:!!retained}:r)};
  }
  function qiyamPray(day,value,at){
    const rows=qiyamRows(day.qiyamPrayers),active=rows.filter(x=>!x.deletedAt);
    if(!value.id||rows.some(x=>x.id===value.id)||(!value.qiyam&&!value.witr))throw Error('invalidPrayer');
    if(value.witr&&active.some(x=>x.witr))throw Error('witrAlreadyRecorded');
    for(const key of ['qiyamRakahs','witrRakahs'])if(value[key]!=null&&(!Number.isInteger(value[key])||value[key]<1||value[key]>100))throw Error('invalidRakahs');
    const row={id:value.id,qiyam:!!value.qiyam,witr:!!value.witr,qiyamRakahs:value.qiyam?value.qiyamRakahs??null:null,witrRakahs:value.witr?value.witrRakahs??null:null,completedAt:at,updatedAt:at};
    return {...copy(day),qiyamPrayers:rows.concat(row)};
  }
  function qiyamEditPrayer(day,id,value,at){
    const rows=qiyamRows(day.qiyamPrayers),old=rows.find(r=>r.id===id&&!r.deletedAt);if(!old)throw Error('stalePrayer');
    const edited=qiyamPray({...day,qiyamPrayers:rows.filter(r=>r.id!==id)},{...value,id},at).qiyamPrayers.at(-1);
    return {...copy(day),qiyamPrayers:rows.map(r=>r.id===id?{...edited,completedAt:old.completedAt}:r)};
  }
  function mergeChanges(base,local,remote){
    if(equal(base,local))return copy(remote);
    if(Array.isArray(base)&&Array.isArray(local)&&Array.isArray(remote)){
      const identified=base.concat(local,remote).every(v=>record(v)&&typeof v.id==='string');
      if(identified){
        const before=new Map(base.map(v=>[v.id,v])),after=new Map(local.map(v=>[v.id,v])),cloud=new Map(remote.map(v=>[v.id,v]));
        const deleted=new Set(base.filter(v=>!after.has(v.id)).map(v=>v.id));
        const order=[...new Set(local.map(v=>v.id).concat(remote.map(v=>v.id)))];
        return order.filter(id=>!deleted.has(id)).map(id=>after.has(id)?mergeChanges(before.get(id),after.get(id),cloud.get(id)):copy(cloud.get(id))).filter(Boolean);
      }
      if(base.length===local.length&&base.every(v=>!record(v))&&local.every(v=>!record(v))){
        const out=copy(remote);local.forEach((v,i)=>{if(!equal(v,base[i]))out[i]=copy(v);});return out;
      }
      return copy(local);
    }
    if(record(local)&&(!base||record(base))&&(!remote||record(remote))){
      const out=copy(remote)||{};
      new Set(Object.keys(base||{}).concat(Object.keys(local))).forEach(key=>{
        if((key==='witrSessions'||key==='qiyamPrayers')&&(Array.isArray(local[key])||Array.isArray(base?.[key]))){out[key]=qiyamMerge(base?.[key],local[key],remote?.[key]);return;}
        if(!Object.prototype.hasOwnProperty.call(local,key)){if(base&&Object.prototype.hasOwnProperty.call(base,key))delete out[key];return;}
        // A Friday reading session and its undo history form one state. Merging
        // their fields independently can combine completion with a partial range.
        if(key==='friday'&&record(local[key])){
          const friday=mergeChanges((base||{})[key],local[key],(remote||{})[key]);
          if(!equal(base?.friday?.kahf,local.friday.kahf)){
            if(Object.prototype.hasOwnProperty.call(local.friday,'kahf'))friday.kahf=copy(local.friday.kahf);
            else delete friday.kahf;
          }
          out[key]=friday;return;
        }
        if(key==='witr'&&(local[key]===null||Array.isArray(local[key]?.parts))){if(!equal(base?.[key],local[key])){if(!qiyamDraftEqual(base?.[key],local[key]))out[key]=copy(local[key]);else if(qiyamDraftEqual(base?.[key],remote?.[key]))out[key]=copy(local[key]);}return;}
        if(key==='prayers'){
          const values=[(base||{})[key],local[key],(remote||{})[key]];
          if(values.every(v=>Array.isArray(v)&&[5,6].includes(v.length)&&v.every(x=>[true,false,'','ontime','late','missed'].includes(x)))){
            const normalized=values.map(v=>(v.length===5?[v[0],false,...v.slice(1)]:v).map(x=>x===true?'ontime':x||false));
            out[key]=mergeChanges(...normalized);return;
          }
        }
        if(!equal((base||{})[key],local[key]))out[key]=mergeChanges((base||{})[key],local[key],(remote||{})[key]);
      });return out;
    }
    return copy(local);
  }
  // Three-way learning reconciliation. Conflicts are returned, never silently committed.
  function reconcileLearning(base,local,remote){
    const merged=copy(remote||{}), conflicts=[], equal=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
    const fields=row=>Object.keys(row||{}).filter(k=>!['id','createdAt','updatedAt'].includes(k));
    const same=(a,b)=>[...new Set([...fields(a),...fields(b)])].every(k=>equal(a?.[k],b?.[k]));
    for(const key of ['schedule','preparations','courses','professionalReading','calendarOccurrences','subjects','activity','academicYears','terms']){
      const maps=[base,local,remote].map(d=>new Map((d?.[key]||[]).map(r=>[r.id,r]))), ids=[...new Set([...maps[1].keys(),...maps[2].keys()])].sort();
      merged[key]=ids.map(id=>{
        const [b,l,r]=maps.map(m=>m.get(id));
        if(!l||!r)return copy(l||r);
        if(key==='calendarOccurrences'){
          if(same(l,r))return copy({...r,updatedAt:Math.max(l.updatedAt||0,r.updatedAt||0)});
          if(b&&same(b,l))return copy(r);if(b&&same(b,r))return copy(l);
          let clash=!b;
          if(b){
            if(!!l.binding!==!!r.binding)clash=true;
            for(const k of ['binding','sourceBase','outcome'])if(!equal(l[k],b[k])&&!equal(r[k],b[k])&&!equal(l[k],r[k]))clash=true;
            const groups=[['dueDate','dueTime','endTime','allDay'],['text'],['location'],['notes'],['link'],['reminders'],['cancelled']];
            for(const g of groups)if(g.some(k=>!equal(l.value?.[k],b.value?.[k]))&&g.some(k=>!equal(r.value?.[k],b.value?.[k]))&&g.some(k=>!equal(l.value?.[k],r.value?.[k])))clash=true;
          }
          if(clash){conflicts.push({key,id,fields:['*'],local:copy(l),remote:copy(r)});return copy(l);}
          const result=mergeChanges(b,l,r);result.updatedAt=Math.max(l.updatedAt||0,r.updatedAt||0);return result;
        }
        const out=copy(r), conflict=[];
        if(same(l,r))return copy({...r,updatedAt:Math.max(l.updatedAt||0,r.updatedAt||0)});
        if(!b||((!!l.deletedAt!==!!r.deletedAt)&&!same(b,l)&&!same(b,r)))conflict.push('*');
        else if(same(b,l))return copy(r);
        else if(same(b,r))return copy(l);
        else {
          const groups=key==='schedule'?[['day','startTime','endTime','recurrence','date','termStart','termEnd','excludedDates','futureChanges']]:key==='academicYears'?[['startDate','endDate']]:key==='terms'?[['yearId','startDate','endDate','excludedDates']]:[];
          const grouped=new Set(groups.flat());
          [...new Set([...fields(l),...fields(r)])].filter(k=>!grouped.has(k)).forEach(k=>groups.push([k]));
          for(const group of groups){
            const lc=group.some(k=>!equal(l[k],b[k])),rc=group.some(k=>!equal(r[k],b[k]));
            if(lc&&rc&&group.some(k=>!equal(l[k],r[k])))conflict.push(...group);
            else if(lc)for(const k of group){if(l[k]===undefined)delete out[k];else out[k]=copy(l[k]);}
          }
        }
        out.updatedAt=Math.max(l.updatedAt||0,r.updatedAt||0);
        if(conflict.length)conflicts.push({key,id,fields:conflict,local:copy(l),remote:copy(r)});
        return out;
      });
    }
    const academic=typeof module==='object'&&module.exports?require('./learning-core'):globalThis.MufLearningCore;
    if(academic&&!academic.validateAcademic(merged).valid&&academic.validateAcademic(local||{}).valid&&academic.validateAcademic(remote||{}).valid){
      const keys=['academicYears','terms','subjects'],bundle=d=>Object.fromEntries(keys.map(k=>[k,copy(d?.[k]||[])]));
      for(let i=conflicts.length-1;i>=0;i--)if(keys.includes(conflicts[i].key))conflicts.splice(i,1);
      conflicts.push({key:'academicYears',id:'academic-structure',academicGroup:true,fields:['academicYears','terms','subjects'],local:{name:'الهيكل الدراسي',...bundle(local)},remote:{name:'الهيكل الدراسي',...bundle(remote)}});
      Object.assign(merged,bundle(local));
    }
    merged.updatedAt=Math.max(local?.updatedAt||0,remote?.updatedAt||0);
    return {merged,conflicts};
  }
  return {openDurableStorage,openAccountStorageAsync,openBackupVault,storageKeys,storageReport,cleanStorageCaches,openAccountStorage,mergeChanges,reconcileLearning,qiyamRows,qiyamActive,qiyamMerge,qiyamNight,qiyamSlice,qiyamRead,qiyamUndo,qiyamPray,qiyamEditPrayer,qiyamStable,qiyamSignature};
});
