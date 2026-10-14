/* Watching controls do not cancel, resample or mutate an in-flight round input. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MATCH_CONTROLS=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const key=s=>[s.year,s.matchToken,s.map].join(':');
 function create({state,busy,stopTimer,update=()=>{},receipt=()=>{},rules}){
  let stopping=false;
  function stop(){const s=state();s.playing=false;s.fastForward=false;stopTimer();stopping=busy();receipt(stopping?'已接收停止请求，本分完成后等待':'已停止自动推进');update();}
  function timeout(){const s=state();if(rules.mapOver(s)){receipt('本图已结束，不能申请战术暂停');return false;}if(s.coachWindow){receipt('已有执教窗口，无需再次申请暂停');return false;}if(busy()){if(s.pendingTimeout)return true;s.pendingTimeout={key:key(s),afterRound:s.round+1};stop();receipt('战术暂停已登记，当前分结束后按规则判定');update();return true;}const ok=rules.chargeTimeout(s);receipt(ok?'战术暂停已开放，双方可调整':'当前边界或剩余次数不允许战术暂停');if(ok)stop();update();return ok;}
  function committed(){const s=state(),p=s.pendingTimeout;s.pendingTimeout=null;if(p){if(p.key!==key(s))receipt('比赛位置已变化，待处理暂停已撤销');else if(rules.mapOver(s))receipt('本图已结束，暂停申请未消耗次数');else if(s.coachWindow)receipt('已进入执教窗口，暂停申请未消耗次数');else receipt(rules.chargeTimeout(s)?'战术暂停已开放，双方可调整':'暂停申请未被规则接受，次数未消耗');}if(stopping)s.playing=false;stopping=false;}
  function restore(){stopping=false;if(state().pendingTimeout){state().pendingTimeout=null;receipt('上次待处理暂停未提交，可重新申请');}}
  return {stop,timeout,committed,restore,stopping:()=>stopping};
 }
 return {create};
});
