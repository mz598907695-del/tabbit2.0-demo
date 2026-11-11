# 动态壁纸切换的发布版崩溃

2026-11-10，安装版切换到「花影微光」出现 `SIGABRT`。四份 macOS
崩溃报告的异常线程都是 `tokio-rt-worker`；独立发布构建也复现了
`panic in a function that cannot unwind`，调试版同一流程没有退出。

## 原因与修复

WebKit 停止视频资源请求时可能抛出 Objective-C 异常，Wry 的自定义资源协议
已经使用 `objc2::exception::catch` 处理这类异常。但发布配置的 `panic = "abort"`
不允许异常经过相关 Rust 栈帧，导致异常到达捕获处理之前就终止进程。

将发布配置改为 `panic = "unwind"`，其余优化设置、视频素材和界面效果保持原样。
单独的 Cocoa 异常对照实验在 `abort` 下退出码为 134，在 `unwind` 下正常捕获并退出 0。

## 原生回归

```sh
cargo run --manifest-path src-tauri/Cargo.toml --locked --release --example macos_exception_smoke
```

这个检查必须用发布配置运行。普通 `cargo test` 会启用异常展开，无法覆盖原来的
发布配置缺陷。示例只主动触发并捕获一个 Cocoa 异常，不进入产品运行路径。

打包后的界面仍需验证视频之间的常规切换、首帧准备前的快速切换，以及「花影微光」
的循环播放；开发服务器和浏览器预览无法代替发布包的自定义资源协议验证。

本次验证：

- 上述原生 release 检查通过；42 项前端测试及构建通过。
- 独立发布窗口完成 12 次常规切换、24 次快速切换，然后继续播放「花影微光」16 秒，未退出。
- 最终两个视频均为 `ready`、正在播放、错误码 0，播放时钟差约 6 毫秒。
- 新 DMG 的完整性和包内应用的 `codesign --verify --deep --strict` 校验通过。

交付包以 `19c0d2b` 的界面代码为基础，仅加入原生修复；没有混入同时进行的前端调整。
