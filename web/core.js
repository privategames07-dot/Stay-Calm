/* Shared timetable and statistics rules. Input timestamps use the device's local calendar. */
const Calm = (() => {
  const pad = n => String(n).padStart(2,'0');
  const days = ['일','월','화','수','목','금','토'];
  const key = d => [d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join('-');
  function shift(dateKey, amount) {
    const d = new Date(dateKey+'T12:00:00');
    d.setDate(d.getDate()+amount);
    return key(d);
  }
  const monday = day => shift(day,-((new Date(day+'T12:00:00').getDay()+6)%7));
  const time = n => pad(Math.floor(n/60))+':'+pad(n%60);
  const minutes = s => Number(s.slice(0,2))*60+Number(s.slice(3,5));
  function active(slots,d) {
    const minute=d.getHours()*60+d.getMinutes();
    return slots.filter(s=>s.weekday===d.getDay() && s.start<=minute && minute<s.end);
  }
  function uuid() {
    if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
    const bytes=globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6]=(bytes[6]&15)|64; bytes[8]=(bytes[8]&63)|128;
    const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
  }
  function tap(slot,date) {
    return {id:uuid(),at:date.getTime(),day:key(date),hour:date.getHours(),clock:time(date.getHours()*60+date.getMinutes()),
      slot:slot ? {id:slot.id,name:slot.name,start:slot.start,end:slot.end} : null};
  }
  const count=events=>events.reduce((sum,e)=>sum+(e.count??1),0);
  function rank(events,key) {
    const counts=new Map();
    events.forEach(e=>{const k=key(e);counts.set(k,(counts.get(k)||0)+(e.count??1));});
    return [...counts].sort((a,b)=>b[1]-a[1] || String(a[0]).localeCompare(String(b[0]),'ko',{numeric:true}));
  }
  function stats(events,day) {
    const first=monday(day), last=shift(first,6);
    const week=events.filter(e=>e.day>=first && e.day<=last);
    const classes=week.filter(e=>e.slot);
    return {first,last,total:count(classes),outside:count(week)-count(classes),subjects:rank(classes,e=>e.slot.name),hours:rank(classes,e=>e.hour)};
  }
  return {count,uuid,key,shift,monday,time,minutes,days,active,tap,stats};
})();
if(typeof module!=='undefined') module.exports=Calm;
