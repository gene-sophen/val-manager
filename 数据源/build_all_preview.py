# 生成金银铜全量预览页（按赛区分页），套用卡面原型 v16 的金银铜布局
import json, re, os

ROOT = os.path.dirname(os.path.abspath(__file__)) + '/../'
proto = open(ROOT + '设计文档/选手卡/卡面原型.html', encoding='utf-8').read()
styles = '\n'.join(re.findall(r'<style>.*?</style>', proto, re.S))
svgdefs = re.search(r'<svg width="0".*?</svg>', proto, re.S).group(0)

cards = json.load(open(ROOT + '数据源/cards_full.json', encoding='utf-8'))

# 金卡特性分配（解析金卡特性方向.md 表格）
trait_map = {}
tdoc = open(ROOT + '设计文档/选手卡/金卡特性方向.md', encoding='utf-8').read()
for line in tdoc.splitlines():
    m = re.match(r'\|\s*([^|]+?)\s*\|\s*[^|]+\|\s*([^|]+?)\s*\|', line)
    if m and m.group(1) not in ('选手', '---') and not m.group(1).startswith('-'):
        trait_map[m.group(1)] = m.group(2)

# 素材文件名索引（扩展名不统一：png/jpg/jpeg）
def index_dir(p):
    out = {}
    for f in os.listdir(ROOT + p):
        base, ext = f.rsplit('.', 1)
        out[base.lower()] = f
    return out
PORTRAIT = index_dir('素材库/选手半身像')
AGENT = index_dir('素材库/英雄头像')

def portrait(name): return '../../素材库/选手半身像/' + PORTRAIT[name.lower()]
def agent_icon(name): return '../../素材库/英雄头像/' + AGENT[name.replace('/', '').lower()]

DECO_PATH_2 = "M 138.5,23.2 Q 150.0,20.0 161.5,23.2 L 275.7,55.4 Q 287.2,58.7 287.2,70.7 L 287.2,399.3 Q 287.2,411.3 275.7,414.6 L 161.5,446.8 Q 150.0,450.0 138.5,446.8 L 24.3,414.6 Q 12.8,411.3 12.8,399.3 L 12.8,70.7 Q 12.8,58.7 24.3,55.4 Z"
DECO_PATH_3 = "M 140.4,29.7 Q 150.0,27.0 159.6,29.7 L 273.1,61.7 Q 282.8,64.5 282.8,74.5 L 282.8,395.5 Q 282.8,405.5 273.1,408.3 L 159.6,440.3 Q 150.0,443.0 140.4,440.3 L 26.9,408.3 Q 17.2,405.5 17.2,395.5 L 17.2,74.5 Q 17.2,64.5 26.9,61.7 Z"
DECO_PATH_BODY = "M 136.5,12.7 Q 150.0,8.9 163.5,12.7 L 280.8,45.8 Q 294.3,49.6 294.3,63.6 L 294.3,406.4 Q 294.3,420.4 280.8,424.2 L 163.5,457.3 Q 150.0,461.1 136.5,457.3 L 19.2,424.2 Q 5.7,420.4 5.7,406.4 L 5.7,63.6 Q 5.7,49.6 19.2,45.8 Z"

def deco(tier):
    if tier == '铜':
        return f'''<svg class="deco" viewBox="0 0 300 470">
        <path d="{DECO_PATH_BODY}" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="2" transform="translate(0,-1)"/>
        <path d="{DECO_PATH_BODY}" fill="none" stroke="rgba(214,181,145,.3)" stroke-width=".8" transform="translate(0,.8)"/>
      </svg>'''
    if tier == '银':
        return f'''<svg class="deco" viewBox="0 0 300 470" style="color:#C9D4DE">
        <path d="{DECO_PATH_2}" fill="none" stroke="rgba(0,0,0,.6)" stroke-width="2.6" transform="translate(0,-1.2)"/>
        <path d="{DECO_PATH_2}" fill="none" stroke="#C9D4DE" stroke-width="1.1" opacity=".75"/>
        <use href="#medal" x="277" y="49" width="18" height="18"/>
        <use href="#medal" x="5" y="49" width="18" height="18"/>
        <use href="#medal" x="277" y="398" width="18" height="18" opacity=".55"/>
        <use href="#medal" x="5" y="398" width="18" height="18" opacity=".55"/>
      </svg>'''
    return f'''<svg class="deco" viewBox="0 0 300 470" style="color:#E8B93E">
        <path d="{DECO_PATH_2}" fill="none" stroke="rgba(0,0,0,.65)" stroke-width="3.2" transform="translate(0,-1.4)"/>
        <path d="{DECO_PATH_2}" fill="none" stroke="#E8B93E" stroke-width="1.5" opacity=".9"/>
        <path d="{DECO_PATH_3}" fill="none" stroke="#E8B93E" stroke-width=".7" opacity=".45"/>
        <use href="#medal" x="140" y="11" width="19" height="19"/>
        <use href="#medal" x="277" y="49" width="19" height="19"/>
        <use href="#medal" x="4" y="49" width="19" height="19"/>
        <use href="#medal" x="277" y="398" width="19" height="19" opacity=".6"/>
        <use href="#medal" x="4" y="398" width="19" height="19" opacity=".6"/>
        <use href="#medal" x="140" y="438" width="19" height="19" opacity=".6"/>
        <g stroke="#E8B93E" fill="none" opacity=".75">
          <path d="M150 30 v16 M130 33 l7 13 M170 33 l-7 13 M112 41 l11 9 M188 41 l-11 9" stroke-width="1.2"/>
          <path d="M150 34 v8 M136 37 l4 6 M164 37 l-4 6" stroke-width=".7" opacity=".6"/>
        </g>
      </svg>'''

