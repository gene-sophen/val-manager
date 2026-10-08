# 新版征战：开局试玩

## 10 月 5 日：正式前端成长与继承

`progression.js` 已接入用户指定的完整前端：队伍三维逐分变化与休息恢复、教练三维有限升降、H/M 地图积累与换人代价、实际参赛地图/赛事熟识、离队收益和跨年继承。164 项回归通过，12 种子各连续 5 年审计通过。海外国内赛事只做正常赛制下的数值比赛，国际及 CN 保留当前回合模型；空间引擎独立计划本批未执行。该模块服务当前 UI，未宣称旧业务 IndexedDB 已统一接入。见[验证记录](../docs/validation/2026-10-05-growth.md)。

## 本轮进展：展示风格与 Ascent 防守行为

九张柔色 SVG 仅作 UI 展示；新空间策略实现自动补防/后撤、跨区域视线开枪和距离计时，旧 version 1 日志兼容。149 项回归通过。旧/新同条件 200 场镜像进攻 85.6%→67.8%，未过门槛，常规征战继续队伍层模型。下一步执行 `docs/plans/2026-10-05-defensive-balance-next.md`。


**2026-10-05：**新增[Ascent 独立空间推演验收](../设计文档/UI原型/complete-prototype-01/index.html?scene=ascent)，真实事件回放、五类行动、引擎暂停和恢复已接通，143 项测试通过。但 200 场审计仍有明显进攻优势，未默认启用到新征战；九图与完整精细赛年未完成。见[验证和后续](../docs/validation/2026-10-05-spatial.md)。下方 10-04 状态仍适用于常规征战。

**2026-10-04 最新入口：**[用户定稿前端](../设计文档/UI原型/complete-prototype-01/index.html)已接通逐张开包、五列 / 四列卡片、实际赛果、赛事晋级 / 积分和额外 BO5 总决赛。新增模块为 tournament / season-2026 / map-veto / round-outcome / agent-selection。正式与快速比赛暂共用队伍层面回合模型；精细空间引擎与本目录业务存档尚未整合。下文是旧 A 批业务验证记录，不能当成最新功能状态。见[本轮验收](../docs/validation/2026-10-04-season-followup.md)。

2026-10-04：用户指定的最终前端基础为 [完整原型 01](../设计文档/UI原型/complete-prototype-01/index.html)，已经对齐征战交互。其原型状态与此处正式业务存档隔离；本目录 `play.template.html` 继续作为 A 批业务验证入口，后续接入最终前端，不作为最终视觉方向。

2026-10-03 已实现 A 批开局与存档基础，并开始 B 批单图规则。完整实施状态见[开工清单](../docs/plans/2026-10-03-season-and-match-engine-rebuild.md)和[本批验证记录](../docs/validation/2026-10-03-batch-a-and-match-rules.md)。当前入口不开放未完成的赛年或比赛。

在仓库根目录运行：

```powershell
node 游戏/build_web.js
```

生成 `游戏/out/playable.html`。当前流程为：选择十二个 CN 主队席位之一 → 一次开三个十张初始包 → 全览并选择一个完整包 → 确认五名不同选手。全部三包解锁图鉴；不跨包选人、不设替补，最多一钻。英雄留到逐图赛前，职责与指挥自动承担。选手既有卡面三维保持不变。

推荐通过固定本地地址打开，避免不同文件路径/域名产生不同存档空间：

```powershell
python -m http.server 8786 --bind 127.0.0.1
```

浏览器访问 `http://localhost:8786/游戏/out/playable.html`。不依赖联网接口。相同浏览器和地址下刷新续玩，已开卡包不重抽；五人确认后显示初始羁绊/状态/熟练。退出征战保留图鉴，但阵容不带入下一局。不同域名的浏览器存档相互独立；本次自动试玩使用 `127.0.0.1`，交付入口使用 `localhost`，不带入自动试玩的阵容。

存档为 schema v2，冻结本局卡库与内容配置；结算使用稳定事件 ID。优先 IndexedDB，缺失时使用本地存储。旧四场切片完整归档，可导出原始备份，旧图鉴和荣誉保留；旧进行中比赛不会被伪造成新版职业赛年。读取异常不覆盖原始数据。本地存储降级方式未验证跨标签并发，常规使用 IndexedDB。

两次补强的状态机与交互已具备，每次一次十张，支持保留或更换 0–5 人，确认后离队卡实例不可召回；自动投放依赖后续真实赛事流程，当前开局页没有人为跳阶段的按钮。

引擎已改为领先两分结束、加时交替攻守与独立一次暂停、双方共享执教窗口。可运行独立窗口调试页：

```powershell
node 引擎/build_spectator.js --a tiers:GGSSB --b tiers:GGSSB --seed 42 --selftest -o 引擎/out/coaching-window-check.html
```

此页使用旧 Ascent 节点地图与旧攻四守三战术比重，只验证窗口行为；不是征战比赛入口。尚缺五类排序、地图 BP/BO3、九图、赛事资格与年度成长。大招仍沿用原型的整场一次模型，未达到正式游戏的充能规则。

测试入口：

```powershell
$files = @(rg --files 引擎/tests 游戏/tests -g '*.test.js')
node --test @files
```

真实浏览器存档集成验证页：`node 游戏/tests/helpers/build-browser-storage-harness.js`，随后访问同一地址下的 `游戏/out/storage-check.html`。每次创建独立测试数据库，不读写正式游戏存档。
