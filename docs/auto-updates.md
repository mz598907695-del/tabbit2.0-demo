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

## 团队通过 GitHub Actions 发布

源码仓库的 Actions → **Release macOS** → **Run workflow**，分支选择 `main`：

1. 填写新的稳定版本号（例如 `0.1.10`，必须高于当前公开版本）和更新说明。
2. 保持“验证通过后公开发布”勾选，运行后会检查源码、构建 Apple Silicon 安装包、用原私钥签名，并通过真实原生更新探针验证下载、安装、错误签名和版本绑定。
3. 全部通过后才上传公开更新仓库。取消勾选则只构建验证，产物保留在本次运行的 Artifacts 中 14 天。

此入口只支持手动触发，提交代码不会自动发版。同一时间只执行一个发布任务。
版本号会同步到 CI 临时检出的前端、Tauri 和 Cargo 配置，不修改开发者工作区、不自动提交或打 Git 标签。
构建使用仓库中已提交的 `src/demo-defaults.json`，不会抓取开发者电脑上的个人设置。

在**源码仓库**的 Settings → Secrets and variables → Actions 配置：

| Secret | 内容 |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | 原有 `signing.key` 文件的完整内容，必须匹配客户端内置公钥 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 私钥密码；当前私钥无密码，可留空或不创建 |
| `TABBIT_RELEASE_TOKEN` | 由 `mz598907695-del` 创建的 fine-grained PAT，仅选择 `tabbit-demo-updates`，授予 `Contents: Read and write` |

`TABBIT_RELEASE_TOKEN` 不需要访问私有源码仓库。工作流通过临时的、只读的 `GITHUB_TOKEN` 检查源码仓库，发布脚本通过 `TABBIT_SOURCE_TOKEN` 接收它。
PAT 到期前需替换对应 Secret。创建后直接存入仓库 Secret，不写进源码、更新包或日志。
