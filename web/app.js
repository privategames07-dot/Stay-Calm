'use strict';
const $=s=>document.querySelector(s);
const el=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(cls)n.className=cls;return n;};
const btn=(label,fn,cls)=>{const n=el('button',label,cls);n.type='button';n.onclick=fn;return n;};
const sub=(s)=>el('p',s,'sub');
const storagePrefix='staycalm.v1.';
const read=(k,def)=>{const raw=localStorage.getItem(storagePrefix+k);return raw===null?def:JSON.parse(raw);};
const write=(k,v)=>localStorage.setItem(storagePrefix+k,JSON.stringify(v));
let slots,options;
try{slots=read('slots',[]);options=Object.assign({haptics:true,effects:true},read('settings',{}));}
catch(e){document.body.textContent='저장된 기록을 열 수 없어. 앱을 다시 열어줘.';throw e;}
let page='참기',selectedDay=Calm.key(new Date()),week=selectedDay,weekday=new Date().getDay();
let combo=0,previous=0,comboSession='',comboTimer,noticeTimer,chosen='',homeKey='';
const pages=['참기','기록','통계','시간표'],screen=$('#screen');
const sheet=$('#sheet'),drawer=$('#drawer');
function message(s){const n=$('#notice');n.textContent=s;n.style.display='block';clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>n.style.display='none',2400);}
function safely(fn){try{fn();return true;}catch(e){message('저장하지 못했어. 저장 공간을 확인해줘.');return false;}}
function saveSlots(next){return safely(()=>{write('slots',next);slots=next;});}
function events(day){return read('day.'+day,[]);}
function periodLabel(s){return Calm.time(s.start)+'–'+Calm.time(s.end);}
function show(title,...nodes){$('#sheet-title').textContent=title;$('#sheet-body').replaceChildren(...nodes);if(!sheet.open)sheet.showModal();}
function close(){if(sheet.open)sheet.close();if(drawer.open)drawer.close();}
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
for(const d of [sheet,drawer])d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});
$('#menu').onclick=()=>drawer.showModal();
function resetCombo(){clearTimeout(comboTimer);combo=0;previous=0;comboSession='';document.documentElement.style.setProperty('--heat',0);if($('#combo'))$('#combo').textContent='';}
function go(p){close();resetCombo();page=p;render();}
pages.forEach(p=>$('#tabs').append(btn(p,()=>go(p))));
[...pages,'설정'].forEach(p=>$('#links').append(btn(p,()=>go(p))));
function render(){
  const now=new Date();$('#today').textContent=(now.getMonth()+1)+'. '+now.getDate()+'. '+Calm.days[now.getDay()];
  document.body.classList.toggle('quiet',!options.effects);
  [...$('#tabs').children].forEach((b,i)=>{b.classList.toggle('active',pages[i]===page);if(pages[i]===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  screen.className=page==='참기'?'home':'';screen.replaceChildren();screen.scrollTop=0;
  if(page==='참기')home(now);else if(page==='시간표')schedule();else if(page==='기록')historyView();else if(page==='통계')statsView();else settings();
}
function current(d){const found=Calm.active(slots,d);const slot=found.length===1?found[0]:found.find(s=>s.id===chosen);return {found,slot};}
function identify(d){const {found,slot}=current(d);return [Calm.key(d),found.map(s=>s.id).join(','),slot?.id].join('|');}
function home(d){
  const {slot,found}=current(d);homeKey=identify(d);
  const context=el('div',null,'hero-context');context.append(el('small',slot?'현재 수업':found.length?'겹치는 수업':'현재 시간'),el('h1',slot?.name||(found.length?'수업 선택':'수업 외')),sub(slot?periodLabel(slot):found.length?'버튼을 누르면 수업을 선택할 수 있어.':'자유 기록'));
  if(found.length>1)context.append(btn('수업 변경',()=>pick(found,s=>{chosen=s.id;resetCombo();render();}),'small-link'));
  const wrap=el('div',null,'target-wrap');const target=btn('',onTap,'target');target.setAttribute('aria-label','참은 횟수 1회 기록');target.id='tap';
  const comboLabel=el('b',null,'combo');comboLabel.id='combo';wrap.append(target,comboLabel);
  const counter=el('div',null,'counter');counter.append(el('small',slot?'이번 수업에서 참은 횟수':found.length?'수업 선택 후 기록':'오늘 수업 밖에서 참은 횟수'));const amount=el('b',events(Calm.key(d)).filter(e=>(e.slot?.id||'')===(slot?.id||'')).length+'회');amount.id='amount';counter.append(amount);
  if(!slots.length)counter.append(btn('시간표 등록',()=>go('시간표'),'small-link'));
  screen.append(context,wrap,counter);
}
function pick(found,callback){show('어느 수업이야?',...found.map(s=>btn(s.name+' · '+periodLabel(s),()=>{close();callback(s);},'row')));}
function onTap(){const d=new Date(),{found,slot}=current(d);
  if(found.length>1&&!slot){pick(found,s=>{chosen=s.id;render();record(s,d);});return;}
  if(homeKey!==identify(d)){resetCombo();render();}record(slot,d);
}
function record(s,d){
  const e=Calm.tap(s,d),list=events(e.day);list.push(e);
  if(!safely(()=>write('day.'+e.day,list)))return;
  const session=e.day+'|'+(s?.id||'');const now=d.getTime();
  combo=session===comboSession&&now>=previous&&now-previous<=900?combo+1:1;comboSession=session;previous=now;
  $('#amount').textContent=list.filter(v=>(v.slot?.id||'')===(s?.id||'')).length+'회';
  if(options.haptics)window.webkit?.messageHandlers?.feedback?.postMessage('tap');
  if(options.effects){
    const wrap=$('.target-wrap');wrap.classList.remove('ripple');void wrap.offsetWidth;wrap.classList.add('ripple');
    $('#combo').textContent=combo>=3?'COMBO × '+combo:'';
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.style.setProperty('--heat',String(combo>=3?Math.min(.22,.055+combo*.009):0));
  }
  clearTimeout(comboTimer);comboTimer=setTimeout(resetCombo,920);
}
function field(label,control){const l=el('label',null,'field');l.append(document.createTextNode(label),control);return l;}
function input(type,value){const n=el('input');n.type=type;n.value=value;return n;}
function select(values,selected){const n=el('select');values.forEach(([v,label])=>{const o=el('option',label);o.value=v;o.selected=String(v)===String(selected);n.append(o);});return n;}
function controls(s){
  const name=input('text',s.name);name.maxLength=100;name.autocomplete='off';const day=select(Calm.days.map((v,i)=>[i,v+'요일']),s.weekday);
  const start=input('time',Calm.time(s.start)),end=input('time',Calm.time(s.end));const pair=el('div',null,'pair');pair.append(field('시작',start),field('종료',end));
  return {nodes:[field('과목명',name),field('요일',day),pair],value(){
    if(!name.value.trim()||!start.value||!end.value||start.value>=end.value)throw Error('과목명과 시작·종료 시간을 확인해줘.');
    return {id:s.id||Calm.uuid(),name:name.value.trim(),weekday:Number(day.value),start:Calm.minutes(start.value),end:Calm.minutes(end.value)};
  }};
}
function edit(s){const c=controls(s);const save=btn('저장',()=>{try{const v=c.value();const next=s.id?slots.map(x=>x.id===s.id?v:x):[...slots,v];if(saveSlots(next)){weekday=v.weekday;close();render();}}catch(e){message(e.message);}},'primary');
  const actions=el('div',null,'actions');actions.append(save);
  if(s.id)actions.append(btn('수업 삭제',()=>show('이 수업을 삭제할까?',sub('이미 기록한 횟수는 보관돼.'),btn('삭제',()=>{if(saveSlots(slots.filter(x=>x.id!==s.id))){close();render();}},'primary')),'secondary'));
  show(s.id?'수업 수정':'수업 추가',...c.nodes,actions);
}
function schedule(){
  screen.append(el('h1','시간표'));const actions=el('div',null,'actions');
  actions.append(btn('에타 캡처 가져오기',startImport,'primary'),btn('수업 추가',()=>edit({name:'',weekday,start:540,end:600}),'secondary'));screen.append(actions);
  const ds=el('div',null,'weekdays');[1,2,3,4,5,6,0].forEach(i=>ds.append(btn(Calm.days[i],()=>{weekday=i;render();},i===weekday?'sel':'')));screen.append(ds);
  const list=slots.filter(s=>s.weekday===weekday).sort((a,b)=>a.start-b.start);if(!list.length)screen.append(el('p','등록된 수업이 없어.','empty'));
  list.forEach(s=>{const row=btn('',()=>edit(s),'row');row.append(el('b',s.name),el('small',periodLabel(s)));screen.append(row);});
}
function dateBar(d,step,change){
  const bar=el('div',null,'period'),pickDate=input('date',d);pickDate.setAttribute('aria-label','기준 날짜');pickDate.onchange=()=>{if(pickDate.value)change(pickDate.value);};
  bar.append(btn('이전',()=>change(Calm.shift(d,-step))),pickDate,btn('다음',()=>change(Calm.shift(d,step))));return bar;
}
function historyView(){
  screen.append(el('h1','기록'),dateBar(selectedDay,1,k=>{selectedDay=k;render();}));
  const list=events(selectedDay),groups=new Map();
  list.forEach(e=>{const k=JSON.stringify(e.slot);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(e);});
  if(!list.length)screen.append(el('p','이날의 기록이 없어.','empty'));
  for(const ev of groups.values()){const s=ev[0].slot;const detail=el('details');detail.append(el('summary',(s?s.name+' · '+periodLabel(s):'수업 외')+'　'+ev.length+'회'),el('p',ev.map(v=>v.clock).join('  '),'times'));screen.append(detail);}
}
function ranking(title,rows,format){
  const section=el('section');section.append(el('h2',title));if(!rows.length){section.append(sub('수업 중에 누른 기록이 없어.'));return section;}
  let rank=0,last=0;rows.forEach(([k,n],i)=>{if(n!==last)rank=i+1;last=n;const row=el('div',null,'row');row.append(el('span',rank+'위　'+format(k)),el('em',n+'회'));const bar=el('div',null,'bar'),mark=el('i');mark.style.width=(n/rows[0][1]*100)+'%';bar.append(mark);section.append(row,bar);});return section;
}
function statsView(){
  const first=Calm.monday(week);let list=[];for(let k=0;k<7;k++)list.push(...events(Calm.shift(first,k)));const st=Calm.stats(list,week);
  screen.append(el('h1','주간 통계'),dateBar(week,7,k=>{week=k;render();}),sub(st.first+' — '+st.last),el('b',st.total+'회','big'),sub('수업 중 기록 · 수업 외 '+st.outside+'회'),ranking('가장 빡셌던 수업',st.subjects,String),ranking('가장 빡셌던 시간',st.hours,h=>String(h).padStart(2,'0')+'시대'));
}
function settings(){
  screen.append(el('h1','설정'));const list=el('div',null,'list');
  [['haptics','탭 진동','버튼을 누를 때 가볍게 진동'],['effects','콤보 효과','파동과 붉은 배경, 콤보 숫자']].forEach(([k,title,desc])=>{const row=el('label',null,'row'),txt=el('span');txt.append(el('b',title),el('small',desc));const check=input('checkbox','');check.checked=options[k];check.onchange=()=>{const next={...options,[k]:check.checked};if(safely(()=>write('settings',next)))options=next;else check.checked=options[k];};row.append(txt,check);list.append(row);});
  screen.append(list,sub('소리는 항상 꺼져 있어. 시간표와 기록은 이 기기에 저장돼.'),sub('stay calm! · 1.0'));
}
function startImport(){
  if(window.webkit?.messageHandlers?.timetable){window.webkit.messageHandlers.timetable.postMessage('pick');return;}
  const f=input('file','');f.accept='image/*';f.onchange=()=>{const file=f.files[0];if(file){const r=new FileReader();r.onload=()=>window.receiveTimetable(r.result,[]);r.readAsDataURL(file);}};f.click();
}
window.importFailure=s=>message(s);
window.receiveTimetable=(src,words)=>{
  const img=new Image();img.alt='시간표 캡처';const wrap=el('div',null,'gridpic');wrap.append(img);
  const hint=sub('월요일 첫 시간 칸의 왼쪽 위를 눌러줘.');let points=[];
  const hours=Array.from({length:25},(_,i)=>[i,i+'시']);
  const start=select(hours.slice(0,24),9),end=select(hours.slice(1),18),columns=select([[5,'월–금'],[6,'월–토'],[7,'월–일']],5);
  const times=el('div',null,'pair');times.append(field('맨 위 시각',start),field('맨 아래 시각',end));
  img.style.maxHeight='none';img.onclick=e=>{const r=img.getBoundingClientRect();if(points.length===2)points=[];points.push([(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height]);hint.textContent=points.length===1?'마지막 요일 칸의 오른쪽 아래를 눌러줘.':'범위를 지정했어. 시각과 요일을 확인해줘.';};
  const scan=btn('수업 읽기',()=>{if(points.length!==2||points[1][0]<=points[0][0]||points[1][1]<=points[0][1]||+end.value<=+start.value){hint.textContent='왼쪽 위와 오른쪽 아래, 시작·끝 시각을 확인해줘.';return;}
    const result=readGrid(img,words,[...points[0],...points[1]],+start.value,+end.value,+columns.value);
    review(result);},'primary');
  img.onerror=()=>message('이미지를 열 수 없어. 다른 캡처를 선택해줘.');img.src=src;
  show('에타 시간표 범위',hint,wrap,times,field('캡처에 보이는 요일',columns),scan);
};
function review(proposal){
  const list=el('div'),editors=[];function add(s){const c=controls(s),box=el('div',null,'draft');const entry={c,box};editors.push(entry);box.append(...c.nodes,btn('이 항목 제외',()=>{box.remove();editors.splice(editors.indexOf(entry),1);},'secondary'));list.append(box);}
  proposal.forEach(add);const note=sub(proposal.length?proposal.length+'개 후보의 이름과 시간을 확인해줘.':'색상 칸을 찾지 못했어. 수업을 직접 추가해줘.');
  const actions=el('div',null,'actions');actions.append(btn('항목 추가',()=>add({name:'',weekday:1,start:540,end:600}),'secondary'),btn('시간표에 추가',()=>{try{if(!editors.length)throw Error('저장할 수업을 추가해줘.');const next=[...slots];editors.map(e=>e.c.value()).forEach(v=>{if(!next.some(s=>s.name===v.name&&s.weekday===v.weekday&&s.start===v.start&&s.end===v.end))next.push(v);});
    if(saveSlots(next)){close();render();message('시간표에 저장했어.');}}catch(e){note.textContent=e.message;}},'primary'));
  show('가져올 수업 확인',note,list,actions);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetCombo();else if(page==='참기')render();});
setInterval(()=>{if(!document.hidden&&page==='참기'&&!sheet.open&&homeKey!==identify(new Date())){resetCombo();render();}},1000);
render();
