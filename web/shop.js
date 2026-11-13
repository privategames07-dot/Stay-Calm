'use strict';
const effectCatalog = [
  {id:'brake', name:'브레이크 불티', cost:0, detail:'원 둘레를 따라 튀는 주황색 불티'},
  {id:'frost', name:'서리 결정', cost:500, detail:'얼음빛 테두리에서 흩날리는 눈 결정'},
  {id:'bolt', name:'번개', cost:2500, detail:'갈라진 보랏빛 전류와 전기 스파크'},
  {id:'meteor', name:'유성우', cost:5000, detail:'금빛 꼬리를 끌며 비스듬히 떨어지는 유성'},
  {id:'aurora', name:'오로라', cost:10000, detail:'원 둘레를 물결치는 세 겹의 빛과 별'}
];
function subjectKey(slot){
  return slot ? 'course:'+slot.name.trim().normalize('NFC') : 'outside';
}
function inventory(){
  return read('shop',{paid:{},equipped:{}});
}
function creditBalance(shop){
  let earned=0;
  const prefix=storagePrefix+'day.';
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(key.startsWith(prefix))earned+=events(key.slice(prefix.length)).length;
  }
  return earned-Object.values(shop.paid).reduce((sum,cost)=>sum+cost,0);
}
function shopView(subject=subjectKey(current(new Date()).slot)){
  const shop=inventory(), balance=creditBalance(shop);
  const subjects=new Map([['outside','수업 외']]);
  for(const slot of slots)subjects.set(subjectKey(slot),slot.name);
  if(!subjects.has(subject))subject='outside';
  const chooser=select([...subjects],subject);
  function refresh(){screen.replaceChildren();shopView(chooser.value);}
  chooser.onchange=refresh;
  const heading=el('div',null,'shop-heading');
  heading.append(el('h1','이펙트 상점'),el('b',balance.toLocaleString()+' 크레딧','wallet'));
  screen.append(heading,sub('탭 1회당 1크레딧 · 해금한 이펙트는 과목마다 골라 쓸 수 있어.'),field('적용할 수업',chooser));
  function purchase(item,cheat=false){
    const latest=inventory();
    if(Object.hasOwn(latest.paid,item.id)){close();refresh();return;}
    const available=creditBalance(latest);
    if(available<item.cost&&!cheat){
      const actions=el('div',null,'actions');
      actions.append(btn('취소',close,'secondary'),btn('치트로 구매',()=>purchase(item,true),'primary'));
      show('크레딧이 부족해',sub(item.name+' 구매에 '+(item.cost-available).toLocaleString()+'크레딧이 부족해. 테스트용 치트로 무료 해금할까?'),actions);
      return;
    }
    latest.paid[item.id]=cheat?0:item.cost;
    if(safely(()=>write('shop',latest))){close();refresh();message(item.name+' 해금 완료');}
  }
  const equipped=shop.equipped[subject]||'brake';
  for(const item of effectCatalog){
    const owned=item.cost===0||Object.hasOwn(shop.paid,item.id);
    const active=equipped===item.id;
    const row=el('div',null,'row shop-item'),info=el('span');
    info.append(el('b',item.name),el('small',item.detail));
    const action=btn(active?'적용 중':owned?'적용':item.cost.toLocaleString()+' 구매',()=>{
      if(!owned){purchase(item);return;}
      const latest=inventory();latest.equipped[subject]=item.id;
      if(safely(()=>write('shop',latest)))refresh();
    },active?'secondary':owned?'primary':'secondary');
    action.disabled=active;row.append(info,action);screen.append(row);
  }
}
