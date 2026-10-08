// Reproduce one audited match with its exact recorded inputs for diagnosis.
const fs=require('node:fs'),path=require('node:path'),S=require('./spatial-match');
const [id='fracture',label='held-j',index='0']=process.argv.slice(2),folder=path.resolve('docs/validation/2026-10-07-multimap-balance',id,label),report=JSON.parse(fs.readFileSync(path.join(folder,'results.json'),'utf8')),item=report.matches[Number(index)];
if(!item)throw Error('No recorded match at that index');
const input=report.inputs.find(x=>x.club===item.club),team=id=>({id,players:input.players,team:input.team,coach:input.coach}),rounds=[];
S.simulate(item.seed,team('A'),team('B'),item.priority,{mapId:id,version:6,behaviorVersion:report.behaviorVersion,side:item.side,awayPriority:item.priority,onRound:r=>rounds.push(r)});
fs.writeFileSync(path.join(folder,'trace-'+index+'.json'),JSON.stringify({item,input,rounds},null,2)+'\n');
console.log(rounds.map(r=>{const end=r.events.find(e=>e.type==='round_end');return {round:r.round,...end,plant:r.events.find(e=>e.type==='plant')?.site,flanks:r.events.filter(e=>e.type==='retake_route').length};}));
