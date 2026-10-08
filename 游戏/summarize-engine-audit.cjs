// Strict per-version/per-cohort reporting. Development cohorts never merged.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const labels=process.argv.slice(2),rows=[];if(!labels.length)throw Error('Specify complete cohort labels');
for(const id of ['split','fracture'])for(const label of labels){
 const file=path.resolve('docs/validation/2026-10-07-multimap-balance',id,label,'results.json'),r=JSON.parse(fs.readFileSync(file));
 if(!r.complete||r.matches.length<48)throw Error('Incomplete cohort '+id+'/'+label);
 for(const s of r.sources)if(crypto.createHash('sha256').update(fs.readFileSync(s.file)).digest('hex')!==s.sha256)throw Error('Source changed '+id+'/'+label+': '+s.file);
 const clubs={};for(const m of r.matches){const x=clubs[m.club]??={maps:0,rounds:0,atk:0};x.maps++;x.rounds+=m.rounds;x.atk+=m.atk;}for(const x of Object.values(clubs))x.atkPercent=+(100*x.atk/x.rounds).toFixed(2);
 rows.push({id,label,behavior:r.behaviorVersion,styleProfiles:r.styleProfiles||false,maps:r.matches.length,totals:r.totals,clubs,overallWithin55:r.totals.atkPercent>=45&&r.totals.atkPercent<=55,allClubsWithin55:Object.values(clubs).every(c=>c.atkPercent>=45&&c.atkPercent<=55),source:file});
}
const out=path.resolve('docs/validation/2026-10-07-engine-completion/summary-'+labels.join('+')+'.json');if(fs.existsSync(out))throw Error('Summary already exists');fs.writeFileSync(out,JSON.stringify({rows,releaseGate:false},null,2));console.log(JSON.stringify(rows.map(r=>({...r,source:undefined})),null,2));
