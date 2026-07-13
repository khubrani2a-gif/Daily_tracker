function __loadChromium(){const c=[process.env.PW_PATH,"playwright","/opt/node22/lib/node_modules/playwright"].filter(Boolean);for(const x of c){try{return require(x).chromium;}catch(e){}}console.error("Playwright not found. Set PW_PATH=/path/to/playwright");process.exit(2);}
const { chromium } = { chromium: __loadChromium() };
const path=require("path");
const fileUrl = "file://" + path.resolve(__dirname, "..", "index.html");
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
const store={}; let REJECT=null; // path substring to reject (simulate one module failing)
const FAKE = `
window.firebase = (function(){
  const mkRef=(p)=>({ collection:(c)=>mkColl(p+"/"+c),
    set:(o)=> window.__rSet(p, JSON.stringify(o)).then(()=>{}),
    get:(opts)=> window.__rReject(p).then(bad=>{ if(bad) throw new Error("simulated fail "+p); return window.__rGet(p).then(j=>({exists:j!=null, data:()=> j?JSON.parse(j):null, metadata:{fromCache:false} })); }) });
  const snapList=(p)=> window.__rReject(p).then(bad=>{ if(bad) throw new Error("simulated fail "+p);
    return window.__rColl(p).then(arr=>({ forEach:(cb)=> (arr||[]).forEach(x=> cb({ id:x.id, data:()=>x })), empty:!(arr&&arr.length), size:(arr?arr.length:0), metadata:{fromCache:false} })); });
  const mkColl=(p)=>({ doc:(d)=>mkRef(p+"/"+d), get:(opts)=> snapList(p), where:()=>({ get:()=> snapList(p), where:function(){return this;} }) });
  const fs=function(){ return { settings:undefined, enablePersistence:()=>({catch:()=>{}}), collection:(c)=>mkColl(c) }; };
  const auth=function(){ return { onAuthStateChanged:(cb)=>{ setTimeout(()=>cb({uid:"U1",displayName:"T",email:"t@t"}),10); }, signOut:()=>Promise.resolve(), signInWithPopup:()=>Promise.resolve() }; };
  auth.GoogleAuthProvider=function(){};
  return { initializeApp:()=>({}), firestore:fs, auth:auth };
})();
window.firebase.__MFKR_FAKE__ = true;   /* علامة صريحة: يجب أن تبقى الحقيقية غير مُحمَّلة */
`;
let PASS=0,FAIL=0; const ok=(n,c)=>{ if(c){PASS++;console.log("  ✓ "+n);}else{FAIL++;console.log("  ✗ FAIL: "+n);} };
const errs=[];
/* هرمِتيّة: نمنع سكربتات Firebase من الشبكة (gstatic) كي لا تستبدل البديل المحقون بعد التحميل */
async function blockFirebaseCDN(page){ await page.route("https://www.gstatic.com/firebasejs/**", r=> r.abort()); }
async function verifyFake(page, label){ const active = await page.evaluate(()=> !!(window.firebase && window.firebase.__MFKR_FAKE__===true)); ok("fake Firebase authoritative after load ("+label+")", active); return active; }
async function device(b){ const ctx=await b.newContext({viewport:{width:1000,height:900}}); const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message.split("\n")[0]));
  await blockFirebaseCDN(p);   // must run before goto so real Firebase never loads
  await p.exposeBinding("__rGet",(s,path)=> (store[path]!=null?store[path]:null));
  await p.exposeBinding("__rSet",(s,path,json)=>{ store[path]=json; return true; });
  await p.exposeBinding("__rColl",(s,path)=>{ const out=[]; Object.keys(store).forEach(k=>{ if(k.indexOf(path+"/")===0){ try{ out.push(JSON.parse(store[k])); }catch(e){} } }); return out; });
  await p.exposeBinding("__rReject",(s,path)=> (REJECT && path.indexOf(REJECT)>=0));
  await p.addInitScript(FAKE); return p; }
