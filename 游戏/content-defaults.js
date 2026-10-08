(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CONTENT_DEFAULTS=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';const version='authored-rosters-2';
 const aliases={FX:'FXW',SP:'SPE'};
 function complete(ctx,cards=[]){ctx.contentPolicy=version;for(const t of ctx.teams){
   if(t.entryOnly&&!t.players.length){const pool=cards.filter(p=>p.tier!=='钻'&&p.team===(aliases[t.id]||t.id)&&p.region===t.region),seen=new Set(),five=pool.filter(p=>!seen.has(p.playerId||p.name)&&(seen.add(p.playerId||p.name),true));
    if(five.length===5){t.players=five.map(p=>({...p,agents:[...(p.agents||[])]}));t.contentStatus='原作者卡库五人；资格席位按赛制模拟';t.rosterCardTeam=aliases[t.id]||t.id;delete t.neutralPrior;}
   }
   if(t.players.length>5)throw Error('队伍超过五人：'+t.id);const present=[...t.players],average=k=>present.length?present.reduce((n,p)=>n+p[k],0)/present.length:65;
   const missing=t.missingPlayers||[];while(t.players.length<5){const i=t.players.length-present.length,name=missing[i]||'待定队员 '+(i+1);t.players.push({cardId:'game-proxy:'+t.id+':'+i,playerId:'game-proxy:'+t.id+':'+i,name,team:t.id,region:t.region,AIM:average('AIM'),SYN:average('SYN'),SEN:average('SEN'),rating:average('rating'),agents:[],source:'game-default',proxy:true,reason:present.length?'缺卡，仅用现有队友均值代理':'挑战者阵容未导入，使用中性先验65'});}
   t.contentEvidence={roster:t.players.some(p=>p.proxy)?'contains-game-proxy':'imported-card-roster',mapScores:'seeded-game-default',coach:'neutral-game-default',ranking:'reference-only'};
  }ctx.dataGaps=ctx.teams.filter(t=>t.players.some(p=>p.proxy)).map(t=>({id:t.id,missing:t.players.filter(p=>p.proxy).map(p=>p.name),status:'缺作者卡值，明确代理'}));return ctx;
 }
 function audit(ctx){return {version,teams:ctx.teams.length,fullTeams:ctx.teams.filter(t=>t.players.length===5).length,proxies:ctx.teams.filter(t=>t.players.some(p=>p.proxy)).map(t=>({id:t.id,players:t.players.filter(p=>p.proxy).map(p=>({name:p.name,reason:p.reason}))})),externalRankingApplied:false,realMapStatsImported:false};}
 return {version,complete,audit};
});