def card_html(c):
    t = c['tier']
    logo = f"../../素材库/队伍logo/{c['team']}.png"
    ags = []
    for i, a in enumerate(c.get('agents') or []):
        sig = ' sig' if (t in ('金', '银') and i == 0) else ''
        ags.append(f'<div class="ag{sig}"><div class="heximg"><img src="{agent_icon(a)}"></div></div>')
    badges = ''
    if t == '金':
        tr = trait_map.get(c['name'], '待定')
        badges = f'''<div class="badges">
        <div class="plate trait">
          <div class="picon"><svg width="14" height="14" style="color:#E8B93E"><use href="#i-star"/></svg></div>
          <div class="ptext"><b>{tr}</b></div>
        </div>
      </div>'''
    wings = '<div class="wing l"></div><div class="wing r"></div>' if t == '金' else ''
    return f'''<div class="cell"><div class="card r-{t}">
    <div class="frame"></div><div class="bevel"></div>
    <div class="body">
      <div class="pbg"><img class="watermark" src="{logo}"></div>
      <div class="portrait"><img src="{portrait(c['name'])}"><div class="scrim"></div></div>
      <div class="vignette"></div><div class="grain"></div>
      {wings}
      {deco(t)}
      <div class="gem"></div>
      <img class="rgen" src="../../素材库/赛区图标/{c['region']}.png">
      <div class="rating texnum" data-n="{c['rating']}">{c['rating']}</div>
      <div class="corner"><img class="tlo" src="{logo}"></div>
      <div class="who"><div class="pid">{c['name']}</div></div>
      <div class="agents">{''.join(ags)}</div>
      {badges}
      <div class="stats">
        <div class="stat"><b class="texnum">{c['AIM']}</b><span>枪法</span></div>
        <div class="stat"><b class="texnum">{c['SYN']}</b><span>协同</span></div>
        <div class="stat"><b class="texnum">{c['SEN']}</b><span>意识</span></div>
      </div>
    </div>
  </div></div>'''

EXTRA = '''<style>
  .cell{width:186px;height:292px;overflow:visible;flex:none}
  .cell .card{transform:scale(.62);transform-origin:top left}
  .row{max-width:1300px;gap:24px}
</style>'''

order = {'金': 0, '银': 1, '铜': 2}
missing_trait = []
for region in ['CN', 'AMER', 'EMEA', 'PAC']:
    rs = [c for c in cards if c['region'] == region]
    rs.sort(key=lambda c: (order[c['tier']], -c['TOT']))
    for c in rs:
        if c['tier'] == '金' and c['name'] not in trait_map:
            missing_trait.append(c['name'])
    tiers = {t: sum(1 for c in rs if c['tier'] == t) for t in '金银铜'}
    html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>全量预览 · {region}（{len(rs)} 张）</title>
{styles}
{EXTRA}
</head>
<body>
<header>
  <h1>选手卡全量预览 <span>/ {region}</span></h1>
  <p>金{tiers['金']} · 银{tiers['银']} · 铜{tiers['铜']} ｜ 总评波段 金80~90 / 银60~80 / 铜30~60 ｜ 卡面布局 v16</p>
</header>
{svgdefs}
<div class="row">
{''.join(card_html(c) for c in rs)}
</div>
</body>
</html>'''
    out = ROOT + f'设计文档/选手卡/全量预览_{region}.html'
    open(out, 'w', encoding='utf-8').write(html)
    print(region, len(rs), 'written')

if missing_trait:
    print('⚠️ 金卡缺特性分配:', ', '.join(sorted(set(missing_trait))))
