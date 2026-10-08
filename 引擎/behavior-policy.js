// Frozen policies are selected by the journal, never by today's UI default.
const ascent=require('./ascent-behavior');
const multi=require('./spatial-behavior');
const next=require('./spatial-behavior-v2');
const autonomy=require('./agent-autonomy');
const select=r=>autonomy.enabled(r)?autonomy:next.enabled(r)?next:multi.enabled(r)?multi:ascent;
const out={enabled:r=>ascent.enabled(r)||multi.enabled(r)||next.enabled(r)||autonomy.enabled(r),zonesEnabled:r=>select(r).zonesEnabled(r),multimapEnabled:r=>multi.enabled(r)||next.enabled(r),nextEnabled:next.enabled,autonomyEnabled:autonomy.enabled,autonomy};
for(const name of ['poseScore','routeSeconds','denied','hazardCandidate','updateHazards'])out[name]=(r,...args)=>select(r)[name](r,...args);
for(const name of ['fire','defCandidates','supportCandidate','fallback'])out[name]=function(...args){return select(this)[name].apply(this,args);};
out.deploy=(intent,units,map)=>select({map}).deploy(intent,units,map);
out.updateDefenseSupport=function(){return select(this).updateDefenseSupport.call(this);};
module.exports=out;
