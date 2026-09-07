# 素材整理：从号角保存页提取选手半身像与英雄头像，重命名归档到 ../素材库/
# 用法: py organize_assets.py   （在 数据源/ 目录下运行）
import json, re, os, shutil, io, sys, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

EVENTS = [('号角-第二赛段', 'stage2'), ('号角-第一赛段', 'stage1'), ('号角-启点赛', 'kickoff')]
players = json.load(open('all_players.json', encoding='utf-8'))
AG = json.load(open('agents.json', encoding='utf-8'))

# ---------- 1. 解析三个赛段页面的行结构 ----------
rows = []   # (event, name, team, avatar_file, [icon_files], folder)
for base, ev in EVENTS:
    html = open(f'{base}.html', encoding='utf-8').read()
    for block in html.split('<tr data-row-key')[1:]:
        m_av = re.search(r'class="YNwc_" src="\./([^"]+?)"', block)
        m_nm = re.search(r'_2PZ5S">([^<]+)<', block)
        m_tm = re.search(r'_1xuMo" title="([^"]+)"', block)
        if not (m_av and m_nm): continue
        m_ag = re.search(r'<div class="_2eGQF[^"]*">(.*?)</div>', block, re.S)
        icons = re.findall(r'src="\./([^"]+?)"', m_ag.group(1)) if m_ag else []
        icons = [i for i in icons if '_files' in i]
        rows.append((ev, m_nm.group(1).strip(), m_tm.group(1) if m_tm else '?',
                     m_av.group(1), icons, base + '_files'))
print('解析出行数:', len(rows))

# ---------- 2. 选手半身像映射（最新赛段优先）----------
avatar = {}
for ev, name, team, av, icons, folder in rows:
    avatar.setdefault(name, (av, folder, ev))
missing_av = [n for n in players if n not in avatar]

# ---------- 3. 英雄头像 → 特工名 投票 ----------
votes = collections.defaultdict(collections.Counter)
for ev, name, team, av, icons, folder in rows:
    p = players.get(name)
    if not p or ev not in p['events']: continue
    agents = [AG.get(a, a) for a in p['events'][ev]['agents']]
    for i, icon in enumerate(icons):
        for j, ag in enumerate(agents):
            votes[icon][ag] += 3 if i == j else 1
icon2agent = {}
for icon, cnt in votes.items():
    icon2agent[icon] = cnt.most_common(1)[0][0]
agent2icon = {}
for icon, ag in icon2agent.items():
    # 同一特工可能对应多个文件（不同赛段重复下载），取投票数最高的
    if ag not in agent2icon or votes[icon][ag] > votes[agent2icon[ag]][ag]:
        agent2icon[ag] = icon

# ---------- 4. 归档 ----------
def safe(s):  # Windows 文件名非法字符处理（如 KAY/O）
    return re.sub(r'[\\/:*?"<>|]', '', s)

os.makedirs('../素材库/选手半身像', exist_ok=True)
os.makedirs('../素材库/英雄头像', exist_ok=True)

n_av = 0
for name, (av, folder, ev) in avatar.items():
    src = os.path.join(folder, av.split('/')[-1])
    if os.path.exists(src):
        ext = os.path.splitext(src)[1]
        shutil.copy2(src, f'../素材库/选手半身像/{safe(name)}{ext}')
        n_av += 1

n_ag = 0
agent_src = {}
for ag, icon in agent2icon.items():
    fname = icon.split('/')[-1]
    for base, ev in EVENTS:
        src = os.path.join(base + '_files', fname)
        if os.path.exists(src):
            agent_src[ag] = src
            ext = os.path.splitext(src)[1]
            shutil.copy2(src, f'../素材库/英雄头像/{safe(ag)}{ext}')
            n_ag += 1
            break

print(f'选手半身像: {n_av} 张归档，覆盖卡池 {len(players)-len(missing_av)}/{len(players)}')
if missing_av: print('缺头像选手:', ', '.join(missing_av))
all_agents = sorted({AG.get(a, a) for p in players.values() for e in p['events'].values() for a in e['agents']})
missing_ag = [a for a in all_agents if a not in agent2icon]
print(f'英雄头像: {n_ag} 张归档，覆盖特工 {len(agent2icon)}/{len(all_agents)}')
if missing_ag: print('缺头像特工:', ', '.join(missing_ag))
json.dump({a: os.path.basename(s) for a, s in agent_src.items()},
          open('agent_icons.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
