# Ascent 单图视觉样板

新版：`ascent-v2.svg`。旧 `ascent.svg` 保留，当前比赛仍使用原有资产及空间模型。

布局来源为 `引擎/maps/layouts/ascent-v2.json`，渲染器为 `游戏/build-ascent-style.cjs`；生成数据见 `数据源/trace_ascent_layout.py`。独立渲染，不执行批量八图生成器。

保留源小地图轮廓、内墙/结构标记、A/B 包区、主要掩体轮廓及 A 二楼；采用浅色地面、柔色边线、少量主题色、低密度地标，不用大面积文字代替地图形状。

预览：`设计文档/UI原型/complete-prototype-01/map-preview-ascent/index.html`，支持新版/原始小地图/叠加、局部放大、拖动、文字与地标开关。

当前 `simulationReady: false`：此版供画风与结构审阅，尚未制作真实对枪点、碰撞/导航和战斗接入；不代表进攻偏强已解决。地图具体版本仍待冻结。
