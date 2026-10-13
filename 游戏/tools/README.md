# 构建、审计与诊断工具

从仓库根目录运行。工具集中到此处后，相对模块引用和工作区定位已适配。

| 类型 | 工具 |
|---|---|
| 正式发布 | `build-spatial.cjs`、`build-pages.cjs` |
| 图片与卡牌资源 | `build-image-assets.cjs`、`build-card-effects.cjs` |
| 地图展示与复核 | `build-ascent-style.cjs`、`build-map-style.cjs`、`build-map-library.cjs` |
| 当前引擎/赛年审计 | `audit-current-system.cjs`、`audit-spatial-campaign.cjs`、`audit-spatial-final.cjs`、`audit-progression.cjs` |
| 平衡与行为审计 | `audit-*.cjs`、`aggregate-*.cjs`、`summarize-*.cjs` |
| 故障复现与探查 | `diagnose-*.cjs`、`inspect-*.cjs`、`probe-*.cjs`、`trace-map-balance.cjs`、`debug-parity.cjs` |
| 早期业务验证 | `build_web.js`，输出独立试玩页，非正式UI |

发布输出默认 `.artifacts/releases/current/`；审计和诊断默认写入 `.artifacts/validation/`，已确认的报告再选入docs。审计工具中的版本号表示要复现的行为版本，不表示存在多个正式产品。历史审计不可代替当前发布验收；不要将缺少样本或未完成队列解释为通过。
