# 2026-10-04：开包、卡牌布局、赛果资格与 BO5 验收

最终前端保持 `设计文档/UI原型/complete-prototype-01/`。此前原型验收与旧引擎实验记录保留为历史，不替代本轮证据。

## 本轮完成

1. 三个初始包与补强包逐张揭晓，纸包、完整卡面及钻卡动效保留，无全部揭晓入口。已知前缀决定图鉴解锁，刷新不重抽；修正独立章节首张揭晓计数。
2. 包 / 比较 / 五人 / 补强候选五列真实海报加总评，图鉴四列；点击查看完整卡牌，选择控件独立。
3. 实际回合结果推进赛事图：前置与后置比赛均模拟，正式胜负改变后续对阵；CN 三败启点、双败季后赛、十队入围，世界赛瑞士 / GSL / 双败，积分与去重资格已接入。
4. 到总决赛额外正式 BO5，胜者组两禁与 A / B 权限，三胜即停；仅实际地图计收益，夺冠有奖杯和参赛荣誉。
5. 九图海报与真实静态俯视图来自 Riot，可放大；本地记录来源、哈希及几何尚未验证，不显示虚构走位。
6. 非铜卡原第一个常用英雄标唯一招牌，铜卡保持原无招牌设计。快速选英雄计算五人不重复特工的整体适配，兼顾个人 / 地图 / 职责，可手动改选。

双方共享暂停窗口，只扣发起方次数；自动 / 快进遇中场或对手暂停停止等候。状态回归中性，防止后台连胜把状态推至 100。保存清理已结算后台逐分明细，保留成绩、参赛、成长和当前正式比赛逐分记录，修复全年浏览器容量失败。

## 验收证据

- 工程回归 **133 通过、0 失败**，日志 `2026-10-04-season-followup/tests.txt`；其中新版规则 / 模板 / 运行契约 33 项。
- 纯契约跑通八阶段模拟、BO3 / BO5、保存恢复、资格去重、成长幂等与全年存档小于 2 MB。十二个种子检查海外启点轮空保护、大师赛首轮跨区二号对三号、后续不重赛及区域冠军挑选真实瑞士晋级队。
- 浏览器实际新征战 EDG 对 TYLU BO3 1:2 失利，后续三败赛仍晋级，阶段第 2 名；失利没有直接伪造为出局。
- 浏览器 BO5 胜者组选 B 仍有两禁，败者组对手执行两禁；刷新保留 BP。实际打完 3:1：Split 13:11、Haven 8:13、Lotus 13:7、Breeze 13:7，第五图未打不出结果。冠军名次、积分与荣誉结算成功。
- 浏览器逐张走完三包三十张，每步一张；第二张刷新保留，海报点击打开完整卡牌。证据 `pack-reveal.json`。
- 35 页面入口在图片加载后无破图、阻塞、横向溢出或 undefined：`browser-pages.json`。九个变更页面在 320 / 360 / 390 / 430 宽度大字模式共 36 状态无溢出、破图、底栏覆盖：`browser-responsive.json`。
- 最新页面截图在原型 `preview/season-followup-gallery/`，独立决赛和五列开包截图在本目录。`season-review.html` 提供总览；普通章节仍为界面样例，两个决赛预览由合法赛事图和固定种子生成。

复跑工程：以 `rg --files 引擎/tests 游戏/tests -g '*.test.js'` 和原型 `*.test.cjs` 文件数组运行 `node --test`。原型 `verify-ui.cjs` 运行 33 项；`verify-review.cjs` 校验已保存证据，不启动浏览器或声称重新验收。

## 尚未完成

- **精细战斗 / 2D 回放**：新征战与快速赛暂共用队伍层面回合概率模型；未连接旧引擎移动、技能、交火、视线。九张官方图不是九张有效战斗地图。需先完成 Ascent 区域 / 通路 / 墙体 / 高差与新版战术行为，再逐图扩展并接同源回放。
- **卡牌与标定**：原三维固定，队伍 / 教练 / 地图 / 英雄适配有效；选手各项特性、暗属性、明星时刻尚未逐项接入真实行动触发。长期熟识 / 声望、BO3 / BO5 成长和合理执教收益需多种子校准。
- **全球内容**：TL GSR、GX tomaszy 缺卡；十二个海外挑战者仅真实队名与中性先验，阵容待补。阵容期地图统计、教练数据待补，不捏造缺卡三维。
- **赛事细则**：CN 实际签位已核对；非 CN 入围赛仍为通用十二队双败拓扑；分组属于重模拟赛年生成，最终同分 BO1 为明示后备游戏规则。不能声称逐项复刻全部地区抽签与裁定。
- **整合与发布**：前端 v3 与旧 v1 / v2、游戏业务存档隔离，统一 IndexedDB 迁移待做；精细九图 / 全球全量阵容 / 多赛年平衡 / 真机 PWA 和系统安全区未验收。自选 / 联机另行推进。

后续顺序：补齐数据与细则 → 精细 Ascent 纵向闭环 → 共用系列赛与业务存档 → 九图 → 全球年与多赛年平衡 / 真机验收。

## 来源

- [2026 官方手册](https://valorantesports.com/en-US/season/115571062868511862/handbook/)与[官方规则 PDF](https://cdn.sanity.io/files/dsfx7636/news_live/f600a428dbcb54cff5814750f4c4be2b699d7934.pdf)：格式、积分、BP、暂停、同分。
- [Pacific 官方介绍](https://valorantesports.com/en-SG/news/vct-pacific-2026-season-primer)与[Americas 官方启点介绍](https://valorantesports.com/en-US/news/vct-americas-2026-kickoff-everything-you-need-to-know)：轮空与地区格式。
- [CN 启点](https://www.vlr.gg/event/2685/vct-2026-china-kickoff/main-event)、[第一赛段](https://www.vlr.gg/event/2864/vct-2026-china-stage-1)、[第二赛段入围](https://www.vlr.gg/event/2978/vct-2026-china-stage-2/play-ins)：地区实际签表差异。
- [Santiago 首轮抽签记录](https://www.vlr.gg/625549/masters-santiago-draw-brings-high-stakes-clashes-and-first-time-matchups)与[London 季后赛抽签记录](https://www.vlr.gg/694862/playoff-matchups-for-masters-london-drawn/)：种子 / 区域约束与冠军挑选对手。
- [Riot 地图官网](https://playvalorant.com/en-us/maps/)：实景与俯视图，来源清单 `素材库/地图官方/sources.json`。
