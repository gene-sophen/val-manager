"""Keep original map plans; use real in-game gallery shots for BP postcards."""
import hashlib, json, re, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://playvalorant.com/en-us/maps/'
OUT = ROOT / '素材库' / '地图官方'
manifest = json.loads((OUT / 'sources.json').read_text(encoding='utf-8'))
html = urllib.request.urlopen(SOURCE, timeout=40).read().decode('utf-8')
data = json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html).group(1))
choices = {}

def walk(value):
    if isinstance(value, dict):
        ident = value.get('fragmentId')
        if ident in manifest and 'groups' in value:
            wide = [g['content']['media'] for g in value['groups']
                    if g.get('content', {}).get('media', {}).get('type') == 'image'
                    and g['content']['media'].get('dimensions', {}).get('aspectRatio', 0) > 1.5]
            if len(wide) < 2:
                raise ValueError('No gameplay gallery shot: ' + ident)
            # Gallery's first wide image is often the 3D cutaway overview.
            shot = wide[1]
            width = min(1280, shot['dimensions']['width'])
            choices[ident] = (shot['url'].split('?')[0] + f'?w={width}&fm=webp&q=90', width)
        for child in value.values():
            walk(child)
    elif isinstance(value, list):
        for child in value:
            walk(child)

walk(data)
if set(choices) != set(manifest):
    raise ValueError('Missing galleries')

def fetch(item):
    ident, (url, width) = item
    raw = urllib.request.urlopen(url, timeout=40).read()
    file = ident + '-poster.webp'
    (OUT / file).write_bytes(raw)
    return ident, dict(bpPoster='地图官方/' + file, bpPosterUrl=url,
                       bpPosterSha256=hashlib.sha256(raw).hexdigest(),
                       bpPosterKind='official-gameplay-gallery', bpPosterWidth=width)

with ThreadPoolExecutor(max_workers=5) as pool:
    for ident, record in pool.map(fetch, choices.items()):
        manifest[ident].update(record)
        print(ident, record['bpPosterWidth'])
(OUT / 'sources.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
