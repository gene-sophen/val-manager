# 解析号角统计页 → 统一全年数据集
# 用法: py parse_all.py
import re, json, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

EVENTS = {
    '号角-启点赛.html': 'kickoff',
    '号角-第一赛段.html': 'stage1',
    '号角-第二赛段.html': 'stage2',
}
COLS = ['ROUND', 'ACS', 'KD', 'KDA', 'K', 'D', 'A', 'ADR', 'KAST', 'HS', 'KMAX', 'FK', 'FD']

players = {}  # name -> {events: {ev: {stats, team, agents, extra}}}
for fname, ev in EVENTS.items():
    html = open(fname, encoding='utf-8').read()
    rows = re.findall(r'<tr[^>]*class="[^"]*ant-table-row[^"]*"[^>]*>(.*?)</tr>', html, re.S)
    for r in rows:
        m = re.search(r'<span class="_2PZ5S">([^<]*)</span><span class="_1xuMo" title="([^"]*)"', r)
        if not m:
            continue
        name, team = m.group(1), m.group(2)
        cells = re.findall(r'<td[^>]*>(.*?)</td>', r, re.S)
        nums = [re.sub(r'<[^>]*>', '', c).strip() for c in cells[3:]]
        stats = {}
        for k, v in zip(COLS, nums):
            v = v.replace('%', '')
            stats[k] = float(v) if v not in ('-', '') else None
        agent_cell = cells[2]
        imgs = re.findall(r'_files/(\d+\.(?:png|webp|jpg))', agent_cell)
        plus = re.search(r'\(\+(\d+)\)', agent_cell)
        p = players.setdefault(name, {'events': {}})
        p['events'][ev] = {
            'team': team,
            'stats': stats,
            'agents': imgs,
            'agents_extra': int(plus.group(1)) if plus else 0,
        }

json.dump(players, open('all_players.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('选手总数(全年并集):', len(players))
cnt = {ev: 0 for ev in EVENTS.values()}
for p in players.values():
    for ev in p['events']:
        cnt[ev] += 1
print('各赛事人数:', cnt)
# 同名跨赛区冲突检查: 同一名字出现在不同队伍
multi = {n: p for n, p in players.items() if len({e['team'] for e in p['events'].values()}) > 1}
print('年内换过队的选手数:', len(multi))
for n, p in list(multi.items())[:10]:
    print(' ', n, {ev: e['team'] for ev, e in p['events'].items()})
