"""Extract real map art from Riot's own map page; keep URLs and hashes as evidence."""
import hashlib, json, re, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://playvalorant.com/en-us/maps/'
WANTED = {'ascent','sunset','split','haven','lotus','breeze','summit','abyss','fracture'}
html = urllib.request.urlopen(SOURCE, timeout=40).read().decode('utf-8')
data = json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html).group(1))
out = ROOT / '素材库' / '地图官方'
out.mkdir(exist_ok=True)
manifest = {}

def walk(value):
    if isinstance(value, dict):
        ident = value.get('fragmentId')
        if ident in WANTED and 'groups' in value:
            media = [g['content']['media'] for g in value['groups'] if g.get('content',{}).get('media',{}).get('type') == 'image']
            wide = next(m for m in media if m.get('dimensions',{}).get('aspectRatio',0) > 1.5)
            url = wide['url'].split('?')[0] + '?w=960&fm=webp'
            image = urllib.request.urlopen(url, timeout=40).read()
            (out / (ident+'.webp')).write_bytes(image)
            manifest[ident] = {'source':SOURCE, 'posterUrl':url, 'poster':'地图官方/'+ident+'.webp', 'sha256':hashlib.sha256(image).hexdigest(), 'kind':'official-map-screenshot', 'geometryStatus':'not-validated'}
            square = next((m for m in media if .95 < m.get('dimensions',{}).get('aspectRatio',0) < 1.05), None)
            if square:
                plan_url = square['url'].split('?')[0] + '?w=960&fm=webp'
                plan = urllib.request.urlopen(plan_url, timeout=40).read()
                (out / (ident+'-plan.webp')).write_bytes(plan)
                manifest[ident].update({'planUrl':plan_url, 'plan':'地图官方/'+ident+'-plan.webp', 'planSha256':hashlib.sha256(plan).hexdigest(), 'planKind':'official-map-layout-image'})
            print(ident, len(image))
        for child in value.values(): walk(child)
    elif isinstance(value,list):
        for child in value: walk(child)

walk(data)
if set(manifest) != WANTED: raise RuntimeError('Missing official map art: '+str(WANTED-set(manifest)))
(out/'sources.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