const dayKey="users/U1/days/"+today();
(async()=>{
  const b=await chromium.launch();

  console.log("A. Cross-device DAILY (prayer) pulls on foreground via coordinator (server-first)");
  // pre-seed remote day doc (simulating device A push)
  store[dayKey]=JSON.stringify({date:today(),prayers:[true,false,false,false,false],worship:{},water:0,intention:"",tasks:[],priorities:[],memory:"",notes:"",rating:0,updatedAt:Date.now()+50000});
  store["users/U1/meta/quran"]=JSON.stringify({page:123,target:5,dayAnchor:today(),startPage:123,updatedAt:Date.now()+50000});
  let B=await device(b); await B.goto(fileUrl); await B.waitForTimeout(900); await verifyFake(B,"A");
  let bday=await B.evaluate((k)=>JSON.parse(localStorage.getItem(k)), "h2do-tracker:"+today());
  ok("B hydrated prayer[0]=true from remote day doc on auth", bday && bday.prayers && bday.prayers[0]===true);
  let bq=await B.evaluate(()=>JSON.parse(localStorage.getItem("h2do-quran")));
  ok("B hydrated Quran page=123 on auth", bq && bq.page===123);
  // Now simulate A changing prayer[1] with newer updatedAt, then FOREGROUND B
  store[dayKey]=JSON.stringify({date:today(),prayers:[true,true,false,false,false],worship:{},water:0,intention:"",tasks:[],priorities:[],memory:"",notes:"",rating:0,updatedAt:Date.now()+90000});
  await B.waitForTimeout(1600); // clear global throttle
  await B.evaluate(()=>document.dispatchEvent(new Event("visibilitychange")));
  await B.waitForTimeout(900);
  bday=await B.evaluate((k)=>JSON.parse(localStorage.getItem(k)), "h2do-tracker:"+today());
  ok("B pulled updated prayer[1]=true on FOREGROUND (no reload)", bday && bday.prayers[1]===true);
  // Quran update on foreground
  store["users/U1/meta/quran"]=JSON.stringify({page:200,target:5,dayAnchor:today(),startPage:200,updatedAt:Date.now()+99000});
  await B.waitForTimeout(1600);
  await B.evaluate(()=>window.dispatchEvent(new Event("focus")));
  await B.waitForTimeout(800);
  bq=await B.evaluate(()=>JSON.parse(localStorage.getItem("h2do-quran")));
  ok("B pulled updated Quran page=200 on focus", bq && bq.page===200);
  await B.close();

  console.log("B. CONTAINMENT: malformed Expenses data does NOT stop daily/quran sync");
  const B2=await device(b);
  await B2.addInitScript(()=>{ localStorage.setItem("h2do-expenses", JSON.stringify({version:2, categories:[null], transactions:[null], fixedTemplates:[null]})); });
  await B2.goto(fileUrl); await B2.waitForTimeout(900); await verifyFake(B2,"B");
  const dp=await B2.$eval("#datePicker",e=>e.value).catch(()=>"");
  ok("startup completed despite malformed expenses (datePicker set)", dp===today());
  const b2day=await B2.evaluate((k)=>JSON.parse(localStorage.getItem(k)), "h2do-tracker:"+today());
  ok("daily still hydrated from remote (prayer[0]=true)", b2day && b2day.prayers && b2day.prayers[0]===true);
  const b2q=await B2.evaluate(()=>JSON.parse(localStorage.getItem("h2do-quran")));
  ok("quran still hydrated (page present)", b2q && typeof b2q.page==="number");
  ok("no uncaught page errors", errs.length===0);
  // diagnostics captured the expenses issue (if any) without crashing
  const diag=await B2.evaluate(()=>window.__mfkrDiag? window.__mfkrDiag():null);
  ok("diagnostics available (no global halt)", diag && Array.isArray(diag.marks));
  await B2.close();

  console.log("C. One module FAILS, others still succeed (Promise.allSettled isolation)");
  REJECT="meta/witr";  // witr pull will reject
  store[dayKey]=JSON.stringify({date:today(),prayers:[true,true,true,false,false],worship:{},water:0,tasks:[],priorities:[],updatedAt:Date.now()+120000});
  const B3=await device(b); await B3.goto(fileUrl); await B3.waitForTimeout(1000); await verifyFake(B3,"C");
  const b3day=await B3.evaluate((k)=>JSON.parse(localStorage.getItem(k)), "h2do-tracker:"+today());
  ok("daily synced even though witr module failed", b3day && b3day.prayers[2]===true);
  const b3q=await B3.evaluate(()=>JSON.parse(localStorage.getItem("h2do-quran")));
  ok("quran synced even though witr failed", b3q && b3q.page===200);
  REJECT=null;
  await B3.close();

  console.log("D. Global manual sync 'مزامنة جميع البيانات' works + per-module status");
  const B4=await device(b); await B4.goto(fileUrl); await B4.waitForTimeout(800); await verifyFake(B4,"D");
  await B4.click("#expOpenBtn"); await B4.waitForTimeout(300);
  await B4.click('.exp-tab[data-view="settings"]'); await B4.waitForTimeout(300);
  ok("global sync button present", !!(await B4.$("#expGlobalSyncBtn")));
  ok("per-module status list present", (await B4.$$("#expModStatus .exp-foot-row")).length===6);
  store[dayKey]=JSON.stringify({date:today(),prayers:[true,true,true,true,false],worship:{},water:0,tasks:[],priorities:[],updatedAt:Date.now()+150000});
  await B4.click("#expGlobalSyncBtn"); await B4.waitForTimeout(1000);
  const gst=await B4.$eval("#expGlobalSyncText",e=>e.textContent).catch(()=>"");
  ok("global sync shows a result state", /مزامنة/.test(gst));
  const b4day=await B4.evaluate((k)=>JSON.parse(localStorage.getItem(k)), "h2do-tracker:"+today());
  ok("manual global sync pulled daily update (prayer[3]=true)", b4day && b4day.prayers[3]===true);
  await B4.close();

  console.log("\nRESULT: "+PASS+" passed, "+FAIL+" failed");
  console.log("PAGE JS ERRORS:", errs.length? [...new Set(errs)] : "none");
  await b.close();
  process.exit(FAIL>0?1:0);
})();
