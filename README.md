# VAL MANAGER

组建五人阵容，进行地图BP与战术调整，完成一个电竞赛年。

手机试玩：[https://gene-sophen.github.io/val-manager/](https://gene-sophen.github.io/val-manager/)。Android可从浏览器菜单安装；iPhone用Safari打开后通过“分享→添加到主屏幕”。首次联网等待资源准备完成再离线使用，建议使用Wi-Fi。

当前新赛年使用九图空间引擎，默认观战2×。玩家操作包括选主队、三个初始包逐张揭晓、选一包选五人、赛前地图/特工/战术、暂停/中场和两次补强。进行中的旧赛年保留原模型。

存档保存在当前设备和站点的浏览器内，不会随GitHub同步；换设备可在设置导出/导入备份。关闭或清除浏览器数据前请自行备份。

本地启动静态服务器后打开`设计文档/UI原型/complete-prototype-01/index.html`。运行`node 游戏/build-spatial.cjs`重建同源引擎，`node 游戏/build-pages.cjs`生成独立`_site`发布目录；目录已存在时构建拒绝覆盖。GitHub Actions在main更新后校验并部署GitHub Pages，只发布运行资源，不发布测试存档、诊断输出或原始数据网页。

设计与范围见[当前设计](设计文档/01_当前设计/当前完成情况与剩余工作.md)，工程闭环见[验收记录](docs/validation/2026-10-08-spatial-campaign.md)。自选组队与联机是后续模式；部分海外数据代理、长期阵容平衡与续局重演性能仍待迭代。

2026-10-09手机版更新：三栏导航、两列BP与明确选边、WebP小尺寸资源、同步品质揭晓、关键分沙盘/普通分战报、单分推进及保存后安全更新。398项回归通过，见[手机验收](docs/validation/2026-10-09-mobile.md)。
