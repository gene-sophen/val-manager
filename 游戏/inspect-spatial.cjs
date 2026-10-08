const S=require('./spatial-match'),O=require('./round-outcome');
const cards=require('./catalog').cards.filter(p=>p.team==='EDG'&&p.tier!=='钻').slice(0,5);
const results={},families={},kills={atk:0,def:0},shots={atk:0,def:0},support={orders:0,movements:0,beforePlantMovements:0};
for(let i=0;i<30;i++) {
 const order=Array.from({length:5},(_,n)=>(i+n)%5),p={attack:order,defense:order},a={id:'A',players:cards},b={id:'B',players:cards};
 const m=O.create('paired-spatial:'+i,'ascent','attack');S.initialize(m,a,b,p);m.spatial.initial.away.tactics=S.weights(p);
 while(!O.ended(m.home,m.away)) {
  S.step(m,a,b,p);const ev=m.replay.events,meta=ev.find(e=>e.type==='round_meta'),end=ev.find(e=>e.type==='round_end'),start=ev.find(e=>e.type==='round_start');
  const key=end.winner+':'+end.reason;results[key]=(results[key]||0)+1;
  const f=meta.atkFamily+' / '+meta.defFamily;families[f]||={rounds:0,attackWins:0};families[f].rounds++;families[f].attackWins+=end.winner==='atk';
  for(const e of ev) {if(e.type==='kill')kills[e.side]++;if(e.type==='shot'){const u=start.units.find(u=>u.id===e.actorId);shots[u.side]++;}if(e.type==='support_call')support.orders++;if(e.type==='support_move'){support.movements++;support.beforePlantMovements+=e.t<(ev.find(e=>e.type==='plant')?.t??Infinity);}}
 }
}
console.log(JSON.stringify({results,families,kills,shots,support},null,2));
