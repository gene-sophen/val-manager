# 选手卡生成管线：全年数据合并 → 全球池分位映射 → 四赛区主表
# 用法: py build_cards.py   （在 数据源/ 目录下运行，输出到 ../设计文档/选手卡/）
import json, bisect, io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

EV_W = {'stage2': 0.6, 'stage1': 0.3, 'kickoff': 0.1}   # 全年权重（近期为主）
EV_ORDER = ['stage2', 'stage1', 'kickoff']              # 最新优先
BAND = {'金': (80, 90), '银': (60, 80), '铜': (30, 60)}
SHRINK_K = 150   # 小样本回缩常数（回合数）

players = json.load(open('all_players.json', encoding='utf-8'))
AG = json.load(open('agents.json', encoding='utf-8'))
regions = json.load(open('team_regions.json', encoding='utf-8'))
results = json.load(open('team_results.json', encoding='utf-8'))
igls = json.load(open('igl_list.json', encoding='utf-8'))

TEAM_REGION, SECONDARY = {}, set()
for k, v in regions.items():
    if k.startswith('_'): continue
    region = k.replace('_次级', '')
    for t in v:
        TEAM_REGION[t] = region
        if '次级' in k: SECONDARY.add(t)

TEAM_SCORE = {}
for k, v in results.items():
    if k.startswith('_'): continue
    TEAM_SCORE.update(v)

IGL = set()
for k, v in igls.items():
    if not k.startswith('_'): IGL.update(v)

# ---------- 1. 合并全年数据 ----------
records = []
for name, p in players.items():
    evs = p['events']
    latest_ev = next(e for e in EV_ORDER if e in evs)
    team = evs[latest_ev]['team']
    w_sum = sum(EV_W[e] for e in evs)
    def wavg(key, base=None):
        total = 0.0
        for e, d in evs.items():
            s = d['stats']
            if s['ROUND'] is None: continue
            v = s[key]
            if v is None: continue
            if base == 'R': v = v / s['ROUND']
            total += v * EV_W[e]
        return total / w_sum
    rounds = sum(d['stats']['ROUND'] or 0 for d in evs.values())
    rec = {
        'name': name, 'team': team, 'region': TEAM_REGION.get(team, '?'),
        'secondary': team in SECONDARY, 'igl': name in IGL,
        'rounds': rounds, 'events': len(evs),
        'ACS': wavg('ACS'), 'ADR': wavg('ADR'), 'KDA': wavg('KDA'),
        'A_R': wavg('A', 'R'), 'FD_R': wavg('FD', 'R'), 'FKFD_R': wavg('FK', 'R') - wavg('FD', 'R'),
        'agents': [AG.get(a, a) for a in evs[latest_ev]['agents'][:3]],
        'agents_extra': evs[latest_ev]['agents_extra'],
        'team_score': TEAM_SCORE.get(team, 0.35),
    }
    records.append(rec)

unk = [r['name'] for r in records if r['region'] == '?']
if unk: print('警告: 未识别队伍', [(r['name'], r['team']) for r in records if r['region'] == '?'])

# ---------- 2. 小样本回缩（联赛选手向全池 40 分位回缩；次级选手向 25 分位回缩且回缩更强）----------
def shrink_all(key):
    vals = sorted(r[key] for r in records)
    a_league = vals[int(len(vals) * 0.4)]
    a_sec = vals[int(len(vals) * 0.25)]
    for r in records:
        anchor, K = (a_sec, 80) if r['secondary'] else (a_league, SHRINK_K)
        w = r['rounds'] / (r['rounds'] + K)
        r[key + '_s'] = anchor + (r[key] - anchor) * w
for k in ['ADR', 'A_R', 'KDA', 'FD_R', 'FKFD_R', 'ACS']:
    shrink_all(k)

# ---------- 3. 全球池分位（次级选手分位 ×0.85，次级对抗质量折价）----------
def pctiles(key):
    vals = sorted(r[key] for r in records)
    for r in records:
        p = bisect.bisect_left(vals, r[key]) / len(vals)
        r[key + '_p'] = p * 0.75 if r['secondary'] else p
for k in ['ADR_s', 'A_R_s', 'KDA_s', 'FD_R_s', 'FKFD_R_s', 'ACS_s']:
    pctiles(k)

tscores = sorted(set(TEAM_SCORE.values()))
def team_pct(t): return bisect.bisect_left(tscores, t) / (len(tscores) - 1)

ROLE_BONUS = 0.12        # 特殊身份（指挥等）补分：直接计入综合评分，影响分档与意识
ROLE_BONUS_DEEP = 0.06   # 队伍成绩 >=0.85（赛段冠亚军级）时追加补分
for r in records:
    r['syn_p'] = 0.5 * r['A_R_s_p'] + 0.25 * r['KDA_s_p'] + 0.25 * (1 - r['FD_R_s_p'])
    r['overall_p'] = (0.25 * r['ACS_s_p'] + 0.20 * r['ADR_s_p'] + 0.15 * r['KDA_s_p']
                      + 0.10 * r['FKFD_R_s_p'] + 0.30 * r['syn_p'])
    if r['igl']:
        bonus = ROLE_BONUS + (ROLE_BONUS_DEEP if r['team_score'] >= 0.85 else 0)
        r['overall_p'] = min(1.0, r['overall_p'] + bonus)
    sen_score = 0.5 * r['overall_p'] + 0.25 * team_pct(r['team_score']) + (0.25 if r['igl'] else 0)
    r['sen_p'] = min(1.0, sen_score)

