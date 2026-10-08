# 分层站位与交火 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 用少量有空间含义的站位和交火窗口取代“区域节点就是对枪点”的表达，先制作 Ascent 可检验样板。

**Architecture:** 区域层沿用宏观路线，只处理集结、补防与转点；站位层记录真实坐标、掩体侧与探头目的地；交火层记录入口/通道的接敌窗口，并由墙体和身体射线编译静态可见性。窗口不授权开枪，移动途中仍在真实坐标校验，烟和门必须重新判定。新模型冻结为 v4，v1–v3 不改数据和旧存档。

**Tech Stack:** CommonJS、版本化 JSON、SVG、Node 原生测试、现有浏览器回放。

---

### Task 1: 审核内墙并建立独立 v4 数据

- 新增 `引擎/maps/build-ascent-combat-v4.cjs`，输出 `ascent-combat-v4.json`、`ascent-geometry-v4.json`。
- 使用已保存源图的坐标变换；为 B 入口隔墙、市场隔墙、箱体和中路低分隔登记语义与来源，不能把所有小地图细线当高墙。
- 每区域约 2–5 个具名站位，关键包点可略多；不扩张宏观路线图。
- 定义约 12 个入口/枪线窗口、保护位与探头位之间的微移动。预计算定点身体可见性，禁止同区域自动互见。
- 测试 `引擎/tests/layered-engagements.test.js`：隔墙阻断但通道可绕行；同区可不可见；跨区可互见；探头从实际坐标进入射线。

### Task 2: 接入分层交火查询

- 新增 `引擎/engagements.js`，修改 `gamemap.js`、`observation.js`、`combat.js`、`actions.js`。
- 定点查询读编译表；移动、烟、门查询真实几何；同 tick 重复查询复用结果但坐标或动态状态改变必须失效。
- `contact`/`shot` 事件记录实际站位、窗口和暴露比例；概率只消费暴露结果，不能另叠“窗口克制胜率”。
- 修改 `brain.js`，保护位自主探头时走合法微路径，不瞬移、不凭真实敌人隐藏坐标作决策。
- 对照优化查询与直接射线，检验无漏接触和穿墙射击；记录静态命中/动态射线次数，不能以测试总数代替性能证据。

### Task 3: 可视检查与回放版本

- 修改 `游戏/spatial-match.js` 支持 v4、冻结和恢复；测试 `游戏/tests/spatial-v4.test.js`。
- 新增 `map-preview-ascent/layered.html`、`layered.js`，显示分层开关、具名站位、单个站位真实枪线、保护/探头对照与源图对照。
- 增加独立 `?scene=ascent-v4`，回放用同份 v4 墙体，旧版回放用旧资产。
- 构建 `node 游戏/build-spatial.cjs`，执行 `node --test 引擎/tests/*.test.js 游戏/tests/*.test.js`，浏览器检查后保存截图。

### Task 4: 记录边界与推广条件

- 运行固定种子小样本与静态/直接几何查询对照，记录统计，不追求通过改胜率常数达到五五开。
- 更新完成记录：本批是 Ascent 分层样板；其余八图仍需逐图审核内墙/高度/特殊机制后沿用同一结构，不批量复制 Ascent 枪线。
- 门状态自动执行、多层导航、真实英雄全部技能、千场平衡及正式征战发布仍属原计划后续任务。

执行直接在已授权工作区推进，不创建新对话、不派子代理、不提交混合工作区变更。

## 本批执行结果

- Task 1–3 的 Ascent 样板及 Task 4 的诊断/缺口记录完成：17 区域、52 站位、12 窗口、13 实体分隔；182 项回归通过。
- 20 场诊断攻方胜率仍为 63.6%，未发布；其余八图分层战斗待逐图审核和制作。
- 详见[分层站位与交火验收](../validation/2026-10-06-layered-engagements.md)。
