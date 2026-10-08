# FIELDNOTES / 视觉探索 01

手机端 PWA 的视觉基础原型。当前只探索配色、人物影像、排版和基础交互。

直接用浏览器打开 `index.html`，或从仓库根目录启动静态服务：

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

访问 `http://127.0.0.1:8765/设计文档/UI原型/art-direction-01/index.html`。

- 桌面：三张手机页面并排，右上角切换主题。
- 手机：首页太阳图标切换主题；底部切换俱乐部、选手与卡册。
- 选手页：名单/影像切换、排序，点击选手更新详情。
- 详情：切换卡面版本、标记喜欢、放大鉴赏；收藏只在当前预览有效。
- URL：`?theme=paper#home` 为浅色首页，`#squad` 为选手，`#detail` 为卡面。

原素材和游戏存档不受影响。`card-art.html` 为原有 v16 卡面派生文件，更新生成文件时运行：

```powershell
node 设计文档/UI原型/art-direction-01/build-assets.js
```

`verify-preview.cjs` 使用 Playwright + 本机 Edge 检查原型并输出截图。需在可解析 `playwright` 的环境中运行，同时保持静态服务启动。

当前未接入玩法、未实现 PWA 安装或离线。详细方向见 `docs/plans/2026-09-30-visual-foundation.md`。
