from pathlib import Path
root=Path(__file__).resolve().parents[2];ui=root/'设计文档/UI原型/complete-prototype-01'
def edit(p,a,b):
 s=p.read_text(encoding='utf-8');assert a in s,(p,a[:70]);p.write_text(s.replace(a,b),encoding='utf-8')
edit(root/'游戏/season-2026.js',"id:region+'-challenger-'+(i+1),teamId:region+'-challenger-'+(i+1)","id:({AMER:['FX','BST','M80','2G'],EMEA:['EP','FF','JL','SGE'],PAC:['SP','XIP','ONG','QTD']})[region][i],teamId:({AMER:['FX','BST','M80','2G'],EMEA:['EP','FF','JL','SGE'],PAC:['SP','XIP','ONG','QTD']})[region][i]")
edit(root/'游戏/tournament.js',"const node={id:prefix+id,a,b,bestOf,officialBestOf:bestOf", "const node={id:prefix+id,a,b,higherSeed:teams.indexOf(a)<=teams.indexOf(b)?a:b,bestOf,officialBestOf:bestOf")
edit(root/'游戏/tournament.js',"bestOf:3,label:'常规赛'", "bestOf:3,higherSeed:teams[i],label:'常规赛'")
edit(root/'游戏/tournament.js',"tables.push(standings(teams,games,play,prefix+'tie:'));", "const tied=[];tables.push(standings(teams,games.filter(g=>g.label==='常规赛'),node=>{const r=play(node);tied.push({...node,...r});return r;},prefix+'tie:'));games.push(...tied);")
edit(root/'游戏/season-2026.js',"else if(phase===7){const qualified=", "else if(phase===7){const qualificationTies=new Map();for(const region of regions)for(const row of pointStandings(ctx,region))for(const g of row.tieGames||[])qualificationTies.set(g.id,g);for(const game of qualificationTies.values()){const r=play(game);out.games.push({...game,...r});}const qualified=")
edit(root/'游戏/season-2026.js',"id:prefix+a+':'+b", "id:prefix+a+':'+b") if False else None
edit(root/'游戏/season-2026.js',"T.standings(group.map(t=>t.id),[],tiePlay,'points:')", "T.standings(group.map(t=>t.id),[],tiePlay,'points:'+region+':')")
edit(ui/'runtime-model.js',"node.a===s.club:true", "(node.higherSeed||node.a)===s.club:true")
edit(ui/'runtime-model.js',"const place=placeIndex===999?[2,5].includes(s.phase)?'常规赛第 '+regional.seeds.indexOf(s.club+':'):'未晋级':'第 '+placeIndex+' 名';", "const place=placeIndex===999?'未晋级':'第 '+placeIndex+' 名';")
edit(ui/'runtime-model.js',"old.matchGrowth(s,D.cards,item.kind,win,id);s.ledger.push(token);", "old.matchGrowth(s,D.cards,item.kind,win,id);const record=s.participation.at(-1);record.bestOf=item.result.bestOf;record.matchId=id;s.ledger.push(token);")
edit(ui/'runtime-model.js',"s.matchToken=null;};", "s.matchToken=null;s.bestOf=3;s.grandFinal=false;s.fastForward=false;};")
# No unresolved point ties before any matches have been played: show the tied table,
# and use the explicit BO1 fallback only when choosing Champions qualification.
edit(root/'游戏/season-2026.js',"if(group.length>1&&unresolved){", "if(group.length>1&&unresolved&&ctx.stages[6]){")
edit(ui/'runtime-views.js',"use('standings',s=>{const points=S.pointStandings(s.seasonEngine,'CN')", "use('standings',s=>{if(!s.seasonEngine)return {title:'赛事与积分',body:section('尚未开始赛年',note('完成开包组队后生成赛事签表与积分。')),dock:'返回征战',go:'campaign'};const points=S.pointStandings(s.seasonEngine,'CN')")
# The BO5 record appears in personal history, instead of the old hard-coded BO3.
edit(ui/'aligned-views.js',"r.kind==='quick'?'快速比赛':'正式 BO3'", "r.kind==='quick'?'快速 BO'+(r.bestOf||3):'正式 BO'+(r.bestOf||3)")
edit(ui/'aligned-views.js',"每次实际地图结果产生示例 ±1 成长", "每次实际地图结果产生 ±1 成长")
print('Refined standings, event attribution, official entrant names and role authority.')
