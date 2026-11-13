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

test('다중클릭은 기본 Lv1부터 Lv5까지만 강화하고 구버전 과성장을 제한',()=>{
  const tap=growth.skills.find(s=>s.id==='tap');
  assert.deepEqual([0,1,2,3].map(l=>growth.cost(tap,l)),[500,2000,5000,10000]);
  assert.equal(tap.max,4);
  assert.equal(growth.score({tap:0},'manual'),1);
  assert.equal(growth.score({tap:3},'manual'),4);
  assert.equal(growth.score({tap:4},'manual'),5);
  assert.equal(growth.score({tap:20},'manual'),5);
  assert.equal(growth.score({tap:20},'manual',2),10);
});

test('펫은 Lv0부터 Lv20까지 레벨과 같은 자동 클릭 횟수, 마지막 강화 20000',()=>{
  const pet=growth.skills.find(s=>s.id==='pet');
  assert.equal(pet.max,20);
  assert.deepEqual([0,4,9,19].map(l=>growth.cost(pet,l)),[50,1250,5000,20000]);
  for(const level of [0,1,5,20,99]){
    assert.equal(growth.score({pet:level},'pet'),Math.min(20,level));
  }
  assert.equal(growth.score({pet:20},'pet',2),40);
});
