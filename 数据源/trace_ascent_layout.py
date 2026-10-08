"""Read a saved minimap and extract vector contours; never rewrite source pixels.

The extracted footprint and marks are for visual review, not a validated navmesh.
Keep the canonical 960-space aligned with the saved Riot overview.
"""
from pathlib import Path
from PIL import Image
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '素材库/地图参考/ascent-minimap.png'
SCALE, OFFSET_X, OFFSET_Y = .853, 57, 43


def project(x, y):
    return [round(OFFSET_X + SCALE * y, 3), round(OFFSET_Y + SCALE * (1024 - x), 3)]


def contours(mask, width, height, minimum_area=3):
    """Trace pixel-cell boundaries, removing only exactly collinear vertices."""
    edges = {}
    def add(a, b):
        edges.setdefault(a, []).append(b)
    def filled(x, y):
        return 0 <= x < width and 0 <= y < height and mask[y * width + x]
    for y in range(height):
        for x in range(width):
            if not filled(x, y):
                continue
            if not filled(x, y-1): add((x,y), (x+1,y))
            if not filled(x+1, y): add((x+1,y), (x+1,y+1))
            if not filled(x, y+1): add((x+1,y+1), (x,y+1))
            if not filled(x-1, y): add((x,y+1), (x,y))
    loops = []
    while edges:
        start = next(iter(edges))
        current = start
        points = []
        while True:
            points.append(current)
            targets = edges[current]
            current = targets.pop()
            if not targets: del edges[points[-1]]
            if current == start: break
        area = abs(sum(points[i][0] * points[(i+1)%len(points)][1] - points[(i+1)%len(points)][0] * points[i][1] for i in range(len(points))) / 2)
        if area < minimum_area:
            continue
        simplified = []
        for i, p in enumerate(points):
            a, b = points[i-1], points[(i+1)%len(points)]
            if (p[0]-a[0])*(b[1]-p[1]) != (p[1]-a[1])*(b[0]-p[0]):
                simplified.append(project(*p))
        loops.append({'area': round(area*SCALE*SCALE, 3), 'points': simplified})
    return sorted(loops, key=lambda loop: -loop['area'])


def main():
    im = Image.open(SOURCE).convert('RGBA')
    width, height = im.size
    pixels = list(im.get_flattened_data())
    footprint = bytearray(a >= 128 for r,g,b,a in pixels)
    white_lines = bytearray(a >= 180 and min(r,g,b) >= 185 and max(r,g,b)-min(r,g,b)<12 for r,g,b,a in pixels)
    plant_zones = bytearray(a >= 200 and r-b > 20 and abs(r-g) < 8 for r,g,b,a in pixels)
    marks = bytearray(a >= 200 and 128 <= r <= 160 and abs(r-g)<3 and abs(r-b)<3 for r,g,b,a in pixels)
    api = json.loads((ROOT/'素材库/地图参考/ascent-api-snapshot.json').read_text(encoding='utf-8-sig'))
    names = {'A:Tree':'A 树房','A:Lobby':'A 大厅','A:Main':'A 大','A:Window':'A 窗口','A:Site':'A 包点','Attacker Side:Spawn':'进攻出生点','B:Lobby':'B 大厅','B:Main':'B 大','B:Boat House':'B 船屋','Mid:Bottom':'中路底','B:Site':'B 包点','Mid:Catwalk':'中路猫道','Mid:Cubby':'中路凹位','Defender Side:Spawn':'防守出生点','A:Garden':'A 花园','Mid:Market':'市场','Mid:Courtyard':'中路庭院','Mid:Link':'中路连接','Mid:Pizza':'披萨位','A:Rafters':'A 二楼','Mid:Top':'中路顶','A:Wine':'A 酒窖'}
    landmarks = []
    for callout in api['callouts']:
        key = callout['superRegionName']+':'+callout['regionName']
        location = callout['location']
        raw_x = (location['y']*api['xMultiplier']+api['xScalarToAdd'])*width
        raw_y = (location['x']*api['yMultiplier']+api['yScalarToAdd'])*height
        x,y = project(raw_x,raw_y)
        landmarks.append({'id':key.lower().replace(' ','-').replace(':','-'), 'name':names[key], 'region':callout['superRegionName'], 'x':x,'y':y,'sourceHeight':location['z']})
    data = {
        'schemaVersion':1, 'mapId':'ascent', 'layoutVersion':'ascent-visual-v2',
        'status':'visual-review', 'simulationReady':False,
        'reference':{'primary':'https://playvalorant.com/en-us/maps/', 'supplement':'https://valorant-api.com/v1/maps','supplementOwner':'第三方游戏资源索引，不是 Riot 官方接口','asset':str(SOURCE.relative_to(ROOT)).replace('\\','/'), 'sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'captured':'2026-10-06','patch':None, 'limitations':['当前资源快照未核实对应竞技补丁','小地图轮廓不等于可通行网格','细线包含栏杆、门和层级边界，需分别审核物理含义','声学、穿透、时间比例和高度连接尚未制作']},
        'coordinates':{'width':960,'height':960,'orientation':'attacker-top-A-left','sourceWidth':width,'sourceHeight':height,'sourceTransform':{'scale':SCALE,'translateX':OFFSET_X,'translateY':OFFSET_Y,'quarterTurns':-1},'metersPerUnit':None},
        'footprintContours':contours(footprint,width,height),
        'structureLineContours':contours(white_lines,width,height),
        'surfaceMarkContours':contours(marks,width,height,minimum_area=12),
        'plantZoneContours':contours(plant_zones,width,height,minimum_area=100),
        'landmarks':landmarks,
        'reviewFeatures':[
            {'id':'a-generator','name':'A 点发电机','x':222,'y':638,'kind':'cover'},
            {'id':'a-double-box','name':'A 点双箱','x':167,'y':643,'kind':'cover'},
            {'id':'b-stack','name':'B 点箱体','x':753,'y':667,'kind':'cover'},
            {'id':'b-stairs','name':'B 点台阶','x':684,'y':648,'kind':'height'},
            {'id':'a-door','name':'A 树房门','x':254,'y':574,'kind':'door'},
            {'id':'market-door','name':'市场门','x':580,'y':645,'kind':'door'}
        ]
    }
    target = ROOT/'引擎/maps/layouts/ascent-v2.json'
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Ascent visual layout: {len(data["landmarks"])} reference landmarks, {len(data["structureLineContours"])} structure contours. Simulation not enabled.')


if __name__ == '__main__': main()
