const test=require('node:test'),assert=require('node:assert/strict'),{snapshotAt}=require('../snapshot');
test('reserving a distant stance without a successful movement never teleports a replay portrait',()=>{
 const map={strictSpatial:true,nodes:{from:{x:10,y:10},to:{x:100,y:100}},posts:{reserved:{node:'to',x:100,y:100}}},start={type:'round_start',t:0,units:[{id:'A:0',name:'a',node:'from',position:{x:10,y:10}}]};
 for(const deferred of [true,undefined]){const events=[start,{type:'post_pick',t:1,unitId:'A:0',node:'to',post:'reserved',deferred}];assert.deepEqual(snapshotAt(events,1,map).units['A:0'].position,{x:10,y:10});}
 const events=[start,{type:'post_pick',t:1,unitId:'A:0',node:'to',post:'reserved',deferred:true},{type:'move',t:1,unitId:'A:0',to:'to',ticks:10,route:[{x:10,y:10},{x:100,y:100}]}];assert.deepEqual(snapshotAt(events,2,map).units['A:0'].position,{x:19,y:19});
});
