/* Grid calibration is explicit so margins, cropping and semester layouts do not shift a course. */
function readGrid(image, words, box, startHour, endHour, columns) {
  const scale=Math.min(1,1200/image.naturalWidth);
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(image.naturalWidth*scale);
  canvas.height=Math.round(image.naturalHeight*scale);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const {data,width,height}=ctx.getImageData(0,0,canvas.width,canvas.height);
  const [left,top,right,bottom]=box;
  const lines=Math.round((endHour-startHour)*12);
  const draft=[];
  function fill(x,y){
    const offset=4*(Math.min(height-1,Math.max(0,Math.floor(y*height)))*width+Math.min(width-1,Math.max(0,Math.floor(x*width))));
    return Array.from(data.slice(offset,offset+3));
  }
  function strip(day,line){
    const samples=[];
    for(let k=1;k<=11;k++){
      const x=left+(day+k/12)*(right-left)/columns;
      const y=top+(line+.5)*(bottom-top)/lines;
      samples.push(fill(x,y));
    }
    return [0,1,2].map(channel=>samples.map(c=>c[channel]).sort((a,b)=>a-b)[5]);
  }
  function add(day,from,to){
    if(to-from<2)return;
    const inBlock=words.filter(w=>w.x>left+day*(right-left)/columns && w.x<left+(day+1)*(right-left)/columns && w.y>=top+from*(bottom-top)/lines && w.y<top+to*(bottom-top)/lines).sort((a,b)=>a.y-b.y||a.x-b.x);
    draft.push({name:inBlock[0]?.text||'',weekday:(day+1)%7,start:startHour*60+from*5,end:startHour*60+to*5});
  }
  for(let day=0;day<columns;day++){
    let from=-1,base=null;
    for(let i=0;i<=lines;i++){
      const rgb=i<lines?strip(day,i):[255,255,255];
      const colored=Math.max(...rgb)-Math.min(...rgb)>=12;
      const change=base && Math.max(...rgb.map((v,j)=>Math.abs(v-base[j])))>22;
      if(from>=0 && (!colored||change)){add(day,from,i);from=-1;base=null;}
      if(colored && from<0){from=i;base=rgb;}
    }
  }
  return draft;
}
