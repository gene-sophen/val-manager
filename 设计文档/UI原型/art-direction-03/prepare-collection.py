"""Read-only sample collection; no gameplay state."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[3]
catalog=json.loads((root/'数据源/cards_full.json').read_text(encoding='utf-8'))
def asset(folder,name):
    files=list((root/'素材库'/folder).glob(name+'.*'))
    if not files: raise FileNotFoundError(name)
    return files[0].relative_to(root/'素材库').as_posix()
samples=[]
for region in ['AMER','EMEA','PAC']:
    added=0
    for source in [p for p in catalog if p['region']==region]:
        try:
            p={k:source[k] for k in ['name','team','region','tier','rating','AIM','SYN','SEN','agents']}
            p['photo']=asset('选手半身像',p['name'])
            p['logo']=asset('队伍logo',p['team'])
            p['agentAssets']={a:asset('英雄头像','KO' if a=='KAY/O' else a) for a in p['agents'][:3]}
        except FileNotFoundError: continue
        samples.append(p);added+=1
        if added==4: break
(Path(__file__).parent/'collection-samples.js').write_text('window.COLLECTION_EXTRA = '+json.dumps(samples,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
print('Saved',len(samples),'international samples')
