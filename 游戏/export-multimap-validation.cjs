// Export the frozen diagnostic provenance; this does not compile or mutate maps.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const registry=require('../引擎/maps/combat-registry'),root=path.resolve(__dirname,'..'),out=path.join(root,'docs/validation/2026-10-06-multimap');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const maps=registry.ids.map(id=>{const {data}=registry.entries[id];return {id,name:data.name,layoutVersion:data.layoutVersion,counts:data.layerCounts,features:data.features,mechanisms:data.doorDefinitions.map(d=>({id:d.id,kind:d.kind})),source:{asset:data.source.asset,sha256:data.source.sha256,patch:data.source.patch,sourceTransform:data.source.sourceTransform,coordinateCorrections:data.source.coordinateCorrections},files:[`引擎/maps/${id}-combat-v6.json`,`引擎/maps/${id}-geometry-v6.json`,`素材库/地图风格/${id}-combat-v6.svg`].map(file=>({file,sha256:sha(file)})),releaseGate:false};});
fs.writeFileSync(path.join(out,'combat-manifest.json'),JSON.stringify({schemaVersion:1,date:'2026-10-06',formalDefault:'team-level',sourcePatchVerified:false,releaseGate:false,maps},null,2)+'\n');
const audit=JSON.parse(fs.readFileSync(path.join(out,'audit.json'),'utf8'));
if(audit.maps.length!==8||audit.failures.length)throw Error('Eight-map audit is incomplete or has failures');
const totals={};for(const key of ['maps','rounds','attackerWins','shots','blockedShots','moves','invalidRoutes','liveFrames','invalidFrames','doorEvents','objectDamage','ziplineMoves','supportMoves'])totals[key]=audit.maps.reduce((s,m)=>s+m[key],0);
totals.attackerWinPercent=+(totals.attackerWins/totals.rounds*100).toFixed(1);
fs.writeFileSync(path.join(out,'audit-summary.json'),JSON.stringify({releaseGate:false,samplePurpose:audit.samplePurpose,totals},null,2)+'\n');
const engine=['gamemap.js','tactics.js','map-tactics.js','round.js','brain.js','observation.js','abilities.js','combat.js','movement.js','geometry.js','geometry-v2.js','engagements.js','map-mechanisms.js','doors.js','snapshot.js'].map(f=>'引擎/'+f);
const ui=['app.js','runtime-model.js','runtime-fixtures.js','spatial-view.js','spatial-engine.js','ui.css','index.html','sw.js','map-preview-combat/index.html','map-preview-combat/layered.js'].map(f=>'设计文档/UI原型/complete-prototype-01/'+f);
const extra=['游戏/spatial-match.js','游戏/commentary.js','游戏/spectator-layout.js','游戏/audit-multimap.cjs','游戏/export-multimap-validation.cjs','引擎/maps/build-multimap-combat.cjs','引擎/maps/combat-registry.js','引擎/maps/combat-profiles/index.js','引擎/maps/combat-profiles/stances.js'];
fs.writeFileSync(path.join(out,'file-hashes.json'),JSON.stringify([...engine,...ui,...extra,...maps.flatMap(m=>m.files.map(f=>f.file))].map(file=>({file,sha256:sha(file)})),null,2)+'\n');
console.log(JSON.stringify(totals));
