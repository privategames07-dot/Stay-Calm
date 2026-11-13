'use strict';
window.webkit={messageHandlers:Object.fromEntries(
  ['timetable','courseNames','feedback','updates','cache','updateCheck'].map(name=>[name,{
    postMessage:body=>window.Android.postMessage(JSON.stringify({name,body}))
  }])
)};
