const registry=require('../游戏/content/card-effects-v1.json');
const clamp=n=>Math.max(0,Math.min(100,n));
function value(n,fallback){if(n==null)return fallback;if(!Number.isFinite(n)||n<0||n>100)throw Error('外部属性必须为 0–100 有限数值');return n;}
function state(input={}){return {bond:value(input.bond,40),form:value(input.form,50),mastery:value(input.mastery,50),map:value(input.map,50)};}
function cardEffect(p){
 if(!['金','钻'].includes(p.tier))return null;
 let trait=registry.goldNames[p.name.normalize('NFKC').toLowerCase()]||null,moment=null;
 if(p.tier==='钻'){moment=registry.diamond.find(d=>d.name===p.name&&String(p.cut||p.event||'').includes(d.cut));if(!moment)throw Error('钻卡切面未接入局内效果：'+p.name+' '+(p.cut||p.event));trait=moment.trait;}
 return {version:registry.version,trait,rule:trait?registry.traits[trait]:null,moment};
}
function base(p,st,coach={},execution={}){
 for(const k of ['AIM','SYN','SEN']){if(p[k]==null)throw Error('选手三维缺失：'+p.name);value(p[k],null);}
 const s=state(st),tactics=value(coach.tactics,50);
 return {aim:clamp(p.AIM+(s.form-50)*.04),syn:clamp(p.SYN+(s.bond-40)*.035+(s.mastery-50)*.025+(execution.syn||0)),sen:clamp(p.SEN+(s.map-50)*.03+(tactics-50)*.035+(execution.sen||0))};
}
function bindTeam(team){
 if(team.effectsVersion&&team.effectsVersion!==registry.version)throw Error('外部特性版本不匹配');
 const coach={tactics:value(team.coach?.tactics??team.coach?.战术,50),clutch:value(team.coach?.clutch??team.coach?.临场,50),prestige:value(team.coach?.prestige??team.coach?.声望,50)},executionState=state(team.executionState);
 const players=team.players.map(p=>{base(p,executionState,coach);if(p.cardEffect&&p.cardEffect.version!==registry.version)throw Error('选手特性版本不匹配');return {...p,cardId:p.cardId||p.name+'-'+p.tier,cardEffect:p.cardEffect||cardEffect(p)};});
 return {...team,players,coach,executionState,effectsVersion:registry.version};
}
function condition(kind,round,u,target){
 const allies=round.units.filter(a=>a.alive&&a.side===u.side),enemy=round.units.filter(a=>a.alive&&a.side!==u.side),ctx=round.externalContext?.[u.id[0]]||{},intent=u.side==='atk'?round.atkIntent:round.defIntent;
 switch(kind){
  case 'opening':return !!target&&target.side!==u.side&&round.units.every(a=>!a.roundKills)&&visible(round,u,target);
  case 'rush':return u.side==='atk'&&round.atkFamily==='rush';
  case 'multikill':return u.roundKills>=2;
  case 'match-point':return !!ctx.matchPoint;
  case 'clutch':return allies.length<=2&&enemy.length>=allies.length;
  case 'last-alive':return allies.length===1&&enemy.length>1;
  case 'combo':return (round.effectAbilities||[]).some(e=>e.unitId===u.id&&round.t-e.t<=2)&&(round.effectAbilities||[]).some(e=>e.unitId!==u.id&&e.side===u.side&&round.t-e.t<=2&&e.position&&Math.hypot(e.position.x-u.position.x,e.position.y-u.position.y)<=120);
  case 'trade':return !!target&&target.side!==u.side&&visible(round,u,target)&&(round.effectKills||[]).some(e=>e.side!==u.side&&e.killerId===target.id&&round.t-e.t<=2&&Math.hypot(e.x-u.position.x,e.y-u.position.y)<=120);
  case 'loss-streak':return ctx.lossStreak>=2;
  case 'ambush':return u.holdTicks>=2&&(u.concealed||['lurk','flank'].includes(u.role)||(u.side==='def'&&['trap','flank'].includes(intent.family)));
  case 'defense':return u.side==='def';
  case 'information':return Object.values(round.localObservations?.[u.id]||{}).some(e=>round.t-e.lastSeenTick<=1);
  case 'eco':return u.gun<2;
  case 'trailing-three':return ctx.gap<=-3;
  case 'stronger-opponent':return ctx.enemyPower>ctx.ownPower;
  default:return false;
 }
}
function visible(round,u,target){return (round.map.engagements?round.map.engagements.query(round,u,target).visible:round.map.geometry.visibleFraction(u.position,target.position,{doors:round.doors}))>0;}
function announce(round,u,type,extra){round.effectAnnounced??=new Set();const key=type+':'+u.id+':'+(extra.name||'');if(!round.effectAnnounced.has(key)){round.effectAnnounced.add(key);round.emit(type,{unit:u.name,unitId:u.id,cardId:u.player.cardId,side:u.side,...extra});}}
function refresh(round,target=null){
 if(!round.map.data.externalEffectsVersion)return;
 for(const u of round.units){const stats=base(u.player,u.executionState,u.externalCoach,u.tacticalExecution);Object.assign(u,stats);u.secondChance=false;u.duelChain=false;}
 const activate=u=>{const d=u.player.cardEffect?.moment,ctx=round.externalContext?.[u.id[0]]||{};if(u.alive&&d&&!u.momentUsed&&Number.isInteger(ctx.number)&&condition(d.condition,round,u,target)){u.momentUsed=true;u.momentRound=ctx.number;u.momentKills=u.roundKills;u.rallyActive=d.kind==='rally';announce(round,u,'star_moment',{name:d.moment,kind:d.kind,condition:d.condition});}};
 for(const u of round.units)if(u.player.cardEffect?.moment?.kind==='event-lock')activate(u);
 const locks=new Set(round.units.filter(u=>u.alive&&u.momentUsed&&Number.isInteger(u.momentRound)&&u.player.cardEffect?.moment?.kind==='event-lock'&&u.momentRound===round.externalContext?.[u.id[0]]?.number).map(u=>u.side==='atk'?'def':'atk'));
 round.suppressedEventSides=locks;
 for(const u of round.units)if(!locks.has(u.side)&&u.player.cardEffect?.moment?.kind!=='event-lock')activate(u);
 for(const u of round.units){if(!u.alive)continue;const e=u.player.cardEffect,ctx=round.externalContext?.[u.id[0]]||{},d=e?.moment;
  if(!locks.has(u.side)&&e?.rule&&condition(e.rule.condition,round,u,target)){for(const [k,n]of Object.entries(e.rule.buff))u[k]=clamp(u[k]+n);announce(round,u,'card_trait',{name:e.trait,buff:e.rule.buff,condition:e.rule.condition});}
  if(locks.has(u.side))continue;
 const active=u.momentUsed&&Number.isInteger(ctx.number)&&u.momentRound===ctx.number;
  if(d&&active){if(d.kind==='event-lock')u.sen=clamp(u.sen*d.senMultiplier);if(d.kind==='second-chance')u.secondChance=true;if(d.kind==='duel-chain'){u.duelChain=true;u.aim=clamp(u.aim+Math.min(d.cap,Math.max(0,u.roundKills-u.momentKills)*d.aimPerKill));}}
  if(d?.kind==='giant-killer'&&u.momentUsed&&ctx.number<=u.momentRound+d.rounds-1)for(const [k,n]of Object.entries(d.buff))u[k]=clamp(u[k]+n);
 }
 for(const u of round.units){const d=u.player.cardEffect?.moment,ctx=round.externalContext?.[u.id[0]]||{};if(d?.kind==='rally'&&u.rallyActive&&!locks.has(u.side)){if(ctx.gap>=0)u.rallyActive=false;else for(const a of round.units)if(a.alive&&a.side===u.side)for(const [k,n]of Object.entries(d.buff))a[k]=clamp(a[k]+n);}}
}
function attach(hooks){hooks.onRoundStart.push(round=>{refresh(round);for(const u of round.units)round.emit('execution_profile',{unit:u.name,unitId:u.id,side:u.side,card:{aim:u.player.AIM,syn:u.player.SYN,sen:u.player.SEN},effective:{aim:u.aim,syn:u.syn,sen:u.sen},team:{...u.executionState},coach:{...u.externalCoach},trait:u.player.cardEffect?.trait||null,moment:u.player.cardEffect?.moment?.moment||null});});hooks.beforeDecision.push(({round},options)=>{refresh(round);return options;});}
module.exports={registry,state,cardEffect,base,bindTeam,condition,refresh,attach};
