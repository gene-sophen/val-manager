"""Extract the other eight minimaps into the approved Ascent vector language."""
import json, hashlib, math
from itertools import permutations
from pathlib import Path
from PIL import Image
import trace_ascent_layout as trace

ROOT=Path(__file__).resolve().parents[1]
GUIDES={
 'haven':{'name':'隐世修所','A':[167,592],'B':[482,571],'C':[782,601],'attack':[520,132],'defense':[399,823]},
 'split':{'name':'霓虹町','A':[96,616],'B':[760,614],'attack':[507,138],'defense':[492,838]},
 'sunset':{'name':'日落之城','A':[720,378],'B':[200,426],'attack':[514,790],'defense':[478,151]},
 'breeze':{'name':'微风岛屿','A':[796,450],'B':[225,327],'attack':[462,778],'defense':[554,211]},
 'lotus':{'name':'莲华古城','A':[149,648],'B':[520,558],'C':[810,544],'attack':[458,177],'defense':[384,796]},
 'fracture':{'name':'裂变峡谷','A':[124,490],'B':[848,460],'attack':[448,139],'defense':[480,557]},
 'abyss':{'name':'幽邃地窟','A':[169,538],'B':[800,576],'attack':[475,214],'defense':[429,808]},
 'summit':{'name':'天枢云巅','A':[129,535],'B':[815,638],'attack':[504,146],'defense':[483,838]}
}
WORDS={'Site':'包点','Lobby':'大厅','Main':'大','Spawn':'出生点','Top':'上段','Bottom':'下段','Link':'连接','Long':'长廊','Short':'短道','Tower':'高塔','Heaven':'二楼','Garage':'车库','Window':'窗口','Courtyard':'庭院','Market':'市场','Tree':'树房','Garden':'花园','Rafters':'二楼','Catwalk':'猫道','Cubby':'凹位','Boat House':'船屋','Cave':'洞穴','Bridge':'桥','Hall':'通道','Halls':'通道','Nest':'高台','Belt':'传送带','Ramps':'斜坡','Ramp':'斜坡','Mail':'邮件房','Vent':'通风管','Elbow':'拐角','Rubble':'碎石','Mound':'土坡','Waterfall':'瀑布','Water':'水道','Root':'树根','Art':'画廊','Connector':'连接','Door':'门','Arcade':'长廊','Drop':'落点','Dish':'雷达','Bench':'长凳','Stairs':'台阶','Back':'后点','Secret':'暗道','Flowers':'花坛','Fountain':'喷泉','Hallway':'走廊','Pit':'低地','Pillar':'立柱','Screen':'屏风','Screens':'屏风','Backsite':'后点'}
# The current third-party Summit attacker coordinate falls outside its own minimap.
# Preserve the API snapshot; calibrate this label to the visibly identifiable spawn.
SOURCE_OVERRIDES={'summit':{'Attacker Side:Spawn':[503,960]}}
def rotate(x,y,turn):
    return [(x,y),(-y,x),(-x,-y),(y,-x)][turn]

