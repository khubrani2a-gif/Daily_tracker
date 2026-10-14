(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MufPlanner=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const pad=n=>String(n).padStart(2,'0');
  const key=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  function date(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return null;const d=new Date(s+'T12:00:00');return key(d)===s?d:null;}
  const plus=(s,n)=>{const d=date(s);if(!d)return '';d.setDate(d.getDate()+n);return key(d);};
  const days=(a,b)=>Math.round((date(b)-date(a))/86400000);
  const minutes=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t||'')?Number(t.slice(0,2))*60+Number(t.slice(3)):null;
  const time=m=>pad(Math.floor(m/60))+':'+pad(m%60);
  const active=t=>!t.deletedAt&&!['done','cancelled','skipped'].includes(t.status)&&!t.done;
  function matches(t,anchor,s){
    const a=date(anchor),d=date(s),interval=Math.max(1,Math.min(99,Number(t.repeatInterval)||1));if(!a||!d||s<anchor)return false;
    if(t.repeat==='daily')return days(anchor,s)%interval===0;
    if(t.repeat==='weekly'){
      const weekdays=t.repeatDays?.length?t.repeatDays:[a.getDay()],weekStart=Number(t.weekStart??0);
      const start=plus(anchor,-((a.getDay()-weekStart+7)%7));
      return Math.floor(days(start,s)/7)%interval===0&&weekdays.includes(d.getDay());
    }
    if(t.repeat==='monthly'){
      const months=(d.getFullYear()-a.getFullYear())*12+d.getMonth()-a.getMonth();
      if(months%interval)return false;
      const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();let day=Math.min(Number(t.repeatMonthlyDay)||a.getDate(),last);
      if(t.repeatMonthlyMode==='last_day')day=last;
      if(t.repeatMonthlyMode==='first_workday'){day=1;const work=t.workdays?.length?t.workdays:[0,1,2,3,4];while(day<=7&&!work.includes(new Date(d.getFullYear(),d.getMonth(),day).getDay()))day++;}
      return d.getDate()===day;
    }
    if(t.repeat==='yearly')return (d.getFullYear()-a.getFullYear())%interval===0&&d.getMonth()===a.getMonth()&&d.getDate()===Math.min(a.getDate(),new Date(d.getFullYear(),a.getMonth()+1,0).getDate());
    return false;
  }
  function occurs(t,fallback,s){
    if(!date(s)||t.occurrenceOnly)return false;
    const anchor=t.repeatAnchor||t.dueDate||fallback;if(!date(anchor)||s<anchor||t.repeatUntil&&s>t.repeatUntil)return false;
    if(t.repeatMode==='completion')return s===anchor;
    if(!matches(t,anchor,s))return false;
    if(t.repeatCount){
      const a=date(anchor),d=date(s),interval=Math.max(1,Number(t.repeatInterval)||1);let n=0;
      if(t.repeat==='daily')n=days(anchor,s)/interval+1;
      else if(t.repeat==='weekly'){
        const weekStart=Number(t.weekStart??0),base=plus(anchor,-((a.getDay()-weekStart+7)%7)),week=Math.floor(days(base,s)/7);
        (t.repeatDays?.length?t.repeatDays:[a.getDay()]).forEach(day=>{const first=plus(base,(day-weekStart+7)%7),lastWeek=Math.floor((days(first,s))/7);if(lastWeek>=0)n+=Math.floor(lastWeek/interval)+1;if(first<anchor)n--;});
      }else if(t.repeat==='monthly'){
        n=Math.floor(((d.getFullYear()-a.getFullYear())*12+d.getMonth()-a.getMonth())/interval)+1;
        let firstMonthHasOccurrence=false;for(let i=a.getDate();i<=new Date(a.getFullYear(),a.getMonth()+1,0).getDate();i++)if(matches(t,anchor,key(new Date(a.getFullYear(),a.getMonth(),i,12))))firstMonthHasOccurrence=true;
        if(!firstMonthHasOccurrence)n--;
      }else if(t.repeat==='yearly')n=(d.getFullYear()-a.getFullYear())/interval+1;
      if(n>t.repeatCount)return false;
    }
    return true;
  }
  function next(t,after){if(!t.repeat||t.repeat==='none')return '';if(t.repeatMode==='completion'){const n=afterCompletion(t,after);return t.repeatCount===1||t.repeatUntil&&n>t.repeatUntil?'':n;}for(let i=1;i<=36600;i++){const s=plus(after,i);if(t.repeatUntil&&s>t.repeatUntil)return '';if(occurs(t,t.dueDate,s))return s;}return '';}
  function afterCompletion(t,s){
    const d=date(s),n=Math.max(1,Number(t.repeatInterval)||1);if(!d)return '';
    if(t.repeat==='daily'||t.repeat==='weekly')return plus(s,n*(t.repeat==='weekly'?7:1));
    const day=d.getDate();d.setDate(1);if(t.repeat==='monthly')d.setMonth(d.getMonth()+n);else d.setFullYear(d.getFullYear()+n);d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));return key(d);
  }
  function range(t){const start=minutes(t.dueTime);if(start===null||t.allDay)return null;let end=minutes(t.endTime);if(end===null&&t.durationMinutes)end=start+Number(t.durationMinutes);if(end===null||end<=start)return null;return {start:Math.max(0,start-(+t.bufferMinutes||0)),end};}
  function conflicts(t,rows){const a=range(t);if(!a||!t.dueDate)return [];return rows.filter(r=>r.task.id!==t.id&&r.date===t.dueDate&&active(r.task)).flatMap(r=>{const b=range(r.task);if(!b)return [];const overlap=Math.min(a.end,b.end)-Math.max(a.start,b.start);return overlap>0?[{row:r,minutes:overlap}]:[];});}
  function slots(rows,s,start,end,duration){
    const a=minutes(start),b=minutes(end);if(a===null||b===null||b<=a||!duration)return [];
    const busy=rows.filter(r=>r.date===s&&active(r.task)).map(r=>range(r.task)).filter(Boolean).sort((x,y)=>x.start-y.start),out=[];let cursor=a;
    busy.forEach(r=>{if(r.start-cursor>=duration)out.push({start:time(cursor),end:time(cursor+duration)});cursor=Math.max(cursor,r.end);});if(b-cursor>=duration)out.push({start:time(cursor),end:time(cursor+duration)});return out.filter(x=>minutes(x.end)<=b).slice(0,3);
  }
  function parse(text,base){
    const v=String(text).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))),out={};
    if(/بعد غد|بعد بكر[هةا]/.test(v))out.dueDate=plus(base,2);else if(/غد|بكر[هةا]/.test(v))out.dueDate=plus(base,1);else if(/اليوم/.test(v))out.dueDate=base;
    const weekday=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'].findIndex(x=>v.replace(/أ|إ/g,'ا').includes(x.replace(/أ|إ/g,'ا')));
    if(!out.dueDate&&weekday>=0)out.dueDate=plus(base,(weekday-date(base).getDay()+7)%7||7);
    const iso=v.match(/\b\d{4}-\d{2}-\d{2}\b/);if(iso&&date(iso[0]))out.dueDate=iso[0];
    const m=v.match(/(?:الساعة\s*|\s)(\d{1,2})(?::(\d{2}))?\s*(صباح(?:ًا|ا)?|مساء(?:ً|ا|ًا)?|ص|م)(?:\s|$)/)||v.match(/الساعة\s*(\d{1,2})(?::(\d{2}))?/);
    if(m){let hour=+m[1];const min=+(m[2]||0);if(hour<=23&&min<60){if(m[3]){if(hour<=12){hour=hour%12+(/^م/.test(m[3])?12:0);out.dueTime=pad(hour)+':'+pad(min);}}else if(hour>12||hour===0)out.dueTime=pad(hour)+':'+pad(min);else out.ambiguousTime=true;}}
    const duration=v.match(/لمدة\s*(\d+)\s*(دقيقة|دقائق|ساعة|ساعات)/);if(duration)out.durationMinutes=+duration[1]*(duration[2].includes('ساع')?60:1);else if(/نصف ساعة/.test(v))out.durationMinutes=30;else if(/ربع ساعة/.test(v))out.durationMinutes=15;
    if(/موعد|اجتماع|زيارة|محاضرة/.test(v))out.kind='appointment';
    if(/كل يوم|يومي/.test(v))out.repeat='daily';else if(/كل أسبوع|أسبوعي/.test(v))out.repeat='weekly';else if(/كل شهر|شهري/.test(v))out.repeat='monthly';
    return out;
  }
  const escape=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  function ics(t){
    if(!date(t.dueDate))throw new Error('date required');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Mufakkirati//Planner//AR','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+escape(t.id)+'@mufakkirati','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z'),'SUMMARY:'+escape(t.text)];
    if(t.allDay||!t.dueTime)lines.push('DTSTART;VALUE=DATE:'+t.dueDate.replace(/-/g,''),'DTEND;VALUE=DATE:'+plus(t.dueDate,1).replace(/-/g,''));
    else{const start=new Date(t.dueDate+'T'+t.dueTime+':00'),end=new Date(t.dueDate+'T'+(t.endTime||time(Math.min(1439,minutes(t.dueTime)+(+t.durationMinutes||30))))+':00');if(end<=start)end.setTime(start.getTime()+30*60000);const utc=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');lines.push('DTSTART:'+utc(start),'DTEND:'+utc(end));}
    if(t.location)lines.push('LOCATION:'+escape(t.location));if(t.notes||t.link)lines.push('DESCRIPTION:'+escape([t.notes,t.link].filter(Boolean).join('\n')));
    (t.reminders||[]).forEach(n=>{if(Number.isFinite(n)&&n>=0)lines.push('BEGIN:VALARM','TRIGGER:-PT'+n+'M','ACTION:DISPLAY','DESCRIPTION:'+escape(t.text),'END:VALARM');});lines.push('END:VEVENT','END:VCALENDAR');
    return lines.map(line=>{let out='',bytes=0;for(const c of line){const n=new TextEncoder().encode(c).length;if(bytes+n>73){out+='\r\n ';bytes=1;}out+=c;bytes+=n;}return out;}).join('\r\n')+'\r\n';
  }
  return {date,key,plus,days,minutes,time,active,occurs,next,afterCompletion,range,conflicts,slots,parse,ics};
});
