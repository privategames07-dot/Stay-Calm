// Pixel geometry and Vision text observations share normalized, top-left coordinates.
function timetablePixels(image) {
  const scale=Math.min(1,1200/image.naturalWidth);
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(image.naturalWidth*scale);
  canvas.height=Math.round(image.naturalHeight*scale);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return ctx.getImageData(0,0,canvas.width,canvas.height);
}

function peakCenters(scores,threshold){
  const peaks=[];
  let start=-1,best=0,first=0,last=0;
  for(let i=0;i<=scores.length;i++){
    if(i<scores.length && scores[i]>=threshold){
      if(start<0){start=i;best=0;}
      if(scores[i]>best){best=scores[i];first=last=i;}
      else if(scores[i]===best)last=i;
    }else if(start>=0){
      if(i-start<15)peaks.push(Math.round((first+last)/2));
      start=-1;
    }
  }
  return peaks;
}
function median(numbers){const sorted=[...numbers].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];}

function detectGrid(frame,words){
  const {width:w,height:h,data}=frame;
  const color=(x,y)=>data[4*(y*w+x)];
  const neutral=(x,y)=>{const i=4*(y*w+x);return Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])<10;};
  const gap=Math.max(3,Math.round(w*.0035)), xs=new Float32Array(w);
  for(let x=0;x<w;x++){
    for(let y=0;y<h;y+=4){
      const v=color(x,y);
      if(!neutral(x,y)||v<26||v>249)continue;
      const left=color(Math.max(0,x-gap),y),right=color(Math.min(w-1,x+gap),y);
      if(Math.max(Math.abs(v-left),Math.abs(v-right))>=13)xs[x]++;
    }
  }
  const rails=peakCenters(xs,Math.max(8,h*.13/4));
  const nearest=(values,v,tol)=>values.reduce((best,x)=>Math.abs(x-v)<=tol&&(best===null||Math.abs(x-v)<Math.abs(best-v))?x:best,null);
  let best=null;
  for(let a=0;a<rails.length;a++)for(let b=a+1;b<rails.length;b++){
    const step=rails[b]-rails[a]; if(step<w*.10||step>w*.245)continue;
    const edges=[rails[a],rails[b]];
    for(let col=2;col<=7;col++){
      const predicted=rails[a]+col*step;
      let hit=nearest(rails,predicted,step*.045);
      if(hit===null&&col>=5)hit=nearest(rails,predicted,step*.14);
      if(hit===null&&col>=5&&Math.abs(w-1-predicted)<step*.14)hit=w-1;
      if(hit===null)break;
      edges.push(hit);
    }
    if(edges.length<6||edges.at(-1)-edges[0]<w*.68)continue;
    const score=edges.reduce((sum,x)=>sum+xs[x],0);
    if(!best||score>best.score)best={edges,score};
  }
  if(!best)return null;
  const edges=best.edges,left=edges[0],right=edges.at(-1);
  // A one-pixel rule may be blended by JPEG. Detect its vertical contrast instead of a fixed grey.
  // Keep horizontal rules inside the band crossed by the selected vertical day separators.
  const railAt=y=>edges.slice(0,-1).filter(x=>{
    for(let dx=-1;dx<=1;dx++){
      const v=color(x+dx,y);
      if(neutral(x+dx,y)&&Math.max(Math.abs(v-color(x-gap,y)),Math.abs(v-color(x+gap,y)))>=11)return true;
    }
    return false;
  }).length>=1;
  let band=[0,0],begin=0,lastGood=-100;
  for(let y=0;y<h;y++){
    if(!railAt(y))continue;
    if(y-lastGood>Math.max(8,w*.016))begin=y;
    lastGood=y;if(y-begin>band[1]-band[0])band=[begin,y];
  }
  const ys=new Float32Array(h);
  for(let y=Math.max(gap,band[0]-gap);y<Math.min(h-gap,band[1]+gap+1);y++){
    for(let x=left+gap;x<right-gap;x+=4){
      if(!neutral(x,y))continue;
      const v=color(x,y),up=color(x,y-gap),down=color(x,y+gap);
      if((v-up)*(v-down)>0&&Math.min(Math.abs(v-up),Math.abs(v-down))>=10)ys[y]++;
    }
  }
  const rows=peakCenters(ys,(right-left)*.10/4);
  // Cropped exports can end on the outside border, with no pixels below it.
  if(rows.length&&band[1]>=h-2*gap&&rows.at(-1)<h-gap)rows.push(h-1);
  let series=[],strength=0;
  for(let a=0;a<rows.length;a++)for(let b=a+1;b<rows.length;b++)for(let intervals=1;intervals<=16;intervals++){
    const step=(rows[b]-rows[a])/intervals;
    if(step<w*.04||step>w*.34)continue;
    const points=[];
    let misses=0,error=0;
    for(let i=0;i<=24;i++){
      const predicted=rows[a]+i*step;
      const hit=nearest(rows,predicted,Math.max(4,step*.07));
      if(hit===null){if(++misses>1)break;continue;}
      misses=0;error+=Math.abs(predicted-hit)/step;
      points.push({i,y:hit});
      const score=points.length-(i+1-points.length)*.75-error*.4;
      if(points.length>=4&&score>strength){series=points.slice();strength=score;}
    }
  }
  if(!series.length)return null;
  const top=series[0].y,last=series.at(-1),hours=last.i;
  const hourPx=(last.y-top)/hours;
  const gutter=Math.min((edges[1]-left)*.42,left);
  const votes=new Map();
  for(const word of words){
    if(word.x*w<left-gutter||word.x*w>left+gap)continue;
    const m=/^(\d{1,2})(?::00|시)?$/.exec(word.text.trim());if(!m)continue;
    const hour=Number(m[1]),offset=(word.y*h-top)/hourPx,index=Math.floor(offset+.04);
    if(hour>23||index<0||index>=hours||offset-index>.52)continue;
    let start=hour-index;
    if(hour>=1&&hour<=12&&start<5)start+=12;
    if(start<0||start+hours>24)continue;
    if(!votes.has(start))votes.set(start,new Set());votes.get(start).add(index);
  }
  const winners=[...votes].sort((a,b)=>b[1].size-a[1].size);
  const certain=winners.length>0&&winners[0][1].size>=2&&winners[0][1].size>(winners[1]?.[1].size||0);
  const start=certain?winners[0][0]*60:Math.min(9,24-hours)*60;
  return {edges:edges.map(x=>x/w),top:top/h,bottom:last.y/h,start,end:start+hours*60,certain};
}

