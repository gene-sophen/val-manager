# 视觉探索 03 · 游戏手感与字体

日期：2026-10-01。

用户反馈：偏好白底；此前按钮与组件存在廉价感，希望参考多邻国和皇室战争，增强立体感，并重新选择字体。

## 入口

- **最新交互入口：`mobile.html#album`**。统一俱乐部、选手、卡册导航；22 张四赛区样例卡、筛选、详情、开包与返回位置恢复。

- **当前选定方向：A 清爽自然。** 风格参考不等于一比一复刻；具体组件继续打磨。
- `selected.html`：A 单独审阅入口，保留用户认可的界面观感。
- `cards.html`：新版铜、银、金、钻卡总览，点击放大；右上角进入开包体验。
- `pack.html`：划开/点击拆封后直接展示第一张，连续点击/左滑换卡、回看、随时跳过和紧凑结果。固定序列，仅用于视觉审阅。
- `component-kit.html`：当前 A 组件总览，可体验按钮提交、卡槽选中、标签、筛选弹层、确认与错误重试。
- `components-a.html`：早期 A 基础组件，保留对照。
- `index.html`：A/B 对比，支持同步切换首页、名单、卡面与组件。
- `concept.html?skin=playful#home`：A 清爽弹性；手机单页、桌面三页并排。
- `concept.html?skin=arena#home`：B 竞技厚度。
- `components.html?skin=playful`、`components.html?skin=arena`：按钮状态、中文/英文/数字、选择器、卡槽、能力条。

仓库根目录启动 `python -m http.server 8765 --bind 127.0.0.1`，访问当前目录下的 `index.html`。建议用 HTTP 预览，确保同目录字体与卡面资源正常加载。

## 两个方向

| | A 清爽弹性 | B 竞技厚度 |
| --- | --- | --- |
| 底色 | 纯白 | 略带冷色的白 |
| 主按钮 | 蓝色实色面 + 深蓝 5px 侧壁 | 金色双明度面 + 亮边 + 6px 侧壁 |
| 普通组件 | 2px 轮廓、适量硬阴影、圆角 | 更明确的底边与少量亮边 |
| 信息区 | 以留白和简单分区组织 | 保持清晰，主操作承载更多材质 |
| 气质 | 轻快、亲近、清楚 | 饱满、竞技、操作感更强 |

主按钮按下时下移，同时缩短侧壁。没有把所有组件都做成厚按钮。页面未使用上一轮黄灰金属渐变。

## 字体

- 中文：Noto Sans SC 可变字体，正文 500，控件 700，标题 800。
- 英文和数字：Nunito 可变字体，姓名和关键数字使用更饱满的字重。
- 本地 WOFF 子集总计约 351 KiB，附各自 OFL 许可证，无需预览时请求第三方字体服务。
- `prepare-fonts.py` 从本机 Noto Sans SC 和 Google Fonts 上游 Nunito 生成子集；新增中文后重新生成。
- A 选定原型的卡面已统一使用 Noto Sans SC + Nunito；A/B 对照页仍保留旧卡面。

## 参考与设计判断

阅读了[多邻国核心页面重设计说明](https://blog.duolingo.com/core-tabs-redesign/)，采用字体层级统一、组件一致、按目的分配装饰的原则。另参考[多邻国产品界面示例](https://blog.duolingo.com/pt/primeiros-passos-como-aprender-idiomas-no-duolingo/)与[皇室战争官方展示](https://supercell.com/en/games/clashroyale/)。

A/B 的颜色、几何、侧壁尺寸和交互是本项目的设计提案，不是官方组件规格。没有复制它们的品牌字体或游戏素材。

字体来源：[Nunito](https://github.com/google/fonts/tree/main/ofl/nunito)、[Noto Sans SC](https://github.com/google/fonts/tree/main/ofl/notosanssc)。

## 验证

已使用 Edge + Playwright 验证：

- A/B 与四个对比页面切换。
- 字体成功加载、页面图片正常、无浏览器脚本或 HTTP 资源错误。
- 选手详情、钻卡切换、放大卡面、选中控件。
- 按下按钮时实际发生位移。
- 360 / 390 / 430px 宽度下无主页面横向溢出，底栏完整可见。
- 手机对比页单方案切换。
- A 组件：提交中/禁用反馈、卡槽选择、错误重试、确认与取消。
- A 名单：搜索、无结果提示、品质筛选、排序；筛选取消不应用、关闭后焦点返回。
- 组件总览及底部面板在 360 / 390 / 430px 下无横向溢出，面板位于视口内。
- 新版四档卡面、10 张完整揭晓、上一张、拆封中跳过、结果放大、重新体验、减动效，以及详情页普通/钻卡切换。
- 新版卡面、开包、详情页在 360 / 390 / 430px 下无横向溢出，所有图片及脚本正常加载。

截图见 `preview/`。尚未进行 iOS / Android 真机验证。没有连接玩法或存档。

## 文件关系

保留 `art-direction-01` 与 `art-direction-02` 作对照。`build.cjs` 派生 HTML 和交互脚本，新 `ui.css` 不加载第二轮的材质 CSS。复用第一轮的基础布局、只读选手快照与隔离卡面。

`verify.cjs` 需要可解析的 Playwright 包与本机 Edge，并要求静态服务正在 8765 端口运行。

`refinements.css` 与 `refinements.js` 为选定 A 原型和组件总览提供共享样式及演示交互；`verify-components.cjs` 验证本轮组件。相关截图为 `preview/06-component-kit.png`、`07-filter-sheet.png` 和 `08-filtered-roster.png`。所有筛选与反馈仅作用于原型展示。

`cards.css` / `card-renderer.js` 为新卡面共享实现，`card-art-a.html` 提供隔离展示，`card-integration.js` 接入 A 详情与首页收藏入口。`pack.css` / `pack.js` 实现开包演示；`prepare-pack-samples.py` 生成四位补充选手的素材快照。`verify-cards.cjs` 验证本轮交互，截图为 `preview/09` 至 `15`。设计说明见 `cards-and-packs.md`。

第二版使用 `pack-flow.css` 实现连续卡堆和紧凑结果。`selected-copy.cjs` 在生成选定界面时精简文案，旧对照页保持独立。当前截图为 `preview/16` 至 `22`；交互验证仍运行 `verify-cards.cjs`。下一步见 `docs/plans/2026-10-01-collection-ui-next.md`：正式卡册与统一手机导航，玩法引擎继续后置。

## 统一手机原型

`mobile.html` / `mobile.css` / `mobile.js` 提供页面外壳、Hash 导航、卡册和详情。`prepare-collection.py` 从已有 catalog 提取 12 张国际赛区素材快照，与前述 10 张展示卡合并。仅会话保存筛选和浏览位置，不接触玩法存档。

开包逻辑通过 `mountPack(root, options)` 共享；独立 `pack.html` 仍可使用，手机外壳挂载同一布局并连接详情/返回行为。结果正文独立滚动，避免溢出覆盖底栏；卡堆阴影与进度条保留间距。

`verify-mobile.cjs` 验证卡册筛选、取消、空结果、刷新、浏览器返回、滚动位置、卡面版本和开包结果往返，并检查 320/360/390/430px 与短屏上的组件几何边界。截图见 `preview/24` 至 `29`。共享开包逻辑继续由 `verify-cards.cjs` 验证。下一步为首页与选手管理布局细化，PWA 和引擎接入仍后置。
