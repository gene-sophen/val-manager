const test=require('node:test'),assert=require('node:assert/strict'),{Worker}=require('node:worker_threads'),path=require('node:path');
const H=require('./helpers/live-ui.cjs'),Client=require('../round-worker-client'),P=require('../round-presentation');
const dir=path.resolve(__dirname,'../../设计文档/UI原型/complete-prototype-01');
function spawn(){const code=`global.self=global;self.location={href:'https://example.test/round-worker.js?v=20261010-v04'};global.importScripts=()=>require(${JSON.stringify(path.join(dir,'spatial-engine.js'))});const port=require('node:worker_threads').parentPort;self.postMessage=data=>port.postMessage(data);require(${JSON.stringify(path.join(dir,'round-worker.js'))});port.on('message',data=>self.onmessage({data}));`;
 const w=new Worker(code,{eval:true}),bridge={postMessage:v=>w.postMessage(v),terminate:()=>w.terminate()};w.on('message',data=>bridge.onmessage?.({data}));w.on('error',e=>bridge.onerror?.(e));return bridge;}
test('background rounds preserve frozen results, growth and windows through worker restart',async()=>{
 const x=H.load('worker-parity',{spatial:true}),R=x.PROTOTYPE_RULES,a=H.begin(x);H.veto(x,a);a.run='match';a.agents[0]=Object.fromEntries(a.roster.map((k,i)=>[k,x.AGENT_SELECTION.recommend(x.FLOW_UI.lineup(a),x.CN_CONTENT.agents,R.mapsFor(a)[0]).agents[i]]));R.startMap(a);const b=JSON.parse(JSON.stringify(a)),client=Client.create({spawn});
 try{for(let n=0;n<14&&!R.mapOver(a);n++){if(a.coachWindow)a.coachWindow='';if(b.coachWindow)b.coachWindow='';const i=R.roundInput(a),result=await client.run('same-map',i);Object.assign(i.m,result.map);R.commitRound(a,result.round,true);R.stepRound(b);assert.equal(JSON.stringify(a.liveMaps),JSON.stringify(b.liveMaps));assert.equal(JSON.stringify(a.team),JSON.stringify(b.team));assert.equal(a.coachWindow,b.coachWindow);if(n===5)client.cancel();}}
 finally{client.cancel();}
});
test('duplicate clicks, worker timeout and late messages never commit another round',async()=>{
 let fake;const client=Client.create({timeout:15,spawn:()=>fake={postMessage(){},terminate(){this.closed=true;}}});const pending=client.run('key',{});await assert.rejects(client.run('key',{}),/正在推演/);await assert.rejects(pending,/超时/);assert(fake.closed);fake.onmessage({data:{id:1,map:{wrong:true}}});const retry=client.run('key',{});fake.onmessage({data:{id:2,map:{home:1},round:{number:1}}});assert.equal((await retry).map.home,1);client.cancel();
});
test('skipping the unfinished current replay preserves its score, growth and pause window',()=>{
 const s={year:1,matchToken:'one',map:0,round:1,coachWindow:'opponent',playing:true,liveMaps:[{spatial:{},rounds:[{number:1,home:1,away:0}]}]};let skipped=0;const R={skipReplay:()=>skipped++};assert(P.skipCurrent(s,R));assert.equal(s.round,1);assert.equal(s.coachWindow,'opponent');assert.equal(P.mode(s).replay,false);assert.equal(P.skipCurrent(s,R),false);assert.equal(skipped,1);
});
