# 生成钻卡全量预览页：读取 diamond_cards.json + 特性/明星时刻映射，套用卡面原型 v16 的钻卡布局
import json, re, os

ROOT = os.path.dirname(os.path.abspath(__file__)) + '/../'
proto = open(ROOT + '设计文档/选手卡/卡面原型.html', encoding='utf-8').read()

# 提取原型的 <style> 块与 svg 图标定义
styles = '\n'.join(re.findall(r'<style>.*?</style>', proto, re.S))
svgdefs = re.search(r'<svg width="0".*?</svg>', proto, re.S).group(0)

cards = json.load(open(ROOT + '数据源/diamond_cards.json', encoding='utf-8'))

# 特性 / 明星时刻（与钻卡设计草案一致）
TRAIT = {
 ('21柏林大师赛','nAts'):      ('老六','暗影独行'),
 ('22雷克雅未克','yay'):       ('重炮手','El Diablo'),
 ('23洛杉矶','aspas'):      ('大场面先生','永恒利刃'),
 ('23洛杉矶','Demon1'):        ('重炮手','魔王降临'),
 ('23洛杉矶','whzy'):          ('首杀机器','无情判官'),
 ('23东京','ZmjjKK'):          ('首杀机器','冥驹审判'),
 ('23东京','Chronicle'):       ('残局大师','四冠之心'),
 ('23东京','Leo'):             ('黏合剂','完美先锋'),
 ('23圣保罗','Derke'):         ('快刀手','圣保罗重炮'),
 ('24上海','t3xture'):         ('快刀手','模版决斗'),
 ('24首尔','ZmjjKK'):          ('大场面先生','降维打击'),
 ('25曼谷','CHICHOO'):         ('残局大师','一人成军'),
 ('25曼谷','Meteor'):          ('残局大师','曼谷之舞'),
 ('25多伦多','Spring'):        ('黏合剂','黑马之蹄'),
 ('25多伦多','Alfajer'):       ('重炮手','土耳其火炮'),
 ('25多伦多','Jinggg'):        ('快刀手','烟火秀'),
 ('25多伦多','f0rsakeN'):      ('黏合剂','万花筒'),
 ('25巴黎','brawk'):           ('定海神针','巴黎奇迹'),
 ('26伦敦','Sato'):            ('重炮手','伦敦焰火'),
 ('26圣地亚哥','Dambi'):       ('快刀手','疾驰突进'),
}

# 总评：钻卡池内 TOT 分位映射到 90~97（钻卡总评波段 90+，金 80~90 / 银 60~80 / 铜 30~60）
tots = [c['TOT'] for c in cards]
tmin, tmax = min(tots), max(tots)
def rating(t): return round(90 + (t - tmin) / (tmax - tmin) * 7)

def cut_label(cut):
    return '20' + cut[:2] + ' · ' + cut[2:]

def icon(name):
    base = name.replace('/', '')
    ext = 'jpg' if os.path.exists(ROOT + f'素材库/英雄头像/{base}.jpg') else 'png'
    return f'../../素材库/英雄头像/{base}.{ext}'

ORDER = {'CN':0,'AMER':1,'EMEA':2,'PAC':3}
cards.sort(key=lambda c: (ORDER[c['region']], c['cut']))

