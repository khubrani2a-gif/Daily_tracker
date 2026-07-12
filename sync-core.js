(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  else root.MufSyncCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  const VALID = new Set(["success","cacheFallback","failed","skipped","throttled"]);

  function createCoordinator(options){
    options = options || {};
    const names = (options.moduleNames || []).slice();
    const now = options.now || Date.now;
    const debounceMs = options.debounceMs == null ? 350 : options.debounceMs;
    const throttleMs = options.throttleMs == null ? 1000 : options.throttleMs;
    const states = {};
    names.forEach(name=> states[name] = {
      inFlight:new Map(), lastPullAt:0, lastSuccessAt:0, lastServerSuccessAt:0,
      lastCacheFallbackAt:0, lastAttemptAt:0, lastError:null, lastTrigger:null, lastResult:null
    });
    let debounceTimer = null, debouncePromise = null, debounceResolve = null, pendingTrigger = null;

    function result(module, status, extra){
      return Object.assign({module, status, changed:false}, extra || {});
    }

    function runModule(module, key, trigger, runOptions, worker){
      const st = states[module];
      if(!st) return Promise.resolve(result(module,"failed",{error:new Error("Unknown sync module: "+module)}));
      key = key || "default"; runOptions = runOptions || {};
      if(st.inFlight.has(key)) return Promise.resolve(result(module,"throttled",{reason:"inFlight"}));
      const ts = now();
      if(!runOptions.bypassThrottle && st.lastPullAt && ts-st.lastPullAt < throttleMs){
        return Promise.resolve(result(module,"throttled",{reason:"recent"}));
      }
      st.lastPullAt=ts; st.lastAttemptAt=ts; st.lastTrigger=trigger || "unknown"; st.lastError=null;
      const task = Promise.resolve().then(worker).then(raw=>{
        raw = raw || {}; const status = VALID.has(raw.status) ? raw.status : "success";
        const out = result(module,status,raw);
        if(status === "success"){
          st.lastSuccessAt=now();
          if(raw.source === "server") st.lastServerSuccessAt=st.lastSuccessAt;
        }else if(status === "cacheFallback"){
          st.lastSuccessAt=now(); st.lastCacheFallbackAt=st.lastSuccessAt;
        }else if(status === "failed") st.lastError=raw.error || new Error(module+" pull failed");
        st.lastResult=out; return out;
      }).catch(error=>{
        st.lastError=error; const out=result(module,"failed",{error}); st.lastResult=out; return out;
      }).finally(()=> st.inFlight.delete(key));
      st.inFlight.set(key,task);
      return task;
    }

    function summarize(results){
      const counts={success:0,cacheFallback:0,failed:0,skipped:0,throttled:0};
      results.forEach(r=>{ if(r && counts[r.status] !== undefined) counts[r.status]++; else counts.failed++; });
      let status;
      if(counts.failed === results.length) status="failed";
      else if(counts.failed>0) status="partial";
      else if(counts.success===results.length) status="success";
      else if(counts.cacheFallback>0 && counts.cacheFallback+counts.success===results.length) status="cacheFallback";
      else if(counts.success>0 || counts.cacheFallback>0) status="partial";
      else status="skipped";
      return {status,counts,results};
    }

    async function syncAll(trigger, syncOptions, pullers){
      const settled = await Promise.allSettled(names.map(name=> Promise.resolve().then(()=> pullers[name](syncOptions || {}))));
      const results = settled.map((entry,i)=> entry.status === "fulfilled"
        ? entry.value
        : result(names[i],"failed",{error:entry.reason}));
      return summarize(results);
    }

    function triggerDebounced(trigger, callback){
      pendingTrigger=trigger;
      if(debounceTimer) clearTimeout(debounceTimer);
      if(!debouncePromise) debouncePromise=new Promise(resolve=>{ debounceResolve=resolve; });
      debounceTimer=setTimeout(async()=>{
        const resolve=debounceResolve, activeTrigger=pendingTrigger;
        debounceTimer=null; debouncePromise=null; debounceResolve=null; pendingTrigger=null;
        let value;
        try{ value=await callback(activeTrigger); }catch(error){ value={status:"failed",error}; }
        resolve(value);
      },debounceMs);
      return debouncePromise;
    }

    return {states,runModule,syncAll,summarize,triggerDebounced};
  }

  return {createCoordinator};
});
