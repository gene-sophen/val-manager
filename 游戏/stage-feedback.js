(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.STAGE_FEEDBACK=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';const version='stage-feedback-1',clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function create(){return {version,phase:null,settled:[],samples:[],adjustment:0};}
 function reset(ctx,phase){if(ctx.stageFeedbackVersion!==version)return;const f=ctx.stageFeedback||(ctx.stageFeedback=create());if(f.phase!==phase){f.phase=phase;f.samples=[];f.settled=[];f.adjustment=0;}}
 function settle(ctx,node,result){if(ctx.stageFeedbackVersion!==version)return null;const f=ctx.stageFeedback;if(!f||f.phase!==Number(node.id.split(':')[0]))return null;if(f.settled.includes(node.id))return f;const home=node.a===ctx.club;if(!home&&node.b!==ctx.club)return null;
  const samples=[];for(const map of result.maps||[]){const n=map.home+map.away;if(!n)continue;const expected=map.predictions?.expected;if(!Number.isFinite(expected))continue;const observed=(home?map.home:map.away)/n,baseline=home?expected:1-expected;samples.push({mapId:map.mapId,rounds:n,residual:clamp(observed-baseline,-.5,.5)});}
  f.settled.push(node.id);f.samples.push(...samples);const n=f.samples.reduce((sum,x)=>sum+x.rounds,0),residual=n?f.samples.reduce((sum,x)=>sum+x.residual*x.rounds,0)/n:0;
  // Small, noisy sample: at most 0.75 equivalent strength, no permanent stat growth.
  f.adjustment=clamp(4*residual*n/(n+48),-.75,.75);return f;
 }
 function team(ctx,t){if(t.id!==ctx.club||ctx.stageFeedbackVersion!==version||!ctx.stageFeedback?.adjustment)return t;return {...t,stageAdjustment:{version,value:ctx.stageFeedback.adjustment}};}
 function strength(t){return t.stageAdjustment?.version===version?clamp(t.stageAdjustment.value||0,-.75,.75):0;}
 return {version,create,reset,settle,team,strength};
});
