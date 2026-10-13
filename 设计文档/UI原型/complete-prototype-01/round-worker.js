// Same frozen simulation as Node; expensive replay reconstruction stays off the UI thread.
importScripts('spatial-engine.js?v='+new URL(self.location.href).searchParams.get('v'));
let active=null;
self.onmessage=({data})=>{
 const {id,key,input,operation='step'}=data,started=Date.now();
 const progress=value=>self.postMessage({id,progress:{...value,elapsed:Date.now()-started}});
 try{
  if(!active||active.key!==key||active.map.rounds.length!==input.m.rounds.length)active={key,map:input.m};
  else Object.assign(active.map,input.m);
  if(active.map.rounds.length){progress({phase:'recover',completed:0,total:active.map.rounds.length});active.map.replay=SPATIAL_MATCH.recover(active.map,p=>progress({phase:'recover',...p}));}
  if(operation==='replay'){self.postMessage({id,map:active.map,replay:active.map.replay});return;}
  progress({phase:'compute',number:active.map.rounds.length+1});
  const round=SPATIAL_MATCH.step(active.map,input.home,input.rival,input.priorities,input.agents);
  self.postMessage({id,map:active.map,round});
 }catch(error){active=null;self.postMessage({id,error:error.message});}
};
