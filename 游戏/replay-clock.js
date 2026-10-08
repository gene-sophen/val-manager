// Presentation time only. This clock never advances the simulation or consumes RNG.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.REPLAY_CLOCK=factory();})(typeof window==='object'?window:globalThis,()=>{
 function create({duration,speed=1,onTick,onState=()=>{},request=requestAnimationFrame,cancel=cancelAnimationFrame}){
  const state={tick:0,speed,playing:false};let frameId=null,last=null,generation=0;
  const bounded=t=>Math.max(0,Math.min(duration,t));
  const stop=()=>{generation++;if(frameId!==null)cancel(frameId);frameId=null;last=null;};
  function pause(){stop();state.playing=false;onState(state);}
  function play(){if(state.playing)return;if(state.tick>=duration)state.tick=0;stop();state.playing=true;onState(state);const token=generation;
   function frame(now){if(token!==generation||!state.playing)return;frameId=null;if(last!==null)state.tick=bounded(state.tick+Math.min(.25,Math.max(0,(now-last)/1000))*state.speed);last=now;onTick(state.tick);if(token!==generation||!state.playing)return;if(state.tick>=duration){pause();return;}frameId=request(frame);}
   frameId=request(frame);
  }
  function seek(t){pause();state.tick=bounded(t);onTick(state.tick);}
  function setSpeed(value){if(![.5,1,2,4].includes(value))throw Error('不支持的回放速度');state.speed=value;last=null;onState(state);}
  return {state,play,pause,seek,setSpeed};
 }
 return {create};
});
