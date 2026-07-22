"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {createCoordinator} = require("../sync-core.js");

const MODULES=["daily","quran","customWorship","witr","hifz","expenses","weeklyGoals"];
const clone=value=>JSON.parse(JSON.stringify(value));

function createClient(name, server, options){
  options=options||{};
  const coordinator=createCoordinator({moduleNames:MODULES,debounceMs:15,throttleMs:20});
  const local={}; MODULES.forEach(m=>local[m]=clone(server[m]||{}));
  const reads={}; MODULES.forEach(m=>reads[m]=0);
  function pullers(trigger, extra){
    const out={};
    MODULES.forEach(module=>{
      out[module]=opts=>coordinator.runModule(module,"default",trigger,Object.assign({},opts,extra),async()=>{
        reads[module]++;
        if(options.fail===module) throw new Error(module+" unavailable");
        if(options.offline){
          local[module]=clone(options.cache && options.cache[module] || local[module]);
          return {status:"cacheFallback",source:"cache",changed:false};
        }
        const before=JSON.stringify(local[module]);
        if(module==="expenses"){
          const byId=new Map((local[module].transactions||[]).map(x=>[x.id,x]));
          (server[module].transactions||[]).forEach(x=>{
            const old=byId.get(x.id); if(!old || (x.updatedAt||0)>(old.updatedAt||0)) byId.set(x.id,clone(x));
          });
          local[module]=Object.assign({},clone(server[module]),{transactions:[...byId.values()]});
        }else local[module]=clone(server[module]);
        return {status:"success",source:"server",changed:before!==JSON.stringify(local[module])};
      });
    });
    return out;
  }
  function sync(trigger,extra){ return coordinator.syncAll(trigger,{bypassThrottle:true},pullers(trigger,extra)); }
  return {name,local,reads,coordinator,sync,pullers};
}

function initialServer(){
  return {
    daily:{updatedAt:1,prayers:{fajr:false},health:{sleep:""},tasks:[],priorities:[],water:0,intention:"",notes:"",rating:0,sport:{}},
    quran:{updatedAt:1,page:1}, customWorship:{updatedAt:1,items:[]}, witr:{updatedAt:1,favorites:[]},
    hifz:{segments:[]}, expenses:{settings:{updatedAt:1},transactions:[]}, weeklyGoals:{updatedAt:1,items:{}}
  };
}

test("three authenticated clients receive every Daily field on foreground",async()=>{
  const server=initialServer();
  const laptop=createClient("laptop",server), phone=createClient("phone",server), ipad=createClient("iPad",server);
  server.daily={updatedAt:2,prayers:{fajr:true},health:{sleep:"8"},tasks:[{id:"t1",text:"task"}],
    priorities:[{id:"p1",text:"priority"}],water:7,intention:"intent",notes:"note",rating:5,sport:{km:3}};
  const phoneResult=await phone.sync("visibilitychange");
  const ipadResult=await ipad.sync("pageshow");
  assert.deepEqual(phone.local.daily,server.daily);
  assert.deepEqual(ipad.local.daily,server.daily);
  assert.equal(phoneResult.status,"success"); assert.equal(ipadResult.status,"success");
  assert.equal(laptop.local.daily.updatedAt,1,"the source client is independent");
});

test("Quran, custom worship, Witr, Hifz, and Expenses refresh independently",async()=>{
  const server=initialServer(), phone=createClient("phone",server);
  server.quran={updatedAt:2,page:44};
  server.customWorship={updatedAt:2,items:[{id:"c1",label:"ورد"}]};
  server.witr={updatedAt:2,favorites:["2:255"]};
  server.hifz={segments:[{id:"h1",updatedAt:2,from:1,to:5}]};
  server.expenses={settings:{updatedAt:2},transactions:[{id:"e1",amountMinor:1000,updatedAt:2}]};
  await phone.sync("focus");
  assert.equal(phone.local.quran.page,44);
  assert.equal(phone.local.customWorship.items.length,1);
  assert.deepEqual(phone.local.witr.favorites,["2:255"]);
  assert.equal(phone.local.hifz.segments[0].id,"h1");
  assert.equal(phone.local.expenses.transactions.length,1);
});

test("Expenses merge keeps stable IDs and never duplicates a transaction",async()=>{
  const server=initialServer(), phone=createClient("phone",server);
  server.expenses={settings:{updatedAt:2},transactions:[{id:"e1",amountMinor:1000,updatedAt:2}]};
  await phone.sync("focus"); await phone.sync("manual");
  assert.deepEqual(phone.local.expenses.transactions.map(x=>x.id),["e1"]);
});

test("one failed module cannot cancel the other six",async()=>{
  const server=initialServer(), phone=createClient("phone",server,{fail:"quran"});
  const summary=await phone.sync("online");
  assert.equal(summary.status,"partial");
  assert.equal(summary.counts.failed,1); assert.equal(summary.counts.success,6);
  MODULES.filter(m=>m!=="quran").forEach(m=>assert.equal(phone.reads[m],1));
});

test("cache fallback is not reported as full server success",async()=>{
  const server=initialServer(), phone=createClient("phone",server,{offline:true});
  const summary=await phone.sync("visibilitychange");
  assert.equal(summary.status,"cacheFallback");
  assert.equal(summary.counts.cacheFallback,7);
});

test("offline edit survives reconnect and converges across phone, laptop, and iPad",async()=>{
  const server=initialServer();
  const phone=createClient("phone",server,{offline:true}), laptop=createClient("laptop",server), ipad=createClient("iPad",server);
  phone.local.daily=Object.assign({},phone.local.daily,{updatedAt:3,water:9,notes:"offline"});
  server.daily=clone(phone.local.daily); // Firestore persistence flushes the pending write naturally.
  phone.sync=undefined;
  await laptop.sync("online"); await ipad.sync("online");
  assert.equal(laptop.local.daily.water,9); assert.equal(ipad.local.daily.notes,"offline");
});

test("duplicate lifecycle events collapse to one pull per module",async()=>{
  const server=initialServer(), phone=createClient("phone",server);
  const fire=trigger=>phone.coordinator.triggerDebounced(trigger,t=>phone.coordinator.syncAll(t,{bypassThrottle:false},phone.pullers(t)));
  const a=fire("pageshow"), b=fire("focus"), c=fire("visibilitychange");
  assert.strictEqual(a,b); assert.strictEqual(b,c);
  const summary=await c;
  assert.equal(summary.status,"success");
  MODULES.forEach(m=>assert.equal(phone.reads[m],1));
});

test("manual synchronization bypasses lifecycle debounce and runs immediately",async()=>{
  const server=initialServer(), phone=createClient("phone",server);
  const pending=phone.coordinator.triggerDebounced("focus",t=>phone.coordinator.syncAll(t,{},phone.pullers(t)));
  const manual=await phone.sync("manual");
  assert.equal(manual.status,"success");
  MODULES.forEach(m=>assert.equal(phone.reads[m],1));
  await pending;
});

test("module locks isolate concurrent pulls",async()=>{
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const coordinator=createCoordinator({moduleNames:["daily","quran"],throttleMs:0});
  const daily=coordinator.runModule("daily","2026-07-13","focus",{},async()=>{ await gate; return {status:"success",source:"server"}; });
  const duplicate=await coordinator.runModule("daily","2026-07-13","focus",{},async()=>({status:"success"}));
  const quran=await coordinator.runModule("quran","default","focus",{},async()=>({status:"success",source:"server"}));
  assert.equal(duplicate.status,"throttled"); assert.equal(quran.status,"success");
  release(); assert.equal((await daily).status,"success");
});
