const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const traits={
 '首杀机器':{condition:'opening',buff:{aim:4}},'快刀手':{condition:'rush',buff:{aim:3,syn:3}},'重炮手':{condition:'multikill',buff:{aim:4}},
 '大场面先生':{condition:'match-point',buff:{aim:3,syn:3,sen:3}},'残局大师':{condition:'clutch',buff:{sen:4}},'孤胆英雄':{condition:'last-alive',buff:{aim:3,sen:3}},
 '黏合剂':{condition:'combo',buff:{syn:4}},'补枪手':{condition:'trade',buff:{syn:4}},'定海神针':{condition:'loss-streak',buff:{aim:2,syn:2,sen:2}},
 '老六':{condition:'ambush',buff:{sen:4}},'铁壁':{condition:'defense',buff:{syn:3,sen:3}},'读心者':{condition:'information',buff:{sen:4}},'Eco 刺客':{condition:'eco',buff:{aim:4}}
};
const goldNames={};for(const line of fs.readFileSync(path.join(root,'设计文档/选手卡/金卡特性方向.md'),'utf8').split(/\r?\n/)){const c=line.split('|').map(x=>x.trim());if(c.length===6&&traits[c[3]])goldNames[c[1].normalize('NFKC').toLowerCase()]=c[3];}
if(Object.keys(goldNames).length!==60)throw Error('金卡分配解析不完整');
const diamond=[
 {name:'ZmjjKK',cut:'23东京',trait:'首杀机器',moment:'冥驹审判',condition:'clutch',kind:'event-lock',senMultiplier:1.3},
 {name:'ZmjjKK',cut:'24首尔',trait:'大场面先生',moment:'降维打击',condition:'match-point',kind:'second-chance',mapping:'原回合胜率两骰取优转换为本回合实际射击命中两骰取优；不重抽整回合、不绕过枪线'},
 {name:'CHICHOO',cut:'25曼谷',trait:'残局大师',moment:'一人成军',condition:'last-alive',kind:'duel-chain',aimPerKill:3,cap:9,mapping:'在实际可见敌人中持续锁定一个目标，每击破一人递增枪法；敌方仍可正常射击，不人为冻结空间中的其他人'},
 {name:'Spring',cut:'25多伦多',trait:'黏合剂',moment:'黑马之蹄',condition:'trailing-three',kind:'rally',buff:{aim:3,syn:3},mapping:'本图追平前全队局部执行增益；追平后消失，不改原卡'},
 {name:'whzy',cut:'23洛杉矶',trait:'首杀机器',moment:'无情判官',condition:'stronger-opponent',kind:'giant-killer',buff:{aim:6},rounds:3}
];
const data={version:'card-effects-1',source:'金卡特性方向.md / 钻卡设计草案.md',status:'CN-first-playable; numbers pending balance',goldNames,traits,diamond,limits:{perMapMoment:1,attributes:[0,100]},note:'仅当前 CN 五个钻卡切面；其他赛区钻卡明确不支持，不替换或猜测。声望通过成长/熟识/羁绊影响，不另叠子弹命中奖励。'};
fs.writeFileSync(path.join(__dirname,'content/card-effects-v1.json'),JSON.stringify(data,null,2)+'\n');console.log('Card effects:',Object.keys(goldNames).length,'gold assignments,',Object.keys(traits).length,'directions,',diamond.length,'CN moments');
