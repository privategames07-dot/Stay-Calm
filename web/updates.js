'use strict';
let updateChecking=false,pendingUpdate=null;
function requestUpdateCheck(manual=false){
  const native=window.webkit?.messageHandlers?.updateCheck;
  if(!native){if(manual)message('앱에서 업데이트를 확인할 수 있어.');return;}
  if(updateChecking)return;
  updateChecking=true;
  native.postMessage({manual});
}
function showPendingUpdate(){
  if(!pendingUpdate||sheet.open||drawer.open)return;
  const info=pendingUpdate;pendingUpdate=null;
  const actions=el('div',null,'actions');
  actions.append(btn('나중에',close,'secondary'),btn('다운로드',()=>{
    close();window.webkit?.messageHandlers?.updates?.postMessage('download');
  },'primary'));
  show('업데이트가 있어',sub('현재 '+CalmVersion.name+' → 새 버전 '+info.version),actions);
}
window.receiveUpdate=info=>{
  updateChecking=false;
  if(info.error){if(info.manual)message('업데이트 정보를 불러오지 못했어. 잠시 후 다시 확인해줘.');return;}
  if(!Number.isSafeInteger(info.build)||info.build<=0)return;
  if(info.build>CalmVersion.build){pendingUpdate=info;showPendingUpdate();}
  else if(info.manual)message('최신 버전이야. ('+CalmVersion.name+')');
};
