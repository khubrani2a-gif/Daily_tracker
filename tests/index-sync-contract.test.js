"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
const core=fs.readFileSync(path.join(root,"sync-core.js"),"utf8");

test("inline application JavaScript parses without errors",()=>{
  const match=html.match(/<script>\n([\s\S]*)<\/script>/);
  assert.ok(match); assert.doesNotThrow(()=>new Function(match[1]));
});

function sourceFunction(name){
  const start=html.indexOf("function "+name+"(");
  assert.ok(start>=0,"missing function "+name);
  const bodyStart=html.indexOf("{",start);
  let depth=0;
  for(let i=bodyStart;i<html.length;i++){
    if(html[i]==="{") depth++;
    if(html[i]==="}" && --depth===0) return html.slice(start,i+1);
  }
  throw new Error("unterminated function "+name);
}

function fakeDocument(){
  const createElement=tag=>({
    tag, children:[], textContent:"", className:"", insertedHtml:"", onclick:null,
    append(...nodes){this.children.push(...nodes);},
    appendChild(node){this.children.push(node); return node;},
    setAttribute(){},
    insertAdjacentHTML(_position,html){this.insertedHtml+=html;}
  });
  return {createElement,body:createElement("body"),addEventListener(){},removeEventListener(){}};
}

test("routine and template titles render hostile text as text, not markup",()=>{
  const taskSheet=new Function("document","return ("+sourceFunction("taskSheet")+");")(fakeDocument());
  ["<img src=x onerror=alert(1)>","<script>alert(1)</script>"].forEach(payload=>{
    const sheet=taskSheet(payload,"<p>واجهة داخلية ثابتة</p>");
    const heading=sheet.over.children[0].children[0].children[0];
    assert.equal(heading.textContent,payload);
    assert.doesNotMatch(sheet.over.children[0].insertedHtml,new RegExp(payload.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  });
  assert.match(html,/heading\.textContent=String\(title\|\|""\)/);
  assert.doesNotMatch(html,/'<div class="task-sheet"><div class="task-sheet-head"><h3>'\+title/);
  assert.doesNotMatch(html,/smartManageRoutines\(\)\{const templates=.*item\.icon\+/s);
});

test("global lifecycle events are each registered exactly once",()=>{
  ["visibilitychange","focus","pageshow","online","offline"].forEach(event=>{
    const matches=html.match(new RegExp("addEventListener\\(\\\""+event+"\\\"","g"))||[];
    assert.equal(matches.length,1,event);
  });
  assert.doesNotMatch(html,/\.(?:onfocus|onpageshow|onvisibilitychange)\s*=/);
});

test("all seven modules participate in the coordinator",()=>{
  ["pullRemote(currentDate","qPullRemote(","wCustomPullRemote(","witrPullRemote(","hifzPullRemote(","expPullRemote(","wgPullRemote("].forEach(call=>assert.ok(html.includes(call),call));
  assert.match(core,/Promise\.allSettled/);
});

test("Firestore paths remain unchanged and onSnapshot is absent",()=>{
  assert.match(html,/collection\("days"\)\.doc\(date\)/);
  assert.match(html,/collection\("meta"\)\.doc\("quran"\)/);
  assert.match(html,/collection\("meta"\)\.doc\("customWorship"\)/);
  assert.match(html,/collection\("meta"\)\.doc\("witr"\)/);
  assert.match(html,/collection\("hifzSegments"\)/);
  assert.match(html,/collection\("meta"\)\.doc\("expenses"\)/);
  assert.match(html,/collection\("meta"\)\.doc\("weeklyGoals"\)/);
  assert.doesNotMatch(html,/onSnapshot/);
});

test("server-first and explicit cache fallback are present for docs and queries",()=>{
  assert.ok((html.match(/get\(\{source:"server"\}\)/g)||[]).length>=2);
  assert.ok((html.match(/get\(\{source:"cache"\}\)/g)||[]).length>=2);
  assert.match(html,/function getDocServerFirst/); assert.match(html,/function getQueryServerFirst/);
});

test("v98 Expenses fixed-obligation behavior remains present in the current release",()=>{
  ["expRepairMisclassified","expUndoPayment","expOpenReclassifyForm","needsReview","expMergeById","fixedTemplateId","countAgainstWeeklyBudget"].forEach(name=>assert.ok(html.includes(name),name));
  /* لا نُثبِّت رقم إصدار بعينه (كان يتعطّل مع كل رفع كاش)؛ نتحقّق من وجود نسخة مرئية
     واسم كاش مُرقَّم صالح — وهو جوهر الفحص: إصدار متماسك لا رقم محدد. */
  assert.match(html,/النسخة [٠-٩]+/);
  assert.match(sw,/const CACHE = "mufakkirati-v\d+[a-z]?";/);
  assert.match(sw,/sync-core\.js/);
});

test("daily history is cached and below-fold content is deferred at startup",()=>{
  assert.match(html,/let allDaysCache = null/);
  assert.match(html,/function invalidateAllDaysCache\(\)/);
  assert.match(html,/if\(allDaysCache === null\)/);
  assert.match(html,/const out = Object\.assign\(\{\}, allDaysCache\)/);
  assert.match(html,/function deferNonCriticalRender\(name, fn\)/);
  assert.match(html,/deferNonCriticalRender\("renderHifzCard:init", renderHifzCard\)/);
});

test("backup import limits size, validates entries, and blocks newer schemas",()=>{
  assert.match(html,/const DATA_MAX_IMPORT_BYTES=5\*1024\*1024/);
  assert.match(html,/const DATA_MAX_IMPORT_ENTRIES=1000/);
  assert.match(html,/if\(\+raw\.schema>DATA_VERSION\) throw new Error\("newer backup"\)/);
  assert.match(html,/if\(keys\.length>DATA_MAX_IMPORT_ENTRIES\) throw new Error\("too many entries"\)/);
  assert.match(html,/if\(f\.size>DATA_MAX_IMPORT_BYTES\)/);
});

test("data center can run a non-destructive health check before recovery",()=>{
  assert.match(html,/id="dataHealthCheck"/);
  assert.match(html,/function dataHealthCheck\(\)/);
  assert.match(html,/document\.getElementById\("dataHealthCheck"\)\.onclick=dataHealthCheck/);
  assert.match(html,/dataSnapshotStats\(dataBuildSnapshot/);
});

test("mobile scroll containers clear the fixed navigation and iPhone safe area",()=>{
  assert.match(html,/--mobile-scroll-clearance:calc\(/);
  assert.match(html,/env\(safe-area-inset-bottom,\s*0px\)/);
  assert.match(html,/\.exp-form\{[\s\S]*?padding-bottom:var\(--mobile-scroll-clearance\);[\s\S]*?scroll-padding-bottom:var\(--mobile-scroll-clearance\)/);
  assert.match(html,/body\{[\s\S]*?padding-bottom:var\(--mobile-scroll-clearance\);[\s\S]*?scroll-padding-bottom:var\(--mobile-scroll-clearance\)/);
  assert.match(html,/\.page\{padding-bottom:var\(--mobile-scroll-clearance\);scroll-padding-bottom:var\(--mobile-scroll-clearance\)}/);
  assert.match(html,/bottom:calc\(\.65rem \+ env\(safe-area-inset-bottom, 0px\)\)/);
});

test("today overview and responsive quick navigation remain wired",()=>{
  ["todayOverviewTitle","todayPrayerValue","todayTaskValue","todayQuranValue","todayWaterValue","todayFocus","weeklyGoalBanner","weeklyGoalText","weeklyGoalDone","tomorrowItems","quickTaskBtn","quickExpenseBtn","quickWaterBtn","quickActionsCatalogBtn","quickCustomActionBtn","quickManageActionsBtn","quickCustomActions","quickActionFeedback","shareWeekBtn","quickTemplateUndoBtn","quickTemplateStatus","quickTemplateFeedback","quickCustomTemplateBtn","quickManageTemplatesBtn","quickCustomTemplateList"].forEach(id=>{
    assert.match(html,new RegExp('id="'+id+'"'),id);
  });
  assert.match(html,/const changed=appView!==view;/);
  assert.match(html,/if\(!changed\) return;/);
  assert.match(html,/<div class="quick-template-bar" id="quickTemplateBar" aria-label="قوالب سريعة">/);
  ["today","iman","sport","expenses","more"].forEach(view=>assert.ok(html.includes('data-app-view="'+view+'"'),view));
  assert.match(html,/const APP_VIEW_GROUPS=/);
  assert.match(html,/function renderTodayOverview\(/);
  assert.match(html,/function renderTomorrowPanel\(/);
  assert.match(html,/function smartWeekSummary\(/);
  assert.match(html,/function smartInit\(/);
  assert.match(html,/function smartUndoLastTemplate\(/);
  assert.match(html,/function smartTemplateNotice\(/);
  assert.match(html,/function smartOpenQuickTask\(/);
  assert.match(html,/function smartOpenCustomTemplate\(/);
  assert.match(html,/function smartManageCustomTemplates\(/);
  assert.match(html,/function smartOpenTemplateEditor\(/);
  assert.match(html,/function smartAskInTemplateManager\(/);
  assert.match(html,/function smartSetTemplateHidden\(/);
  assert.match(html,/hide\.onclick=\(\)=>\{smartSetTemplateHidden\(\{kind:row\.kind,id:row\.id\},!row\.hidden\)/);
  assert.match(html,/SMART_CUSTOM_TEMPLATES_KEY/);
  assert.match(html,/SMART_TEMPLATE_SETTINGS_KEY/);
  assert.match(html,/SMART_CUSTOM_ACTIONS_KEY/);
  assert.match(html,/function smartOpenCustomAction\(/);
  assert.match(html,/function smartManageCustomActions\(/);
  assert.match(html,/function smartOpenActionCatalog\(/);
  assert.match(html,/SMART_ACTION_LIBRARY/);
  ["iman","dhikr","health","sport5","family","shopping","finance"].forEach(action=>assert.match(html,new RegExp('value="'+action+'"'),action));
  assert.match(html,/اختر قالبًا لإضافته إلى مهام اليوم\./);
  assert.doesNotMatch(html,/quickTemplatesBtn/);
  assert.match(html,/renderTodayOverview\(\);\s*\n\s*updateStreak/);
});

test("separate dhikr counter supports presets, custom wording, and a daily target",()=>{
  ["dhikrCounterSettings","dhikrCounterText","dhikrCounterProgress","dhikrCounterFill","dhikrCountBtn","dhikrStatsBtn","dhikrManageBtn"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"'),id));
  assert.match(html,/function dhikrCounterState\(/);
  assert.match(html,/function openDhikrCounterSettings\(/);
  assert.match(html,/function openDhikrManager\(/);
  assert.match(html,/function dhikrAddPermanent\(/);
  assert.match(html,/function dhikrCounterCustomPresets\(/);
  assert.match(html,/dhikrMigrateLegacyCounterItems\(/);
  assert.match(html,/function dhikrStatsRows\(/);
  assert.match(html,/function openDhikrStats\(/);
  assert.match(html,/DHIKR_COUNTER_PRESETS/);
});

test("worship interactions update in place without scroll compensation",()=>{
  assert.match(html,/function renderWorship\(rebuildLists=true, updateRemaining=true\)/);
  assert.match(html,/function ibRefreshAfterChange\(\)\{[\s\S]*renderWorship\(false,false\);[\s\S]*renderProgress\(false\);[\s\S]*\}/);
  assert.match(html,/function renderProgress\(updatePageSummaries=true\)/);
  assert.match(html,/chk\.classList\.toggle\("on",completed\)/);
  assert.doesNotMatch(html,/function ibRestoreScroll\(/);
  assert.doesNotMatch(html,/function ibScrollTop\(/);
});

test("primary daily controls use native buttons with accessible state",()=>{
  assert.ok((html.match(/document\.createElement\("button"\)/g)||[]).length>=3);
  assert.match(html,/aria-pressed/);
  assert.match(html,/تقييم اليوم/);
  assert.match(html,/task-delete-btn/);
  assert.match(html,/حذف المهمة/);
});

test("task links open reliably in the current tab and reject unsafe protocols",()=>{
  assert.match(html,/const taskSafeExternalUrl = \(value\)=>\{/);
  assert.ok(html.includes('return /^https?:$/.test(url.protocol) ? url.href : "";'));
  assert.ok(html.includes('a.href=taskLink;a.title="يفتح الرابط في هذه النافذة";a.setAttribute("aria-label","فتح الرابط في هذه النافذة");a.textContent="🔗 فتح الرابط";a.addEventListener("click",(event)=>{ event.preventDefault(); window.location.assign(taskLink); })'));
  assert.match(html,/a\.setAttribute\("aria-label","فتح الرابط في هذه النافذة"\)/);
  assert.doesNotMatch(html,/a\.href=item\.link;a\.target="_blank"/);
});

test("card personalization supports persistent visibility and ordering",()=>{
  ["customizeBtn","customizeOverlay","customizeList","customizeShowAll","customizeReset","customizeDone"].forEach(id=>{
    assert.match(html,new RegExp('id="'+id+'"'),id);
  });
  ["healthCard","waterCard","intentionCard","memoryCard","notesCard","ratingCard"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"'),id));
  assert.match(html,/const CARD_PREF_KEY = "h2do-card-layout-v1"/);
  assert.match(html,/function personalizeApply\(/);
  assert.match(html,/function personalizeMove\(/);
  assert.match(html,/function personalizeDrop\(/);
  assert.match(html,/row\.draggable=true/);
  assert.match(html,/id="homeModeBtn"/);
  assert.match(html,/function homeModeInit\(/);
  assert.match(html,/home-compact-today/);
  assert.match(html,/safeRun\("personalizeInit", personalizeInit\);\s*\n\s*safeRun\("homeMode:init", homeModeInit\);\s*\n\s*safeRun\("appViewInit", appViewInit\);/);
});

test("onboarding, task planning, and expense tools are wired",()=>{
  ["onboardOverlay","onboardModules","onboardWater","onboardSport","onboardQuran","taskHistoryBtn","expSearch","expExportCsv","expBudgetAlert"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"'),id));
  ["taskOpenMeta","taskHistoryOpen","seedRecurringTasks","expExportCurrentCsv","expApplySearch"].forEach(name=>assert.ok(html.includes("function "+name+"("),name));
  assert.match(html,/repeat==="daily"/);
  assert.match(html,/repeat==="weekly"/);
  assert.match(html,/spent\/budget>=\.8/);
  assert.match(html,/text\/csv;charset=utf-8/);
});

test("keyboard and screen-reader access helpers remain present",()=>{
  assert.match(html,/class="skip-link"/);
  assert.match(html,/:focus-visible/);
  assert.match(html,/chk\.setAttribute\("aria-pressed"/);
  assert.match(html,/role","dialog"/);
});

test("sync transparency shows local, cloud, last-success, and retry states",()=>{
  ["syncMeta","syncMode","syncLast","syncRetry"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"'),id));
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/const GLOBAL_SYNC_AT_KEY = "h2do-last-global-sync"/);
  assert.match(html,/function renderSyncDetails\(/);
  assert.match(html,/آخر مزامنة سحابية/);
  assert.match(html,/تغييراتك محفوظة وستُزامن عند عودة الإنترنت/);
  assert.match(html,/syncRetry\.onclick = \(\)=> syncPullAllModules\("retry"/);
});

test("unified weekly and monthly statistics remain wired",()=>{
  ["statsUnifiedView","statsRangeLabel","statsCompare","statsUnifiedKpis","statsTrend","statsBreakdown","statsInsight","statsYearView","statsClose"].forEach(id=>{
    assert.match(html,new RegExp('id="'+id+'"'),id);
  });
  ["week","month","year"].forEach(period=>{
    assert.match(html,new RegExp('data-stats-period="'+period+'"'),period);
  });
  assert.match(html,/function statsPeriodMetrics\(/);
  assert.match(html,/function renderUnifiedStats\(/);
  assert.match(html,/function renderStatsPeriod\(/);
  assert.match(html,/statsSeries\(days,count,count\)/);
  assert.match(html,/renderStatsPeriod\(statsPeriod\)/);
});

test("unified calendar opens saved days and lists upcoming recurring tasks",()=>{
  ["taskCalendarBtn","statsCalendarView","calendarPrev","calendarNext","calendarToday","calendarGrid","calendarSummary","calendarUpcoming"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"'),id));
  ["calendarTaskOccurrences","calendarTaskCounts","calendarOpenDay","calendarRenderUpcoming","renderCalendar","openCalendarView"].forEach(name=>assert.ok(html.includes("function "+name+"("),name));
  assert.match(html,/data-stats-period="calendar"/);
  assert.match(html,/btn\.onclick=\(\)=>calendarOpenDay\(key\)/);
  assert.match(html,/\["daily","weekly","monthly"\]\.includes\(task\.repeat\)/);
  assert.match(html,/document\.getElementById\("taskCalendarBtn"\)\.onclick=openCalendarView/);
});

test("notification center schedules configurable local reminders",()=>{
  ["notifyBtn","notifyOverlay","notifyPermissionBtn","notifyEnabled","notifyPrayer","notifyPrayerLead","notifyTasks","notifyWater","notifyWaterTime","notifySport","notifySportTime","notifyQuran","notifyQuranTime"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"'),id));
  ["notifyLoad","notifyDue","notifyShow","notifyTodayPrayerTimes","notifyTaskRowsForToday","notifyCheck","notifySaveSettings","notifyInit"].forEach(name=>assert.ok(html.includes("function "+name+"("),name));
  assert.match(html,/Notification\.requestPermission\(\)/);
  assert.match(html,/reg\.showNotification\(title,options\)/);
  assert.match(html,/setInterval\(notifyCheck,30000\)/);
  assert.match(sw,/addEventListener\("notificationclick"/);
  assert.match(sw,/postMessage\(\{type:"OPEN_DAY"/);
});

test("global search indexes daily content and expenses with filters",()=>{
  ["globalSearchBtn","globalSearchOverlay","globalSearchInput","globalSearchType","globalSearchFrom","globalSearchTo","globalSearchCategory","globalSearchSummary","globalSearchResults"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"'),id));
  ["globalSearchIndex","globalSearchNorm","globalSearchRender","globalSearchOpenResult","globalSearchOpen","globalSearchInit"].forEach(name=>assert.ok(html.includes("function "+name+"("),name));
  ["task","note","memory","expense"].forEach(type=>assert.match(html,new RegExp('value="'+type+'"'),type));
  assert.match(html,/expActiveTx\(\)/);
  assert.match(html,/appViewSet\(view\)/);
  assert.match(html,/expOpenExpenseForm\(row\.id\)/);
});

test("custom habits support schedules, streaks, and periodic goals",()=>{
  ["habitManageBtn","habitOverlay","habitManageList","habitAddBtn","habitEditView","habitName","habitGroup","habitDailyTarget","habitDays","habitGoalPeriod","habitGoalTarget","habitEditSave"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"'),id));
  ["habitScheduledOn","habitPeriodRange","habitPeriodProgress","habitStreak","habitDaysText","habitRenderManager","habitOpenEditor","habitSaveEditor","habitDelete","habitInit"].forEach(name=>assert.ok(html.includes("function "+name+"("),name));
  assert.match(html,/scheduleDays/);
  assert.match(html,/goalPeriod==="weekly"/);
  assert.match(html,/goalPeriod==="monthly"/);
  assert.match(html,/kind:"habit"/);
  assert.match(html,/safeRun\("habitInit", habitInit\)/);
});

test("data management provides backups, restore, exports, and conflict review",()=>{
  ["dataManageBtn","dataOverlay","dataCreateBackup","dataBackupList","dataConflictList","dataExportExcel","dataExportPdf","dataClearReviewed","exportBtn","importBtn"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"'),id));
  ["dataBuildSnapshot","dataSaveBackup","dataNormalizeImported","dataRestoreBackup","dataApplySnapshot","dataExportExcel","dataExportPdf","dataDetectConflict","dataDetectCollectionConflicts","dataRecordConflict","dataRenderCenter","dataInit"].forEach(name=>assert.ok(html.includes("function "+name+"("),name));
  assert.match(html,/h2do-backup-library-v1/);
  assert.match(html,/h2do-sync-conflicts-v1/);
  assert.match(html,/application\/vnd\.ms-excel/);
  assert.match(html,/printWindow\.print\(\)/);
  assert.match(html,/dataDetectConflict\("daily"/);
  assert.match(html,/dataDetectCollectionConflicts\("expenses"/);
  assert.match(html,/safeRun\("dataInit", dataInit\)/);
});

test("advanced expenses include savings, budget comparison, charts, and recurring rules",()=>{
  ["expSavingsCard","expBudgetCompareCard","expCategoryChartCard","expRecurringCard"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"'),id));
  ["expRenderSavingsCard","expRenderBudgetCompareCard","expRenderCategoryChartCard","expRenderRecurringCard","expOpenSavingForm","expOpenRecurringForm","expGenerateRecurringDue","expNextRecurringDate"].forEach(name=>assert.ok(html.includes("function "+name+"("),name));
  assert.match(html,/savingsGoals:\[\]/);
  assert.match(html,/recurringTransactions:\[\]/);
  assert.match(html,/recurringOccurrenceDate/);
  assert.match(html,/t\.recurringRuleId===rule\.id && t\.recurringOccurrenceDate===occurrence/);
  assert.match(html,/const occurrenceId="expr_"/);
  assert.match(html,/out\.savingsGoals = expMergeById/);
  assert.match(html,/out\.recurringTransactions = expMergeById/);
});

test("salary-cycle budgeting supports a configurable payday",()=>{
  ["salaryCycleStartDay","salaryAmountMinor","stSalaryDay","stSalaryAmount","expSalaryCycleStatus","خطة دورة الراتب"].forEach(name=>assert.ok(html.includes(name),name));
  assert.match(html,/function expSalaryCycleRange\(/);
  assert.match(html,/function expSalaryCycleInstances\(/);
  assert.match(html,/const wr = expWeekRange\(today\), cycle=expSalaryCycleRange/);
  assert.match(html,/stSalaryAmount"\)\.onchange=e=>\{ const amount=expParseAmount\(e\.target\.value\)/);
});

test("financial weekly views obey the configured Saturday-to-Friday boundary",()=>{
  /* تبقى دورة الراتب مستقلة للالتزامات والراتب، ولا تُستخدم في بطاقات الميزانيات الأسبوعية. */
  assert.equal((html.match(/expSalaryWeekRange\(/g)||[]).length,1,"helper legacy is not used by financial weekly views");
  [
    "const wr = expWeekRange(today), cycle=expSalaryCycleRange",
    "wr=expWeekRange(todayStr()), budget=expWeeklyBudgetTotal",
    "const week=expWeekRange(dateStr), month=expMonthRange(dateStr)",
    "const wr=expWeekRange(todayStr()), isHidden=expVarHiddenForWeek"
  ].forEach(source=>assert.ok(html.includes(source),source));
});

test("family hub keeps finance, shopping, and household-task entry points",()=>{
  ["familyLaunchSummary","familyQuickShop","expViewFamily","familyOverviewBody","expViewFamilyManage","familyManageBody","expViewShopping","familyShoppingBody"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"'),id));
  ["familyShoppingAll","familyShoppingLoad","familyRenderOverview","familyRenderShopping","familyShopping","familyEvents","familyOpenEvents","familyMembers","familyManageMembers","familyOpenTask","familyRecordActivity","familyBudgetMinor"].forEach(name=>assert.ok(html.includes(name),name));
  assert.match(html,/data-app-view="expenses"[^>]*>[^<]*<span>👨‍👩‍👧<\/span>العائلة/);
  assert.match(html,/const quickExpense=document\.getElementById\("expQuickAdd"\);/);
  assert.match(html,/إدارة الأعضاء/);
  assert.match(html,/المكلّف/);
  assert.match(html,/ميزانية المنزل المشتركة/);
  assert.match(html,/إدارة العائلة/);
  assert.match(html,/مالية العائلة/);
  assert.match(html,/function familyRenderManage\(/);
  assert.match(html,/expSetView\("familyManage"\)/);
  ["familyShoppingCategoryLabel","familyShopCategory","familyShopCustomCategory"].forEach(name=>assert.ok(html.includes(name),name));
  assert.match(html,/🛒 بقالة وتموين/);
  assert.match(html,/✏️ تصنيف آخر/);
  assert.match(html,/category==="أخرى"&&!custom/);
});

test("advanced tasks include statuses, subtasks, links, phone contacts, reminders, and weekly view",()=>{
  ["taskWeekBtn","tmStatus","tmReminder","tmLink","tmPhone","tmSubtasks"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"'),id));
  ["taskStatus","taskActive","taskSetDone","taskWeekOpen"].forEach(name=>assert.ok(html.includes("function "+name+"("),name));
  ["pending","in_progress","deferred","done","cancelled"].forEach(status=>assert.ok(html.includes(status),status));
  assert.match(html,/item\.subtasks=lines\.map/);
  assert.match(html,/task\.reminderMinutes/);
  assert.match(html,/notifyDue\(task\.dueTime,lead\)/);
  assert.match(html,/function taskNormalizePhone\(/);
  assert.match(html,/function taskCallPhone\(/);
  assert.match(html,/function taskCopyPhone\(/);
  assert.match(html,/function taskCopyLink\(/);
  assert.match(html,/window\.location\.href="tel:"\+phone/);
  assert.match(html,/📞 اتصال/);
  assert.match(html,/📋 نسخ الرقم/);
  assert.match(html,/📋 نسخ الرابط/);
  assert.match(html,/document\.getElementById\("taskWeekBtn"\)\.onclick=taskWeekOpen/);
});

test("task scheduling supports postponement plus daily, selected-weekday, and monthly repeats",()=>{
  ["taskPostponeOpen","taskPostpone","taskOccursOnDate","taskNextOccurrenceDate","taskRepeatWeekdays","taskMonthlyOccurrenceDay"].forEach(name=>assert.ok(html.includes("function "+name+"("),name));
  ["tmPostpone","tmWeeklyOptions","tmMonthlyOptions","tmMonthlyDay","taskPostponeReason","أيام العمل","عطلة نهاية الأسبوع","المرة القادمة"].forEach(text=>assert.ok(html.includes(text),text));
  assert.match(html,/option value="monthly"/);
  assert.match(html,/data-tm-weekday/);
  assert.match(html,/postponedFromDate/);
  assert.match(html,/يؤجَّل هذا التنفيذ فقط؛ لا يتغير تكرار المهمة القادم/);
});

test("advanced statistics support KPI customization, month comparison, day analysis, and suggested goals",()=>{
  ["statsCustomizeBtn","statsBestWorst","statsMonthComparePanel","statsMonthCompare","statsAutoGoal","statsAutoGoalText","statsAutoGoalUse"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"'),id));
  ["statsKpiSelection","statsCustomizeOpen","statsRenderDayAnalysis","statsRenderMonthComparison","statsSuggestedGoal"].forEach(name=>assert.ok(html.includes("function "+name+"("),name));
  assert.match(html,/h2do-stats-kpis-v1/);
  assert.match(html,/for\(let offset=5;offset>=0;offset--\)/);
  assert.match(html,/اقتراح بناءً على أدائك/);
  assert.match(html,/document\.getElementById\("statsCustomizeBtn"\)\.onclick=statsCustomizeOpen/);
});

test("weekly review turns statistics into a synced next goal",()=>{
  ["statsWeeklyReview","statsWeeklyWin","statsWeeklyImprove","statsNextGoal","statsGoalStep1","statsGoalStep2","statsGoalStep3","statsGoalDay1","statsGoalDay2","statsGoalDay3","statsGoalSave","statsGoalStatus"].forEach(id=>{
    assert.match(html,new RegExp('id="'+id+'"'),id);
  });
  assert.match(html,/function statsRenderWeeklyReview\(/);
  assert.match(html,/function statsSaveWeeklyGoal\(/);
  assert.match(html,/wgSetGoal\(target,goal,steps\)/);
  assert.match(html,/if\(period==="week"\)\{ statsRenderWeeklyReview\(cur,metrics\)/);
});

test("weekly goals persist by week, merge by item timestamp, and render on home",()=>{
  assert.match(html,/const WEEKLY_GOALS_KEY = "h2do-weekly-goals-v1"/);
  ["wgWeekStart","wgLoad","wgMerge","wgSave","wgToggleDone","wgToggleStep","wgPullRemote","renderWeeklyGoalBanner"].forEach(name=>{
    assert.match(html,new RegExp("function "+name+"\\("),name);
  });
  assert.match(html,/SYNC_MODULES = \["daily","quran","customWorship","witr","hifz","expenses","weeklyGoals"\]/);
  assert.match(html,/left\.updatedAt\|\|0\)>\=\(right\.updatedAt\|\|0\)/);
});

test("weekly goal supports three synced execution steps and derived progress",()=>{
  ["weeklyGoalSteps","weeklyGoalDone"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"'),id));
  assert.match(html,/slice\(0,3\)/);
  assert.match(html,/done:steps\.length\?steps\.every\(step=>step\.done\)/);
  assert.match(html,/item\.done=item\.steps\.length>0&&item\.steps\.every\(entry=>entry\.done\)/);
  assert.match(html,/control\.onclick=\(\)=>wgToggleStep\(currentKey,step\.id\)/);
  assert.match(html,/إكمال كل الخطوات/);
});

test("weekly execution steps can be scheduled and highlight their due day",()=>{
  assert.match(html,/const WG_DAY_NAMES = \["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"\]/);
  assert.match(html,/day:step&&step\.day!==""&&step\.day!==null/);
  assert.match(html,/wgSetGoal\(weekStart,goal,stepPlans\)/);
  assert.match(html,/const matchesSelectedDay=!preview&&step\.day===/);
  assert.match(html,/if\(matchesSelectedDay\) control\.classList\.add\("today"\)/);
  assert.match(html,/className="weekly-goal-step-day"/);
});

test("weekly goal review offers alternate, edit, and cancellation controls",()=>{
  ["statsSuggestionAlt","statsGoalEdit","statsGoalCancel"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"'),id));
  assert.match(html,/function statsInstallWeeklyGoalControls\(\)/);
  assert.match(html,/statsInstallWeeklyGoalControls\(\)/);
  assert.match(html,/statsSaveWeeklyGoal\(\);/);
});

test("weekly and calendar-month variable budgets keep separate progress rows",()=>{
  ["صُرف ","لم يُصرف شيء من ","تجاوزت بـ ","اكتملت الميزانية","لا توجد ميزانية","٪ مستخدم"].forEach(text=>assert.ok(html.includes(text),text));
  ["expVarViewLoad","expVarToggleHidden","expShowVarCategoryDetails","expMoveVarTransactions","expMonthPlanFromWeeklyBudget","expVariableBudgetProgress"].forEach(name=>assert.match(html,new RegExp("function "+name+"\\("),name));
  assert.match(html,/renderPeriod\("هذا الأسبوع",wr,x\.weeklyBudget,x\.weeklySpent,"week"\)/);
  assert.match(html,/renderPeriod\("هذا الشهر",month,x\.monthlyBudget,x\.monthlySpent,"month"\)/);
  assert.match(html,/month=expMonthRange\(dateStr\)/);
  assert.match(html,/weekly\*days\/7/);
  assert.match(html,/overOnlyWeek===wr\.start/);
  assert.doesNotMatch(sourceFunction("expVariableBudgetProgress"),/expSalaryCycle/);
  assert.match(html,/إظهار في هذا الأسبوع/);
  assert.match(html,/إضافة مصروف/);
  assert.match(html,/تعديل الميزانية الأسبوعية/);
});

test("daily route connects capture, focused execution, and day closing to existing tasks",()=>{
  ["dailyRoute","dailyRouteTask","dailyRouteStart","dailyRouteDone","dailyRouteDefer","dailyRoutePlan","dailyRouteReplan","dailyRouteUndo","dailyRouteSimple","dailyRouteInbox","dailyRouteFamily","dailyRouteWeekly","dailyRoutePatterns","dailyRouteArchive","dailyRouteSettings","dailyRouteClose"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"'),id));
  ["dailyRouteSettingsLoad","dailyRouteSettingsSave","dailyRouteOpenSettings","dailyRouteCandidates","dailyRoutePlanIds","dailyRouteHabit","dailyRouteReason","dailyRouteEssentials","dailyRouteRender","dailyRouteOpenPlan","dailyRouteOpenReplan","dailyRouteMoveToTomorrow","dailyRouteUndoReplan","dailyRouteToggleSimple","dailyRouteOpenWeeklyReview","dailyRoutePatterns","dailyRouteOpenPatterns","dailyRouteOpenArchive","dailyRouteStateForDate","dailyRouteOpenFamilyAppointment","dailyRouteOpenInbox","dailyRouteOpenFocus","dailyRouteOpenClose"].forEach(name=>assert.ok(html.includes("function "+name+"("),name));
  assert.match(html,/المؤقت لا يُكمل المهمة تلقائيًا/);
  assert.match(html,/حفظ وإغلاق اليوم/);
  assert.match(html,/storageKey\(tomorrow\)/);
  assert.match(html,/اختر ٣ أولويات كحد أقصى/);
  assert.match(html,/انقل غير المختار إلى الغد/);
  assert.match(html,/تشغيل الوضع المبسط/);
  assert.match(html,/renderStatsPeriod\("week"\)/);
  assert.match(html,/خطوة إيمانية خفيفة/);
  assert.match(html,/قراءة للسبعة أيام الأخيرة فقط/);
  assert.match(html,/حفظ الموعد والتجهيزات/);
  assert.match(html,/آخر ٣٠ يومًا محفوظًا/);
  assert.match(html,/اقتراحات مسار اليوم/);
  assert.match(html,/لأنك اخترتها ضمن أهم ٣ أولويات اليوم/);
  assert.match(html,/اليوم مزدحم/);
  assert.match(html,/الخطوة الحالية:/);
  assert.match(html,/مصروف فعلي/);
  assert.match(html,/الحد الأدنى:/);
  assert.match(html,/dailyRouteRender\(\);/);
  ["decisionCenter","decisionRulesBtn"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"'),id));
  ["decisionRulesLoad","decisionItems","renderDecisionCenter","decisionRulesOpen","dataAutoBackup"].forEach(name=>assert.ok(html.includes("function "+name+"("),name));
  assert.match(html,/أولوية ثابتة: موعد قريب يحتاج تجهيزًا، ثم مشكلة متكررة، ثم إشارة مالية/);
  assert.match(html,/return out\.slice\(0,3\)/);
  assert.match(html,/DATA_MAX_BACKUPS=7/);
  assert.match(html,/record\.reason==="نسخة تلقائية يومية"/);
  assert.match(html,/option value="appointment"/);
  assert.match(html,/option value="review"/);
  assert.match(html,/taskOpenMeta\(task/);
  assert.match(html,/activityOpen\(row\.date\)/);
  assert.match(html,/deferredLimit/);
  assert.match(html,/morningReading/);
  assert.match(html,/function decisionMorningReading\(/);
  assert.match(html,/ورد الصباح لم يُسجّل بعد/);
  assert.match(html,/القواعد تقترح فقط ولا تنفذ تعديلًا أو نقلًا من دون موافقتك/);
  assert.match(html,/مساءً: رتّب المتبقي أو انقله للغد/);
});

test("expense hierarchy keeps legacy IDs while adding synced subcategories",()=>{
  ["EXP_CATEGORY_SEED","EXP_LEGACY_CATEGORY_MAP","expEnsureCategoryHierarchy","expMoveLegacyBudgetTimelines","expMoveLegacyBudgetTimelinesByName","legacyBudgetPlacementV3","expClearDuplicatedLegacyHomeBudgets","legacyBudgetPlacementV4","expMoveLegacyFoodTransactions","legacyFoodTransactionsV5","expRestoreLegacyHomeTransactions","legacyHomeTransactionsV6","expCorrectLegacyHomeBatchV7","legacyHomeBatchV7","expMoveExceptionalToUnplannedV8","legacyExceptionalToUnplannedV8","expRestoreExceptionalBudgetV9","legacyExceptionalBudgetV9","expMarkHistoricalUnificationV10","legacyHistoryUnifiedV10","subcategoryId","customSubcategory","showInWeeklyBudget","expOpenSubcategoryManager","expTxSubcategoryLabel"].forEach(name=>assert.ok(html.includes(name),name));
  assert.match(html,/"expdcat_"\+i/);
  assert.match(html,/expMergeSubcategories/);
  assert.match(html,/expEnsureCategoryHierarchy\(out\)/);
  assert.match(html,/اكتب نوع المصروف عند اختيار «أخرى»/);
  assert.match(html,/حفظ هذا التصنيف للاستخدام لاحقًا/);
  assert.match(html,/c\.showInWeeklyBudget!==false/);
});
