# 地图比赛引擎优化重做 Implementation Plan

> **2026-10-06 更新：** 最新执行主计划为[真实布局与柔色风格的 2D 地图重做](2026-10-06-2d-map-rebuild.md)。本文件保留历史诊断与任务依据；空间展示/模拟现在共享一份布局基准，海外国内赛保留已批准的数值简化，执行顺序与发布门槛以新计划为准。当前仍为规划状态。

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> 仓库执行时采用当前可用的 executing-plans 技能和下述检查点；本轮仅规划，不开始执行，不自动提交已有混合工作区。

**Goal:** 队员能根据可见信息自主进行合理的多地图比赛，战术和暂停通过行为产生影响，正式和快速比赛同源，2D 与战报可信。

**Architecture:** 保留回合行动、事件、可观察信息和输入日志框架，逐项替换不合理行为，而非另起一个结果补偿器。地图展示资产与导航/几何分离；先在 Ascent 证明正确性和平衡，再推广地图。赛事图、开包、成长账本与业务存档由主系统提供，比赛引擎只产出实际事件和结果。

**Tech Stack:** JavaScript/CJS、node:test、现有几何/行动引擎、SVG 回放、现有浏览器验证入口。

---

## 范围与开工条件

独立项目 E，暂停于规划状态：用户当前要求先核对并收尾非引擎工作，不以此计划继续修改引擎。非引擎状态见 `设计文档/01_当前设计/当前完成情况与剩余工作.md`。

包含：地图导航、观察/视线、交火、队员自主决策、道具和经济、卡牌战斗特性、五攻五防执行、比赛接口、真实回放与平衡。排除：卡包新玩法、联机/自选、年度积分规则、全球数据采集、永久成长和存档迁移。

复用已完成的接触/阵亡补防、另一侧留人、真实路径计时、后撤集结、单 tick 开火预算。当前 200 场审计进攻 **67.802%**，未达到发布条件；只有 Ascent 独立预览，不默认启用。九张柔色 SVG 只作展示。

前置：N5 提供版本/恢复接口；N3/N4 提供冻结属性、战术意图与事件消费接口。N1 的缺数据可用明确标注的合成测试队进行引擎实验，不能用其宣称真实全量赛年完成。

## E1：冻结基线和诊断协议

**文件：** `游戏/audit-spatial.cjs`、`游戏/inspect-spatial.cjs`、`游戏/tests/spatial-match.test.js`；新增 `游戏/tests/engine-release-contract.test.js`。

1. 给诊断写测试：事件时间顺序、单位身份、每枪预算、同种子同输入一致。
2. 运行 `node --test 游戏/tests/engine-release-contract.test.js`，确认新约束存在反例时失败。
3. 增加 A/B 点首次接触、首次开枪、支援呼叫/到达、下包人数、枪线覆盖的统计；统计不得反馈给 AI 形成全知。
4. 执行 `node 游戏/inspect-spatial.cjs`；保存未修改策略的诊断与 200 场基线。
5. 运行对应测试并记录通过；后续每次行为修改用同一固定样本对照，另保留未参与调参的种子。

**完成：** 能区分没有补防、到场太晚、到场但没有枪线、道具未拖延；不能只看总胜率。

## E2：Ascent 地图与交叉火力

**文件：** `引擎/maps/build-ascent-navigation.cjs`、`引擎/maps/ascent-navigation.json`、`引擎/maps/ascent-navigation-geometry.json`、`引擎/geometry.js`、`引擎/movement.js`、`引擎/combat.js`；新增 `引擎/tests/defensive-angles.test.js`。

1. 写固定局部场景：入口、拐角、二楼/市场、障碍两侧。断言可见才能开火、被墙挡不能开火、支援路线可到达。
2. 执行 `node --test 引擎/tests/defensive-angles.test.js`，保留失败位置。
3. 按真实布局修通路和遮挡，补箱体/门/层级接口，检查视野与射击使用同一几何规则。
4. 运行 `node 引擎/maps/build-ascent-navigation.cjs` 生成地图，再跑局部测试。
5. 用 E1 指标检查守点者实际覆盖入口与交叉掩护，不给防守方固定胜率补偿。

**完成：** 同一位置的可观察/可命中规则一致，移动不能穿墙；高低差未制作的区域不得冒充精确模拟。

## E3：守点、补防与反清自主行为

**文件：** `引擎/brain.js`、`引擎/defense-support.js`、`引擎/observation.js`、`引擎/round.js`、`引擎/tests/defense-support.test.js`；新增 `引擎/tests/defensive-regroup.test.js`。

1. 为假打转点、同点补位、跨点支援、信息过期、短退等人和集结反清写小场景测试。
2. 执行 `node --test 引擎/tests/defense-support.test.js 引擎/tests/defensive-regroup.test.js`。
3. 依据可见敌人、己方减员、可信队友通信调整守/退/援/反清；SEN 决定反应，SYN 决定配合，禁止读取敌方真实分布或战术标签。
4. 复跑测试；检查另一侧留人、支援延迟、取消呼叫和预埋包后的独立回防。
5. 做固定案例实际回放，确认日志中的动作真的发生了，而不是只出现一句补防文案。

**完成：** 进攻可以被骗/被拖延，防守也能误判；不增加玩家下补防指令的操作。

## E4：道具、经济和英雄/卡牌差异

**文件：** `引擎/abilities.js`、`引擎/combat.js`、`引擎/round.js`、`引擎/config.js`、`游戏/spatial-match.js`；新增 `引擎/tests/utility-budget.test.js`、`游戏/tests/card-trigger.test.js`。

