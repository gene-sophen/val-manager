# 开包模拟：不同包大小下，"开一包 → 取最强5人组队"的强度分布
# 用法: py sim_packs.py   （在 数据源/ 目录下运行）
import json, random, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
random.seed(42)

recs = json.load(open('cards_full.json', encoding='utf-8'))
dias = json.load(open('diamond_cards.json', encoding='utf-8'))

# 钻卡数据结构兼容：取三维总和与赛区
diamond_pool = {}
for d in dias:
    tot = d.get('TOT') or (d['AIM'] + d['SYN'] + d['SEN'])
    diamond_pool.setdefault(d['region'], []).append({'name': d['name'], 'tier': '钻', 'TOT': tot})

pools = {}
for region in ['CN', 'AMER', 'EMEA', 'PAC']:
    pool = [{'name': r['name'], 'tier': r['tier'], 'TOT': r['TOT']}
            for r in recs if r['region'] == region]
    pool += diamond_pool.get(region, [])
    pools[region] = pool

TRIALS = 20000
for region, pool in pools.items():
    n = len(pool)
    print(f'===== {region} 池（{n} 张：'
          + '/'.join(f"{t}{sum(1 for c in pool if c['tier']==t)}" for t in '钻金银铜') + '）=====')
    for size in [8, 10, 12]:
        team_tots, p_dia, p_2gold, comp = [], 0, 0, {'钻': 0, '金': 0, '银': 0, '铜': 0}
        for _ in range(TRIALS):
            pack = random.sample(pool, size)
            if any(c['tier'] == '钻' for c in pack):
                p_dia += 1
            team = sorted(pack, key=lambda c: -c['TOT'])[:5]
            team_tots.append(sum(c['TOT'] for c in team))
            if sum(1 for c in team if c['tier'] in ('钻', '金')) >= 2:
                p_2gold += 1
            for c in team:
                comp[c['tier']] += 1
        team_tots.sort()
        avg = sum(team_tots) / TRIALS
        p10, p50, p90 = (team_tots[int(TRIALS * q)] for q in (0.1, 0.5, 0.9))
        print(f'  {size}张/包: 队伍总和 均值{avg:.0f} P10={p10} 中位={p50} P90={p90} | '
              f'含钻率{p_dia/TRIALS:.0%} 队均构成 '
              + ' '.join(f'{t}{comp[t]/TRIALS:.1f}' for t in '钻金银铜')
              + f' | 队中2张以上金/钻 {p_2gold/TRIALS:.0%}')
print()
print('参考基准：全铜队≈700 全银队≈1000 全金队≈1180 1钻+4金≈1200')
