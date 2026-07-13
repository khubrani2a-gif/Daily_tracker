function __loadChromium(){const c=[process.env.PW_PATH,"playwright","/opt/node22/lib/node_modules/playwright"].filter(Boolean);for(const x of c){try{return require(x).chromium;}catch(e){}}console.error("Playwright not found. Set PW_PATH=/path/to/playwright");process.exit(2);}
const { chromium } = { chromium: __loadChromium() };
const path=require("path");
const fileUrl = "file://" + path.resolve(__dirname, "..", "index.html");
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
const tk=today();
function base(){ const now=Date.now(); return {version:2,settings:{currency:"SAR",weekStartDay:6,numberFormat:"ar-EG"},
  categories:[{id:"CA",name:"الأكل",section:"variable",budgets:[],isActive:true,archivedAt:null,sortOrder:0,createdAt:now,updatedAt:now}],
  fixedTemplates:[{id:"TPL",name:"القرض",defaultAmountMinor:200000,amountType:"fixed",dueDay:1,startMonth:tk.slice(0,7),isActive:true,archivedAt:null,overrides:{},createdAt:now,updatedAt:now,sortOrder:0}],
  instances:[],transactions:[],trips:[]}; }
const fixtures = {
  "F1 null tx element": (()=>{const d=base(); d.transactions=[null,{id:"X",amountMinor:100,transactionDate:tk,categoryId:"CA",transactionType:"expense",description:"ok"}]; return d;})(),
  "F2 null category element": (()=>{const d=base(); d.categories=[null, d.categories[0]]; return d;})(),
  "F3 description=number": (()=>{const d=base(); d.transactions=[{id:"X",amountMinor:100,transactionDate:tk,categoryId:"CA",transactionType:"expense",description:123}]; return d;})(),
  "F9 template name=number + دفعة:999": (()=>{const d=base(); d.fixedTemplates[0].name=999; d.transactions=[{id:"P",amountMinor:1000,transactionDate:tk,categoryId:"CA",transactionType:"expense",description:"دفعة: 999"}]; return d;})(),
  "F11 amountMinor=NaN/string": (()=>{const d=base(); d.transactions=[{id:"N",amountMinor:"oops",transactionDate:"bad-date",categoryId:"CA",transactionType:"expense",description:"دفعة: القرض"}]; return d;})(),
  "F12 dangling categoryId + دفعة exact": (()=>{const d=base(); d.transactions=[{id:"P",amountMinor:5000,transactionDate:tk,categoryId:"GHOST",transactionType:"expense",description:"دفعة: القرض"}]; return d;})(),
  "F7 valid pre-v98": (()=>{const d=base(); delete d.version; d.transactions=[{id:"OLD",amountMinor:5000,transactionDate:tk,categoryId:"CA",transactionType:"expense",description:"عشاء"}]; return d;})(),
  "F10 malformed JSON": "###not-json###"
};
(async()=>{
  const b=await chromium.launch();
  console.log("fixture".padEnd(42)+"| startupOK | error");
  for(const [name, fx] of Object.entries(fixtures)){
    const ctx=await b.newContext({viewport:{width:800,height:700}}); const p=await ctx.newPage();
    const errs=[]; p.on("pageerror",e=>errs.push(e.message.split("\n")[0]));
    await p.addInitScript((val)=>{ try{ localStorage.clear(); localStorage.setItem("h2do-expenses", typeof val==="string"?val:JSON.stringify(val)); }catch(e){} }, fx);
    await p.goto(fileUrl); await p.waitForTimeout(500);
    const dp = await p.$eval("#datePicker", e=>e.value).catch(()=>"(none)");
    console.log(name.padEnd(42)+"| "+(dp===tk?"YES":"NO ").padEnd(9)+" | "+(errs[0]||"none"));
    await ctx.close();
  }
  await b.close();
})();
