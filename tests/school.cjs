const test=require('node:test');
const assert=require('node:assert/strict');
const school=require('../web/school.js');

test('printed starts take priority after lunch and inferred starts include recess',()=>{
  const periods=[550,null,660,715,810,null].map(start=>({start}));
  assert.deepEqual(school.starts(periods,'middle'),[550,605,660,715,810,865]);
  assert.deepEqual(school.starts([null,610,null,730,840,null].map(start=>({start})),'high'),[550,610,670,730,840,900]);
  assert.equal(school.duration('middle'),45);
  assert.equal(school.duration('high'),50);
  assert.equal(school.printedTime([{text:'5 (13：30)'}]),810);
  assert.equal(school.printedTime([{text:'5'}]),null);
});

test('weekly grid separates subject, teacher, empty highlights and footer',()=>{
  const width=320,height=380,data=new Uint8Array(width*height*4).fill(255);
  function fill(left,top,right,bottom,r,g=r,b=r){
    for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)data.set([r,g,b,255],4*(y*width+x));
  }
  const rails=[5,61,111,161,211,261,311],rows=[55,90,130,170,210];
  for(const x of rails)fill(x,55,x+2,212,211);
  for(const y of rows)fill(5,y,313,y+2,211);
  fill(65,132,108,168,255,255,90);
  fill(74,97,90,105,0);fill(74,116,90,123,0);
  fill(5,278,313,280,211);fill(5,327,313,329,211);
  const word=(text,x,y)=>({text,x:x/width,y:y/height});
  const frame={width,height,data},grid=school.detect(frame);
  const result=school.read(frame,[word('고등학교',90,32),word('체육',81,101),word('장건',81,119),word('1(09:10)',33,110)],grid);
  assert.equal(result.grade,'high');
  assert.equal(result.periods.length,3);
  assert.equal(result.periods[0].start,550);
  assert.deepEqual(result.periods.flatMap(p=>p.cells.map(c=>[c.weekday,c.name])),[[1,'체육']]);
});
