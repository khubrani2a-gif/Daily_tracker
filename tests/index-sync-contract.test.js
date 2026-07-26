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

test("v98 Expenses fixed-obligation behavior remains present in v110",()=>{
  ["expRepairMisclassified","expUndoPayment","expOpenReclassifyForm","needsReview","expMergeById","fixedTemplateId","countAgainstWeeklyBudget"].forEach(name=>assert.ok(html.includes(name),name));
  assert.match(html,/النسخة ١١٠/); assert.match(sw,/mufakkirati-v110/); assert.match(sw,/sync-core\.js/);
});

test("mobile scroll containers clear the fixed navigation and iPhone safe area",()=>{
  assert.match(html,/--mobile-scroll-clearance:calc\(/);
  assert.match(html,/env\(safe-area-inset-bottom,\s*0px\)/);
  assert.match(html,/\.exp-form\{[\s\S]*?padding-bottom:var\(--mobile-scroll-clearance\);[\s\S]*?scroll-padding-bottom:var\(--mobile-scroll-clearance\)/);
  assert.match(html,/body\{[\s\S]*?padding-bottom:var\(--mobile-scroll-clearance\);[\s\S]*?scroll-padding-bottom:var\(--mobile-scroll-clearance\)/);
});

test("today overview and responsive quick navigation remain wired",()=>{
  ["todayOverviewTitle","todayPrayerValue","todayTaskValue","todayQuranValue","todayWaterValue","todayFocus","weeklyGoalBanner","weeklyGoalText","weeklyGoalDone"].forEach(id=>{
    assert.match(html,new RegExp('id="'+id+'"'),id);
  });
  ["today","quran","sport","expenses","more"].forEach(view=>assert.ok(html.includes('data-app-view="'+view+'"'),view));
  assert.match(html,/const APP_VIEW_GROUPS=/);
  assert.match(html,/function renderTodayOverview\(/);
  assert.match(html,/renderTodayOverview\(\);\s*\n\s*updateStreak/);
});

test("primary daily controls use native buttons with accessible state",()=>{
  assert.ok((html.match(/document\.createElement\("button"\)/g)||[]).length>=3);
  assert.match(html,/aria-pressed/);
  assert.match(html,/تقييم اليوم/);
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
  assert.match(html,/safeRun\("personalizeInit", personalizeInit\);\s*\n\s*safeRun\("appViewInit", appViewInit\);/);
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
  assert.match(html,/task\.repeat==="daily"\|\|task\.repeat==="weekly"/);
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

test("advanced tasks include statuses, subtasks, links, reminders, and weekly view",()=>{
  ["taskWeekBtn","tmStatus","tmReminder","tmLink","tmSubtasks"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"'),id));
  ["taskStatus","taskActive","taskSetDone","taskWeekOpen"].forEach(name=>assert.ok(html.includes("function "+name+"("),name));
  ["pending","in_progress","deferred","done","cancelled"].forEach(status=>assert.ok(html.includes(status),status));
  assert.match(html,/item\.subtasks=lines\.map/);
  assert.match(html,/task\.reminderMinutes/);
  assert.match(html,/notifyDue\(task\.dueTime,lead\)/);
  assert.match(html,/document\.getElementById\("taskWeekBtn"\)\.onclick=taskWeekOpen/);
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
  assert.match(html,/if\(period==="week"\) statsRenderWeeklyReview\(cur,metrics\)/);
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
