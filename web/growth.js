'use strict';
const Growth=(()=>{
  const skills=[
    {id:'tap',name:'손끝 단련',base:20},
    {id:'pet',name:'🐹 햄스터 펫',base:40},
    {id:'fever',name:'피버타임 강화',base:60,max:10}
  ];
  function cost(skill,level){return skill.base*(level+1)**2;}
  const feverMs=5000;
  function feverFactor(level,combo){
    const tenths=10+Math.max(0,Math.min(10,level||0));
    return combo===100?tenths/10:(tenths+10)*(combo/100)/10;
  }
  function score(levels,source,factor=1){
    const base=source==='pet'?(levels.pet||0):1+(levels.tap||0);
    return Math.round(base*factor*10)/10;
  }
  function detail(id,level){
    if(id==='tap')return '직접 탭당 '+(1+level)+'회';
    if(id==='pet')return level?'접속 중 5초마다 '+level+'회':'입양하면 접속 중 5초마다 1회';
    return '100콤보 피버 ×'+feverFactor(level,100).toFixed(1);
  }
  return {skills,cost,score,detail,feverMs,feverFactor};
})();
if(typeof module!=='undefined')module.exports=Growth;
