'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),P=require('../planner-core');
test('Arabic input recognizes date/time/duration and flags ambiguous hours',()=>{
 assert.deepEqual(P.parse('موعد طبيب بكرة ٥ مساءً لمدة نصف ساعة','2026-10-14'),{dueDate:'2026-10-15',dueTime:'17:00',durationMinutes:30,kind:'appointment'});
 assert.equal(P.parse('اتصال الساعة ٥','2026-10-14').ambiguousTime,true);assert.equal(P.parse('اتصال الساعة ٥','2026-10-14').dueTime,undefined);
 assert.equal(P.parse('بعد غد الساعة ١٣:٣٠','2026-10-14').dueDate,'2026-10-16');assert.equal(P.parse('الخميس','2026-10-14').dueDate,'2026-10-15');
});
test('date arithmetic handles leap years and rejects impossible dates',()=>{assert.equal(P.date('2026-02-30'),null);assert.equal(P.plus('2028-02-28',1),'2028-02-29');assert.equal(P.plus('2026-12-31',1),'2027-01-01');});
test('weekly intervals and count use series anchor instead of the last generated occurrence',()=>{const t={repeat:'weekly',repeatAnchor:'2026-10-14',repeatDays:[0,3],repeatInterval:2,repeatCount:3};assert.equal(P.occurs(t,'','2026-10-14'),true);assert.equal(P.occurs(t,'','2026-10-18'),false);assert.equal(P.occurs(t,'','2026-10-25'),true);assert.equal(P.occurs(t,'','2026-10-28'),true);assert.equal(P.occurs(t,'','2026-11-08'),false);});
test('monthly recurrence handles last day and configured workdays',()=>{assert.equal(P.occurs({repeat:'monthly',repeatAnchor:'2026-01-31'},'','2026-02-28'),true);assert.equal(P.occurs({repeat:'monthly',repeatAnchor:'2026-01-01',repeatMonthlyMode:'first_workday',workdays:[1,2,3,4,5]},'','2026-02-02'),true);assert.equal(P.occurs({repeat:'monthly',repeatAnchor:'2026-01-01',repeatUntil:'2026-02-01'},'','2026-03-01'),false);});
test('yearly leap-day recurrence and completion-based dates',()=>{assert.equal(P.occurs({repeat:'yearly',repeatAnchor:'2024-02-29'},'','2025-02-28'),true);assert.equal(P.afterCompletion({repeat:'monthly',repeatInterval:3},'2026-11-30'),'2027-02-28');assert.equal(P.afterCompletion({repeat:'weekly',repeatInterval:2},'2026-12-25'),'2027-01-08');});
test('conflicts include preparation buffers but exclude touching boundaries and completed tasks',()=>{const rows=[{date:'2026-10-14',task:{id:'a',dueTime:'10:00',endTime:'11:00',status:'pending'}}];assert.equal(P.conflicts({id:'b',dueDate:'2026-10-14',dueTime:'11:00',endTime:'12:00'},rows).length,0);assert.equal(P.conflicts({id:'b',dueDate:'2026-10-14',dueTime:'11:00',endTime:'12:00',bufferMinutes:15},rows)[0].minutes,15);assert.deepEqual(P.slots(rows,'2026-10-14','09:00','12:00',60),[{start:'09:00',end:'10:00'},{start:'11:00',end:'12:00'}]);});
test('calendar export escapes content, folds Arabic UTF-8 safely, exports exclusive all-day end',()=>{const ics=P.ics({id:'a',text:'زيارة، '+ 'العائلة'.repeat(30)+'\nBEGIN:VEVENT',dueDate:'2026-12-31',allDay:true,reminders:[15]});assert.ok(ics.includes('DTEND;VALUE=DATE:20270101'));assert.ok(ics.includes('TRIGGER:-PT15M'));assert.equal(ics.split('\r\n').filter(x=>x==='BEGIN:VEVENT').length,1);assert.ok(ics.split('\r\n').every(line=>Buffer.byteLength(line)<=75));});
test('calendar export keeps a timed appointment duration',()=>{const ics=P.ics({id:'a',text:'موعد',dueDate:'2026-10-14',dueTime:'17:00',endTime:'17:30'});const parse=s=>new Date(s.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/,'$1-$2-$3T$4:$5:$6Z'));assert.equal(parse(ics.match(/DTEND:(.*)/)[1])-parse(ics.match(/DTSTART:(.*)/)[1]),30*60000);});
test('start-only tasks conflict inside a booked interval without inventing duration',()=>{
 const date='2026-10-15',lecture={id:'lecture',dueTime:'09:00',endTime:'11:00'},point={id:'task',dueDate:date,dueTime:'10:00'};
 assert.equal(P.conflicts(point,[{date,task:lecture}]).length,1);
 assert.equal(P.conflicts({...point,dueTime:'11:00'},[{date,task:lecture}]).length,0);
 assert.equal(P.conflicts({...lecture,dueDate:date},[{date,task:point}]).length,1);
 assert.equal(P.range(point),null);
});
