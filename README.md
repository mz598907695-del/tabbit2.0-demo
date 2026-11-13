# Tabbit 桌面交互演示

React + Vite + Tauri，桌面端使用 macOS WebKit。

```sh
npm install
npm run tauri dev    # 桌面应用，前端 http://localhost:1420
npm run dev          # 仅浏览器预览
npm run check        # 源码卫生、行为回归、类型和构建
npm test             # 仅行为回归
npm run build        # TypeScript 检查和前端构建
npm run release:update # 生成带应用内更新的安装包、签名更新包及版本清单（不上传）
```

- [界面 DOM、样式与交互代码索引](docs/ui-code-map.md)：从页面元素找到实际负责的文件。
- [本轮代码 review 与性能验证](docs/code-review-2026-11-08.md)：清理范围、前后对比与保留项。
- [颜色 token 调整记录](docs/color-token-adjustments.md)：共享颜色与模式的调整。
- [应用内更新与团队发布](docs/auto-updates.md)：GitHub Actions 发布入口、团队权限、签名凭据和本地验证。
- [安装包下载](https://github.com/mz598907695-del/tabbit-demo-updates/releases/latest)：公开的安装与更新文件，源码仍保存在私有仓库。

团队发布使用 Actions 中的 **Release desktop update**，选择 `main`，填写新版本和更新说明。默认只构建并验证，产物保存在私有仓库的工作流附件中；勾选 `publish` 后才会发布客户端更新。管理员配置好签名和跨仓库发布凭据后，源码仓库的 Write 成员即可运行，无需各自持有私钥。详见[团队发布说明](docs/auto-updates.md#团队发布)。

日常调试使用开发应用。普通本地打包会先通过 `capture:defaults` 捕获桌面开发环境的当前设置；团队工作流使用 `--bundled-defaults`，直接采用仓库中的演示默认设置。仅需检查前端时运行 `build`。

壁纸支持本地图片和静音循环视频：在“更多主题 → 我的”上传 MP4、MOV 或 WebM（100 MB 以内）；缩略图和自动亮暗使用视频封面。
