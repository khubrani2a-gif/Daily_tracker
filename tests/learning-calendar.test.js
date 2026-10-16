const test=require('node:test'),assert=require('node:assert/strict'),C=require('../calendar-core');
const lecture={id:'lecture',courseName:'Physics',recurrence:'weekly',day:4,startTime:'09:00',endTime:'11:00',room:'A'};
test('learning source occurrence identity and atomic overrides preserve the weekly template',()=>{
 const src=C.learningSource('schedule',lecture,'2026-10-15');
 const record={id:'learning|schedule|lecture|2026-10-15',kind:'schedule',sourceId:'lecture',date:'2026-10-15',sourceBase:src,value:{...src,dueDate:'2026-10-16',dueTime:'10:00',endTime:'12:00'}};
 assert.equal(C.learningTask(lecture,record).dueDate,'2026-10-16');
 assert.equal(C.learningTask({...lecture,room:'B'},record).location,'B');
 assert.equal(C.learningTask({...lecture,startTime:'08:00'},record).dueDate,'2026-10-15');
 assert.equal(C.learningTask({...lecture,deletedAt:1},record).cancelled,true);
 assert.equal(lecture.startTime,'09:00');
});
test('learning targets are all-day without inventing hours',()=>{
 const t=C.learningSource('course',{name:'Certificate',targetDate:'2026-11-01',url:'https://example.com'},'');
 assert.equal(t.allDay,true);assert.equal(t.dueDate,'2026-11-01');assert.equal(C.toEvent(t,'x').start.date,'2026-11-01');
});
test('weekly converted to once cancels other linked occurrences instead of moving them all',()=>{
 const once={...lecture,recurrence:'once',date:'2026-10-22'};
 const records=['2026-10-15','2026-10-22','2026-10-29'].map(date=>({id:'learning|schedule|lecture|'+date,kind:'schedule',sourceId:'lecture',date,sourceRecurrence:'weekly'}));
 const projected=records.map(r=>C.learningTask(once,r));assert.equal(projected.filter(t=>!t.cancelled).length,1);assert.equal(projected.find(t=>!t.cancelled).dueDate,'2026-10-22');
});
test('malformed nested calendar metadata cannot prevent normalization of other records',()=>{
 const id='learning|schedule|lecture|2026-10-15';const bad={id,kind:'schedule',sourceId:'lecture',date:'2026-10-15',value:{reminders:{}},sourceBase:{text:{}},binding:{ownerId:id,eventId:'e',calendarId:'c',base:{reminders:42}}};
 const records=C.learningNormalizeRecords([bad,null,{broken:true}]);assert.equal(records.length,1);assert.deepEqual(records[0].value.reminders,[]);assert.equal(records[0].sourceBase.text,'');
});
