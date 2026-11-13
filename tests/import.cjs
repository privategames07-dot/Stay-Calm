const {test}=require('node:test');
const assert=require('node:assert/strict');
const {courseTitle,detectGrid,scanCourses}=require('../web/import.js');

test('여러 줄의 한글·영문 제목을 이어 붙이고 강의실에서 중단',()=>{
  function title(lines){return courseTitle(lines.map((text,i)=>({x:.3,y:(i+1)/10,h:.05,text})));}
  assert.equal(title(['자기주도스포','츠','미래관1층15호실']),'자기주도스포츠');
  assert.equal(title(['College En','glish I(ABE','EK)','북악관8층4호실']),'College English I(ABEEK)');
  assert.equal(title(['일반물리실험I','I','과학관지하1층2-','2호실']),'일반물리실험II');
  assert.equal(title(['자동차모빌리','티 Adventur','e Design','공학관3층52호']),'자동차모빌리티 Adventure Design');
});

test('전체 화면 격자, 오전/오후 눈금, 붙어 있는 색상 칸과 반시 수업',()=>{
  const width=560,height=1000,data=new Uint8ClampedArray(width*height*4);
  function rect(x,y,w,h,rgb){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){data.set([...rgb,255],4*(j*width+i));}}
  rect(0,0,width,height,[17,17,17]);
  for(let i=0;i<=5;i++)rect(38+i*100,140,2,633,[49,49,49]);
  for(let i=0;i<=10;i++)rect(10,170+i*60,530,2,[49,49,49]);
  rect(140,261,98,88,[150,200,100]);rect(240,261,98,88,[100,130,200]);rect(240,351,98,88,[90,180,160]);
  const words=Array.from({length:10},(_,i)=>({x:28/width,y:(178+i*60)/height,text:String((9+i-1)%12+1)}));
  const frame={width,height,data},grid=detectGrid(frame,words);
  assert.ok(grid?.certain);assert.equal(grid.start,540);assert.equal(grid.end,1140);
  assert.deepEqual(scanCourses(frame,[],grid).map(s=>[s.weekday,s.start,s.end]),[[2,630,720],[3,630,720],[3,720,810]]);
});
