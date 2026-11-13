'use strict';
const Growth=(()=>{
  const skills=[
    {id:'tap',name:'손끝 단련',base:20},
    {id:'pet',name:'🐹 햄스터 펫',base:40},
    {id:'focus',name:'집중 타격',base:60}
  ];
  function cost(skill,level){return skill.base*(level+1)**2;}
  function score(levels,source,combo){
    if(source==='pet')return levels.pet||0;
    return 1+(levels.tap||0)+(combo>0&&combo%10===0?5*(levels.focus||0):0);
  }
  function detail(id,level){
    if(id==='tap')return '직접 탭당 '+(1+level)+'회';
    if(id==='pet')return level?'접속 중 5초마다 '+level+'회':'입양하면 접속 중 5초마다 1회';
    return '10콤보마다 추가 '+(5*level)+'회';
  }
  return {skills,cost,score,detail};
})();
if(typeof module!=='undefined')module.exports=Growth;