1. 清点当前卡牌特性、暗属性和明星时刻，列出条件/影响判定/事件证据；原三维与品质不重设计。
2. 写技能购买与使用预算、烟雾可见性、大招充能、特性只在合法条件触发的反例测试。
3. 执行 `node --test 引擎/tests/utility-budget.test.js 游戏/tests/card-trigger.test.js`。
4. 接入预算与触发器，同一增益不得在个人、队伍、教练层重复计算；缺触发依据的特性明确待做。
5. 检查普通/钻卡版本、残局和失利分支；招牌影响执行熟练，不保证胜利。

**完成：** 全部保留卡牌效果有可核查触发或明确缺口；技能不是无限投放，大招不再整图默认一次。

## E5：五攻五防、情境选择与教练作用

**文件：** `引擎/tactics.js`、`引擎/coach.js`、`引擎/coach-observation.js`、`游戏/spatial-match.js`；新增 `游戏/audit-tactic-matrix.cjs`、`游戏/tests/coaching-effect.test.js`。

1. 写排序合法性、信息隔离、经济/人数变化允许情境覆盖排序的测试。
2. 运行 `node --test 游戏/tests/coaching-effect.test.js`。
3. 保留五种名称与优先级交互，调整路线、人数分配、协同和道具逻辑；克制体现为机会优势，不直接奖励结果概率。
4. 执行 `node 游戏/audit-tactic-matrix.cjs`，分 A/B、经济档输出 5×5 胜率和事件统计；优先查快攻普遍过强/控图普遍过弱。
5. 同种子比较不调整、随机调整、依据公开信号调整，输出均值与波动；不宣称每次暂停必然有收益。

**完成：** 排序有效、选手能自主变通，各战术有适用条件，教练影响能与随机噪声区分。

## E6：比赛接口、正式与快速同源

**文件：** `游戏/spatial-match.js`、`游戏/season-2026.js`、`游戏/round-outcome.js`、原型 `runtime-model.js`；新增 `游戏/tests/simulation-parity.test.js`。

1. 固定输入协议：内容/地图/策略版本、双方冻结五人及英雄、三层属性、地图分、已确认优先级、种子与自动教练策略。输出只有结果/实际事件/恢复信息。
2. 写同输入的正常播放、关闭播放快速模拟、刷新重放应同结果的测试；恢复输入不重随机。
3. 执行 `node --test 游戏/tests/simulation-parity.test.js 游戏/tests/spatial-match.test.js`。
4. 用同一模拟入口连接正式和后台，差异限于教练输入来源与是否播放；不维持一套细战斗、一套概率赛果的正式版本。
5. 向 N3/N4 提供事实与评价样本；只消费一次成长，不让回放再发奖励。旧 version 1 保持旧规则恢复或归档，不重解释历史。

**完成：** 播放不会改变胜负，自动执教不偷看信息，赛事图只等待/消费合法比赛结果。

## E7：其余八图与地图能力接口

**文件：** `引擎/gamemap.js`、`引擎/maps/`、`游戏/spatial-match.js`、`游戏/build-spatial.cjs`；新增 `引擎/tests/map-library.test.js`。

1. 定义区域/路径/包点/视线/特殊机制接口，战术不硬编码 Ascent 节点。
2. 先写三包点、不可达路径、跨层射击、门和特殊连接的失败场景。
3. 每次只制作一图数据，再执行 `node --test 引擎/tests/map-library.test.js` 验证连通、出生点、包点与双方可达性。
4. 对每图重复 E2–E5 指标与回放检查；九图展示 SVG 不自动用作碰撞几何。
5. 执行 `node 游戏/build-spatial.cjs`，只将已经通过验证的地图声明为可模拟。

**完成：** 初始七图与两图轮换都具备独立有效行为，Haven/Lotus 的 C 点等差异实际参与战术。

## E8：回放、平衡和发布门槛

**文件：** 原型 `spatial-view.js`、`runtime-views.js`、`runtime-contract.test.cjs`，`游戏/audit-spatial.cjs`；验收记录放入 `docs/validation/`。

1. 测试事件身份/坐标/时间与短报一致，不生成没有发生的击杀、补防或技能。
2. 重跑固定 200 场，再跑未参与校准的种子、不同实力和英雄阵容；记录各图/战术而不只汇总平均。
3. 检查合理的强弱队趋势、BO3/BO5、加时结束、暂停、快进、全赛年耗时和存档大小；35–65% 仅作当前等强攻防粗筛，不代替逐图分析，不要求每图五五开。
4. 用最终入口浏览器验收关键分回放、普通分阅读、补防/转点/残局、手机宽度、刷新与离线恢复，保存截图与事件证据。
5. 完成 N6 的最终全流程整合；发布条件通过才改默认开关，未通过继续独立预览。

**全量命令：**

```powershell
$engineTaskTests = @(rg --files 引擎/tests 游戏/tests -g '*.test.js') + @(rg --files 设计文档/UI原型/complete-prototype-01 -g '*.test.cjs')
node --test @engineTaskTests
```

预期：全部必要契约通过、发布审计有实际依据、无已知阻断问题。测试通过不能替代多地图平衡和真实浏览器体验。

## 交付检查点

- E1–E5：Ascent 行为/平衡报告，可独立验收，默认开关仍关。
- E6：同源正式/快速接口与恢复证明，不宣称九图已完成。
- E7：逐图验证报告，不一次批量复制背景。
- E8：全流程验收通过后再默认启用。

`2026-10-05-defensive-balance-next.md` 保留为 E2–E5 的细项参考，不再充当主项目清单。无需重新确认已确定的抽卡、战术排序、暂停、CN 开局和 BO5 总决赛设计。