# ---------- 4. 品质分档：金卡 = 种子名单（每赛区15张），银 = 非金池 39%，整体 ≈ 1 : 2.1 : 3.3（尾部加重） ----------
gold_cfg = json.load(open('gold_seeds.json', encoding='utf-8'))
SEEDS = {n for k, v in gold_cfg.items() if not k.startswith('_') for n in v}
records.sort(key=lambda r: -r['overall_p'])
n = len(records)
n_gold = len(SEEDS)
n_silver = round((n - n_gold) * 0.39)   # 银:铜 ≈ 2.1 : 3.3（相对金），次级选手集中在尾部
threshold = records[n_gold - 1]['overall_p']   # 金卡阈值 = 种子名额末位的综合分
miss = SEEDS - {r['name'] for r in records}
if miss: print('警告: 种子名单中未找到选手', miss)
for r in records:
    if r['name'] in SEEDS and r['overall_p'] < threshold:
        r['overall_p'] = threshold + 0.001   # 种子选手补分过线
non_gold = sorted([r for r in records if r['name'] not in SEEDS], key=lambda r: -r['overall_p'])
for r in records:
    r['tier'] = '金' if r['name'] in SEEDS else None
for i, r in enumerate(non_gold):
    r['tier'] = '银' if i < n_silver else '铜'
records.sort(key=lambda r: -r['overall_p'])

# ---------- 5. 三维映射 ----------
for r in records:
    lo, hi = BAND[r['tier']]
    r['AIM'] = round(lo + (hi - lo) * r['ADR_s_p'])
    r['SYN'] = round(lo + (hi - lo) * r['syn_p'])
    r['SEN'] = round(lo + (hi - lo) * r['sen_p'])
    r['TOT'] = r['AIM'] + r['SYN'] + r['SEN']

# ---------- 5b. 总评：由新三维总和在档内分位映射（铜 30~60 / 银 60~80 / 金 80~90；钻卡另算 90+） ----------
RATING_BAND = {'铜': (30, 60), '银': (60, 80), '金': (80, 90)}
for t, (lo, hi) in RATING_BAND.items():
    pool = [r for r in records if r['tier'] == t]
    tmin = min(r['TOT'] for r in pool)
    tmax = max(r['TOT'] for r in pool)
    for r in pool:
        p = (r['TOT'] - tmin) / (tmax - tmin) if tmax > tmin else 1.0
        r['rating'] = round(lo + (hi - lo) * p)

# ---------- 6. 输出 ----------
json.dump(records, open('cards_full.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
os.makedirs('../设计文档/选手卡', exist_ok=True)
order = {'金': 0, '银': 1, '铜': 2}
for region in ['CN', 'AMER', 'EMEA', 'PAC']:
    rs = [r for r in records if r['region'] == region]
    rs.sort(key=lambda r: (order[r['tier']], -r['TOT']))
    tiers = {t: sum(1 for r in rs if r['tier'] == t) for t in '金银铜'}
    lines = [f'# 选手卡 · {region}赛区（{len(rs)} 张）', '',
             f"> 品质分布 金{tiers['金']} : 银{tiers['银']} : 铜{tiers['铜']}（全球池：金=种子名单60张，银≈非金池39%，整体 ≈ 1 : 2.1 : 3.3 尾部加重）",
             '> 三维与总评同波段：铜 30~60 / 银 60~80 / 金 80~90（钻卡 90+）；总评由三维总和档内分位映射',
             '> 枪法←ADR，协同←助攻率/KDA/纪律性，意识←综合评分+队伍成绩（+特殊身份补分，内部调和不可见）',
             '> 英雄池取最新赛事（第二赛段）前 3 常用，招牌 = 第 1 常用（仅金/银卡）；⁂ = 次级队伍选手', '',
             '| 选手 | 战队 | 品质 | 总评 | 枪法 | 协同 | 意识 | 总和 | 英雄池 | 招牌 |',
             '|---|---|---|---|---|---|---|---|---|---|']
    for r in rs:
        sig = r['agents'][0] if r['tier'] in ('金', '银') and r['agents'] else '—'
        sec = ' ⁂' if r['secondary'] else ''
        pool = ' / '.join(r['agents'])
        lines.append(f"| {r['name']}{sec} | {r['team']} | {r['tier']} | {r['rating']} | {r['AIM']} | {r['SYN']} | {r['SEN']} | {r['TOT']} | {pool} | {sig} |")
    open(f'../设计文档/选手卡/选手卡_{region}.md', 'w', encoding='utf-8').write('\n'.join(lines))
    print(region, len(rs), tiers)

print()
print('校验 · 特殊身份选手落档:')
for r in records:
    if r['igl']:
        print(f"  {r['name']:<12}{r['team']:<5}{r['tier']} 枪{r['AIM']} 协{r['SYN']} 意{r['SEN']} 总{r['TOT']}")
print()
sec_rs = [r for r in records if r['secondary']]
st = {t: sum(1 for r in sec_rs if r['tier'] == t) for t in '金银铜'}
print('校验 · 次级选手分档:', st, '共', len(sec_rs))

print(f'金卡种子（{n_gold} 张）:')
print(', '.join(sorted(SEEDS)))
