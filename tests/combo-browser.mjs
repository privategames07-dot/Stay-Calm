// Exercise the bundled page in Chrome on the macOS runner, including hits outside the visible disc.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {setTimeout as wait} from 'node:timers/promises';
const dir=await mkdtemp(join(tmpdir(),'stay-calm-test-'));
const app=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+dir,'about:blank'],{stdio:'ignore'});
let ws;
try{
  let port;
  for(let i=0;i<80&&!port;i++){await wait(125);try{port=(await readFile(join(dir,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{}}
  assert.ok(port,'Chrome startup');const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
  let seq=0;const pending=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){const [ok,no]=pending.get(m.id);pending.delete(m.id);if(m.error)no(Error(m.error.message));else ok(m.result);}};
  function send(method,params={}){return new Promise((ok,no)=>{const id=++seq;pending.set(id,[ok,no]);ws.send(JSON.stringify({id,method,params}));});}
  async function evaluate(expression){const res=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(res.exceptionDetails)throw Error(res.exceptionDetails.exception?.description||res.exceptionDetails.text);return res.result.value;}
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await send('Page.navigate',{url:pathToFileURL(resolve('web/index.html')).href});
  for(let i=0;i<40&&!await evaluate("!!document.querySelector('#tap')");i++)await wait(100);
  const rect=await evaluate("(()=>{const r=document.querySelector('.disc').getBoundingClientRect();return {x:r.left-12,y:r.top+r.height/2};})()");
  for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,...rect,button:'left',clickCount:1});
  assert.equal(await evaluate("document.querySelector('#amount').textContent"),'1회');
  await evaluate('resetCombo()');
  // Probe actual canvas pixels at evenly spaced angles after transient sparks have moved.
  const ring=await evaluate(`(async()=>{
    const tap=document.querySelector('#tap');
    for(let i=0;i<50;i++)tap.click();
    for(let attempt=0;attempt<10;attempt++){
    await new Promise(r=>setTimeout(r,150));
    const c=document.querySelector('.ember-layer'),rect=c.getBoundingClientRect();
    const scale=c.width/rect.width, r=document.querySelector('.disc').offsetWidth*scale/2;
    const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    const covered=Array.from({length:72},(_,i)=>{
      const a=2*Math.PI*i/72,x=Math.round(c.width/2+r*Math.cos(a)),y=Math.round(c.height/2+r*Math.sin(a));
      return pixels[4*(y*c.width+x)+3]>128;
    }).every(Boolean);
    if(covered)return true;
    }
    return false;
  })()`);
  assert.ok(ring,'50 combo covers all sampled angles of the disc');
  await evaluate('resetCombo()');
  const result=await evaluate(`(async()=>{const tap=document.querySelector('#tap');for(let i=0;i<100;i++)tap.click();const lifting=document.querySelector('.disc').classList.contains('lifting');tap.click();await new Promise(r=>setTimeout(r,1150));return {lifting,title:document.querySelector('.combo-award').textContent,count:document.querySelector('#amount').textContent};})()`);
  assert.deepEqual(result,{lifting:true,title:'100 Combo!',count:'154회'});
  const feverUI=await evaluate(`(()=>{
    const disc=document.querySelector('.disc');
    const zoom=disc.getBoundingClientRect().width/disc.offsetWidth;
    const lines=document.querySelector('.speed-lines');
    const selection=getComputedStyle(document.querySelector('h1')).userSelect;
    showFever(feverUntil);
    return {large:zoom>1.1,lines:lines.children.length,ended:!lines.isConnected,selection};
  })()`);
  assert.deepEqual(feverUI,{large:true,lines:36,ended:true,selection:'none'});
  await evaluate("resetCombo(); for(let i=0;i<3;i++)document.querySelector('#tap').click()");
  const barState = () => evaluate(`(() => {
    const track=document.querySelector('.combo-track').getBoundingClientRect();
    const fill=document.querySelector('.combo-fill').getBoundingClientRect();
    const label=document.querySelector('#combo').getBoundingClientRect();
    return {fraction:fill.width/track.width,aligned:Math.abs(fill.left-track.left)<1,below:track.top>=label.bottom};
  })()`);
  const visible=()=>evaluate("getComputedStyle(document.querySelector('.combo-track')).visibility==='visible' && document.querySelector('.combo-track').offsetWidth>0");
  assert.equal(await visible(),false);
  await wait(650);
  assert.equal(await visible(),false);
  await wait(490);
  assert.equal(await visible(),true);
  let bar=await barState();
  assert.ok(bar.aligned && bar.below && bar.fraction>.90);
  await wait(3000);
  bar=await barState();
  assert.ok(bar.aligned && bar.fraction>.12 && bar.fraction<.55);
  assert.equal(await evaluate("document.querySelector('#tap').click();document.querySelector('#combo').textContent"),'COMBO × 4');
  assert.equal(await visible(),false);
  await wait(1150);
  assert.equal(await visible(),true);
  assert.ok((await barState()).fraction>.80);
  await wait(5250);
  assert.equal(await evaluate("document.querySelector('.combo-track').offsetWidth"),0);
  assert.equal(await evaluate("document.querySelector('#combo').textContent"),'');
  assert.equal(await evaluate("document.querySelector('#tap').click();combo"),1);
  // Exercise reset through the timetable UI and preserve historical snapshots.
  await evaluate(`window.resetFixture=[
    {id:'reset-a',name:'수학',weekday:1,start:550,end:595},
    {id:'reset-b',name:'영어',weekday:5,start:550,end:595}
  ];saveSlots(window.resetFixture);record(window.resetFixture[0],new Date());go('시간표');
  window.historyBeforeReset=JSON.stringify(events(Calm.key(new Date())));
  [...document.querySelectorAll('#screen button')].find(b=>b.textContent==='시간표 초기화').click()`);
  assert.equal(await evaluate('slots.length'),2);
  await evaluate("[...document.querySelectorAll('#sheet-body button')].find(b=>b.textContent==='취소').click()");
  assert.equal(await evaluate('slots.length'),2);
  await evaluate(`[...document.querySelectorAll('#screen button')].find(b=>b.textContent==='시간표 초기화').click();
  [...document.querySelectorAll('#sheet-body button')].find(b=>b.textContent==='전체 초기화').click()`);
  assert.equal(await evaluate('slots.length'),0);
  assert.deepEqual(await evaluate("read('slots',null)"),[]);
  assert.equal(await evaluate('JSON.stringify(events(Calm.key(new Date())))===window.historyBeforeReset'),true);
  assert.equal(await evaluate("document.querySelector('#screen').textContent.includes('등록된 수업이 없어.')"),true);
  const shopChecks=await evaluate(`(()=>{
    const a={...resetFixture[0],name:'미술'},b={...resetFixture[1],name:'국어'};
    saveSlots([a,{...a,weekday:3},b]);
    go('상점');
    const buttons=()=>[...document.querySelectorAll('.shop-item button')];
    const choose=key=>{const sel=document.querySelector('#screen select');sel.value=key;sel.onchange();};
    choose(subjectKey(a));
    const before=creditBalance(inventory());
    buttons()[2].click();document.querySelector('#sheet .secondary').click();
    const canceled=!Object.hasOwn(inventory().paid,'bolt');
    buttons()[2].click();document.querySelector('#sheet .primary').click();buttons()[2].click();
    const shared=inventory().equipped[subjectKey({...a,weekday:3})]==='bolt';
    choose(subjectKey(b));const separate=buttons()[0].disabled;
    const free=creditBalance(inventory())===before;
    write('day.2020-01-01',Array(1000).fill({}));
    const funded=creditBalance(inventory());buttons()[1].click();
    choose('all');buttons()[2].click();
    const allApplied=[subjectKey(a),subjectKey(b),'outside','course:새 과목'].every(k=>equippedEffect(inventory(),k)==='bolt');
    choose(subjectKey(b));buttons()[0].click();
    choose('all');const mixed=!buttons()[2].disabled&&equippedEffect(inventory(),subjectKey(b))==='brake';
    return {allApplied,mixed,canceled,shared,separate,free,cost:funded-creditBalance(inventory()),choices:document.querySelector('#screen select').options.length};
  })()`);
  assert.deepEqual(shopChecks,{canceled:true,shared:true,separate:true,free:true,cost:500,choices:4,allApplied:true,mixed:true});
  const growth=await evaluate(`(async()=>{
    const before=creditBalance(inventory());
    document.querySelector('.wallet').closest('main').querySelector('.row button').click();
    const spent=before-creditBalance(inventory());
    go('참기');document.querySelector('#tap').click();
    const manual=events(Calm.key(new Date())).at(-1).count;
    go('상점');document.querySelectorAll('#screen .row button')[1].click();
    await new Promise(r=>setTimeout(r,5200));
    const pet=events(Calm.key(new Date())).at(-1);
    return {spent,manual,source:pet.source,count:pet.count};
  })()`);
  assert.deepEqual(growth,{spent:500,manual:2,source:'pet',count:1});
  const editor=await evaluate(`(()=>{
    go('시간표');
    [...document.querySelectorAll('#screen button')].find(b=>b.textContent==='수업 추가').click();
    const name=document.querySelector('#sheet input[type=text]');
    name.focus();name.value='테스트 수업';
    const editable=getComputedStyle(name).userSelect==='text'&&document.activeElement===name;
    close();saveSlots(Array.from({length:35},(_,i)=>({...resetFixture[0],id:'scroll-'+i,weekday})));
    render();screen.scrollTop=80;
    return {editable,scrolled:screen.scrollTop>0};
  })()`);
  assert.deepEqual(editor,{editable:true,scrolled:true});
  await evaluate("go('참기');window.fixedHomeY=document.querySelector('#tap').getBoundingClientRect().top");
  await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:195,y:360,deltaX:0,deltaY:350});
  await wait(250);
  const fixedHome=await evaluate(`({
    fixed:Math.abs(document.querySelector('#tap').getBoundingClientRect().top-window.fixedHomeY)<1,
    top:screen.scrollTop,
    touch:getComputedStyle(screen).touchAction
  })`);
  assert.deepEqual(fixedHome,{fixed:true,top:0,touch:'none'});
  console.log('Passed: enlarged hitbox, 100th tap ascent, fireworks title, uninterrupted input.');
}finally{ws?.close();app.kill('SIGKILL');await wait(250);await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
