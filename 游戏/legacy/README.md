# 旧四场原型归档

这里保留改造前的 schema v1、命令、抽包及页面模板。旧规则与卡包配置在 `../content/prototype-rules.json`、`prototype-packs.json`。

`run-flow.test.js`、`preparation.test.js` 显式使用这些旧模块，验证既有四场切片仍可追溯；通过它们不表示新版八阶段赛年已完成。旧 fixture 服务显式启用 `legacy-prototype` 执教策略，新引擎默认拒绝普通回合免费改战术。

浏览器正式入口只打包新版状态与命令，不加载归档命令。
