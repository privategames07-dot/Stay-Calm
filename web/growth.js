'use strict';
const Growth=(()=>{
  const clickPrices=[500,2000,5000,10000];
  const skills=[
    {id:'tap',name:'다중클릭',max:4,prices:clickPrices,displayOffset:1},
    {id:'petPower',name:'펫 클릭 배수',max:4,prices:clickPrices,displayOffset:1},
    {id:'pet',name:'🐰 토끼 펫',base:50,max:20},
    {id:'fever',name:'피버 계수 강화',base:60,max:10},
    {id:'critical',name:'크리티컬 확률',base:500,max:10},
    {id:'criticalHit',name:'크리티컬 히트',base:1000,max:19,displayOffset:1},
    {id:'feverEase',name:'피버 진입 완화',base:1000,max:10},
    {id:'turtle',name:'🐢 거북이 해금',max:1,prices:[30000]},
    {id:'turtleSpeed',name:'거북이 속도',base:1000,max:10},
    {id:'turtleDamage',name:'거북이 피해',base:1500,max:9,displayOffset:1}
  ];
  function normalizeLevels(levels){
    const result={...levels};
    for(const skill of skills){
      const level=Number(levels[skill.id]??0);
      result[skill.id]=Number.isFinite(level)?Math.min(skill.max,Math.max(0,Math.floor(level))):0;
    }
    return result;
  }
  function displayLevel(skill,level){return level+(skill.displayOffset||0);}
  function cost(skill,level){return skill.prices?skill.prices[level]??0:skill.base*(level+1)**2;}
  const tapLevel=level=>Math.min(4,Math.max(0,level||0));
  const petLevel=level=>Math.min(20,Math.max(0,level||0));
  const feverMs=10000;
  const skillFactor=level=>1+Math.min(10,Math.max(0,level||0))/10;
  function feverFactor(level,combo){
    if(combo===100)return 2;
    const base=7+Math.log2(Math.min(combo,10000)/500);
    return base*skillFactor(level);
  }
  const cap=(n,max)=>Math.min(max,Math.max(0,n||0));
  function locked(id,levels){
    if(id==='criticalHit'&&cap(levels.critical,10)<5)return '크리티컬 확률 Lv.5 필요';
    if(id==='feverEase'&&cap(levels.fever,10)<10)return '피버 계수 강화 Lv.10 필요';
    if(id==='turtle'&&(petLevel(levels.pet)<20||tapLevel(levels.petPower)<4))return '토끼 Lv.20 · 펫 클릭 배수 Lv.5 필요';
    if((id==='turtleSpeed'||id==='turtleDamage')&&!levels.turtle)return '거북이 해금 필요';
    return '';
  }
  function feverStage(levels,combo){
    const reduction=locked('feverEase',levels)?0:cap(levels.feverEase,10)*20;
    if(combo===Math.max(20,100-reduction))return 100;
    const stage=combo+reduction;
    return stage>=500&&stage%500===0?stage:null;
  }
  function turtleInterval(levels){return 30000/(1+cap(levels.turtleSpeed,10)/10);}
  function score(levels,source,factor=1){
    let base=1+tapLevel(levels.tap);
    if(source==='pet')base=petLevel(levels.pet)*(1+tapLevel(levels.petPower));
    if(source==='turtle')base=levels.turtle?200*(1+cap(levels.turtleDamage,9)):0;
    return Math.round(base*factor*10)/10;
  }
  function hit(levels,source,factor=1,random=Math.random()){
    const critical=random<cap(levels.critical,10)/100;
    const multiplier=locked('criticalHit',levels)?5:5+5*cap(levels.criticalHit,19)/19;
    return {critical,count:Math.round(score(levels,source,factor)*(critical?multiplier:1)*10)/10};
  }
  function detail(id,level){
    if(id==='tap')return '직접 탭당 '+(1+tapLevel(level))+'회';
    if(id==='petPower')return '펫 클릭 ×'+(1+tapLevel(level));
    if(id==='pet')return '접속 중 5초마다 '+petLevel(level)+'회';
    if(id==='critical')return '확률 '+cap(level,10)+'%';
    if(id==='criticalHit')return '크리티컬 피해 ×'+(5+5*cap(level,19)/19).toFixed(2);
    if(id==='feverEase')return '첫 피버 '+Math.max(20,100-cap(level,10)*20)+'콤보 · 다음 '+(500-cap(level,10)*20)+'콤보';
    if(id==='turtle')return level?'30초마다 200회 · 토끼와 함께 활동':'미해금';
    if(id==='turtleSpeed')return '속도 ×'+(1+cap(level,10)/10).toFixed(1)+' · '+(turtleInterval({turtleSpeed:level})/1000).toFixed(2)+'초마다';
    if(id==='turtleDamage')return '기본 피해 '+(200*(1+cap(level,9)))+'회';
    return '500콤보부터 피버 계수 ×'+skillFactor(level).toFixed(1);
  }
  return {normalizeLevels,displayLevel,locked,feverStage,turtleInterval,hit,petLevel,tapLevel,skills,cost,score,detail,feverMs,feverFactor};
})();
if(typeof module!=='undefined')module.exports=Growth;
