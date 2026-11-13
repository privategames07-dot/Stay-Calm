// Komsi student view. All rectangles exported to the native OCR bridge are normalized.
const SchoolTimetable = (() => {
  function centers(values) {
    const result = [];
    for (let i = 0; i < values.length; i++) {
      if (!values[i]) continue;
      const first = i;
      while (values[i + 1]) i++;
      result.push(Math.round((first + i) / 2));
    }
    return result;
  }

  function detect(frame) {
    const {width, height, data} = frame;
    function border(x, y) {
      const offset = 4 * (y * width + x);
      const [r,g,b] = [data[offset], data[offset+1], data[offset+2]];
      return r >= 180 && r <= 228 && Math.max(r,g,b) - Math.min(r,g,b) < 8;
    }
    const horizontal = new Uint8Array(height);
    for (let y = 0; y < height; y++) {
      let hits = 0;
      for (let x = 0; x < width; x += 6) if (border(x,y)) hits++;
      horizontal[y] = hits >= width * .72 / 6;
    }
    const lines = centers(horizontal);
    let best = null, run = null;
    for (let i = 1; i < lines.length; i++) {
      const top = lines[i-1], bottom = lines[i], span = bottom-top;
      if (span < width*.038 || span > width*.22) { run = null; continue; }
      const rails = centers(Array.from({length:width}, (_,x) =>
        [.16,.44,.78].every(f => border(x, Math.round(top+span*f)))));
      if (rails.length !== 7) { run = null; continue; }
      const step = (rails[6]-rails[1])/5;
      if (step < width*.12 || rails.slice(2).some((x,j) =>
        Math.abs(x-rails[j+1]-step) > step*.2)) { run = null; continue; }
      if (!run || run.rows.at(-1) !== top || rails.some((x,j) =>
        Math.abs(x-run.rails[j]) > step*.03)) run = {rails, rows:[top]};
      run.rows.push(bottom);
      if (!best || run.rows.length > best.rows.length) best = run;
    }
    return best && best.rows.length >= 4 ? best : null;
  }

  function inside(words, rect) {
    return words.filter(w => w.x >= rect[0] && w.x < rect[2] && w.y >= rect[1] && w.y < rect[3]);
  }
  function printedTime(words) {
    const line = [...words].sort((a,b) => a.x-b.x).map(w=>w.text).join('').replace(/\s/g,'');
    const found = line.match(/(?:^|[^0-9])([01]?\d|2[0-3])[:：.]([0-5]\d)(?!\d)/);
    return found ? Number(found[1])*60 + Number(found[2]) : null;
  }
  function title(words) {
    return [...words].sort((a,b)=>a.x-b.x).map(w=>w.text.trim()).filter(Boolean).join(' ');
  }
  function read(frame,words,{rails,rows}) {
    const {width,height,data} = frame;
    const heading = words.filter(w=>w.y < rows[0]/height).map(w=>w.text.replace(/\s/g,'')).join(' ');
    const grade = heading.includes('고등학교') ? 'high' : heading.includes('중학교') ? 'middle' : '';
    const periods = [];
    // The first strip is the weekday header. The second grid lists other homerooms.
    for (let row=1; row<rows.length-1; row++) {
      const top=rows[row], bottom=rows[row+1];
      const timeRect=[rails[0]/width,top/height,rails[1]/width,bottom/height];
      const period={start:printedTime(inside(words,timeRect)),timeRect,cells:[]};
      for (let day=1; day<=5; day++) {
        const left=rails[day],right=rails[day+1], pad=(right-left)*.04;
        const x1=Math.ceil(left+pad),x2=Math.floor(right-pad);
        const y1=Math.ceil(top+(bottom-top)*.06), y2=Math.round((top+bottom)/2);
        const rect=[x1/width,y1/height,x2/width,y2/height];
        let ink=0;
        for(let y=y1;y<y2;y+=2) for(let x=x1;x<x2;x+=2) {
          const p=4*(y*width+x);
          if(Math.max(data[p],data[p+1],data[p+2])<120) ink++;
        }
        if(ink>=Math.max(4,(x2-x1)*(y2-y1)*.0007))
          period.cells.push({weekday:day,name:title(inside(words,rect)),rect});
      }
      periods.push(period);
    }
    return {grade,periods};
  }
  const duration = grade => grade==='high' ? 50 : 45;
  function starts(periods,grade) {
    const step=duration(grade)+10;
    const anchor=periods.findIndex(p=>p.start!==null);
    let next=anchor<0 ? 540 : periods[anchor].start-anchor*step;
    return periods.map(p=>{
      const start=p.start??next;
      next=start+step;
      return start;
    });
  }
  return {detect,read,starts,duration,title,printedTime};
})();
if(typeof module!=='undefined')module.exports=SchoolTimetable;
