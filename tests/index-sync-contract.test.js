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

test("all six modules participate in the coordinator",()=>{
  ["pullRemote(currentDate","qPullRemote(","wCustomPullRemote(","witrPullRemote(","hifzPullRemote(","expPullRemote("].forEach(call=>assert.ok(html.includes(call),call));
  assert.match(core,/Promise\.allSettled/);
});

test("Firestore paths remain unchanged and onSnapshot is absent",()=>{
  assert.match(html,/collection\("days"\)\.doc\(date\)/);
  assert.match(html,/collection\("meta"\)\.doc\("quran"\)/);
  assert.match(html,/collection\("meta"\)\.doc\("customWorship"\)/);
  assert.match(html,/collection\("meta"\)\.doc\("witr"\)/);
  assert.match(html,/collection\("hifzSegments"\)/);
  assert.match(html,/collection\("meta"\)\.doc\("expenses"\)/);
  assert.doesNotMatch(html,/onSnapshot/);
});

test("server-first and explicit cache fallback are present for docs and queries",()=>{
  assert.ok((html.match(/get\(\{source:"server"\}\)/g)||[]).length>=2);
  assert.ok((html.match(/get\(\{source:"cache"\}\)/g)||[]).length>=2);
  assert.match(html,/function getDocServerFirst/); assert.match(html,/function getQueryServerFirst/);
});

test("v98 Expenses fixed-obligation behavior remains present in v99",()=>{
  ["expRepairMisclassified","expUndoPayment","expOpenReclassifyForm","needsReview","expMergeById","fixedTemplateId","countAgainstWeeklyBudget"].forEach(name=>assert.ok(html.includes(name),name));
  assert.match(html,/النسخة ٩٩/); assert.match(sw,/mufakkirati-v99/); assert.match(sw,/sync-core\.js/);
});
