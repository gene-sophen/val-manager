(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.AGENT_SELECTION=api;})(typeof window==='object'?window:this,function(){
 'use strict';
 const roles={duelist:['捷风','雷兹','霓虹','壹决','不死鸟','夜露','芮娜'],controller:['幽影','炼狱','蝰蛇','星礈','哈泊','暮蝶'],initiator:['猎枭','铁臂','斯凯','K/O','盖可','黑梦','钛狐','禁灭'],sentinel:['零','奇乐','尚勃勒','贤者','钢锁','薇丝','幻棱','迷核']};
 const role=a=>Object.keys(roles).find(r=>roles[r].includes(a))||'initiator';
 const signature=p=>p.tier!=='铜'&&p.agents?.length?p.agents[0]:null;
 const preferences={ascent:['猎枭','K/O','幽影','奇乐','捷风'],sunset:['零','铁臂','雷兹','幽影','盖可'],split:['雷兹','幽影','蝰蛇','铁臂','零'],haven:['猎枭','奇乐','幽影','捷风','铁臂'],lotus:['雷兹','黑梦','幽影','蝰蛇','奇乐'],breeze:['捷风','蝰蛇','猎枭','零','K/O'],summit:['雷兹','铁臂','幽影','奇乐','黑梦'],abyss:['捷风','猎枭','幽影','零','铁臂'],fracture:['雷兹','铁臂','炼狱','奇乐','霓虹']};
 function fit(p,a,map){const i=(p.agents||[]).indexOf(a),r=role(a);return (i===0?100:i>=0?94-i*2:48)+(preferences[map]?.includes(a)?4:0)+(r==='duelist'?p.AIM:r==='initiator'?p.SYN:p.SEN)/50;}
 function composition(selected,map){const counts={};for(const a of selected)counts[role(a)]=(counts[role(a)]||0)+1;let value=Object.keys(roles).reduce((n,r)=>n+(counts[r]?12:0),0);if(['split','lotus','breeze'].includes(map)&&counts.controller===2)value+=8;return value;}
 // Exact branch-and-bound over all available agents. Personal fit upper bounds
 // plus the maximum role bonus prune assignments, never exclude a legal agent.
 function recommend(players,agents,map){if(players.length!==5||agents.length<5)throw Error('快速选择需要五名队员及至少五个特工');const choices=players.map(p=>agents.map(a=>({a,score:fit(p,a,map)})).sort((a,b)=>b.score-a.score||a.a.localeCompare(b.a)));const suffix=Array(6).fill(0);for(let i=4;i>=0;i--)suffix[i]=suffix[i+1]+choices[i][0].score;let best=-Infinity,result=[],visits=0;const selected=[],used=new Set();function search(i,score){visits++;if(score+suffix[i]+56<=best)return;if(i===5){const total=score+composition(selected,map);if(total>best){best=total;result=[...selected];}return;}for(const c of choices[i]){if(score+c.score+suffix[i+1]+56<=best)break;if(used.has(c.a))continue;used.add(c.a);selected.push(c.a);search(i+1,score+c.score);selected.pop();used.delete(c.a);}}search(0,0);return {agents:result,score:best,visits};}
 return {roles,role,signature,fit,composition,recommend};
});
