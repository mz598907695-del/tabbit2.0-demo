# Tabbit 桌面交互演示

React + Vite + Tauri，桌面端使用 macOS WebKit。

```sh
npm install
npm run tauri dev    # 桌面应用，前端 http://localhost:1420
npm run dev          # 仅浏览器预览
npm run check        # 源码卫生、行为回归、类型和构建
npm test             # 仅行为回归
npm run build        # TypeScript 检查和前端构建
```

- [界面 DOM、样式与交互代码索引](docs/ui-code-map.md)：从页面元素找到实际负责的文件。
- [本轮代码 review 与性能验证](docs/code-review-2026-11-08.md)：清理范围、前后对比与保留项。
- [颜色 token 调整记录](docs/color-token-adjustments.md)：共享颜色与模式的调整。

日常调试使用开发应用。打包会先通过 `capture:defaults` 捕获桌面开发环境的当前设置；仅需检查前端时运行 `build`。

壁纸支持本地图片和静音循环视频：在“更多主题 → 我的”上传 MP4、MOV 或 WebM（100 MB 以内）；缩略图和自动亮暗使用视频封面。
