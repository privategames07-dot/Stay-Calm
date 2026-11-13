'use strict';
window.webkit={messageHandlers:Object.fromEntries(
  ['timetable','courseNames','feedback','updates','cache'].map(name=>[name,{
    postMessage:body=>window.Android.postMessage(JSON.stringify({name,body}))
  }])
)};
