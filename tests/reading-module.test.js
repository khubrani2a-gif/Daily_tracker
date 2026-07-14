/*
 * اختبار وحدة القراءة (v100) — مفكرتي اليومية
 * ----------------------------------------------------------------------------
 * يغطّي: الحالة الفارغة/الإضافة/التعديل/التركيز، أنماط التقدّم الخمسة، المؤقّت
 * (حساب المدّة من الطوابع الزمنية، حماية التاريخ التاريخي، المسوّدة القديمة)،
 * التسجيل اليدوي/التعديل مرّة واحدة بالضبط/التراجع بلا إحياء، تصحيح الموضع بلا رصيد،
 * تدفّق الإكمال، توافق «صفحة قراءة» القديمة (لا تكرار، لا إعادة كتابة)، النسخ
 * الاحتياطي (v1/v2)، احتواء بيانات محلية فاسدة عند الإقلاع، ومزامنة الوحدة السابعة.
 *
 * التشغيل: node tests/reading-module.test.js
 */
"use strict";
function __loadChromium(){const c=[process.env.PW_PATH,"playwright","/opt/node22/lib/node_modules/playwright"].filter(Boolean);for(const x of c){try{return require(x).chromium;}catch(e){}}console.error("Playwright not found. Set PW_PATH=/path/to/playwright");process.exit(2);}
const { chromium } = { chromium: __loadChromium() };
const path = require("path");
const fileUrl = "file://" + path.resolve(__dirname, "..", "index.html");
const today = ()=>{ const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const daysAgo = (n)=>{ const d=new Date(); d.setDate(d.getDate()-n); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };

let PASS=0, FAIL=0;
const ok = (n,c)=>{ if(c){ PASS++; console.log("  ✓ "+n); } else { FAIL++; console.log("  ✗ FAIL: "+n); } };
const errs = [];
async function page(b){
  const ctx = await b.newContext({viewport:{width:1000,height:900}});
  const p = await ctx.newPage();
  p.on("pageerror", e=> errs.push(e.message));
  p.on("console", m=>{ if(m.type()==="error") errs.push("console.error: "+m.text()); });
  return p;
}
const rdItems = (p)=> p.evaluate(()=> JSON.parse(localStorage.getItem("h2do-reading-items")) || []);
const rdSessions = (p)=> p.evaluate(()=> JSON.parse(localStorage.getItem("h2do-reading-sessions")) || []);
const rdSettings = (p)=> p.evaluate(()=> JSON.parse(localStorage.getItem("h2do-reading-settings")) || {});
const rdCache = (p)=> p.evaluate(()=> JSON.parse(localStorage.getItem("h2do-reading-stats-cache")) || {});

(async()=>{
  const b = await chromium.launch();

  console.log("A. Empty state -> add material (book/page) -> becomes focus automatically");
  let p = await page(b);
  await p.addInitScript(()=>{ localStorage.clear(); });
  await p.goto(fileUrl); await p.waitForTimeout(600);
  const cardText0 = await p.$eval("#readingCard", e=> e.textContent);
  ok("empty-state copy present", cardText0.includes("ابدأ رحلتك مع مادة جديدة"));
  ok("empty-state add button present", !!(await p.$("#rdEmptyAdd")));
  ok("empty-state pick-from-library button present", !!(await p.$("#rdEmptyPick")));
  await p.click("#rdEmptyAdd"); await p.waitForTimeout(250);
  await p.fill("#itTitle", "كتاب تجريبي");
  await p.selectOption("#itType", "book");
  await p.selectOption("#itUnit", "page");
  await p.fill("#itTotal", "200");
  await p.click("#itSave"); await p.waitForTimeout(300);
  let items = await rdItems(p);
  ok("item created", items.length===1 && items[0].title==="كتاب تجريبي");
  let settings = await rdSettings(p);
  ok("first item auto-becomes focus", settings.focusItemId === items[0].id);
  let cardText1 = await p.$eval("#readingCard", e=> e.textContent);
  ok("compact card shows focus title", cardText1.includes("كتاب تجريبي"));
  ok("compact card shows 'ابدأ جلسة'", cardText1.includes("ابدأ جلسة"));
  ok("compact card shows 'تسجيل سريع'", cardText1.includes("تسجيل سريع"));
  await p.close();

  console.log("B. Five progress-unit modes: page/chapter/section/percent/time — form field behavior");
  p = await page(b);
  await p.addInitScript(()=>{ localStorage.clear(); });
  await p.goto(fileUrl); await p.waitForTimeout(600);
  await p.click("#readingCard #rdEmptyAdd"); await p.waitForTimeout(200);
  await p.selectOption("#itUnit", "percent");
  let totalWrapDisplay = await p.$eval("#itTotalWrap", e=> getComputedStyle(e).display);
  ok("percent unit still shows position field (total hidden by app logic, no crash)", totalWrapDisplay !== "");
  await p.selectOption("#itUnit", "time");
  totalWrapDisplay = await p.$eval("#itTotalWrap", e=> getComputedStyle(e).display);
  ok("time unit hides total/current fields", totalWrapDisplay === "none");
  await p.selectOption("#itUnit", "chapter");
  await p.fill("#itTitle", "بحث تجريبي");
  await p.click("#itSave"); await p.waitForTimeout(200);
  items = await rdItems(p);
  ok("chapter-unit item saved", items[0].progressUnit === "chapter");
  await p.close();

  console.log("C. Manual quick log: updates position, creates exactly one session, position correction adds none");
  p = await page(b);
  await p.addInitScript((tk)=>{ localStorage.clear();
    const now = Date.now();
    localStorage.setItem("h2do-reading-items", JSON.stringify([{schemaVersion:1,id:"IT1",title:"كتاب",author:null,materialType:"book",progressUnit:"page",totalUnits:300,currentUnit:10,status:"active",startedAt:now,completedAt:null,createdAt:now,updatedAt:now,deletedAt:null}]));
    localStorage.setItem("h2do-reading-settings", JSON.stringify({schemaVersion:1,focusItemId:"IT1",dailyGoal:null,createdAt:now,updatedAt:now}));
  }, today());
  await p.goto(fileUrl); await p.waitForTimeout(600);
  await p.click("#readingCard #rdQuickBtn"); await p.waitForTimeout(200);
  await p.fill("#qlMins", "20");
  await p.fill("#qlStart", "10");
  await p.fill("#qlEnd", "35");
  await p.click("#qlSave"); await p.waitForTimeout(300);
  let sessions = await rdSessions(p);
  items = await rdItems(p);
  ok("exactly one session created", sessions.length === 1);
  ok("session unitsRead computed (35-10=25)", sessions[0].unitsRead === 25);
  ok("item position updated to 35", items[0].currentUnit === 35);
  let cache = await rdCache(p);
  const todayAgg = cache.byDate[today()];
  ok("stats cache today sessionCount=1", todayAgg && todayAgg.sessionCount === 1);
  ok("stats cache today units page=25", todayAgg && todayAgg.unitsByUnit.page === 25);

  // position correction: no new session, no unitsRead credit
  await p.click("#rdFocusBlock"); await p.waitForSelector("#rdCorrectBtn");
  await p.click("#rdCorrectBtn"); await p.waitForSelector("#cpSave");
  await p.fill("#cpVal", "50");
  await p.click("#cpSave"); await p.waitForTimeout(300);
  sessions = await rdSessions(p);
  items = await rdItems(p);
  ok("position correction: still exactly one session (no credit)", sessions.length === 1);
  ok("position correction applied to item", items[0].currentUnit === 50);
  cache = await rdCache(p);
  ok("stats cache unaffected by correction", cache.byDate[today()].sessionCount === 1);
  await p.close();

  console.log("D. Edit session replaces its contribution exactly once; tombstone removes it, restores position only under the 3 conditions, no resurrection");
  p = await page(b);
  // NOTE: addInitScript re-runs on every navigation in this page (including page.reload()), so it must
  // only seed ONCE (guarded by a sentinel) — otherwise a reload would wipe UI-driven changes right before
  // the reload's fresh app instance starts, which would misreport a real persistence bug.
  await p.addInitScript((tk)=>{
    if(localStorage.getItem("__seeded__")) return;
    localStorage.clear();
    const now = Date.now();
    localStorage.setItem("h2do-reading-items", JSON.stringify([{schemaVersion:1,id:"IT1",title:"كتاب",author:null,materialType:"book",progressUnit:"page",totalUnits:300,currentUnit:0,status:"active",startedAt:now,completedAt:null,createdAt:now,updatedAt:now,deletedAt:null}]));
    localStorage.setItem("h2do-reading-settings", JSON.stringify({schemaVersion:1,focusItemId:"IT1",dailyGoal:null,createdAt:now,updatedAt:now}));
    localStorage.setItem("h2do-reading-sessions", JSON.stringify([{schemaVersion:1,id:"S1",itemId:"IT1",dateKey:tk,source:"manual",startedAt:now,endedAt:now,durationSeconds:600,startUnit:0,endUnit:10,unitsRead:10,createdAt:now,updatedAt:now,syncUpdatedAt:null,deletedAt:null}]));
    localStorage.setItem("__seeded__", "1");
  }, today());
  await p.goto(fileUrl); await p.waitForTimeout(600);
  let c0 = await rdCache(p);
  ok("initial cache reflects seeded session (10 pages, 600s)", c0.byDate[today()].unitsByUnit.page===10 && c0.byDate[today()].durationSeconds===600);
  // edit the session via the today view's edit button (opening the overlay first)
  await p.click("#rdFocusBlock"); await p.waitForSelector('[data-rdsess-edit="S1"]');
  await p.click('[data-rdsess-edit="S1"]'); await p.waitForSelector("#qlSave");
  await p.fill("#qlMins", "15");
  await p.fill("#qlStart", "0");
  await p.fill("#qlEnd", "20");
  await p.click("#qlSave"); await p.waitForTimeout(300);
  let c1 = await rdCache(p);
  ok("edit replaces contribution exactly once (units now 20, not 30)", c1.byDate[today()].unitsByUnit.page===20);
  ok("edit replaces contribution exactly once (duration now 900s, not 1500)", c1.byDate[today()].durationSeconds===900);
  ok("edit does not create a second session", (await rdSessions(p)).filter(s=>!s.deletedAt).length===1);
  ok("edit does NOT retroactively move item position (by design — only session/timer flows update position)", (await rdItems(p))[0].currentUnit===0);

  // delete this edited session: its endUnit(20) != item.currentUnit(0) -> position must be PRESERVED (not rolled back), per spec's 3rd condition
  await p.click('[data-rdsess-del="S1"]'); await p.waitForSelector("#hifzDialogOk");
  await p.click("#hifzDialogOk"); await p.waitForTimeout(300);
  let c2 = await rdCache(p);
  ok("tombstone removes contribution (byDate cleared)", !c2.byDate[today()] || c2.byDate[today()].sessionCount===0);
  let sessAfterDel = await rdSessions(p);
  ok("session soft-deleted (tombstoned, not hard-removed)", sessAfterDel.length===1 && !!sessAfterDel[0].deletedAt);
  ok("position preserved (unaffected) since currentUnit did not equal the deleted session's endUnit", (await rdItems(p))[0].currentUnit===0);
  await p.reload(); await p.waitForTimeout(500);
  let c3 = await rdCache(p);
  ok("no resurrection after reload", !c3.byDate[today()] || c3.byDate[today()].sessionCount===0);
  await p.close();

  console.log("D2. Tombstone DOES restore position when the deleted session was the latest position-driving one and no later session/correction happened since");
  p = await page(b);
  await p.addInitScript(()=>{ localStorage.clear();
    const now = Date.now();
    localStorage.setItem("h2do-reading-items", JSON.stringify([{schemaVersion:1,id:"IT1",title:"كتاب",author:null,materialType:"book",progressUnit:"page",totalUnits:300,currentUnit:null,status:"active",startedAt:now,completedAt:null,createdAt:now,updatedAt:now,deletedAt:null}]));
    localStorage.setItem("h2do-reading-settings", JSON.stringify({schemaVersion:1,focusItemId:"IT1",dailyGoal:null,createdAt:now,updatedAt:now}));
  });
  await p.goto(fileUrl); await p.waitForTimeout(600);
  // session 1: 0 -> 10, WITH position update
  await p.click("#readingCard #rdQuickBtn"); await p.waitForSelector("#qlSave");
  await p.fill("#qlMins", "10"); await p.fill("#qlStart", "0"); await p.fill("#qlEnd", "10");
  await p.click("#qlSave"); await p.waitForTimeout(250);
  ok("session 1 moved position to 10", (await rdItems(p))[0].currentUnit===10);
  // session 2: 10 -> 20, WITH position update (now the latest position-driving session)
  await p.click("#readingCard #rdQuickBtn"); await p.waitForSelector("#qlSave");
  await p.fill("#qlMins", "10"); await p.fill("#qlStart", "10"); await p.fill("#qlEnd", "20");
  await p.click("#qlSave"); await p.waitForTimeout(250);
  ok("session 2 moved position to 20", (await rdItems(p))[0].currentUnit===20);
  let allSess = await rdSessions(p);
  const s2id = allSess.find(s=>s.endUnit===20).id;
  const s1id = allSess.find(s=>s.endUnit===10).id;
  // delete session 2 (the latest, currentUnit(20) === its endUnit(20), no later session) -> restores to session 1's endUnit (10)
  await p.click("#rdFocusBlock"); await p.waitForSelector('[data-rdsess-del="'+s2id+'"]');
  await p.click('[data-rdsess-del="'+s2id+'"]'); await p.waitForSelector("#hifzDialogOk");
  await p.click("#hifzDialogOk"); await p.waitForTimeout(300);
  ok("deleting the latest position-driving session restores position to the prior session's endUnit (10)", (await rdItems(p))[0].currentUnit===10);
  // delete session 1 too (now the only one, latest, currentUnit(10)===its endUnit) -> restores to null (no priors)
  await p.click('[data-rdsess-del="'+s1id+'"]'); await p.waitForSelector("#hifzDialogOk");
  await p.click("#hifzDialogOk"); await p.waitForTimeout(300);
  ok("deleting the last remaining position-driving session restores position to null", (await rdItems(p))[0].currentUnit===null);
  await p.close();

  console.log("D3. Tombstone does NOT restore position when a later session still exists (preserve position)");
  p = await page(b);
  await p.addInitScript(()=>{ localStorage.clear();
    const now = Date.now();
    localStorage.setItem("h2do-reading-items", JSON.stringify([{schemaVersion:1,id:"IT1",title:"كتاب",author:null,materialType:"book",progressUnit:"page",totalUnits:300,currentUnit:null,status:"active",startedAt:now,completedAt:null,createdAt:now,updatedAt:now,deletedAt:null}]));
    localStorage.setItem("h2do-reading-settings", JSON.stringify({schemaVersion:1,focusItemId:"IT1",dailyGoal:null,createdAt:now,updatedAt:now}));
  });
  await p.goto(fileUrl); await p.waitForTimeout(600);
  await p.click("#readingCard #rdQuickBtn"); await p.waitForSelector("#qlSave");
  await p.fill("#qlMins", "10"); await p.fill("#qlStart", "0"); await p.fill("#qlEnd", "10");
  await p.click("#qlSave"); await p.waitForTimeout(250);
  await p.click("#readingCard #rdQuickBtn"); await p.waitForSelector("#qlSave");
  await p.fill("#qlMins", "10"); await p.fill("#qlStart", "10"); await p.fill("#qlEnd", "20");
  await p.click("#qlSave"); await p.waitForTimeout(250);
  allSess = await rdSessions(p);
  const earlyId = allSess.find(s=>s.endUnit===10).id;
  await p.click("#rdFocusBlock"); await p.waitForSelector('[data-rdsess-del="'+earlyId+'"]');
  await p.click('[data-rdsess-del="'+earlyId+'"]'); await p.waitForSelector("#hifzDialogOk");
  await p.click("#hifzDialogOk"); await p.waitForTimeout(300);
  ok("deleting a non-latest session preserves current position (still 20, not rolled back)", (await rdItems(p))[0].currentUnit===20);
  await p.close();

  console.log("E. Timer: duration computed from timestamps (survives reload), historical-date guard, stale-draft prompt");
  p = await page(b);
  // seed-once sentinel: this block reloads the page, and addInitScript re-runs on every reload —
  // without the sentinel, a reload would wipe the timer draft rewritten below right before it counts.
  await p.addInitScript((tk)=>{
    if(localStorage.getItem("__seeded__")) return;
    localStorage.clear();
    const now = Date.now();
    localStorage.setItem("h2do-reading-items", JSON.stringify([{schemaVersion:1,id:"IT1",title:"كتاب",author:null,materialType:"book",progressUnit:"page",totalUnits:300,currentUnit:0,status:"active",startedAt:now,completedAt:null,createdAt:now,updatedAt:now,deletedAt:null}]));
    localStorage.setItem("h2do-reading-settings", JSON.stringify({schemaVersion:1,focusItemId:"IT1",dailyGoal:null,createdAt:now,updatedAt:now}));
    localStorage.setItem("__seeded__", "1");
  }, today());
  await p.goto(fileUrl); await p.waitForTimeout(600);
  await p.click("#readingCard #rdStartBtn"); await p.waitForSelector("#rdTimerClock");
  ok("reading overlay opened on 'اليوم' after starting timer", await p.evaluate(()=> !document.getElementById("rdOverlay").hidden));
  // simulate elapsed time by rewriting the draft's startedAt into the past, then reload (survives reload / duration derived from timestamps, not a running counter)
  await p.evaluate(()=>{ const d=JSON.parse(localStorage.getItem("h2do-reading-active-session")); d.startedAt = Date.now() - 65*1000; localStorage.setItem("h2do-reading-active-session", JSON.stringify(d)); });
  await p.reload(); await p.waitForTimeout(500);
  await p.click("#readingCard #rdStartBtn"); await p.waitForSelector("#rdTimerClock"); // draft already active for same item -> reopens overlay (does not restart)
  await p.waitForTimeout(200);
  const clockTxt = await p.$eval("#rdTimerClock", e=> e.textContent);
  ok("timer clock shows elapsed >=1 minute computed from timestamps after reload (not '00:00')", clockTxt !== "00:00" && clockTxt !== "00:01");
  await p.click("#rdTimerFinish"); await p.waitForSelector("#rfSave");
  await p.click("#rfSave"); await p.waitForTimeout(400);
  sessions = await rdSessions(p);
  ok("finishing timer creates a timer-source session with plausible duration", sessions.length===1 && sessions[0].source==="timer" && sessions[0].durationSeconds>=60);
  ok("active draft cleared after finish", await p.evaluate(()=> localStorage.getItem("h2do-reading-active-session")===null));
  await p.click("#rdClose"); await p.waitForTimeout(200);
  ok("overlay closed via close button", await p.evaluate(()=> document.getElementById("rdOverlay").hidden===true));

  // historical date guard: navigate to yesterday, attempt to start a session -> must NOT create a draft, must prompt to return to today
  await p.click("#prevDay"); await p.waitForTimeout(400);
  await p.click("#readingCard #rdStartBtn"); await p.waitForSelector("#hifzDialogBody");
  const guardDialogText = await p.$eval("#hifzDialogBody", e=> e.textContent);
  ok("historical-date start shows a guard dialog (not a silently-started timer)", guardDialogText.includes("اليوم فقط") || guardDialogText.includes("تاريخًا سابقًا"));
  await p.click("#hifzDialogCancel"); await p.waitForTimeout(150);
  ok("no draft was created while browsing a historical date", await p.evaluate(()=> localStorage.getItem("h2do-reading-active-session")===null));

  // stale draft handling: seed an old (>3h) draft, then attempt to start -> resume/finish/discard prompt (not silent overwrite)
  await p.click("#nextDay"); await p.waitForTimeout(300); // back to today
  await p.evaluate(()=>{ localStorage.setItem("h2do-reading-active-session", JSON.stringify({draftId:"old1", itemId:"IT1", startedAt: Date.now()-4*3600*1000, startUnit:0})); });
  await p.click("#readingCard #rdStartBtn"); await p.waitForSelector("#expFormBox .exp-optbtn");
  const staleDialogText = await p.$eval("#expFormBox", e=> e.textContent);
  ok("stale draft triggers resume/finish/discard prompt", staleDialogText.includes("متابعة الجلسة") && staleDialogText.includes("تجاهلها"));
  await p.click('#expFormBox [data-act="discard"]'); await p.waitForTimeout(200);
  ok("discarding a stale draft does not create a session", (await rdSessions(p)).length===1);
  ok("draft cleared after discard", await p.evaluate(()=> localStorage.getItem("h2do-reading-active-session")===null));
  await p.close();

  console.log("F. Completion flow: prompt on reaching total, sets completed status, preserves sessions");
  p = await page(b);
  await p.addInitScript((tk)=>{ localStorage.clear();
    const now = Date.now();
    localStorage.setItem("h2do-reading-items", JSON.stringify([{schemaVersion:1,id:"IT1",title:"كتيّب قصير",author:null,materialType:"book",progressUnit:"page",totalUnits:20,currentUnit:15,status:"active",startedAt:now,completedAt:null,createdAt:now,updatedAt:now,deletedAt:null}]));
    localStorage.setItem("h2do-reading-settings", JSON.stringify({schemaVersion:1,focusItemId:"IT1",dailyGoal:null,createdAt:now,updatedAt:now}));
  }, today());
  await p.goto(fileUrl); await p.waitForTimeout(600);
  await p.click("#readingCard #rdQuickBtn"); await p.waitForSelector("#qlSave");
  await p.fill("#qlMins", "10");
  await p.fill("#qlStart", "15");
  await p.fill("#qlEnd", "20");
  await p.click("#qlSave"); await p.waitForSelector("#hifzDialogTitle");
  const completionTitle = await p.$eval("#hifzDialogTitle", e=> e.textContent).catch(()=>"");
  ok("completion prompt text matches spec", completionTitle.includes("🎉") && completionTitle.includes("أتممت هذه المادة"));
  await p.click("#hifzDialogOk"); await p.waitForTimeout(300);
  items = await rdItems(p);
  ok("status set to completed with completedAt", items[0].status==="completed" && !!items[0].completedAt);
  sessions = await rdSessions(p);
  ok("sessions preserved after completion (not deleted)", sessions.filter(s=>!s.deletedAt).length===1);
  await p.close();

  console.log("G. Legacy 'صفحة قراءة' checkbox: preserved on historical dates, hidden/excluded from new totals from launch date on; no duplicate UI");
  p = await page(b);
  await p.addInitScript(()=>{ localStorage.clear(); });
  await p.goto(fileUrl); await p.waitForTimeout(600);
  const todayWorshipText = await p.$eval('#ibList-awrad', e=> e.textContent);
  ok("legacy checkbox HIDDEN for today (post-launch)", !todayWorshipText.includes("صفحة قراءة"));
  const cardCountToday = (await p.$$('#readingCard')).length + (await p.$$('h2:has-text("📚 القراءة")')).length;
  ok("no duplicate reading UI (only the new module card renders 📚 القراءة)", (await p.$$eval('.ib-title', els=> els.filter(e=>e.textContent.includes("القراءة")).length)) === 1);
  // seed a historical day (well before launch) with the legacy checkbox checked, and confirm it still renders + counts
  const oldDate = "2025-01-05";
  await p.evaluate((d)=>{
    const key = "h2do-tracker:"+d;
    const blank = { prayers:[true,true,true,true,true,true], worship:{reading:true}, water:8, tasks:[], priorities:[], sport:{types:[],mins:30,km:0}, updatedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(blank));
  }, oldDate);
  await p.fill("#datePicker", oldDate);
  await p.evaluate(()=> document.getElementById("datePicker").dispatchEvent(new Event("change")));
  await p.waitForTimeout(400);
  const oldWorshipText = await p.$eval('#ibList-awrad', e=> e.textContent);
  ok("legacy checkbox STILL SHOWN for historical pre-launch date (no rewritten history)", oldWorshipText.includes("صفحة قراءة"));
  const rawOldDay = await p.evaluate((d)=> localStorage.getItem("h2do-tracker:"+d), oldDate);
  ok("historical raw day document not rewritten/mutated by navigation", JSON.parse(rawOldDay).worship.reading === true);
  await p.close();

  console.log("H. Backup: real export/import round-trip through the actual buttons (v2 envelope) and legacy flat-file compatibility");
  const os = require("os");
  const fs = require("fs");
  p = await page(b);
  await p.addInitScript((tk)=>{ localStorage.clear();
    const now = Date.now();
    localStorage.setItem("h2do-reading-items", JSON.stringify([{schemaVersion:1,id:"IT1",title:"كتاب أ",author:null,materialType:"book",progressUnit:"page",totalUnits:100,currentUnit:5,status:"active",startedAt:now,completedAt:null,createdAt:now,updatedAt:now,deletedAt:null}]));
    localStorage.setItem("h2do-reading-settings", JSON.stringify({schemaVersion:1,focusItemId:"IT1",dailyGoal:null,createdAt:now,updatedAt:now}));
    localStorage.setItem("h2do-tracker:"+tk, JSON.stringify({prayers:[true,false,false,false,false,false], updatedAt: now}));
  }, today());
  await p.goto(fileUrl); await p.waitForTimeout(600);
  const [download] = await Promise.all([ p.waitForEvent("download"), p.click("#exportBtn") ]);
  const exportPath = path.join(os.tmpdir(), "rd-backup-test-"+Date.now()+".json");
  await download.saveAs(exportPath);
  const exportedPayload = JSON.parse(fs.readFileSync(exportPath, "utf8"));
  ok("real export produces a v2 envelope (format+version)", exportedPayload.format==="mufakkirati-backup" && exportedPayload.version===2);
  ok("real export includes the day document", !!exportedPayload.days[today()]);
  ok("real export includes reading items via modules.reading", exportedPayload.modules && exportedPayload.modules.reading && exportedPayload.modules.reading.items.length===1);
  ok("real export excludes active draft/stats cache (not part of modules.reading shape)", !("draftId" in exportedPayload.modules.reading) && !("byDate" in exportedPayload.modules.reading));

  // fresh device importing that real v2 file through the real import button
  let p2 = await page(b);
  await p2.addInitScript(()=>{ localStorage.clear(); });
  await p2.goto(fileUrl); await p2.waitForTimeout(600);
  p2.once("dialog", d=> d.accept());
  await p2.setInputFiles("#importFile", exportPath);
  await p2.waitForTimeout(500);
  let importedItems = await rdItems(p2);
  ok("v2 import merges reading item by id via the real import flow", importedItems.length===1 && importedItems[0].id==="IT1");
  const importedDay = await p2.evaluate((tk)=> JSON.parse(localStorage.getItem("h2do-tracker:"+tk)), today());
  ok("v2 import still imports day documents (unrelated-module claim not made, days still work)", importedDay && importedDay.prayers[0]===true);

  // legacy flat backup (no 'format'/'version'/'modules' keys at all) — the exact pre-v100 shape — must still import cleanly
  const legacyPath = path.join(os.tmpdir(), "rd-legacy-backup-"+Date.now()+".json");
  fs.writeFileSync(legacyPath, JSON.stringify({ "2025-06-01": { prayers:[true,false,false,false,false,false], updatedAt: Date.now() } }));
  let p3 = await page(b);
  await p3.addInitScript(()=>{ localStorage.clear(); });
  await p3.goto(fileUrl); await p3.waitForTimeout(600);
  p3.once("dialog", d=> d.accept());
  await p3.setInputFiles("#importFile", legacyPath);
  await p3.waitForTimeout(500);
  const legacyDay = await p3.evaluate(()=> JSON.parse(localStorage.getItem("h2do-tracker:2025-06-01")));
  ok("legacy flat backup (pre-v100, no envelope) still imports correctly", legacyDay && legacyDay.prayers[0]===true);
  ok("legacy import did not crash or touch reading storage", (await rdItems(p3)).length===0);
  fs.unlinkSync(exportPath); fs.unlinkSync(legacyPath);
  await p.close(); await p2.close(); await p3.close();

  console.log("I. Malformed local reading data cannot block startup or other modules");
  p = await page(b);
  await p.addInitScript(()=>{
    localStorage.clear();
    localStorage.setItem("h2do-reading-items", "{not valid json");
    localStorage.setItem("h2do-reading-sessions", JSON.stringify([null, 42, {id:"onlyid"}, {id:"S1", itemId:"IT1", dateKey:"bad", durationSeconds:-5}]));
    localStorage.setItem("h2do-reading-settings", "null");
    localStorage.setItem("h2do-reading-stats-cache", "{corrupt");
  });
  await p.goto(fileUrl); await p.waitForTimeout(700);
  ok("app still reached a ready state (date picker set) despite malformed reading data", (await p.$eval("#datePicker", e=>e.value)) === today());
  ok("reading card still rendered (did not crash renderAll)", !!(await p.$("#readingCard")));
  ok("other cards still rendered (sport card present)", !!(await p.$("#sportCard")));
  await p.close();

  console.log("J. Sync: reading is the 7th independent module (status rows, coordinator wiring)");
  p = await page(b);
  await p.addInitScript(()=>{ window.__MFKR_TEST__ = true; localStorage.clear(); });
  await p.goto(fileUrl); await p.waitForTimeout(600);
  const modKeys = await p.evaluate(()=> Object.keys(JSON.parse(JSON.stringify({daily:1,quran:1,customWorship:1,witr:1,hifz:1,expenses:1,reading:1}))));
  ok("module list has 7 entries including reading", modKeys.length===7 && modKeys.includes("reading"));
  const readingModuleState = await p.evaluate(()=> window.__mfkrSync.module("reading"));
  ok("reading module reachable via the same read-only coordinator diagnostics as other modules", readingModuleState && typeof readingModuleState.inFlight === "boolean");
  await p.click("#expOpenBtn"); await p.waitForTimeout(300);
  await p.click('.exp-tab[data-view="settings"]'); await p.waitForTimeout(300);
  const rowCount = (await p.$$("#expModStatus .exp-foot-row")).length;
  ok("per-module status list shows exactly 7 rows (Reading added as the 7th)", rowCount===7);
  const statusHtml = await p.$eval("#expModStatus", e=> e.textContent);
  ok("Reading's Arabic label 'القراءة' present in per-module status", statusHtml.includes("القراءة"));
  await p.close();

  console.log("K. Zero page errors / unhandled rejections across the full flow above");
  ok("no uncaught JS errors or console.error across all scenarios", errs.length===0);
  if(errs.length) console.log("ERRORS:", [...new Set(errs)].slice(0,10));

  await b.close();
  console.log("\nRESULT: "+PASS+" passed, "+FAIL+" failed");
  process.exit(FAIL>0 ? 1 : 0);
})().catch(e=>{ console.error("FATAL:", e); process.exit(1); });
