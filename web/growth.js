'use strict';
const Growth=(()=>{
  const skills=[
    {id:'tap',name:'다중클릭',max:4,prices:[500,2000,5000,10000]},
    {id:'pet',name:'🐹 햄스터 펫',base:40},
    {id:'fever',name:'피버 계수 강화',base:60,max:10}
  ];
  function cost(skill,level){return skill.prices?skill.prices[level]??0:skill.base*(level+1)**2;}
  const tapLevel=level=>Math.min(4,Math.max(0,level||0));
  const feverMs=10000;
  const skillFactor=level=>1+Math.min(10,Math.max(0,level||0))/10;
  function feverFactor(level,combo){
    if(combo===100)return 2;
    const base=7+Math.log2(Math.min(combo,10000)/500);
    return base*skillFactor(level);
  }
  function score(levels,source,factor=1){
    const base=source==='pet'?(levels.pet||0):1+tapLevel(levels.tap);
    return Math.round(base*factor*10)/10;
  }
  function detail(id,level){
    if(id==='tap')return '직접 탭당 '+(1+tapLevel(level))+'회';
    if(id==='pet')return level?'접속 중 5초마다 '+level+'회':'입양하면 접속 중 5초마다 1회';
    return '500콤보부터 피버 계수 ×'+skillFactor(level).toFixed(1);
  }
  return {tapLevel,skills,cost,score,detail,feverMs,feverFactor};
})();
if(typeof module!=='undefined')module.exports=Growth;
