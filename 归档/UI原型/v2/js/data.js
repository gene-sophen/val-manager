/* ================= 假数据（沿用 v1 结构，路径前缀适配 v2/ 深度） ================= */
const A = p => '../../../素材库/' + p;
const QN = {gold:'金', silver:'银', bronze:'铜', diamond:'钻'};
const PLAYERS = {
  Haodong:  {team:'EDG',  region:'CN',   q:'gold',   g:92, s:85, m:88, status:'hot',  agents:['幽影','零','蝰蛇'],   trait:'大场面先生'},
  heybay:   {team:'EDG',  region:'CN',   q:'silver', g:78, s:82, m:74, status:'cold', agents:['猎枭','零','黑梦']},
  SUYGETSU: {team:'VIT',  region:'EMEA', q:'gold',   g:88, s:80, m:85, status:'',     agents:['幽影','蝰蛇','零'],   trait:'残局大师'},
  Munchkin: {team:'GEN',  region:'PAC',  q:'silver', g:80, s:84, m:79, status:'',     agents:['猎枭','黑梦','零']},
  stax:     {team:'T1',   region:'PAC',  q:'silver', g:82, s:86, m:84, status:'',     agents:['铁臂','猎枭','黑梦']},
  Boaster:  {team:'FNC',  region:'EMEA', q:'gold',   g:85, s:90, m:88, status:'',     agents:['幽影','炼狱','零'],   trait:'铁血指挥'},
  Marved:   {team:'NRG',  region:'AMER', q:'bronze', g:68, s:60, m:64, status:'',     agents:['幽影','蝰蛇']},
  Saadhak:  {team:'LOUD', region:'AMER', q:'silver', g:79, s:83, m:86, status:'',     agents:['零','猎枭','幽影']},
  starxo:   {team:'100T', region:'AMER', q:'bronze', g:66, s:70, m:62, status:'',     agents:['捷风','霓虹']},
  Zellsis:  {team:'SEN',  region:'AMER', q:'bronze', g:70, s:65, m:60, status:'',     agents:['霓虹','芮娜']},
  tex:      {team:'LEV',  region:'AMER', q:'silver', g:81, s:72, m:70, delta:-12,     agents:['捷风','霓虹','夜露']},
  Rossy:    {team:'G2',   region:'AMER', q:'bronze', g:65, s:60, m:63, delta:-22,     agents:['幽影','猎枭']},
  v1c:      {team:'BLG',  region:'CN',   q:'gold',   g:86, s:78, m:80, delta:-8,      agents:['捷风','雷兹','霓虹'], trait:'少年枪男'},
  DH:       {team:'TYL',  region:'CN',   q:'silver', g:77, s:80, m:76, delta:-15,     agents:['幽影','零','黑梦']},
  BerLIN:   {team:'FPX',  region:'CN',   q:'gold',   g:84, s:88, m:86, delta:-10,     agents:['幽影','蝰蛇','零'],   trait:'残局大师'},
  Crws:     {team:'TH',   region:'EMEA', q:'bronze', g:69, s:71, m:66, status:'',     agents:['捷风','霓虹']},
  tuyz:     {team:'LOUD', region:'AMER', q:'silver', g:80, s:74, m:72, status:'',     agents:['幽影','蝰蛇','猎枭']},
  Kicks:    {team:'VIT',  region:'EMEA', q:'silver', g:76, s:79, m:77, status:'',     agents:['零','猎枭','黑梦']},
  Proxh:    {team:'TYL',  region:'CN',   q:'bronze', g:67, s:69, m:61, status:'',     agents:['霓虹','捷风']},
};
const IMG_EXT = {tex:'.jpeg'}; // 其余为 .png
const pimg = id => A('选手半身像/' + id + (IMG_EXT[id] || '.png'));

