'use strict';
const Growth=(()=>{
  const skills=[
    {id:'tap',name:'손끝 단련',base:20},
    {id:'pet',name:'🐹 햄스터 펫',base:40},
    {id:'fever',name:'피버 계수 강화',base:60,max:10}
  ];
  function cost(skill,level){return skill.base*(level+1)**2;}
  const feverMs=10000;
  const skillFactor=level=>1+Math.min(10,Math.max(0,level||0))/10;
  function feverFactor(level,combo){
    if(combo===100)return 2;
    const base=7+Math.log2(Math.min(combo,10000)/500);
    return base*skillFactor(level);
  }
  function score(levels,source,factor=1){
    const base=source==='pet'?(levels.pet||0):1+(levels.tap||0);
    return Math.round(base*factor*10)/10;
  }
  function detail(id,level){
    if(id==='tap')return '직접 탭당 '+(1+level)+'회';
    if(id==='pet')return level?'접속 중 5초마다 '+level+'회':'입양하면 접속 중 5초마다 1회';
    return '500콤보부터 피버 계수 ×'+skillFactor(level).toFixed(1);
  }
  return {skills,cost,score,detail,feverMs,feverFactor};
})();
if(typeof module!=='undefined')module.exports=Growth;