body = []
for c in cards:
    key = (c['cut'], c['name'])
    trait, moment = TRAIT[key]
    poster = f"../../素材库/切面海报/{c['cut']}_{c['name']}.png"
    sig = c['agents'][0]
    body.append(f'''
  <!-- {cut_label(c['cut'])} · {c['name']} -->
  <div class="card r-钻">
    <div class="frame"></div><div class="bevel"></div>
    <div class="body">
      <div class="pbg"></div>
      <div class="portrait"><img src="{poster}"><div class="scrim"></div></div>
      <div class="vignette"></div><div class="grain"></div>
      <svg class="deco" viewBox="0 0 300 470" style="color:#A9F1FF">
        <path d="M 138.5,23.2 Q 150.0,20.0 161.5,23.2 L 275.7,55.4 Q 287.2,58.7 287.2,70.7 L 287.2,399.3 Q 287.2,411.3 275.7,414.6 L 161.5,446.8 Q 150.0,450.0 138.5,446.8 L 24.3,414.6 Q 12.8,411.3 12.8,399.3 L 12.8,70.7 Q 12.8,58.7 24.3,55.4 Z"
          fill="none" stroke="rgba(0,0,0,.65)" stroke-width="3.4" transform="translate(0,-1.4)"/>
        <path d="M 138.5,23.2 Q 150.0,20.0 161.5,23.2 L 275.7,55.4 Q 287.2,58.7 287.2,70.7 L 287.2,399.3 Q 287.2,411.3 275.7,414.6 L 161.5,446.8 Q 150.0,450.0 138.5,446.8 L 24.3,414.6 Q 12.8,411.3 12.8,399.3 L 12.8,70.7 Q 12.8,58.7 24.3,55.4 Z"
          fill="none" stroke="#A9F1FF" stroke-width="1.8" opacity=".9"/>
        <path d="M 140.4,29.7 Q 150.0,27.0 159.6,29.7 L 273.1,61.7 Q 282.8,64.5 282.8,74.5 L 282.8,395.5 Q 282.8,405.5 273.1,408.3 L 159.6,440.3 Q 150.0,443.0 140.4,440.3 L 26.9,408.3 Q 17.2,405.5 17.2,395.5 L 17.2,74.5 Q 17.2,64.5 26.9,61.7 Z"
          fill="none" stroke="#A9F1FF" stroke-width=".8" opacity=".5"/>
        <path d="M126 452 L150 434 L174 452" fill="none" stroke="rgba(0,0,0,.6)" stroke-width="2.4" transform="translate(0,-1)"/>
        <path d="M126 452 L150 434 L174 452" fill="none" stroke="#A9F1FF" stroke-width="1.3"/>
        <path d="M136 452 L150 440 L164 452" fill="none" stroke="#A9F1FF" stroke-width=".8" opacity=".6"/>
      </svg>
      <div class="sheen"></div>
      <div class="gem"></div>
      <img class="rgen" src="../../素材库/赛区图标/{c['region']}.png">
      <div class="rating texnum" data-n="{rating(c['TOT'])}">{rating(c['TOT'])}</div>
      <div class="d-banner"><div class="d-pid">{c['name']}</div></div>
      <div class="d-cut">{cut_label(c['cut'])}</div>
      <div class="agents">
        <div class="ag sig"><div class="heximg"><img src="{icon(sig)}"></div></div>
      </div>
      <div class="badges">
        <div class="plate moment">
          <div class="picon"><svg width="14" height="14" style="color:#A9F1FF"><use href="#i-scope"/></svg></div>
          <div class="ptext"><b>{moment}</b></div>
        </div>
      </div>
      <div class="d-stat ds1"><span>枪法</span><b>{c['AIM']}</b></div>
      <div class="d-stat ds2"><span>协同</span><b>{c['SYN']}</b></div>
      <div class="d-stat ds3"><span>意识</span><b>{c['SEN']}</b></div>
    </div>
  </div>''')

html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>钻卡全量预览 · 20 张</title>
{styles}
<style>.row{{max-width:1780px}}</style>
</head>
<body>
<header>
  <h1>钻卡全量预览 <span>/ 20 DIAMOND CUTS</span></h1>
  <p>卡面布局 v16 · 切面海报实装 · 总评波段：钻 90~97（铜30~60 / 银60~80 / 金80~90）· 按赛区排序 CN→AMER→EMEA→PAC</p>
</header>
{svgdefs}
<div class="row">
{''.join(body)}
</div>
</body>
</html>'''

out = ROOT + '设计文档/选手卡/钻卡全量预览.html'
open(out, 'w', encoding='utf-8').write(html)
print('written:', out, len(body), 'cards')
