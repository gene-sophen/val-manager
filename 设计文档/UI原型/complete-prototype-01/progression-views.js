/* Views of committed progression only; rendering never awards anything. */
(() => {
 const R=PROTOTYPE_RULES,D=DEMO,F=FLOW_UI,A=ARCHIVE_UI;
 const number=n=>Math.abs(n)<.05?'持平':(n>0?'+':'')+n.toFixed(1);
 const rows=values=>`<div class="change-rows">${Object.entries(values).map(([k,n])=>`<div><span>${k}</span><b>${number(n)}</b></div>`).join('')}</div>`;
 const summary=(g,label)=>g?`<details class="plain-details"><summary>${label}</summary>${rows({...g.teamDelta,...g.coachDelta})}${Number.isFinite(g.mapDelta)?`<p class="muted">地图分 ${number(g.mapDelta)} · 熟识已计入实际出场选手</p>`:''}</details>`:'';
 const mapResult=F.mapResult;F.mapResult=s=>{const v=mapResult(s);if(s.simulation!=='live')return v;const m=s.liveMaps[s.reviewMap??s.map],record=s.mapRecords.find(r=>r.year===s.year&&r.matchId===s.matchToken&&r.mapId===m.mapId);v.body+=summary(record?.growth,'本图自动成长');return v;};
 const series=F.series;F.series=s=>{const v=series(s);if(s.simulation==='live'){const record=s.participation.find(r=>r.year===s.year&&r.matchId===s.matchToken);v.body+=summary(record?.growth,'赛后队伍与教练变化');}return v;};
 const stage=F.stage;F.stage=s=>{const v=stage(s);if(s.simulation==='live'){const g=s.stageRecords.find(r=>r.phase===s.phase)?.growth;v.body+=summary(g,'阶段成果与声望');if(g?.participants.length)v.body+='<p class="rule-note">赛事熟识收益按实际出场地图份额记录，已离队队员仍保留应得收益。</p>';}return v;};
 const mapDetail=A.mapDetail;A.mapDetail=(id,s)=>{id=D.allMaps.some(m=>m.id===id)?id:D.allMaps[0].id;const v=mapDetail(id,s);if(s.simulation!=='live')return v;v.body=v.body.replace('继承地图分','地图分').replace('新队伍默认 50。地图分随比赛表现变化，教练积累可以跨赛年继承。','教练积累占六成，阵容磨合占四成。胜负结合赛前预期更新；换人只影响阵容部分，新赛年只继承教练部分。');v.body+=`<div class="change-rows"><div><span>教练积累 · 跨年保留</span><b>${s.mapCoach[id].toFixed(1)}</b></div><div><span>阵容磨合 · 新赛年重建</span><b>${s.mapLineup[id].toFixed(1)}</b></div></div>`;return v;};
 const maps=A.maps;A.maps=s=>{const v=maps(s);if(s.simulation==='live')v.body=v.body.replace('地图分跨赛年保留。','教练地图积累跨赛年保留，阵容磨合重新建立。');return v;};
 const coach=A.coach;A.coach=s=>{const v=coach(s);if(s.simulation!=='live')return v;v.body=v.body.replace('三维均为 0–100，跨赛年继承。赛后自动结算，声望可升可降。','三维均为 0–100，跨赛年继承。战术与临场依据游戏估计和实际表现缓慢升降，声望依据赛事与年度成绩变化，不按暂停次数奖励。');v.body+=s.growthReports.filter(g=>g.type!=='map').slice(-3).reverse().map(g=>summary(g,D.phases[g.phase]+' · '+({match:'赛后',event:'阶段',year:'年度'}[g.type]||'成长'))).join('');return v;};
 const compare=F.compareTeam;F.compareTeam=s=>{const v=compare(s);if(s.simulation==='live'){const id=k=>D.cards.find(p=>R.key(p)===k)?.playerId,retained=s.reinforce.filter(k=>s.roster.some(old=>id(old)===id(k))).length;v.body+=`<p class="rule-note">保留 ${retained} / 5 位队员。教练地图积累不变；阵容地图磨合相对 50 的积累保留 ${retained*20}%。未受影响的队员关系保留。</p>`;}return v;};
 const year=F.year;F.year=s=>{const v=year(s);if(s.simulation==='live'){v.body=v.body.replace('教练三维、地图积累、熟识、图鉴与既得荣誉跨局保留。','教练三维、教练地图积累、熟识、图鉴与既得荣誉跨局保留。阵容地图磨合回到 50；结束赛年时按全年成绩结算一次声望。');v.body+=summary(s.annualGrowth,'年度执教评价');}return v;};
})();
