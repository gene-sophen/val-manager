# VAL MANAGER

当前版本 **v0.16**：全项目静态审计、死代码清理、观赛生命周期与目标边界修正。旧赛年保持原规则；iQOO Neo10 / OriginOS 6 真机滑动与性能仍待复验。

[手机试玩](https://gene-sophen.github.io/val-manager/) · [完整目录导航](docs/PROJECT_LAYOUT.md) · [当前玩法设计](设计文档/01_当前设计/征战模式重做定案与待确认事项.md)

组建五人阵容，进行地图BP、特工选择与战术调整，完成2026电竞赛年。新征战使用九图空间引擎，观战默认2×；联机和自选组队是后续模式。

| 目录 | 内容 |
|---|---|
| `设计文档/UI原型/complete-prototype-01/` | 唯一正式前端与PWA入口 |
| `设计文档/UI原型/共享资源/` | 正式前端实际使用的卡牌、样式、字体与兼容URL清单 |
| `游戏/`、`引擎/` | 业务规则、比赛引擎与测试；游戏开发工具统一在 `游戏/tools/` |
| `设计文档/` | 当前玩法、专题设计及选手卡资料 |
| `数据源/`、`素材库/` | 制作数据、原始素材与优化资源 |
| `docs/` | 工程导航、计划、用户反馈与验收证据 |
| `归档/` | 旧UI、旧引擎演示、历史维护脚本及被替代的说明 |
| `.artifacts/` | 本地发布副本、未发布诊断与整理日志，不提交Git |
| `视频/` | 独立视频工作区；大体积制作依赖与成片留在本机 |

## 本地运行

在项目根目录执行：

```powershell
node 游戏/tools/build-spatial.cjs
python -m http.server 8765 --bind 127.0.0.1
```

打开 `http://127.0.0.1:8765/设计文档/UI原型/complete-prototype-01/`。正式入口保留原路径，避免目录整理改变已安装PWA的地址和存档来源。

## 构建与验证

```powershell
node scripts/check-project-layout.cjs
node 游戏/tools/build-pages.cjs
$tests = @(rg --files 游戏/tests 引擎/tests -g '*.test.js')
node --test @tests
```

默认发布输出为 `.artifacts/releases/current/`。构建拒绝覆盖已有目录；需要再次构建时指定新的输出路径，例如 `node 游戏/tools/build-pages.cjs .artifacts/releases/v011-check`。GitHub Actions自动构建并部署main，只发布正式运行资源与兼容资源URL。

存档在当前设备和站点的浏览器内，不随GitHub同步。换设备可在设置导出/导入备份。手机仍显示旧版时使用“设置→检查更新→保存并更新”。

本轮整体改版见[Aurora 界面验收](docs/validation/reports/2026-10-14-aurora-redesign.md)。上一轮改版见[移动端验收](docs/validation/reports/2026-10-14-mobile-flow.md)。目录整理与验证见[目录整理验收](docs/validation/reports/2026-10-14-project-organization.md)。之前的[玩家旅程验收](docs/validation/reports/2026-10-14-player-journeys.md)保留作为v0.7依据。
