const test=require('node:test'),assert=require('node:assert/strict'),E=require('../external-effects');
const p=(name,tier='金',cut='')=>({name,tier,cut,cardId:name+cut,AIM:70,SYN:70,SEN:70,agents:['捷风']}),unit=(p,id,side)=>({id,name:p.name,player:{...p,cardEffect:E.cardEffect(p)},side,alive:true,position:{x:180,y:610},roundKills:0,holdTicks:2,executionState:{bond:40,form:50,mastery:50,map:50},externalCoach:{tactics:50}});
function round(units,context={}){return {map:{data:{externalEffectsVersion:'card-effects-1'},geometry:{visibleFraction:()=>1}},t:0,units,atkFamily:'rush',atkIntent:{family:'rush'},defIntent:{family:'hold'},externalContext:{A:{number:1,gap:0,ownPower:100,enemyPower:100,...context},B:{number:1,gap:0,ownPower:100,enemyPower:100}},emit:()=>{}};}
test('external player/team/map/coach values affect distinct match-local attributes, never source cards',()=>{
 const card=p('CHICHOO'),before=JSON.stringify(card),neutral=E.base(card,{bond:40,form:50,mastery:50,map:50},{tactics:50}),strong=E.base(card,{bond:100,form:100,mastery:100,map:100},{tactics:100});assert(strong.aim>neutral.aim);assert(strong.syn>neutral.syn);assert(strong.sen>neutral.sen);assert.equal(JSON.stringify(card),before);assert.throws(()=>E.base({...card,AIM:NaN},{},{tactics:50}));
});
test('raw engine team input binds the same card effects without mutating the caller',()=>{const input={name:'A',players:[p('CHICHOO')],executionState:{bond:55,form:45,mastery:60,map:70},coach:{战术:80,临场:75,声望:60}},before=JSON.stringify(input),bound=E.bindTeam(input);assert.equal(bound.players[0].cardEffect.trait,'铁壁');assert.equal(bound.coach.tactics,80);assert.equal(bound.coach.clutch,75);assert.equal(bound.executionState.bond,55);assert.equal(JSON.stringify(input),before);});
test('gold activates only on the documented condition and repeated refresh never accumulates buffs',()=>{
 const u=unit(p('CHICHOO'),'A:0','def'),v=unit(p('not-gold','银'),'B:0','atk'),r=round([u,v]);E.refresh(r);assert.equal(u.syn,73);assert.equal(u.sen,73);for(let n=0;n<20;n++)E.refresh(r);assert.equal(u.syn,73);u.side='atk';v.side='def';E.refresh(r);assert.equal(u.syn,70);assert.equal(u.sen,70);
});
test('opening and combo traits require actual encounter/casting evidence, not just round start',()=>{
 const u=unit(p('SLOWLY'),'A:0','atk'),enemy=unit(p('unknown','银'),'B:0','def'),r=round([u,enemy]);E.refresh(r);assert.equal(u.aim,70);E.refresh(r,enemy);assert.equal(u.aim,74);enemy.roundKills=1;E.refresh(r,enemy);assert.equal(u.aim,70);
 const glue=unit(p('lysoar'),'A:1','atk'),combo=round([glue,u,enemy]);combo.effectAbilities=[{unitId:u.id,side:'atk',t:0,position:u.position}];E.refresh(combo);assert.equal(glue.syn,70);combo.effectAbilities.push({unitId:glue.id,side:'atk',t:0,position:glue.position});E.refresh(combo);assert.equal(glue.syn,74);
});
test('CN diamond registry covers all five cuts and unknown editions fail instead of receiving another card effect',()=>{assert.equal(E.registry.diamond.length,5);for(const d of E.registry.diamond)assert.equal(E.cardEffect(p(d.name,'钻',d.cut)).moment.moment,d.moment);assert.throws(()=>E.cardEffect(p('ZmjjKK','钻','unknown')),/未接入/);assert.equal(E.cardEffect(p('CHICHOO','铜')),null);});
test('clutch star moment activates once per map and event lock suppresses opposing gold and random triggers',()=>{
 const u=unit(p('ZmjjKK','钻','23东京'),'A:0','atk'),v=unit(p('CHICHOO'),'B:0','def'),r=round([u,v]);let triggers=0;r.emit=type=>triggers+=type==='star_moment';E.refresh(r);assert(u.momentUsed);assert.equal(u.sen,91);assert(r.suppressedEventSides.has('def'));assert.equal(v.syn,70);E.refresh(r);assert.equal(triggers,1);r.externalContext.A.number=2;r.externalContext.B.number=2;E.refresh(r);assert.equal(u.sen,70);assert.equal(triggers,1);
});
test('match-point second chance and duel-chain are round-bounded and do not promise a geometric kill',()=>{
 const a=unit(p('ZmjjKK','钻','24首尔'),'A:0','atk'),b=unit(p('unknown','银'),'B:0','def'),r=round([a,b],{matchPoint:true});E.refresh(r);assert(a.secondChance);r.externalContext.A.number++;E.refresh(r);assert(!a.secondChance);
 const c=unit(p('CHICHOO','钻','25曼谷'),'A:0','atk'),d=unit(p('unknown','银'),'B:1','def'),duel=round([c,b,d]);E.refresh(duel);assert(c.duelChain);c.roundKills=2;E.refresh(duel);assert.equal(c.aim,76);assert.equal(c.player.AIM,70);
});
test('rally persists through its owner death until a tie; giant killer expires after three rounds',()=>{
 const a=unit(p('Spring','钻','25多伦多'),'A:0','atk'),friend=unit(p('unknown','银'),'A:1','atk'),enemy=unit(p('unknown','银'),'B:0','def'),r=round([a,friend,enemy],{gap:-3});E.refresh(r);assert.equal(friend.aim,73);a.alive=false;E.refresh(r);assert.equal(friend.aim,73);r.externalContext.A.gap=0;E.refresh(r);assert.equal(friend.aim,70);
 const w=unit(p('whzy','钻','23洛杉矶'),'A:0','atk'),rr=round([w,enemy],{enemyPower:101});E.refresh(rr,enemy);assert.equal(w.aim,80);rr.externalContext.A.number=4;E.refresh(rr,enemy);assert.equal(w.aim,74);
});
test('a gold trade trait improves the actual contact reaction timing through SYN, without a hidden target',()=>{
 const {RoundSim}=require('../round'),{GameMap}=require('../gamemap'),{buildIntent}=require('../tactics'),hooks=require('../hooks');
 const map=new GameMap(require('../maps/ascent-combat-v5.json'),require('../maps/ascent-geometry-v5.json'));
 function contact(withTrait){const a=unit(p('Spring'),'A:0','atk'),b=unit(p('unknown','银'),'B:0','def');if(!withTrait)a.player.cardEffect=null;
  for(const u of [a,b])Object.assign(u,{sideIdx:0,gun:0,utils:0});const seen=[],r=new RoundSim({map,atkUnits:[a],defUnits:[b],atkFamily:'rush',defFamily:'hold',atkIntent:buildIntent(map,'atk','rush',()=>0),defIntent:buildIntent(map,'def','hold',()=>0),rng:()=>0,hooks:hooks(),logger:e=>seen.push(e),externalContext:{A:{number:1,gap:0},B:{number:1,gap:0}}});
  r.t=1;a.position={x:180,y:610};b.position={x:193,y:638};a.post=b.post=null;r.effectKills=[{t:1,side:'def',killerId:b.id,x:180,y:610}];r.resolveTimedFire();return seen.find(e=>e.type==='contact'&&e.unitId===a.id);}
 const plain=contact(false),gold=contact(true);assert(plain.tradeResponse);assert(gold.tradeResponse);assert(Math.abs(plain.readyAt-gold.readyAt-.004)<1e-8);assert(gold.coordinationSeconds>plain.coordinationSeconds);
});