def main():
    manifest={'ascent':{'name':'亚海悬城','layout':'ascent-v2.json','visual':'ascent-v2.svg','simulationReady':False}}
    for ident,guide in GUIDES.items():
        source=ROOT/f'素材库/地图参考/{ident}-minimap.png'
        api=json.loads((ROOT/f'素材库/地图参考/{ident}-api-snapshot.json').read_text(encoding='utf-8-sig'))
        im=Image.open(source).convert('RGBA');width,height=im.size
        raw=[]
        for c in api['callouts'] or []:
            p=c['location'];x=(p['y']*api['xMultiplier']+api['xScalarToAdd'])*width;y=(p['x']*api['yMultiplier']+api['yScalarToAdd'])*height
            x,y=SOURCE_OVERRIDES.get(ident,{}).get(c['superRegionName']+':'+c['regionName'],[x,y])
            raw.append((c,x,y))
        anchors=[]
        for c,x,y in raw:
            region=c['superRegionName'];name=c['regionName']
            key=region if name=='Site' else 'attack' if region=='Attacker Side' and name=='Spawn' else 'defense' if region=='Defender Side' and name=='Spawn' else None
            if key in guide:anchors.append(((x,y),guide[key]))
        if len(anchors)<3:raise RuntimeError(f'{ident}: missing reference anchors')
        solutions=[]
        for turn in range(4):
            src=[rotate(*p,turn) for p,q in anchors];dst=[q for p,q in anchors]
            sx,sy=[sum(p[i] for p in src)/len(src) for i in range(2)];tx,ty=[sum(p[i] for p in dst)/len(dst) for i in range(2)]
            scale=sum((p[0]-sx)*(q[0]-tx)+(p[1]-sy)*(q[1]-ty) for p,q in zip(src,dst))/sum((p[0]-sx)**2+(p[1]-sy)**2 for p in src)
            if scale<=0:continue
            dx,dy=tx-scale*sx,ty-scale*sy
            error=math.sqrt(sum((scale*p[0]+dx-q[0])**2+(scale*p[1]+dy-q[1])**2 for p,q in zip(src,dst))/len(src))
            solutions.append((error,turn,scale,dx,dy))
        error,turn,scale,dx,dy=min(solutions)
        # Fit the whole footprint, not just the labels: no clipped map or anisotropic warp.
        bounds=im.getbbox();left,top,right,bottom=bounds
        corners=[rotate(x,y,turn) for x,y in [(left,top),(right,top),(left,bottom),(right,bottom)]]
        minx,miny=[min(p[i] for p in corners) for i in range(2)];maxx,maxy=[max(p[i] for p in corners) for i in range(2)]
        scale=840/max(maxx-minx,maxy-miny);dx=480-scale*(minx+maxx)/2;dy=480-scale*(miny+maxy)/2
        trace.SCALE=scale
        def project(x,y):
            x,y=rotate(x,y,turn);return [round(scale*x+dx,3),round(scale*y+dy,3)]
        trace.project=project
        pixels=list(im.get_flattened_data())
        footprint=bytearray(a>=128 for r,g,b,a in pixels)
        white=bytearray(a>=180 and min(r,g,b)>=185 and max(r,g,b)-min(r,g,b)<12 for r,g,b,a in pixels)
        zones=bytearray(a>=200 and r-b>20 and abs(r-g)<8 for r,g,b,a in pixels)
        marks=bytearray(a>=200 and 128<=r<=160 and abs(r-g)<3 and abs(r-b)<3 for r,g,b,a in pixels)
        matrices=[(scale,0,0,scale,dx,dy),(0,scale,-scale,0,dx,dy),(-scale,0,0,-scale,dx,dy),(0,-scale,scale,0,dx,dy)]
        landmarks=[]
        for c,x,y in raw:
            region=c['superRegionName'];name=c['regionName'];p=project(x,y)
            prefix='进攻' if region=='Attacker Side' else '防守' if region=='Defender Side' else '中路' if region=='Mid' else region
            title=prefix+' '+WORDS.get(name,name)
            on_floor=0<=x<width and 0<=y<height and im.getpixel((int(x),int(y)))[3]>=128
            landmarks.append({'id':(region+'-'+name).lower().replace(' ','-'),'name':title,'region':region,'sourceName':name,'x':p[0],'y':p[1],'onFootprint':on_floor,'sourceHeight':c['location']['z']})
        data={'schemaVersion':1,'mapId':ident,'name':guide['name'],'layoutVersion':ident+'-visual-v2','status':'visual-review','simulationReady':False,
            'reference':{'primary':'https://playvalorant.com/en-us/maps/','supplement':'https://valorant-api.com/v1/maps','supplementOwner':'第三方游戏资源索引，不是 Riot 官方接口','asset':str(source.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'captured':'2026-10-06','patch':None,'orientationAnchorFitRmsPixels':round(error,2),'sourceLabelOverrides':SOURCE_OVERRIDES.get(ident,{}),'limitations':['竞技补丁未核实','小地图轮廓不等于碰撞/导航','门、高度、动态结构尚未接入比赛']},
            'coordinates':{'width':960,'height':960,'sourceWidth':width,'sourceHeight':height,'sourceTransform':{'matrix':list(matrices[turn])},'metersPerUnit':None},
            'footprintContours':trace.contours(footprint,width,height),'structureLineContours':trace.contours(white,width,height),
            'surfaceMarkContours':trace.contours(marks,width,height,12),'plantZoneContours':trace.contours(zones,width,height,100),'landmarks':landmarks}
        sites=[p for p in landmarks if p['sourceName']=='Site']
        yellow_pixels=[(i%width+.5,i//width+.5) for i,value in enumerate(zones) if value]
        def center(contour):
            ps=contour['points'];cross=[ps[i][0]*ps[(i+1)%len(ps)][1]-ps[(i+1)%len(ps)][0]*ps[i][1] for i in range(len(ps))];area=sum(cross)
            q=[sum((ps[i][k]+ps[(i+1)%len(ps)][k])*cross[i] for i in range(len(ps)))/(3*area) for k in range(2)]
            rx,ry=rotate((q[0]-dx)/scale,(q[1]-dy)/scale,(-turn)%4)
            return project(*min(yellow_pixels,key=lambda p:(p[0]-rx)**2+(p[1]-ry)**2))
        centers=[center(c) for c in data['plantZoneContours'][:len(sites)]]
        ordered=min(permutations(centers),key=lambda order:sum(math.hypot(p['x']-q[0],p['y']-q[1]) for p,q in zip(sites,order)))
        data['visualSiteAnchors']={p['region']:{'x':round(q[0],3),'y':round(q[1],3),'source':'nearest-visible-plant-zone-centroid'} for p,q in zip(sites,ordered)}
        (ROOT/f'引擎/maps/layouts/{ident}-v2.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        manifest[ident]={'name':guide['name'],'layout':ident+'-v2.json','visual':ident+'-v2.svg','simulationReady':False,'anchorRmsPixels':round(error,2)}
        print(ident,len(landmarks),'landmarks, calibration rms',round(error,2))
    (ROOT/'引擎/maps/layouts/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

if __name__=='__main__':main()
