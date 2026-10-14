const {test}=require('node:test'),assert=require('node:assert/strict');
const {device,chromium}=require('./audit-browser-helper.cjs');
test('failed notification can retry; concurrent calls and successful delivery deduplicate',async()=>{
  const browser=await chromium.launch();
  try{
    const {p,c}=await device(browser);
    const result=await p.evaluate(async()=>{
      const a=window.audit;
      let attempts=0,fail=true;
      class FakeNotification{static permission='granted';constructor(){throw Error('unavailable');}}
      window.Notification=FakeNotification;
      Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:async()=>({showNotification:async()=>{attempts++;if(fail)throw Error('failed');}})}});
      const first=await a.notifyShow('title','body','retry');
      const afterFail=a.notifyWasSent('retry');
      fail=false;
      await Promise.all([a.notifyShow('title','body','retry'),a.notifyShow('title','body','retry')]);
      await a.notifyShow('title','body','retry');
      return {first,afterFail,afterSuccess:a.notifyWasSent('retry'),attempts};
    });
    assert.deepEqual(result,{first:false,afterFail:false,afterSuccess:true,attempts:2});
    await c.close();
  }finally{await browser.close();}
});
test('desktop fallback succeeds after service worker rejection and stale sent records expire',async()=>{
  const browser=await chromium.launch();
  try{
    const {p,c}=await device(browser);
    const result=await p.evaluate(async()=>{
      let count=0;
      window.Notification=class{static permission='granted';constructor(){count++;}};
      Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:async()=>{throw Error('worker unavailable');}}});
      localStorage.setItem('h2do-notify-sent-v1',JSON.stringify({old:Date.now()-4*86400000}));
      const expired=!audit.notifyWasSent('old');
      const ok=await audit.notifyShow('title','body','old');
      await audit.notifyShow('title','body','old');
      return {expired,ok,count,sent:audit.notifyWasSent('old')};
    });
    assert.deepEqual(result,{expired:true,ok:true,count:1,sent:true});
    await c.close();
  }finally{await browser.close();}
});
