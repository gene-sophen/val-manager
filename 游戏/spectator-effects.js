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
 function objective(events,tick,map={}){
  const past=events.filter(e=>e.t>=0&&e.t<=tick),plant=past.find(e=>e.type==='plant'),end=past.find(e=>e.type==='round_end'),defused=past.find(e=>e.type==='defuse'),position=plant&&(finite(plant)?{x:plant.x,y:plant.y}:map.nodes?.[plant.node]);
  if(defused||end?.reason==='defuse')return {state:'defused',label:'拆包完成',site:plant?.site,position,progress:1,remaining:0};
  if(end?.reason==='explosion')return {state:'exploded',label:'爆能器引爆',site:plant?.site,position,progress:1,remaining:0};
  if(end?.reason==='timeout')return {state:'timeout',label:'进攻超时',site:plant?.site,position,progress:0,remaining:0};
  if(end)return {state:'ended',label:'回合结束',site:plant?.site,position,progress:0,remaining:0};
  if(plant){
   const full=map.roundRules?.defuseTicks||7,remaining=Math.max(0,plant.t+(plant.spikeTicks||45)-tick),start=past.filter(e=>e.type==='defuse_start').at(-1),abort=past.filter(e=>e.type==='defuse_abort').at(-1),checkpoint=past.filter(e=>e.type==='defuse_checkpoint').at(-1);
   if(start&&(!abort||start.t>abort.t)){const base=Math.max(0,full-(start.seconds||full)),elapsed=Math.max(0,Math.min(start.seconds||full,tick-start.t));return {state:'defusing',label:'拆包中',site:plant.site,position,progress:clamp((base+elapsed)/full),remaining};}
   return {state:'planted',label:'已下包',site:plant.site,position,progress:checkpoint?clamp((checkpoint.seconds||0)/full):0,remaining};
  }
  const start=past.filter(e=>e.type==='plant_start').at(-1);if(start)return {state:'planting',label:'下包中',site:null,position:null,progress:clamp((tick-start.t)/(map.roundRules?.plantTicks||4)),remaining:0};
  return {state:'idle',label:'未下包',site:null,position:null,progress:0,remaining:0};
 }
 return {shots,abilities,objective};
});