const OBS = {
  Haodong:  [{t:'关键时刻不手软，疑似大心脏', w:'季后赛① · 半决赛'}, {t:'连杀后喜欢前压，偶尔白给', w:'常规赛 · 第3轮', neg:1}, {t:'首杀率联盟前三', w:'常规赛 · 第1轮'}],
  heybay:   [{t:'逆风局容易隐身', w:'常规赛 · 第4轮', neg:1}, {t:'道具配合意识在线', w:'常规赛 · 第2轮'}],
  SUYGETSU: [{t:'残局选位刁钻，1v1 胜率高', w:'常规赛 · 第4轮'}, {t:'逆风局容易隐身', w:'大师赛① · 八强', neg:1}],
  Munchkin: [{t:'指挥调度清晰，中期决策果断', w:'常规赛 · 第3轮'}, {t:'枪法平平，靠脑子吃饭', w:'常规赛 · 第1轮'}],
  stax:     [{t:'老将稳定性极佳，失误率最低', w:'常规赛 · 第4轮'}, {t:'对枪不主动，偏保守', w:'常规赛 · 第2轮', neg:1}],
};
const OBS_DEFAULT = [{t:'样本不足，持续观察中', w:'系统'}];

const DRAFT_POOL = ['Haodong','heybay','Boaster','stax','Marved','Saadhak','starxo','SUYGETSU','Zellsis','Munchkin'];
const TF_NEW = ['tex','Rossy','v1c','DH','BerLIN'];
const GALLERY_LOCKED = new Set(['Boaster','Marved','starxo','Zellsis','Rossy','Crws','Proxh']);
const GALLERY_ORDER = ['Haodong','heybay','v1c','DH','Proxh','stax','Munchkin','SUYGETSU','Boaster','Kicks','Crws','BerLIN','Marved','Saadhak','starxo','Zellsis','tex','Rossy','tuyz'];
const DRAW_FIVE = ['v1c','tuyz','Crws','Kicks','Zellsis'];

const state = {
  packs: 2,
  chemistry: 78,
  lineup: ['Haodong','heybay','SUYGETSU','Munchkin','stax'],
  coach: {rep:72, tac:65, cli:58},
  regMatchDone: false,
  resultClaimed: false,
  draftSel: [],
  tfUsed: new Set(),
  lobbySeen: false,
  mapAnimated: false,
};

const JOURNEY = [
  {id:'champ',  nm:'冠军赛',        region:['CN','AMER','EMEA','PAC'], rc:'r-emea', st:'locked', lock:'解锁条件：赢得季后赛②', crown:1},
  {id:'po2',    nm:'季后赛②',      region:['CN'],                    rc:'r-cn',   st:'locked', lock:'解锁条件：第二赛段常规赛排名前四'},
  {id:'reg2',   nm:'第二赛段常规赛', region:['CN'],                    rc:'r-cn',   st:'locked', lock:'解锁条件：大师赛②结束后开启'},
  {id:'m2',     nm:'大师赛②',      region:['AMER','EMEA','PAC'],     rc:'r-amer', st:'locked', lock:'解锁条件：季后赛①夺冠'},
  {id:'po1',    nm:'季后赛①',      region:['CN'],                    rc:'r-cn',   st:'locked', lock:'解锁条件：常规赛排名前二'},
  {id:'reg1',   nm:'第一赛段常规赛', region:['CN'],                    rc:'r-cn',   st:'current'},
  {id:'m1',     nm:'大师赛①',      region:['AMER','EMEA','PAC'],     rc:'r-pac',  st:'done', res:'4强'},
  {id:'kick',   nm:'启点赛',        region:['CN'],                    rc:'r-cn',   st:'done', res:'冠军'},
];

const STANDINGS = [
  {t:'EDG', w:4, l:0, me:1}, {t:'BLG', w:3, l:1}, {t:'FPX', w:2, l:2},
  {t:'TYL', w:2, l:2}, {t:'TE', w:1, l:3}, {t:'WOL', w:0, l:4},
];

/* 攀登地图：节点坐标（x 为地图宽 %，y 为距顶 px；底部=起点，向上攀登） */
const MAP_POS = {
  po2:  {x:68, y:215},
  reg2: {x:28, y:335},
  m2:   {x:70, y:455},
  po1:  {x:26, y:575},
  reg1: {x:68, y:695},
  m1:   {x:26, y:1040},
  kick: {x:62, y:1160},
};
const RC_REGION = {'r-cn':'CN', 'r-emea':'EMEA', 'r-pac':'PAC', 'r-amer':'AMER'};
const RC_COLOR = {'r-cn':'var(--region-cn)', 'r-emea':'var(--region-emea)', 'r-pac':'var(--region-pac)', 'r-amer':'var(--region-amer)'};