function courseTitle(words){
  const sorted=[...words].sort((a,b)=>a.y-b.y||a.x-b.x);
  if(!sorted.length)return '';
  const parts=[];let prev;
  for(const w of sorted){
    let line=w.text.trim();
    const room=line.search(/(?:[가-힣]{1,10}(?:관|동|센터)\s*(?=지하|\d)|강의실|\d+층\s*\d*호|^\s*\d+호실)/);
    if(room===0)break;
    if(room>0)line=line.slice(0,room).trim();
    if(!line||parts.length&&w.h&&sorted[0].h&&w.h<sorted[0].h*.78)break;
    // Find the common prefix/suffix of a visually wrapped word by the line's inset.
    const sep=!prev?'':(/[가-힣]$/.test(prev.text)&&/^[가-힣]/.test(line))||(/^[IⅠⅡ]+$/.test(line))||(/[a-z]$/.test(prev.text)&&/^[a-z]/.test(line))||(/\([A-Z]*$/.test(prev.text)&&/^[A-Z]/.test(line))?'':' ';
    parts.push(sep+line);prev={text:line};
    if(room>0)break;
  }
  return parts.join('').trim();
}

function scanCourses(frame,words,grid){
  const {width:w,height:h,data}=frame, result=[];
  const count=(grid.end-grid.start)/30;
  for(let day=0;day<grid.edges.length-1;day++){
    const left=grid.edges[day],right=grid.edges[day+1];
    function blockColor(row){
      const bins=new Map();
      for(const dy of [.27,.53,.76])for(let j=1;j<=19;j++){
        const x=Math.max(0,Math.min(w-1,Math.floor((left+(right-left)*j/20)*w)));
        const y=Math.max(0,Math.min(h-1,Math.floor((grid.top+(grid.bottom-grid.top)*(row+dy)/count)*h)));
        const i=4*(y*w+x),r=data[i],g=data[i+1],b=data[i+2];
        if(Math.max(r,g,b)-Math.min(r,g,b)<14)continue;
        const k=((r>>4)<<8)|((g>>4)<<4)|(b>>4);
        let bin=bins.get(k);
        if(!bin){bin=[0,0,0,0];bins.set(k,bin);}
        bin[0]++;bin[1]+=r;bin[2]+=g;bin[3]+=b;
      }
      const best=[...bins.values()].sort((a,b)=>b[0]-a[0])[0];
      return best&&best[0]>=8?best.slice(1).map(x=>x/best[0]):null;
    }
    let from=0,base=null;
    for(let row=0;row<=count;row++){
      const rgb=row<count?blockColor(row):null;
      const same=rgb&&base&&Math.max(...rgb.map((v,i)=>Math.abs(v-base[i])))<24;
      if(base&&!same){
        const y1=grid.top+(grid.bottom-grid.top)*from/count,y2=grid.top+(grid.bottom-grid.top)*row/count;
        const inside=words.filter(word=>word.x>left&&word.x<right&&word.y>=y1&&word.y<y2);
        result.push({name:courseTitle(inside),weekday:(day+1)%7,start:grid.start+from*30,end:grid.start+row*30});
      }
      if(!same){base=rgb;from=row;}
    }
  }
  return result;
}
if(typeof module!=='undefined')module.exports={detectGrid,scanCourses,courseTitle};
