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

test('펫 클릭 배수는 직접 클릭과 비용·상한을 공유하고 펫·피버에 곱한다',()=>{
  const tap=growth.skills.find(s=>s.id==='tap'),power=growth.skills.find(s=>s.id==='petPower');
  assert.equal(power.max,tap.max);
  assert.deepEqual([0,1,2,3].map(l=>growth.cost(power,l)),[500,2000,5000,10000]);
  assert.equal(growth.score({pet:0,petPower:4},'pet'),0);
  assert.equal(growth.score({pet:20,petPower:4},'pet'),100);
  assert.equal(growth.score({pet:20,petPower:99},'pet',14),1400);
  assert.equal(growth.score({pet:20,petPower:4,tap:1},'manual'),2);
});
test('크리티컬 확률 경계, 피해 강화 해금·최대치와 피버 곱연산',()=>{
  assert.equal(growth.hit({critical:0},'manual',1,0).critical,false);
  assert.equal(growth.hit({critical:10},'manual',1,.099).critical,true);
  assert.equal(growth.hit({critical:10},'manual',1,.1).critical,false);
  assert.equal(growth.hit({critical:4,criticalHit:19},'manual',1,0).count,5);
  assert.equal(growth.hit({tap:4,critical:10,criticalHit:19},'manual',14,0).count,700);
  assert.equal(growth.locked('criticalHit',{critical:5}),'');
  assert.equal(growth.feverStage({fever:9,feverEase:10},300),null);
  assert.equal(growth.feverStage({fever:10,feverEase:1},80),100);
  assert.equal(growth.feverStage({fever:10,feverEase:10},20),100);
  assert.equal(growth.feverStage({fever:10,feverEase:10},300),500);
  assert.equal(growth.feverStage({fever:10,feverEase:10},800),1000);
});
test('거북이 선행조건, 비용, 속도·피해 상한과 독립 곱연산',()=>{
  assert.notEqual(growth.locked('turtle',{pet:19,petPower:4}),'');
  assert.equal(growth.locked('turtle',{pet:20,petPower:4}),'');
  assert.equal(growth.cost(growth.skills.find(s=>s.id==='turtle'),0),30000);
  assert.equal(growth.turtleInterval({turtleSpeed:0}),30000);
  assert.equal(growth.turtleInterval({turtleSpeed:10}),15000);
  assert.equal(growth.score({turtle:1,turtleDamage:0},'turtle'),200);
  assert.equal(growth.hit({turtle:1,turtleDamage:9,critical:10,criticalHit:19},'turtle',14,0).count,280000);
});
test('모든 스킬의 표시 레벨과 현재 효과가 강화마다 구분되고 최대치에서 정확히 종료',()=>{
  for(const skill of growth.skills){
    const expectedOffset=['tap','petPower','criticalHit','turtleDamage'].includes(skill.id)?1:0;
    assert.equal(growth.displayLevel(skill,0),expectedOffset,skill.id);
    assert.equal(growth.displayLevel(skill,skill.max),skill.max+expectedOffset,skill.id);
    for(let level=0;level<skill.max;level++){
      assert.ok(growth.cost(skill,level)>0,skill.id);
      assert.notEqual(growth.detail(skill.id,level),growth.detail(skill.id,level+1),skill.id+' '+level);
    }
    assert.equal(growth.normalizeLevels({[skill.id]:999})[skill.id],skill.max,skill.id);
  }
  assert.equal(growth.detail('criticalHit',18),'크리티컬 피해 ×9.74');
  assert.equal(growth.detail('criticalHit',19),'크리티컬 피해 ×10.00');
  assert.ok(growth.detail('turtleSpeed',9).includes('×1.9'));
  assert.ok(growth.detail('turtleSpeed',10).includes('×2.0'));
  assert.equal(growth.hit({critical:5,criticalHit:18},'manual',1,0).count,9.7);
  assert.equal(growth.hit({critical:5,criticalHit:19},'manual',1,0).count,10);
});
