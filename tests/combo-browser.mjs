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
    await new Promise(r=>setTimeout(r,280));
    const c=document.querySelector('.ember-layer'),rect=c.getBoundingClientRect();
    const scale=c.width/rect.width, r=document.querySelector('.disc').offsetWidth*scale/2;
    const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    return Array.from({length:72},(_,i)=>{
      const a=2*Math.PI*i/72,x=Math.round(c.width/2+r*Math.cos(a)),y=Math.round(c.height/2+r*Math.sin(a));
      return pixels[4*(y*c.width+x)+3]>128;
    }).every(Boolean);
  })()`);
  assert.ok(ring,'50 combo covers all sampled angles of the disc');
  await evaluate('resetCombo()');
  const result=await evaluate(`(async()=>{const tap=document.querySelector('#tap');for(let i=0;i<100;i++)tap.click();const lifting=document.querySelector('.disc').classList.contains('lifting');tap.click();await new Promise(r=>setTimeout(r,760));return {lifting,title:document.querySelector('.combo-award').textContent,count:document.querySelector('#amount').textContent};})()`);
  assert.deepEqual(result,{lifting:true,title:'100 Combo!',count:'152회'});
  console.log('Passed: enlarged hitbox, 100th tap ascent, fireworks title, uninterrupted input.');
}finally{ws?.close();app.kill('SIGKILL');await wait(250);await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
