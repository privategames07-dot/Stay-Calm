const {test}=require('node:test');
const assert=require('node:assert/strict');
const {milestone,tangent}=require('../web/effects');
test('100회와 이후 500의 양의 배수에서 한 번만 축하',()=>{
  assert.deepEqual(Array.from({length:4002},(_,n)=>n).filter(milestone),[100,500,1000,1500,2000,2500,3000,3500,4000]);
});
test('화면 원주 위·오른쪽·아래·왼쪽에서 시계 방향 접선으로 발사',()=>{
  for(const a of [-Math.PI/2,0,Math.PI/2,Math.PI]){
    const {vx,vy}=tangent(a,123,7);
    assert.ok(Math.abs(Math.cos(a)*vy-Math.sin(a)*vx-123)<1e-8);
    assert.ok(Math.abs(Math.cos(a)*vx+Math.sin(a)*vy-7)<1e-8);
  }
});
