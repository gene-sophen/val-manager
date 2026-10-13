# 玩家体验逐项优化实施清单

目标：依照同日体验评审逐个完成 V/N/O/P/M/R/A/C 条目，界面解释现有机制，发布 v0.5。
架构：新增纯展示计算 experience-model.js 与最后加载的 experience-views.js；沿用原模拟、成长与存档事务。必要交互进入 app.js，样式保留共享设计令牌。只使用独立测试数据库验收。

- [x] 第一轮 V1、N1、N2、M1、M2、R1、R4、A2、C1、C2、C3：操作分层、恢复位置、紧凑比赛和控制分组、真实赛果去向、补强实算、特性解释、设置与错误反馈。
- [x] 第二轮 V3、N3、O3、O4、P1、P2、P3、P4、M3、M4、R2、R3、A1、A3、C4：卡包合法首发、比较、选人原因、情报、推荐解释、战术行为、证据、可见成长、资格与收藏口径、无障碍。
- [x] 第三轮 V2、V4、O1、O2、A4：教练室首页、逐张进度与新收藏、事实年度回顾、桌面观赛和比较。
- [x] 对 320/360/390/430、横屏、桌面、大字模式逐项验收关键页面；测试展示不改变赛果、备战数据或成长。
- [x] 发布 v0.5，核对线上脚本、样式与缓存版本，并记录每个条目的实际交付范围。

源码：设计文档/UI原型/complete-prototype-01/{experience-model.js,experience-views.js,design-system.css,app.js,spatial-view.js,index.html,sw.js}。
验证：游戏/tests/player-experience.test.js、既有导航/成长/卡牌/发布回归、唯一 val-manager-test-* 浏览器验收。

验收与逐项交付范围见 docs/validation/reports/2026-10-12-player-experience.md；真机与真人观察不作为已验证结论。
