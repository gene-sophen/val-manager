(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.MAP_VETO=api;})(typeof window==='object'?window:this,function(){
 'use strict';
 function steps(bestOf=3,grandFinal=false,upperRole='A'){
  const bans=grandFinal&&bestOf===5?[upperRole,upperRole]:['A','B'];
  return [...bans.map(actor=>({kind:'ban',actor})),{kind:'pick',actor:'A',map:0,side:'B'},{kind:'pick',actor:'B',map:1,side:'A'},...(bestOf===5?[{kind:'pick',actor:'A',map:2,side:'B'},{kind:'pick',actor:'B',map:3,side:'A'},{kind:'decider',map:4,side:'B'}]:[{kind:'ban',actor:'A'},{kind:'ban',actor:'B'},{kind:'decider',map:2,side:'A'}])];
 }
 function validatePool(pool){if(pool.length!==7||new Set(pool).size!==7)throw Error('BP 需要七张不同地图');}
 function create(pool,{bestOf=3,grandFinal=false,playerUpper=false,playerRole='A',canChoose=true}={}){validatePool(pool);if(![3,5].includes(bestOf))throw Error('不支持的系列赛长度');return {pool:[...pool],bestOf,grandFinal,playerUpper,playerRole,canChoose:grandFinal?playerUpper:canChoose,moves:[],sides:Array(bestOf).fill(null)};}
 function sequence(v){return steps(v.bestOf,v.grandFinal,v.playerUpper?v.playerRole:(v.playerRole==='A'?'B':'A'));}
 function actor(v){const st=sequence(v)[v.moves.length];return !st||st.kind==='decider'?null:st.actor===v.playerRole?'player':'opponent';}
 function chooseRole(v,role){if(v.moves.length||!v.canChoose||!['A','B'].includes(role))throw Error('当前没有选择 A/B 顺位的权限');v.playerRole=role;}
 function move(v,map){const st=sequence(v)[v.moves.length];if(!st||!v.pool.includes(map)||v.moves.includes(map))throw Error('不合法的地图禁选');v.moves.push(map);if(v.moves.length===6)v.moves.push(v.pool.find(m=>!v.moves.includes(m)));}
 function maps(v){return sequence(v).flatMap((st,i)=>st.map===undefined?[]:[v.moves[i]]).filter(Boolean);}
 function sideActor(v,map){return sequence(v).find(st=>st.map===map)?.side===v.playerRole?'player':'opponent';}
 function pendingSide(v){return sequence(v).find((st,i)=>st.map!==undefined&&v.moves[i]&&v.sides[st.map]===null&&st.side===v.playerRole)?.map;}
 function setSide(v,map,side){if(!['attack','defense'].includes(side)||!maps(v)[map]||sideActor(v,map)!=='player'||v.sides[map]!==null)throw Error('不合法的开局选边');v.sides[map]=side;}
 function auto(v,knowledge={}){while(actor(v)==='opponent'){const st=sequence(v)[v.moves.length],list=v.pool.filter(m=>!v.moves.includes(m));list.sort((a,b)=>(st.kind==='ban'?1:-1)*((knowledge[a]??50)-(knowledge[b]??50))||v.pool.indexOf(a)-v.pool.indexOf(b));move(v,list[0]);}sequence(v).forEach((st,i)=>{if(st.map!==undefined&&v.moves[i]&&sideActor(v,st.map)==='opponent'&&v.sides[st.map]===null)v.sides[st.map]='attack';});}
 const complete=v=>v.moves.length===7&&v.sides.every(Boolean);
 return {steps,create,sequence,actor,chooseRole,move,maps,sideActor,pendingSide,setSide,auto,complete};
});
