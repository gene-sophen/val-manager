const test=require('node:test'),assert=require('node:assert/strict'),H=require('../team-style'),S=require('../spatial-match'),O=require('../round-outcome'),vm=require('node:vm'),fs=require('node:fs');
const players=require('../catalog').cards.filter(p=>p.team==='EDG'&&p.tier!=='钻').slice(0,5),priority={attack:[0,1,2,3,4],defense:[1,0,2,3,4]},team=id=>({id,players,team:{羁绊:40,状态:50,熟练:50},coach:{战术:65,临场:60,声望:70},mapKnowledge:{haven:80},tacticalProfile:H.create('spatial',id)});
test('spatial profiles initialize opponent weights, affect actual execution, restore and match the browser bundle',()=>{
 const a=team('A'),b=team('B'),before=JSON.stringify(players),m=O.create('style-spatial','haven'),w=structuredClone(m),ctx={structuredClone};vm.createContext(ctx);vm.runInContext(fs.readFileSync('设计文档/UI原型/complete-prototype-01/spatial-engine.js','utf8'),ctx);
 const options={version:6,behaviorVersion:'haven-balance-1'};S.initialize(m,a,b,priority,null,options);ctx.SPATIAL_MATCH.initialize(w,a,b,priority,null,options);
 const ranked=H.weights('attack',H.order(b.tacticalProfile,'attack'));assert.deepEqual(m.spatial.initial.away.tactics.atk,ranked);S.step(m,a,b,priority);ctx.SPATIAL_MATCH.step(w,a,b,priority);assert.equal(JSON.stringify(m.replay),JSON.stringify(w.replay));
 const profiles=m.replay.events.filter(e=>e.type==='execution_profile');assert.equal(profiles.length,10);assert(profiles.some(p=>Math.abs(p.effective.syn-(p.card.syn+(p.team.bond-40)*.035+(p.team.mastery-50)*.025))>.01));assert(profiles.filter(p=>p.side==='def').some(p=>p.team.map===80));
 const copy=structuredClone(m);assert.deepEqual(S.step(m,a,b,priority),S.step(copy,a,b,priority));assert.equal(JSON.stringify(players),before);
});
test('AI pause priorities use the same matrix and skill budget as numerical play',()=>{
 const coach=require('../../引擎/coach'),t=team('A');t.tacticalProfile=H.create('x','A',{neutral:true});const st=coach.initCoachState({...t,name:'A',tactics:{atk:H.weights('attack',[0,1,2,3,4]),def:H.weights('defense',[0,1,2,3,4])}},65);
 coach.adjust(st,{rng:()=>0,oppSignal:{atk:true},oppTendency:{atk:'rush'}},'timeout');assert.equal(Object.entries(st.weights.def).sort((a,b)=>b[1]-a[1])[0][0],'trap');assert.equal(Object.values(st.weights.def).reduce((a,b)=>a+b),1);
});
