# 九图参考快照

采集日期：2026-10-06。

- 官方区域概览：`../地图官方/ascent-plan.webp`；来源为 <https://playvalorant.com/en-us/maps/>，原文件保持不变。
- 补充小地图：`ascent-minimap.png`；来自 <https://valorant-api.com/v1/maps> 中 Ascent 的 `displayIcon`，第三方游戏资源索引，不是 Riot 官方接口。
- 元数据：`ascent-api-snapshot.json`，保留来源地址、世界坐标转换和 22 个区域名称。
- 补充图片 SHA256：`287357fcfce230ecb67704cafdb519a5bdb91602ed30f897474a65e86469c550`。

原始小地图无文字遮挡，用于补充官方概览图被图钉/名称遮挡的边界。两份参考交叉检查；当前索引资源的具体竞技补丁未核实，不能把快照称为已验证的 2026 竞技物理地图。

`数据源/trace_ascent_layout.py` 读取原图，提取透明区域边界、结构线、表面标记和包区，输出矢量坐标；不修改或重绘 PNG。轮廓只移除严格共线顶点，不任意简化通道。统一变换为 960 坐标、进攻在上/A 左/B 右：`x = 57 + 0.853 × sourceY`，`y = 43 + 0.853 × (1024 − sourceX)`。

世界坐标和图片坐标的转换来自快照；文字显示位置另作少量排版偏移。小地图中的细线包含栏杆、门、平台、箱体和非物理标记，下一阶段必须审核具体含义，不能全当阻挡墙。高度连接、穿透与路径耗时尚未制作。

用户确认 Ascent 后，新增 Haven、Split、Sunset、Breeze、Lotus、Fracture、Abyss、Summit 同类 PNG 与元数据。`数据源/trace_map_library.py` 等比提取轮廓并保留源哈希、变换和标注校准；Summit 出生点接口坐标有明确覆盖记录，轮廓外的普通标注不展示。包点徽标以实际包区为准。八图当前只用于展示，不冒充已验证战斗地图。详见 [九图制作与战斗样板](../../docs/validation/2026-10-06-map-library-and-combat.md)。
