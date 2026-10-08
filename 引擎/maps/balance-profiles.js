// Guard views watch physical entrance poses, not every edge in a macro graph.
// Sources and map geometry stay in combat-profiles; these are AI assignments.
module.exports={
 haven:{guards:{a_site:['a_long','a_sewer'],a_tower:['a_site','a_long'],b_site:['mid_courtyard','c_garage'],c_site:['c_cubby','c_window'],c_garage:['mid_doors','c_lobby']},confirmedContacts:3},
 split:{holdHomes:['a_site', 'a_site', 'mid_mail', 'b_site', 'b_tower'],guards:{a_site:['a_main','a_rafters'],a_rafters:['a_main','a_site'],mid_mail:['mid_top'],b_site:['b_garage','b_rafters'],b_tower:['mid_mail','b_site']}},
 sunset:{defensiveSmoke:false,guards:{a_site:['a_elbow','a_link'],a_elbow:['a_main','a_site'],mid_top:['mid_courtyard'],b_site:['b_main','b_market'],b_market:['mid_courtyard','b_site']}},
 breeze:{defensiveSmoke:false,guards:{a_site:['a_shop','a_pyramids'],a_bridge:['a_site','a_ramp'],mid_nest:['mid_top','mid_pillar'],b_site:['b_main','b_tunnel'],b_tunnel:['mid_pillar','b_site']}},
 lotus:{holdHomes:['a_site', 'a_site', 'b_site', 'c_site', 'c_site'],guards:{a_site:['a_main','a_tree'],a_tree:['a_main','a_door'],b_site:['b_main','a_link'],c_site:['c_bend','c_main'],c_waterfall:['c_site','c_main']},confirmedContacts:3},
 fracture:{retakeVia:{A:['a_rope','a_drop']},guardPosts:{a_site:['a_site-stance-0','a_site-stance-5'],b_site:['b_site-stance-2'],b_tower:['b_tower-stance-2']},holdHomes:['a_site','a_site','ct_spawn','b_site','b_tower'],guards:{a_site:['a_main','a_drop'],a_link:['a_rope','a_site'],ct_spawn:['a_link','b_link'],b_site:['b_main','b_tower'],b_tower:['b_arcade','b_site']}},
 abyss:{guardPosts:{a_site:['a_site-stance-2','a_site-stance-4'],a_tower:['a_tower-stance-2'],b_site:['b_site-stance-2','b_site-stance-4'],b_link:['b_link-stance-2']},guards:{a_site:['a_main','a_tower'],a_tower:['a_vent','a_site'],mid_library:['mid_bottom'],b_site:['b_main','b_link'],b_link:['mid_library','b_site']}},
 summit:{guards:{a_site:['a_garden','a_art'],a_art:['a_link','a_garden'],mid_window:['mid_bottom'],b_site:['b_main','b_tower'],b_tower:['b_trophy','b_site']}}
};
