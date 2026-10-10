// Same frozen simulation as Node; expensive replay reconstruction stays off the UI thread.
importScripts('spatial-engine.js?v='+new URL(self.location.href).searchParams.get('v'));
let active=null;
self.onmessage=({data})=>{
 const {id,key,input}=data;
 try{
  if(!active||active.key!==key||active.map.rounds.length!==input.m.rounds.length)active={key,map:input.m};
  else Object.assign(active.map,input.m);
  const round=SPATIAL_MATCH.step(active.map,input.home,input.rival,input.priorities,input.agents);
  self.postMessage({id,map:active.map,round});
 }catch(error){active=null;self.postMessage({id,error:error.message});}
};
