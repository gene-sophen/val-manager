// Report complete cohorts only. Never hide failed maps in a combined average.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ids=require('./spatial-match').mapIds,profiles=require('../引擎/maps/balance-profiles');
const label=process.argv[2]||'held-c',folder=path.resolve('docs/validation/2026-10-07-multimap-balance'),sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const overrides=Object.fromEntries(process.argv.slice(3).map(arg=>{const [id,cohort]=arg.split('=');if(!ids.includes(id)||!cohort)throw Error('Expected mapId=cohort');return [id,cohort];}));
const rows=[];
for(const id of ids){
 const reportLabel=overrides[id]||label,reports=reportLabel.split('+').map(cohort=>JSON.parse(fs.readFileSync(path.join(folder,id,cohort,'results.json'),'utf8')));
 for(const r of reports){
  if(!r.complete||r.matches.length<48)throw Error(id+' does not have a complete 48-map cohort');
  if(JSON.stringify(r.behaviorProfile)!==JSON.stringify(profiles[id]))throw Error(id+' profile changed after sampling');
  for(const source of r.sources){if(source.file==='引擎/maps/balance-profiles.js')continue;if(sha(source.file)!==source.sha256)throw Error(id+' source changed: '+source.file);}
 }
 const report={...reports[0],matches:reports.flatMap(r=>r.matches),totals:Object.fromEntries(Object.keys(reports[0].totals).filter(k=>!['atkPercent','defPercent'].includes(k)).map(k=>[k,reports.reduce((sum,r)=>sum+r.totals[k],0)]))};
 if(new Set(report.matches.map(m=>m.seed+':'+m.side)).size!==report.matches.length)throw Error('Duplicate seed/side samples');
 report.totals.atkPercent=+(100*report.totals.atk/report.totals.rounds).toFixed(2);report.totals.defPercent=+(100*report.totals.def/report.totals.rounds).toFixed(2);
 report.balanceWithin55=report.totals.atkPercent>=45&&report.totals.atkPercent<=55;
 const strata=key=>Object.fromEntries([...new Set(report.matches.map(key))].map(value=>{const xs=report.matches.filter(m=>key(m)===value),rounds=xs.reduce((s,m)=>s+m.rounds,0),atk=xs.reduce((s,m)=>s+m.atk,0);return [value,{maps:xs.length,rounds,atkPercent:+(100*atk/rounds).toFixed(2)}];}));
 // Resample whole seed pairs, rather than pretending every round is independent.
 const groups=[...new Set(report.matches.map(m=>m.seed))].map(seed=>report.matches.filter(m=>m.seed===seed).reduce((g,m)=>({rounds:g.rounds+m.rounds,atk:g.atk+m.atk}),{rounds:0,atk:0}));
 let randomState=0x6ac41e75;const random=()=>{randomState^=randomState<<13;randomState^=randomState>>>17;randomState^=randomState<<5;return (randomState>>>0)/4294967296;},estimates=[];
 for(let n=0;n<4000;n++){let rounds=0,atk=0;for(let j=0;j<groups.length;j++){const g=groups[Math.floor(random()*groups.length)];rounds+=g.rounds;atk+=g.atk;}estimates.push(100*atk/rounds);}
 estimates.sort((a,b)=>a-b);const pairedSeedInterval95=[estimates[100],estimates[3899]].map(x=>+x.toFixed(2));
 rows.push({id,reportLabel,behaviorVersion:report.behaviorVersion,maps:report.matches.length,...report.totals,pairedSeedInterval95,passed:report.balanceWithin55&&!report.totals.blockedShots&&!report.totals.deadShots&&!report.totals.spikeRedrops,byClub:strata(m=>m.club),byPriority:strata(m=>m.priority.attack.join('')),sourceHashes:report.sources});
}
const summary={date:'2026-10-07',label,scope:'Equal-strength mirrored rosters, paired starting sides, four CN lineups, five rotating priorities. Round share, not map-win rate; no probability clipping.',maps:rows,approvedMaps:rows.filter(r=>r.passed).map(r=>r.id),releaseGate:false};
fs.writeFileSync(path.join(folder,'summary-'+label+'.json'),JSON.stringify(summary,null,2)+'\n');console.log(rows.map(({id,maps,rounds,atkPercent,defPercent,passed})=>({id,maps,rounds,atkPercent,defPercent,passed})));
