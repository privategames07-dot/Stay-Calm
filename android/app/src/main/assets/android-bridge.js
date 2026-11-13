'use strict';
window.webkit={messageHandlers:Object.fromEntries(
  ['timetable','courseNames','feedback','updates'].map(name=>[name,{
    postMessage:body=>window.Android.postMessage(JSON.stringify({name,body}))
  }])
)};
