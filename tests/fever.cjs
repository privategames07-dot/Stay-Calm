const {test}=require('node:test'),assert=require('node:assert/strict');
const growth=require('../web/growth'),calm=require('../web/core');
test('100콤보 강화, 500·1000콤보 계수, 10레벨 상한과 소수 점수',()=>{
  assert.equal(growth.feverMs,10000);
  for(const level of [0,1,5,10,11]){
    assert.equal(growth.feverFactor(level,100),2);
    const factor=1+Math.min(10,level)/10;
    for(const [combo,base] of [[500,7],[1000,8],[2000,9],[8000,11]]){
      assert.equal(growth.feverFactor(level,combo),base*factor);
    }
    assert.equal(growth.feverFactor(level,10000).toFixed(2),((7+Math.log2(20))*factor).toFixed(2));
    assert.equal(growth.feverFactor(level,15000),growth.feverFactor(level,10000));
  }
  assert.equal(growth.score({tap:2},'manual',1.1),3.3);
  assert.equal(growth.score({pet:3},'pet',1.1),3.3);
  assert.equal(calm.count([{count:1.1},{count:2.2},{}]),4.3);
});
