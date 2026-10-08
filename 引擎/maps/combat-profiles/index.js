// Authored macro connections and reviewed cover selections. Grey minimap marks
// include platforms: they must never all be converted into solid obstacles.
const path = s => s.split(' ');
const site = (main, alternate, defense) => ({main:path(main),alternate:path(alternate),defense:path(defense)});
module.exports={
 haven:{holdHomes:['a_site','a_tower','b_site','c_garage','c_site'],covers:[2,6,7,9,11,14,16,18,19,22,29,31,32,34],levels:[0],mid:'mid_courtyard',
  sites:{A:site('a_garden a_lobby a_long a_site','mid_window mid_courtyard a_sewer a_site','a_site a_tower a_link'),B:site('mid_window mid_courtyard b_site','c_lobby mid_doors c_garage b_site','b_site b_back'),C:site('c_lobby c_long c_cubby c_site','mid_window mid_courtyard mid_doors c_garage c_window c_site','c_site c_link')},
  links:['t_spawn a_garden','t_spawn mid_window','t_spawn c_lobby','a_lobby a_sewer','c_lobby mid_doors','c_garage c_link','b_back a_link','b_back c_link','a_link ct_spawn','c_link ct_spawn'],features:['three-sites','garage-flank']},
 split:{holdHomes:['a_site','a_rafters','mid_mail','b_site','b_tower'],covers:[6,7,9,10,11,12,13,18,22,27,28,33,35,39],levels:[0,1,4],mid:'mid_top',
  sites:{A:site('a_lobby a_main a_site','a_sewer mid_bottom mid_top mid_vent a_tower a_rafters a_site','a_site a_screens'),B:site('b_lobby b_garage b_site','mid_bottom mid_top mid_mail b_tower b_rafters b_site','b_site b_alley')},
  links:['t_spawn a_lobby','t_spawn a_sewer','t_spawn mid_bottom','t_spawn b_lobby','b_lobby b_link','b_link mid_bottom','a_tower a_screens','a_screens ct_spawn','b_alley ct_spawn','b_tower b_stairs','b_stairs ct_spawn'],traversals:[['mid_vent','a_tower','rope',2],['mid_mail','b_tower','rope',2]],features:['raised-mid','rope-delay']},
 sunset:{holdHomes:['a_site','a_elbow','mid_top','b_site','b_market'],covers:[2,3,4,5,6,7,8,9,10,12,14,15,16,17,18,19,20,21,22,24,25],levels:[],mid:'mid_courtyard',
  sites:{A:site('a_lobby a_main a_elbow a_site','mid_tiles mid_courtyard a_link a_site','a_site a_alley'),B:site('b_lobby b_main b_site','mid_bottom mid_courtyard b_market b_site','b_site b_boba')},
  links:['t_spawn a_lobby','t_spawn mid_tiles','t_spawn b_lobby','b_lobby mid_bottom','mid_bottom mid_courtyard','mid_courtyard mid_top','mid_top ct_spawn','a_alley ct_spawn','b_boba ct_spawn','a_site a_link'],
  mechanisms:[{id:'market-door',name:'B 市场门',kind:'destructible-door',a:'b_market',b:'b_site',at:.68,health:500}],features:['three-lanes','market-door']},
 breeze:{holdHomes:['a_site','a_bridge','mid_nest','b_site','b_tunnel'],covers:[2,3,4,5,6,7,8,9,10,11,12,14,15,19,20,21,23,24,25,27],levels:[0,1],mid:'mid_pillar',speed:{run:30,walk:20},
  sites:{A:site('a_lobby a_shop a_site','mid_bottom mid_pillar mid_wood_doors a_pyramids a_site','a_site a_bridge'),B:site('b_main b_site','mid_bottom mid_pillar b_tunnel b_site','b_site b_wall')},
  links:['t_spawn a_lobby','t_spawn mid_bottom','t_spawn mid_cannon','mid_cannon b_main','b_main b_window','mid_cannon mid_bottom','mid_pillar mid_top','mid_top mid_nest','mid_nest ct_spawn','b_tunnel b_elbow','b_wall defender_side_arches','defender_side_arches ct_spawn','a_bridge ct_spawn','a_shop mid_hall','mid_hall a_ramp','a_ramp a_bridge','b_site b_back'],features:['long-sightlines','pyramids'],patchCaution:'Breeze 12.00 重做；缓存小地图补丁未知，不宣称与 2026 实时地图逐墙一致。'},
 lotus:{holdHomes:['a_site','a_tree','b_site','c_site','c_waterfall'],covers:[2,3,4,5,6,7,8,10,16,17,18,19,21,25,26,27,29,30],levels:[0,1],mid:'b_pillars',
  sites:{A:site('a_lobby a_root a_rubble a_main a_site','a_lobby a_root a_main a_door a_tree a_site','a_site a_stairs a_top'),B:site('b_pillars b_main b_site','a_root a_main a_link b_site','b_site b_upper'),C:site('c_lobby c_mound c_main c_bend c_site','b_pillars b_main c_door c_main c_site','c_site c_hall c_gravel')},
  links:['t_spawn a_lobby','t_spawn b_pillars','t_spawn c_lobby','a_top ct_spawn','b_upper ct_spawn','b_upper c_link','c_link c_waterfall','c_waterfall c_site','c_gravel ct_spawn','a_top a_drop','a_drop a_site','a_link b_upper'],
  mechanisms:[{id:'a-rotating',name:'A 旋转门',kind:'rotating',a:'a_door',b:'a_tree',at:.35,openSeconds:10},{id:'c-rotating',name:'C 旋转门',kind:'rotating',a:'b_main',b:'c_door',at:.75,openSeconds:10},{id:'a-link-breakable',name:'A-B 可破坏连接',kind:'breakable',a:'a_link',b:'b_site',at:.3,health:200}],features:['three-sites','rotating-doors','breakable-link']},
 fracture:{holdHomes:['a_site','a_link','ct_spawn','b_site','b_tower'],openAir:[1,2],covers:[4,5,6,7,9,10,11,12,13,17,18,19,20,21,23,25],levels:[0,1],mid:'ct_spawn',
  sites:{A:site('a_hall a_door a_main a_site','a_gate a_dish a_drop a_site','a_site a_link'),B:site('b_tree b_main b_site','b_bench b_arcade b_tower b_site','b_site b_generator b_link')},
  links:['t_spawn a_hall','t_spawn b_tree','t_bridge a_gate','t_bridge b_bench','a_hall a_rope','a_rope a_link','a_link ct_spawn','b_link ct_spawn','b_generator b_canteen','b_canteen b_tunnel','b_tunnel b_tree','a_drop a_rope','t_spawn t_bridge'],traversals:[['t_spawn','t_bridge','zipline',8]],
  mechanisms:[{id:'a-hall-door',name:'A 大厅自动门',kind:'proximity',a:'a_hall',b:'a_door',at:.7}],features:['two-sided-attack','tower-retake','zipline-transfer']},
 abyss:{holdHomes:['a_site','a_tower','mid_library','b_site','b_link'],openAir:[7,8,10],covers:[3,4,5,6,7,8,11,12,13,14,16,18,22,23,24,29,30,33],levels:[0,1,2],mid:'mid_bottom',
  sites:{A:site('a_lobby a_main a_site','mid_bend mid_bottom mid_catwalk a_vent a_tower a_site','a_site a_security'),B:site('b_lobby b_nest b_main b_site','mid_bend mid_bottom mid_library b_link b_site','b_site b_link')},
  links:['t_spawn a_lobby','t_spawn mid_bend','t_spawn b_lobby','a_site a_bridge','a_security ct_spawn','a_tower a_link','a_link ct_spawn','a_vent mid_top','mid_top ct_spawn','mid_library mid_top','b_link ct_spawn'],features:['void-boundaries','safe-routes','raised-catwalk'],patchCaution:'深渊边界阻止穿越；本版采用安全路线，未加入危险跳跃和坠落动作。'},
 summit:{holdHomes:['a_site','a_art','mid_window','b_site','b_tower'],covers:[2,3,4,7,8,9,10,11,12,14,15,16,17,20,21,22,24,26,27,29,30],levels:[0,1],mid:'mid_fountain',
  sites:{A:site('a_lobby a_main a_garden a_site','mid_top mid_fountain mid_bend a_link a_art a_site','a_site a_cave a_hall'),B:site('b_lobby b_main b_site','mid_top mid_tiles mid_fountain b_link b_trophy b_tower b_site','b_site b_tower b_gym')},
  links:['t_spawn a_lobby','t_spawn mid_top','t_spawn b_lobby','mid_tiles b_lobby','mid_fountain mid_bottom','mid_bottom mid_window','mid_window ct_spawn','a_hall ct_spawn','a_art a_garden','a_art a_hall','b_gym ct_spawn','b_site b_drop','b_drop b_tower'],
  mechanisms:[{id:'a-drop-wall',name:'A 花园落墙',kind:'drop-wall',a:'a_art',b:'a_garden',at:.5},{id:'mid-drop-wall',name:'中路窗口落墙',kind:'drop-wall',a:'mid_window',b:'mid_bottom',at:.2},{id:'b-drop-wall',name:'B 高塔落墙',kind:'drop-wall',a:'b_tower',b:'b_site',at:.3}],features:['three-lanes','round-persistent-drop-walls']}
};



