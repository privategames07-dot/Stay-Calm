'use strict';
const effectCatalog = [
  {id:'brake', name:'브레이크 불티', cost:0, detail:'원 둘레를 따라 튀는 주황색 불티'},
  {id:'frost', name:'서리 결정', cost:500, detail:'얼음빛 테두리에서 흩날리는 눈 결정'},
  {id:'bolt', name:'번개', cost:2500, detail:'갈라진 보랏빛 전류와 전기 스파크'},
  {id:'meteor', name:'유성우', cost:5000, detail:'금빛 꼬리를 끌며 비스듬히 떨어지는 유성'},
  {id:'aurora', name:'오로라', cost:10000, detail:'원 둘레를 물결치는 세 겹의 빛과 별'},
  {id:'ink', name:'수묵화 먹물 번짐', cost:15000, detail:'터치마다 테두리에서 먹물이 은은히 번져 사라져'},
  {id:'nova', name:'초신성 폭발', cost:30000, detail:'붉은 균열이 달아오르고 피버 진입 시 에너지가 분출돼'}
];
function subjectKey(slot){
  return slot ? 'course:'+slot.name.trim().normalize('NFC') : 'outside';
}
function inventory(){
  const shop={levels:{},skillSpent:0,...read('shop',{paid:{},equipped:{}})};
  if(Object.hasOwn(shop.levels,'focus')){
    shop.levels.fever=Math.min(10,shop.levels.fever??shop.levels.focus);
    delete shop.levels.focus;
  }
  shop.levels=Growth.normalizeLevels(shop.levels);
  return shop;
}
function creditBalance(shop){
  let earned=logState().creditCarry;
  const prefix=storagePrefix+dayPrefix();
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(key.startsWith(prefix))earned+=Calm.count(events(key.slice(prefix.length)));
  }
  return Math.round(earned*10)/10-shop.skillSpent-Object.values(shop.paid).reduce((sum,cost)=>sum+cost,0);
}
function equippedEffect(shop,subject){
  return shop.equipped[subject]||shop.equipped.all||'brake';
}
function shopView(subject=subjectKey(current(new Date()).slot)){
  const shop=inventory(), balance=creditBalance(shop);
  const subjects=new Map([['all','전체'],['outside','수업 외']]);
  for(const slot of slots)subjects.set(subjectKey(slot),slot.name);
  if(!subjects.has(subject))subject='outside';
  const chooser=select([...subjects],subject);
  function refresh(){screen.replaceChildren();shopView(chooser.value);}
  chooser.onchange=refresh;
  const heading=el('div',null,'shop-heading');
  heading.append(el('h1','상점'),el('b',balance.toLocaleString()+' 크레딧','wallet'));
  screen.append(heading,el('h2','성장'),sub('클릭 점수 1점마다 1크레딧을 얻어.'));
  for(const skill of Growth.skills){
    const level=shop.levels[skill.id]||0;
    const price=Growth.cost(skill,level),locked=Growth.locked(skill.id,shop.levels);
    const row=el('div',null,'row'),info=el('span');
    const description=locked||'현재 '+Growth.detail(skill.id,level)+(level<skill.max?' → 다음 '+Growth.detail(skill.id,level+1):'');
    info.append(el('b',skill.name+' · Lv.'+Growth.displayLevel(skill,level)),el('small',description));
    const buy=btn(price.toLocaleString()+' 강화',()=>upgrade(skill,level),'secondary');
    if(locked){buy.disabled=true;buy.textContent='잠김';}
    if(level>=skill.max){buy.disabled=true;buy.textContent='최대 레벨';}
    row.append(info,buy);screen.append(row);
  }
  screen.append(el('h2','과목 이펙트'),field('적용할 수업',chooser));
  function upgrade(skill,level,cheat=false){
    const latest=inventory(),price=Growth.cost(skill,level);
    if(Growth.locked(skill.id,latest.levels)||level>=skill.max||(latest.levels[skill.id]||0)!==level){close();refresh();return;}
    const available=creditBalance(latest);
    if(available<price&&!cheat){offerCheat(skill.name,price-available,()=>upgrade(skill,level,true));return;}
    latest.levels[skill.id]=level+1;
    latest.skillSpent+=cheat?0:price;
    if(safely(()=>write('shop',latest))){close();refresh();if(['pet','turtle','turtleSpeed'].includes(skill.id))startPet();}
  }
  function offerCheat(name,missing,accept){
    const actions=el('div',null,'actions');
    actions.append(btn('취소',close,'secondary'),btn('치트로 구매',accept,'primary'));
    show('크레딧이 부족해',sub(name+' 구매에 '+missing.toLocaleString()+'크레딧이 부족해. 테스트용 치트로 구매할까?'),actions);
  }
  function purchase(item,cheat=false){
    const latest=inventory();
    if(Object.hasOwn(latest.paid,item.id)){close();refresh();return;}
    const available=creditBalance(latest);
    if(available<item.cost&&!cheat){
      offerCheat(item.name,item.cost-available,()=>purchase(item,true));
      return;
    }
    latest.paid[item.id]=cheat?0:item.cost;
    if(safely(()=>write('shop',latest))){close();refresh();message(item.name+' 해금 완료');}
  }
  const equipped=equippedEffect(shop,subject);
  const mixed=subject==='all'&&Object.values(shop.equipped).some(effect=>effect!==equipped);
  for(const item of effectCatalog){
    const owned=item.cost===0||Object.hasOwn(shop.paid,item.id);
    const active=!mixed&&equipped===item.id;
    const row=el('div',null,'row shop-item'),info=el('span');
    info.append(el('b',item.name),el('small',item.detail));
    const action=btn(active?'적용 중':owned?'적용':item.cost.toLocaleString()+' 구매',()=>{
      if(!owned){purchase(item);return;}
      const latest=inventory();
      if(subject==='all')latest.equipped={all:item.id};
      else latest.equipped[subject]=item.id;
      if(safely(()=>write('shop',latest)))refresh();
    },active?'secondary':owned?'primary':'secondary');
    action.disabled=active;row.append(info,action);screen.append(row);
  }
}
