/* Shared calendar values only. OAuth credentials never enter this module or storage. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MufCalendar=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const fields=['text','dueDate','dueTime','endTime','allDay','notes','location','link','reminders','cancelled'];
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function snapshot(t){return {text:t.text||'',dueDate:t.dueDate||'',dueTime:t.allDay?'':t.dueTime||'',endTime:t.allDay?'':t.endTime||'',allDay:!!t.allDay,notes:t.notes||'',location:t.location||'',link:t.link||'',reminders:[...new Set(t.reminders||[])].sort((a,b)=>a-b),cancelled:!!t.cancelled||!!t.deletedAt||['cancelled','skipped'].includes(t.status)};}
  function merge(base,local,remote){
    if(!base)return {value:local,conflicts:[]};
    const conflicts=[],value={...local};
    // A date and its times form one unit, avoiding invalid combinations after independent edits.
    const groups=[['dueDate','dueTime','endTime','allDay'],['text'],['notes'],['location'],['link'],['reminders']];
    if(local.cancelled!==remote.cancelled&&!equal(local,base)&&!equal(remote,base))conflicts.push('cancelled');
    for(const group of groups){const changed=(a,b)=>group.some(k=>!equal(a[k],b[k]));if(changed(remote,base)){if(changed(local,base)&&changed(local,remote))conflicts.push(...group);else group.forEach(k=>value[k]=remote[k]);}}
    if(remote.cancelled!==base.cancelled)value.cancelled=remote.cancelled;
    return {value,conflicts};
  }
  function toEvent(value,identity){
    const t=snapshot(value);if(t.reminders.length>5||t.reminders.some(n=>!Number.isInteger(n)||n<0||n>40320))throw Error('Google يقبل حتى خمسة تنبيهات، من وقت الموعد إلى أربعة أسابيع قبله. عدّل التنبيه قبل الربط.');if(!/^\d{4}-\d{2}-\d{2}$/.test(t.dueDate))throw Error('اختر تاريخًا قبل الربط.');
    let start,end;
    if(t.allDay){const d=new Date(t.dueDate+'T12:00:00');d.setDate(d.getDate()+1);const pad=n=>String(n).padStart(2,'0');start={date:t.dueDate};end={date:d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};}
    else{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.dueTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.endTime)||t.endTime<=t.dueTime)throw Error('حدد بداية ونهاية في اليوم نفسه قبل الربط.');start={dateTime:new Date(t.dueDate+'T'+t.dueTime+':00').toISOString()};end={dateTime:new Date(t.dueDate+'T'+t.endTime+':00').toISOString()};}
    return {summary:t.text,description:t.notes,location:t.location,start,end,status:t.cancelled?'cancelled':'confirmed',reminders:{useDefault:false,overrides:t.reminders.map(minutes=>({method:'popup',minutes}))},extendedProperties:{private:{mufakkirati:'v1',mufIdentity:identity,mufLink:t.link}}};
  }
  function fromEvent(event,base){
    if(event.status==='cancelled')return {...base,cancelled:true};
    if(event.reminders?.overrides?.some(r=>r.method!=='popup'))throw Error('اختر تنبيهات إشعار في Google؛ التنبيهات بالبريد لا يقابلها إعداد في المفكرة.');
    if(event.reminders?.useDefault)throw Error('اختر تنبيهات خاصة بهذا الموعد في Google بدل الإعداد الافتراضي، ثم أعد المزامنة.');
    if(event.recurrence?.length||event.recurringEventId)throw Error('غيّر هذه المرة في المفكرة؛ تكرار Google المستقل غير قابل للاستيراد هنا.');
    const allDay=!!event.start?.date,pad=n=>String(n).padStart(2,'0'),day=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()),clock=d=>pad(d.getHours())+':'+pad(d.getMinutes());let dueDate,dueTime='',endTime='';
    if(allDay){dueDate=event.start.date;const a=new Date(dueDate+'T12:00:00'),b=new Date(event.end?.date+'T12:00:00');a.setDate(a.getDate()+1);if(day(a)!==day(b))throw Error('الموعد يمتد لعدة أيام؛ راجعه في Google قبل المزامنة.');}
    else{const a=new Date(event.start?.dateTime),b=new Date(event.end?.dateTime);if(!Number.isFinite(+a)||!Number.isFinite(+b)||b<=a||day(a)!==day(b))throw Error('الموعد يعبر منتصف الليل أو وقته غير صالح؛ راجعه في Google.');dueDate=day(a);dueTime=clock(a);endTime=clock(b);}
    return {text:event.summary||'موعد بدون عنوان',dueDate,dueTime,endTime,allDay,notes:event.description||'',location:event.location||'',link:event.extendedProperties?.private?.mufLink||'',reminders:(event.reminders?.overrides||[]).filter(r=>r.method==='popup').map(r=>r.minutes).sort((a,b)=>a-b),cancelled:false};
  }
  function learningEffective(item,date){const out={...item};for(const c of [...(item.futureChanges||[])].sort((a,b)=>a.from.localeCompare(b.from)))if(c.from<=date)Object.assign(out,c.values);return out;}
  function learningOccurs(item,date){
    item=learningEffective(item,date);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||item.deletedAt)return false;
    if(item.termStart&&date<item.termStart||item.termEnd&&date>item.termEnd||(item.excludedDates||[]).includes(date))return false;
    return item.recurrence==='once'?item.date===date:new Date(date+'T12:00:00').getDay()===+item.day;
  }
  function learningConflictAffects(conflicts,row){
    const key={schedule:'schedule',prep:'preparations',course:'courses',read:'professionalReading'}[row.learningKind];
    return (conflicts||[]).some(c=>c.key===key&&c.id===row.external?.id||c.key==='calendarOccurrences'&&c.id===row.task?.id||c.key==='subjects'&&c.id===row.external?.subjectId);
  }
  function learningSource(kind,item,date,sourceRecurrence){
    const lecture=kind==='schedule';if(lecture)item=learningEffective(item,date);
    return snapshot({text:item.courseName||item.title||item.name,dueDate:lecture?(item.recurrence==='once'&&sourceRecurrence!=='weekly'?item.date:date):item.targetDate,dueTime:lecture?item.startTime:'',endTime:lecture?item.endTime:'',allDay:!lecture,notes:item.notes,location:lecture?item.room:'',link:item.url,reminders:item.reminders||[],cancelled:!!item.deletedAt||(lecture&&sourceRecurrence==='weekly'&&item.recurrence==='once'&&date!==item.date)||(lecture&&!learningOccurs(item,item.recurrence==='once'&&sourceRecurrence!=='weekly'?item.date:date))});
  }
  function learningTask(item,record){
    const source=learningSource(record.kind,item,record.date,record.sourceRecurrence),value={...source},base=record.sourceBase;
    // A later source edit deliberately replaces the acknowledged occurrence override
    // for that field group. Unchanged source fields retain individual Google edits.
    if(base&&record.value)for(const group of [['dueDate','dueTime','endTime','allDay'],['text'],['notes'],['location'],['link'],['reminders'],['cancelled']]){
      if(group.every(k=>equal(source[k],base[k])))group.forEach(k=>value[k]=record.value[k]);
    }
    if(source.cancelled)value.cancelled=true;
    const done=record.kind==='schedule'?['attended','delivered'].includes(record.outcome):['مكتملة','مكتمل','تم تقديمها'].includes(item.status);
    if(record.outcome==='cancelled')value.cancelled=true;
    return {...snapshot(value),id:record.id,kind:record.kind==='schedule'?'appointment':'task',category:'تعلم',done:done&&!value.cancelled,status:value.cancelled?'cancelled':done?'done':'pending',learningOutcome:record.outcome||'',calendarBinding:record.binding||undefined};
  }
  function learningNormalizeRecords(records){
    // Corrupt optional sync metadata must never make the entire learning document unreadable.
    const safeSnapshot=value=>{if(!value||typeof value!=='object')return null;const clean={};for(const key of fields)if(!['allDay','cancelled','reminders'].includes(key))clean[key]=typeof value[key]==='string'?value[key]:'';clean.allDay=!!value.allDay;clean.cancelled=!!value.cancelled;clean.reminders=Array.isArray(value.reminders)?value.reminders.filter(Number.isInteger):[];return snapshot(clean);};
    return (Array.isArray(records)?records:[]).filter(r=>r&&['schedule','prep','course','read'].includes(r.kind)&&typeof r.sourceId==='string'&&typeof r.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&r.id==='learning|'+r.kind+'|'+r.sourceId+'|'+(r.kind==='schedule'?r.date:'target')).map(r=>({id:r.id,kind:r.kind,sourceId:r.sourceId,date:r.date,sourceRecurrence:r.sourceRecurrence==='once'?'once':'weekly',outcome:['attended','delivered','absent','cancelled'].includes(r.outcome)?r.outcome:'',sourceBase:safeSnapshot(r.sourceBase),value:safeSnapshot(r.value),binding:r.binding?.ownerId===r.id&&typeof r.binding.calendarId==='string'&&typeof r.binding.eventId==='string'?{ownerId:r.id,calendarId:r.binding.calendarId,eventId:r.binding.eventId,base:safeSnapshot(r.binding.base),etag:String(r.binding.etag||''),webLink:String(r.binding.webLink||''),syncedAt:+r.binding.syncedAt||0}:null,updatedAt:+r.updatedAt||0}));
  }
  return {fields,snapshot,merge,toEvent,fromEvent,equal,learningEffective,learningOccurs,learningConflictAffects,learningSource,learningTask,learningNormalizeRecords};
});
