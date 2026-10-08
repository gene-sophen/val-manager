// Pure event-time presentation. Seeking/pausing never starts a second animation clock.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SPECTATOR_EFFECTS=factory();})(typeof window==='object'?window:globalThis,()=>{
 const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y),clamp=n=>Math.max(0,Math.min(1,n));
 function shots(events,tick){return events.filter(e=>e.type==='shot'&&e.t<=tick&&tick-e.t<.16&&finite(e)&&Number.isFinite(e.targetX)&&Number.isFinite(e.targetY)).map(e=>{
  const age=tick-e.t,head=clamp((age+.018)/.055),tail=clamp((age-.045)/.055),point=f=>({x:e.x+(e.targetX-e.x)*f,y:e.y+(e.targetY-e.y)*f});
  return {...e,start:point(tail),end:point(head),opacity:Math.max(0,1-age/.16),hit:events.some(d=>d.type==='damage'&&d.t===e.t&&d.actorId===e.actorId&&d.targetId===e.targetId)};
 });}
 function abilities(events,tick,map,positionAt){const out=[];
  for(const e of events){if(e.t>tick)continue;
   if(e.type==='smoke'&&e.until>tick&&finite(e))out.push({...e,visual:'smoke',progress:clamp((tick-e.t)/.35)});
   if(e.type==='molly_zone'&&e.until>tick&&finite(e))out.push({...e,visual:'zone',source:positionAt?.(e),progress:clamp((tick-e.t)/Math.max(.1,(e.activeAt||e.t)-e.t))});
   if(e.type==='flash_hit'&&(e.until||e.t+.6)>tick&&finite(e))out.push({...e,visual:'flash',progress:clamp((tick-e.t)/Math.max(.1,(e.until||e.t+.6)-e.t))});
   if(e.type==='ability'&&tick-e.t<1.1){
    // Historical events may omit IDs/coordinates. Resolve at cast time,
    // never at the caster's later position or a hidden target's position.
    const p=finite(e)?e:positionAt?.(e)||map.posts?.[e.post]||map.nodes?.[e.node];if(!finite(p))continue;
    out.push({...e,x:p.x,y:p.y,visual:'cast',progress:clamp((tick-e.t)/1.1)});
   }
  }return out;
 }
 return {shots,abilities};
});
