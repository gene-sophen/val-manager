"""Create a tiny read-only visual snapshot, resolving actual asset extensions."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[3]
out=Path(__file__).parent
catalog=json.loads((root/'数据源/cards_full.json').read_text(encoding='utf-8'))
def asset(folder,name):
    found=next((root/'素材库'/folder).glob(name+'.*'))
    return str(found.relative_to(root/'素材库')).replace('\\','/')
extra=[]
for name in ['Knight','Coco','DeLb','stew']:
    source=next(p for p in catalog if p['name']==name)
    p={k:source[k] for k in ['name','team','region','tier','rating','AIM','SYN','SEN','agents']}
    p['photo']=asset('选手半身像',name)
    p['logo']=asset('队伍logo',p['team'])
    p['agentAssets']={a:asset('英雄头像','KO' if a=='KAY/O' else a) for a in p['agents'][:3]}
    extra.append(p)
(out/'pack-samples.js').write_text('// Fixed showcase cards. No draw probabilities or gameplay state.\nwindow.PACK_EXTRA = '+json.dumps(extra,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
print('Saved four resolved visual samples.')
