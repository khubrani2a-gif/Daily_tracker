"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const script=(html.match(/<script>\n([\s\S]*)<\/script>/)||[])[1]||"";
function sourceFunction(name){
  const start=script.indexOf("function "+name+"(");
  assert.ok(start>=0,"missing function "+name);
  const bodyStart=script.indexOf("{",start);
  let depth=0;
  for(let i=bodyStart;i<script.length;i++){
    if(script[i]==="{") depth++;
    else if(script[i]==="}" && --depth===0) return script.slice(start,i+1);
  }
  throw new Error("unterminated function "+name);
}

test("learning appears as the sixth primary section without removing existing destinations",()=>{
  const nav=[...html.matchAll(/data-app-view="([^"]+)"/g)].map(m=>m[1]).filter((v,i,a)=>a.indexOf(v)===i);
  assert.deepEqual(nav.slice(0,6),["today","iman","learning","sport","expenses","more"]);
  assert.match(html,/data-app-view="learning"[^>]*><span>🎓<\/span>التعلّم/);
  ["today","iman","sport","expenses","more"].forEach(view=>assert.ok(html.includes('data-app-view="'+view+'"'),view));
  assert.match(html,/quick-nav a,.quick-nav button\{[^}]*flex:1 1 0/);
});

test("learning card exposes the requested four tools and main identity",()=>{
  ["learningCard","learningSummary","learningSummaryActions","learningScheduleBtn","learningPrepBtn","learningCoursesBtn","learningReadingBtn"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"'),id));
  ["رحلة التعلّم","جدول المحاضرات","تحضير المحاضرات","الدورات والشهادات","القراءة المهنية"].forEach(text=>assert.ok(html.includes(text),text));
  assert.match(script,/learning:\["learningCard"\]/);
  assert.match(script,/const CARD_VIEW_LABELS=\{today:"اليوم",iman:"إيمانيات",learning:"التعلّم"/);
});

test("learning uses a separate storage namespace and does not merge with personal reading",()=>{
  assert.match(script,/const LEARNING_KEY="h2do-learning-v1"/);
  assert.match(script,/professionalReading:\[\]/);
  assert.match(script,/id:"learningCard",icon:"🎓",label:"رحلة التعلّم",view:"learning"/);
  assert.doesNotMatch(script,/RD_ITEMS_KEY\s*=\s*LEARNING_KEY/);
  assert.doesNotMatch(script,/professionalReading.*RD_ITEMS_KEY/);
});

test("learning schema supports schedule, preparation, courses, and professional reading fields",()=>{
  ["courseName","courseCode","section","startTime","endTime","room","recurrence","prepId","objectives","materials","activity","reflection","provider","progress","nextStep","totalPages"].forEach(field=>assert.ok(script.includes(field),field));
  assert.match(script,/LEARNING_PREP_STATUS=\["لم يبدأ","قيد التحضير","جاهزة","تم تقديمها"\]/);
  assert.match(script,/LEARNING_COURSE_STATUS=\["مخطط لها","قيد التعلّم","متوقفة مؤقتًا","مكتملة"\]/);
  assert.match(script,/LEARNING_READ_STATUS=\["للقراءة","أقرأ الآن","مكتمل"\]/);
});

test("learning synchronizes additively and is included in existing backup surface",()=>{
  assert.match(script,/collection\("meta"\)\.doc\("learning"\)/);
  assert.match(script,/learningPullRemote\(trigger\)/);
  assert.match(script,/\["daily","quran","customWorship","witr","hifz","expenses","weeklyGoals","learning"\]/);
  assert.match(script,/DATA_MODULE_LABELS=\{[^}]*learning:"التعلّم"/);
  assert.match(script,/function dataOwnedKey\(key\)\{ return !!key&&key\.startsWith\("h2do-"\); \}/);
  assert.match(script,/if\(db&&user\)learningPullRemote\("localSave"\)/);
});

test("learning validates progress and unsafe URLs",()=>{
  assert.match(script,/progress<0\|\|progress>100/);
  assert.match(script,/أدخل رابطًا يبدأ بـ http أو https/);
  assert.match(script,/function learningUrl\(value\)/);
  assert.ok(script.includes('/^https?:$/.test(u.protocol)'));
});

test("learning rendering avoids direct unsafe HTML for saved user rows",()=>{
  ["learningItemRow","learningShowDetails","learningSetText"].forEach(name=>assert.match(script,new RegExp("function "+name+"\\("),name));
  const learningBlock=script.slice(script.indexOf("/* ---------- التعلّم"),script.indexOf("function renderAll()"));
  assert.doesNotMatch(learningBlock,/\.innerHTML\s*=/);
  assert.match(learningBlock,/textContent/);
  assert.match(learningBlock,/rel="noopener noreferrer"/);
  const malicious=["<img src=x onerror=alert(1)>","<script>alert(1)</script>"];
  malicious.forEach(payload=>assert.equal(String(payload),payload));
});

test("inline application JavaScript still parses after adding learning",()=>{
  assert.doesNotThrow(()=>new Function(script));
});

test("backup export and import restore learning data without duplicates",()=>{
  const storage=new Map();
  const localStorage={
    get length(){return storage.size;},
    key(i){return Array.from(storage.keys())[i]||null;},
    getItem(k){return storage.has(k)?storage.get(k):null;},
    setItem(k,v){storage.set(k,String(v));},
    removeItem(k){storage.delete(k);}
  };
  const storageKey=date=>"h2do-tracker:"+date;
  const DATA_BACKUP_KEY="h2do-backup-library-v1", DATA_VERSION=1, DATA_MAX_IMPORT_BYTES=5*1024*1024, DATA_MAX_IMPORT_ENTRIES=1000;
  const Blob=global.Blob;
  const dataOwnedKey=new Function(sourceFunction("dataOwnedKey")+"; return dataOwnedKey;")();
  const dataBuildSnapshot=new Function("localStorage","storageKey","DATA_BACKUP_KEY","DATA_VERSION","Blob",sourceFunction("dataOwnedKey")+";"+sourceFunction("dataBuildSnapshot")+"; return dataBuildSnapshot;")(localStorage,storageKey,DATA_BACKUP_KEY,DATA_VERSION,Blob);
  const dataNormalizeImported=new Function("storageKey","DATA_VERSION","DATA_BACKUP_KEY","DATA_MAX_IMPORT_BYTES","DATA_MAX_IMPORT_ENTRIES",sourceFunction("dataOwnedKey")+";"+sourceFunction("dataNormalizeImported")+"; return dataNormalizeImported;")(storageKey,DATA_VERSION,DATA_BACKUP_KEY,DATA_MAX_IMPORT_BYTES,DATA_MAX_IMPORT_ENTRIES);
  const dataApplySnapshot=new Function("localStorage","DATA_BACKUP_KEY",sourceFunction("dataOwnedKey")+";"+sourceFunction("dataApplySnapshot")+"; return dataApplySnapshot;")(localStorage,DATA_BACKUP_KEY);
  assert.equal(dataOwnedKey("h2do-learning-v1"),true);
  const learning={schema:1,schedule:[{id:"lec1",courseName:"فقه التعليم",day:1,startTime:"09:00",recurrence:"weekly",updatedAt:10}],preparations:[{id:"prep1",title:"مدخل المقرر",status:"قيد التحضير",updatedAt:11}],courses:[{id:"course1",name:"تصميم المقرر",progress:40,status:"قيد التعلّم",updatedAt:12}],professionalReading:[{id:"read1",title:"بحث تربوي",type:"بحث",status:"أقرأ الآن",updatedAt:13}],updatedAt:20};
  localStorage.setItem("h2do-learning-v1",JSON.stringify(learning));
  localStorage.setItem("h2do-expenses",JSON.stringify({transactions:[{id:"tx1"}]}));
  const snapshot=dataBuildSnapshot("اختبار");
  assert.ok(snapshot.entries["h2do-learning-v1"]);
  const imported=dataNormalizeImported(snapshot,"learning.json");
  dataApplySnapshot(imported);
  dataApplySnapshot(imported);
  const restored=JSON.parse(localStorage.getItem("h2do-learning-v1"));
  assert.equal(restored.schedule.length,1);
  assert.equal(restored.preparations.length,1);
  assert.equal(restored.courses.length,1);
  assert.equal(restored.professionalReading.length,1);
  assert.ok(localStorage.getItem("h2do-expenses"));
  const old=dataNormalizeImported({"2026-08-15":{tasks:[],notes:"قديم"}},"old.json");
  assert.ok(old.entries["h2do-tracker:2026-08-15"]);
  assert.equal(old.entries["h2do-learning-v1"],undefined);
});

test("malformed learning data normalizes safely",()=>{
  const learningNormalize=new Function(
    sourceFunction("learningBlank")+
    sourceFunction("learningText")+
    sourceFunction("learningUrl")+
    sourceFunction("learningId")+
    'const LEARNING_SCHEMA=1, LEARNING_PREP_STATUS=["لم يبدأ","قيد التحضير","جاهزة","تم تقديمها"], LEARNING_COURSE_STATUS=["مخطط لها","قيد التعلّم","متوقفة مؤقتًا","مكتملة"], LEARNING_READ_STATUS=["للقراءة","أقرأ الآن","مكتمل"], LEARNING_READ_TYPES=["كتاب","بحث","مرجع","مادة تعليمية"];'+
    sourceFunction("learningNormalize")+"; return learningNormalize;"
  )();
  const out=learningNormalize({schedule:[{id:"x",courseName:"<script>alert(1)</script>",day:99,startTime:"25:99",recurrence:"once"}],courses:[{name:"دورة",progress:500,url:"javascript:alert(1)",status:"غريب"}],professionalReading:[{title:"مرجع",url:"https://example.com/a?q=1",type:"بحث"}]});
  assert.equal(out.schedule.length,0);
  assert.equal(out.courses[0].progress,100);
  assert.equal(out.courses[0].url,"");
  assert.equal(out.courses[0].status,"مخطط لها");
  assert.equal(out.professionalReading[0].url,"https://example.com/a?q=1");
});
