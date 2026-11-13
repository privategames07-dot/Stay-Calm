const {test}=require('node:test'),assert=require('node:assert/strict');
const growth=require('../web/growth'),calm=require('../web/core');
test('100콤보 강화, 500·1000콤보 계수, 10레벨 상한과 소수 점수',()=>{
  for(const [level,expected] of [[0,[1,10,20]],[1,[1.1,10.5,21]],[12,[2,15,30]]]){
    assert.deepEqual([100,500,1000].map(n=>growth.feverFactor(level,n)),expected);
  }
  assert.equal(growth.score({tap:2},'manual',1.1),3.3);
  assert.equal(growth.score({pet:3},'pet',1.1),3.3);
  assert.equal(calm.count([{count:1.1},{count:2.2},{}]),4.3);
});
