// Shared game rules. Public scouting deliberately excludes private scores.
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.TEAM_STYLE=api;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const version='team-style-1',keys={attack:['rush','mid','fake','lurk','contact'],defense:['push','hold','trap','flank','retake']},names={attack:['爆弹强攻','默认控图','佯攻转点','分路渗透','接触反打'],defense:['前压争夺','分区控图','诱敌设伏','侧翼绕后','稳守反清']};
 // Rows attack, columns defense. Each row/column sums to zero; no absolute win.
 const matrix=[[3,1.5,-3,-1.5,0],[-3,-1.5,3,0,1.5],[0,3,1.5,-3,-1.5],[-1.5,-3,0,1.5,3],[1.5,0,-1.5,3,-3]];
 const clamp=n=>Math.max(0,Math.min(100,n)),side=s=>s==='atk'?'attack':s==='def'?'defense':s;
 function rng(seed){let h=2166136261;for(const c of String(seed)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}let n=h>>>0;return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
 function shuffled(xs,seed){const random=rng(seed),out=xs.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
 function validate(p){if(!p)return null;if(p.version!==version)throw Error('未知队伍风格版本');for(const s of ['attack','defense'])if(!Array.isArray(p[s])||p[s].length!==5||p[s].some(v=>!Number.isFinite(v)||v<0||v>100))throw Error('战术熟练分必须为五项0–100数值');return p;}
 function snapshot(p){if(!p)return null;validate(p);return {version,origin:p.origin,attack:p.attack.slice(),defense:p.defense.slice()};}
 function create(seed,id,{neutral=false}={}){return {version,origin:neutral?'fresh-roster':'game-seeded',attack:neutral?Array(5).fill(50):shuffled([66,58,49,42,35],seed+':'+id+':attack'),defense:neutral?Array(5).fill(50):shuffled([66,58,49,42,35],seed+':'+id+':defense'),settled:[]};}
 function mapScores(seed,id,ids){const scores=ids.map((_,i)=>ids.length===1?50:35+30*i/(ids.length-1));return Object.fromEntries(shuffled(ids,seed+':'+id+':maps').map((m,i)=>[m,scores[i]]));}
 function index(s,t){const label=side(s);return Number.isInteger(t)?t:keys[label]?.indexOf(t);}
 function score(p,s,t){const i=index(s,t);if(i<0||i>4)throw Error('未知战术');return validate(p)?.[side(s)][i]??50;}
 function matchup(s,own,opponent){s=side(s);const a=index(s,own),b=index(s==='attack'?'defense':'attack',opponent);if(![a,b].every(i=>Number.isInteger(i)&&i>=0&&i<5))throw Error('未知战术对阵');return s==='attack'?matrix[a][b]:-matrix[b][a];}
 function order(p,s,observed=[],quality=1){s=side(s);validate(p);return [0,1,2,3,4].sort((a,b)=>{
  const utility=i=>(score(p,s,i)-50)*.08+(observed.length?observed.reduce((sum,t)=>sum+matchup(s,i,t),0)/observed.length*Math.max(0,Math.min(1,quality)):0);
  return utility(b)-utility(a)||a-b;
 });}
 function priorities(p){return {attack:order(p,'attack'),defense:order(p,'defense')};}
 function weights(s,priority){s=side(s);if(priority.length!==5||new Set(priority).size!==5||priority.some(i=>!Number.isInteger(i)||i<0||i>4))throw Error('战术排序必须包含五类');return Object.fromEntries(priority.map((i,n)=>[keys[s][i],[.4,.26,.17,.11,.06][n]]));}
 function scout(p,maps={}){if(!p)return {attack:[],defense:[],maps:[],origin:'unavailable'};validate(p);return {attack:order(p,'attack').slice(0,2).map(i=>names.attack[i]),defense:order(p,'defense').slice(0,2).map(i=>names.defense[i]),maps:Object.keys(maps).sort((a,b)=>maps[b]-maps[a]||a.localeCompare(b)).slice(0,2),origin:p.origin};}
 const proficiency=(p,s,t)=>(score(p,s,t)-50)*.04;
 function execution(p,s,t,opponent){if(!p)return {syn:0,sen:0};const syn=(score(p,s,t)-50)*.035+matchup(s,t,opponent)*.12;return {syn,sen:syn*.5};}
 function observations(rounds,ownSide){const opponentSide=ownSide==='attack'?'defense':'attack';return rounds.slice(-6).filter(r=>r.side===opponentSide).map(r=>names[opponentSide].indexOf(r.ownTactic)).filter(i=>i>=0);}
 function usage(rounds,home=true){const out={attack:Array(5).fill(0),defense:Array(5).fill(0)};for(const r of rounds||[]){const s=home?r.side:r.side==='attack'?'defense':'attack',name=home?r.ownTactic:r.opponentTactic,i=names[s]?.indexOf(name);if(i>=0)out[s][i]++;}return out;}
 function settle(p,id,counts,won){validate(p);if(!p)return false;p.settled ||= [];if(p.settled.includes(id))return false;
  for(const s of ['attack','defense']){const xs=counts?.[s];if(!Array.isArray(xs)||xs.length!==5||xs.some(v=>!Number.isFinite(v)||v<0))throw Error('无效战术使用摘要');}
  for(const s of ['attack','defense']){const total=counts[s].reduce((a,b)=>a+b,0);if(!total)continue;for(let i=0;i<5;i++)if(counts[s][i])p[s][i]=clamp(p[s][i]+(won?.8:-.35)*counts[s][i]/total+.12*Math.sqrt(counts[s][i]/total));}
  p.settled.push(id);return true;
 }
 function recruit(p,kept){validate(p);if(!p)return;if(!Number.isInteger(kept)||kept<0||kept>5)throw Error('无效保留人数');for(const s of ['attack','defense'])p[s]=p[s].map(v=>50+(v-50)*kept/5);}
 function hint(s,t){s=side(s);const i=index(s,t),other=s==='attack'?'defense':'attack',xs=[0,1,2,3,4];return {strong:names[other][xs.find(j=>matchup(s,i,j)===3)],weak:names[other][xs.find(j=>matchup(s,i,j)===-3)]};}
 return {version,keys,names,matrix,validate,snapshot,create,mapScores,score,matchup,order,priorities,weights,scout,proficiency,execution,observations,usage,settle,recruit,hint};
});
