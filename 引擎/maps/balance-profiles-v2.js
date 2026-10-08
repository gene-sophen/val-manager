// Revision 2 assignments, independent of published revision 1 geometry/poses.
const old=require('./balance-profiles');
module.exports={...old,
 split:{...old.split,holdHomes:['a_site','a_site','mid_mail','b_site','b_site'],guardPosts:{a_site:['a_site-stance-0','a_site-stance-5'],b_site:['b_site-stance-0','b_site-stance-5']},guardPostsByFamily:{
  push:{a_site:['a_site-stance-2','a_site-stance-5'],b_site:['b_site-stance-0','b_site-stance-4']},
  flank:{a_site:['a_site-stance-2','a_site-stance-5'],b_site:['b_site-stance-0','b_site-stance-4']},
  retake:{a_site:['a_site-stance-2','a_site-stance-4'],b_site:['b_site-stance-1','b_site-stance-4']}
 }},
 fracture:{...old.fracture,holdHomes:['a_site','a_site','ct_spawn','b_site','b_site'],guardPosts:{...old.fracture.guardPosts,b_site:['b_site-stance-2','b_site-stance-5']},guardPostsByFamily:{
  push:{b_site:['b_site-stance-2','b_site-stance-4']},flank:{b_site:['b_site-stance-2','b_site-stance-4']},retake:{b_site:['b_site-stance-0','b_site-stance-4']}
 }}
};
