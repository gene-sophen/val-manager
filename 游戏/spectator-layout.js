// Small continuous display offsets; simulation and shot coordinates never move.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SPECTATOR_LAYOUT=factory();})(typeof window==='object'?window:globalThis,()=>{
 function arrange(units){const live=units.filter(u=>u.alive&&u.position).sort((a,b)=>a.id.localeCompare(b.id));return live.map(u=>{
  const nearest=Math.min(Infinity,...live.filter(v=>v!==u).map(v=>Math.hypot(v.position.x-u.position.x,v.position.y-u.position.y)));
  const radius=3.5*Math.max(0,Math.min(1,(22-nearest)/12));
  let hash=2166136261;for(const c of u.id){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}const angle=(hash>>>0)*2.399963229728653;
  return {...u,display:{x:u.position.x+Math.cos(angle)*radius,y:u.position.y+Math.sin(angle)*radius},offset:radius>0};
 });}
 function create(){return {arrange,reset(){}};}
 return {arrange,create};
});
