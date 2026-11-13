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

test('분별 수동·두 펫 점수를 합산하고 원본 로그를 유지',()=>{
  const rows=[{clock:'09:10',count:1.1},{clock:'09:10',source:'manual',count:2.2},{clock:'09:10',source:'pet',count:5},{clock:'09:10',source:'turtle',count:200},{clock:'09:11',count:1}];
  const before=JSON.stringify(rows);
  assert.deepEqual(C.minuteSummary(rows),[{clock:'09:10',manual:3.3,pet:205},{clock:'09:11',manual:1,pet:0}]);
  assert.equal(JSON.stringify(rows),before);
});
test('예전 로그의 콤보를 복원하고 펫을 제외하며 이름별 최고를 공유',()=>{
  const day='2026-11-16',slot={id:'a',name:'정역학'};
  const rows=[{day,slot,at:0},{day,slot,at:1000,source:'pet'},{day,slot,at:4500},{day,slot,at:9500},{day,slot:{id:'b',name:'정역학'},at:10000,combo:12},{day,slot:null,at:11000,combo:3}];
  assert.equal(C.bestCombos(rows).get('정역학'),12);
  assert.equal(C.bestCombos(rows.slice(0,4)).get('정역학'),2);
  assert.equal(C.bestCombos(rows).get(''),3);
});
