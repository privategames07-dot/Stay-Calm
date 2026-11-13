const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../web/core.js');
const mk=(day,clock)=>new Date(day+'T'+clock+':00');
const a={id:'a',name:'정역학',weekday:1,start:540,end:600},b={id:'b',name:'공학수학',weekday:1,start:600,end:660};
test('시작 포함·종료 제외 및 겹치는 수업',()=>{
  assert.deepEqual(C.active([a,b],mk('2026-11-16','10:00')),[b]);
  assert.deepEqual(C.active([a,b],mk('2026-11-16','08:59')),[]);
  assert.equal(C.active([a,{...a,id:'c'}],mk('2026-11-16','09:59')).length,2);
});
test('수업과 시간대 순위에서 공강 및 다른 주를 제외하고 동점을 보존',()=>{
  const rows=[C.tap(a,mk('2026-11-16','09:30')),C.tap(b,mk('2026-11-16','10:20')),C.tap(null,mk('2026-11-16','08:59')),C.tap(a,mk('2026-11-23','09:00'))];
  const s=C.stats(rows,'2026-11-22');
  assert.equal(s.total,2);assert.equal(s.outside,1);assert.equal(s.first,'2026-11-16');assert.deepEqual(s.hours,[[9,1],[10,1]]);assert.deepEqual(s.subjects.map(x=>x[1]),[1,1]);
});
test('시간표 수정 이후 당시 수업명과 날짜 유지',()=>{
  const slot={...a};const ev=C.tap(slot,mk('2026-11-16','09:59'));slot.name='변경';slot.start=600;assert.equal(ev.slot.name,'정역학');assert.equal(ev.slot.start,540);assert.equal(ev.day,'2026-11-16');
});
