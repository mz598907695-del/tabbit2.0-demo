# 应用内更新

应用启动 15 秒后检查版本，此后每 4 小时检查一次。菜单「检查更新…」可随时触发。
发现新版本后先后台下载，验证成功才显示「重启更新」。点击前不安装、不重启。
更新替换应用程序，不清空 WebKit 的空间、壁纸、快捷方式和其他个人设置。
网页预览不访问原生更新接口；开发版只响应手动检查。

## 发布文件

```sh
npm run release:update
```

版本号在 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 中保持一致。
输出目录为 `release/<version>/`（不进入 Git），包含首次安装用 DMG、更新用 `.app.tar.gz`、
对应 `.sig` 以及 `latest.json`。macOS 应用先完成本地代码签名，再归档并签更新包，避免
对更新包签名后又修改应用导致签名失效。版本清单所写版本也必须匹配更新包的签名版本。
此脚本只生成文件，**不会上传或发布**。

签名私钥默认位置是 `~/.config/tabbit-demo-updater/signing.key`，权限为 600，目录权限 700。
私钥不在源码或安装包里。它是后续所有更新使用的长期凭据，不应当作为临时备份删除。
可以通过 `TABBIT_UPDATER_KEY_PATH` 或 Tauri 的签名环境变量指定其他位置。

## 下载托管

当前代码仓库为私有仓库，免登录客户端不能直接读取它的 Release。
公开资源仓库 [mz598907695-del/tabbit-demo-updates](https://github.com/mz598907695-del/tabbit-demo-updates)
只发布安装和更新文件，不发布源码。2026-11-11 已发布首个支持更新的版本 0.1.2，
原代码仓库继续保持私有。

应用检查地址：
`https://github.com/mz598907695-del/tabbit-demo-updates/releases/latest/download/latest.json`

发布时先上传当前版本的更新包，再上传对应签名和清单，全部完成后才把版本设为公开最新版本。
发布后用不带账号的请求核对下载地址，不能将个人访问令牌嵌入应用。
已获得发布授权时，使用以下命令上传四个白名单文件：

```sh
python3 scripts/publish-update.py --publish
```

脚本先检查版本与签名，建立草稿，核对 GitHub 返回的各文件 SHA-256，再公开该版本。
它不会上传源码，不会改变原代码仓库的私有状态，也不会替换已发布版本中内容不同的文件。
后续发布必须提高版本号，不能重新打包同版本后覆盖已发布内容。

正式托管地址也可以换成其他 HTTPS 对象存储；通过脚本 `--base-url` 参数生成对应下载清单，
并在首次分发支持更新的客户端之前同步修改配置中的检查地址。

已发出的 0.1.1 没有更新模块，需要先手动安装 0.1.2。后续更新必须提高版本号。
离线或检查失败不影响使用，启动检查失败保持安静，手动检查则显示重试入口。

## 验证

```sh
npm run test:updater
cargo check --locked --manifest-path src-tauri/Cargo.toml
```

`src-tauri/examples/updater_smoke.rs` 是独立原生探针，只接受回环地址或配置中的正式 HTTPS 地址，以及临时目录里的
`Tabbit Updater Smoke.app`。用真实的 Tauri 插件验证检查、下载、签名拒绝、版本绑定和安装。
回环 HTTP 只在探针自己的配置中开启，正式客户端仍然要求 HTTPS 和有效签名。
