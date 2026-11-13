# 应用内更新

应用启动 15 秒后检查版本，此后每 4 小时检查一次。菜单「检查更新…」可随时触发。
发现新版本后先后台下载，验证成功才显示「重启更新」。点击前不安装、不重启。
更新替换应用程序，不清空 WebKit 的空间、壁纸、快捷方式和其他个人设置。
网页预览不访问原生更新接口；开发版只响应手动检查。

## 团队发布

[Release desktop update](../.github/workflows/release-update.yml) 是手动触发的发布工作流，仅允许从源码仓库 `mz598907695-del/tabbit2.0-demo` 的 `main` 运行。目前生成 Apple Silicon Mac（`darwin-aarch64`）的安装包和更新包。

1. 打开源码仓库的 **Actions → Release desktop update → Run workflow**，分支选择 `main`。
2. 填写 `version` 和 `notes`。版本格式为 `X.Y.Z`，必须高于源码当前版本和已经公开的最新版本；不接受重复版本、`v` 前缀或预发布后缀。
3. `publish` 默认关闭：只构建、签名和验证，通过后可在该次运行的 **Artifacts** 下载私有产物，保留 7 天，客户端不会收到更新。
4. 要正式发布时启用 `publish`。工作流会在全部验证通过后，将产物上传到公开更新仓库，再检查客户端更新地址是否返回本次版本。以运行结果和实际更新地址为准，触发工作流本身不代表发布成功。

工作流使用 `macos-15` 并检查 runner 必须为 arm64。版本准备脚本只修改 runner 上的五个版本清单，不自动提交回源码仓库。构建使用 `--bundled-defaults`，采用仓库中的 `src/demo-defaults.json`，不读取发布者电脑的 WebKit 设置。构建后校验更新包签名、公钥、签名绑定版本和下载清单，并运行原生更新探针。

### 管理员配置一次，成员按权限发布

在**源码仓库**的 Actions secrets / variables 中配置下列凭据。团队成员拥有源码仓库 Write 权限即可手动运行已配置的工作流，无需复制签名私钥，也无需逐人拥有公开更新仓库的写权限。

| 类型 | 名称 | 用途 |
| --- | --- | --- |
| Secret | `TAURI_SIGNING_PRIVATE_KEY` | 原客户端对应的更新签名私钥，构建和发布均需要。必须继续使用原密钥。 |
| Secret（按需） | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 私钥有密码时填写。 |
| Variable | `TABBIT_RELEASE_APP_ID` | 推荐使用的发布 GitHub App ID。 |
| Secret | `TABBIT_RELEASE_APP_PRIVATE_KEY` | 上述 GitHub App 的私钥，与更新签名私钥是两种不同凭据。 |
| Secret（替代 App） | `TABBIT_RELEASE_TOKEN` | 限定公开更新仓库且具有 Contents: Read and write 权限的 fine-grained token。 |

跨仓库发布凭据采用以下一种方式：

- **GitHub App（推荐）**：将 App 安装到 `mz598907695-del/tabbit-demo-updates`，授予 Contents: Read and write。工作流使用 App ID 和 App 私钥生成仅针对该更新仓库的短期令牌。
- **Fine-grained token**：当前更新仓库属于个人账号，由仓库所有者 `mz598907695-del` 创建，只选择 `tabbit-demo-updates`，授予 Contents: Read and write，保存为 `TABBIT_RELEASE_TOKEN`。GitHub 目前不支持协作者用自己的 fine-grained token 向他人的个人仓库贡献，详见 [GitHub 的限制说明](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#fine-grained-personal-access-tokens-limitations)。

源码仓库自动提供的 `GITHUB_TOKEN` 只用于读取源码仓库，不能向另一个仓库发布 Release。给某位成员更新仓库的写权限后，该成员可用自己的本地凭据发布；Actions 仍需配置上述跨仓库凭据之一。只构建时不需要跨仓库发布凭据。

签名私钥不放进 Git、安装包或工作流附件。已有客户端使用配置中的公钥验证更新，团队发布继续保留该公钥和原更新检查地址；更换发布账号或使用 GitHub App 不需要更换客户端签名密钥。

## 本地构建与发布

```sh
node scripts/prepare-release-version.mjs --version 0.1.10
npm run release:update -- --bundled-defaults --notes '本次更新说明'
node scripts/verify-update-artifacts.mjs --version 0.1.10
```

以上版本号仅为示例，请选用高于当前源码和已发布版本的新版本。本地版本准备脚本会同步修改 `package.json`、`package-lock.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 和 `src-tauri/Cargo.lock` 中的应用版本；依赖版本保持不变。任何现有版本不一致或输入版本不递增时，脚本会拒绝修改。

输出目录为 `release/<version>/`（不进入 Git），包含首次安装用 DMG、更新用 `.app.tar.gz`、
对应 `.sig` 以及 `latest.json`。macOS 应用先完成本地代码签名，再归档并签更新包，避免
对更新包签名后又修改应用导致签名失效。版本清单所写版本也必须匹配更新包的签名版本。
`release:update` 只生成文件，**不会上传或发布**。省略 `--bundled-defaults` 时，普通本地打包会先捕获桌面开发环境的当前设置。

签名私钥默认位置是 `~/.config/tabbit-demo-updater/signing.key`，权限为 600，目录权限 700。
私钥不在源码或安装包里。它是后续所有更新使用的长期凭据，不应当作为临时备份删除。
可以通过 `TABBIT_UPDATER_KEY_PATH` 指定其他文件位置，或使用 `TAURI_SIGNING_PRIVATE_KEY` 和可选的 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 环境变量。

本地发布者需要对源码仓库有读取权限、对公开更新仓库有写权限。发布脚本支持 `TABBIT_RELEASE_TOKEN`（公开更新仓库）与 `GITHUB_TOKEN`（源码仓库）分别授权，也支持一个可访问两个仓库的 `GH_TOKEN`，缺省时尝试 Git credential helper。使用 GitHub CLI 登录的成员可以将自己的令牌传给单次发布命令：

```sh
GH_TOKEN="$(gh auth token)" python3 scripts/publish-update.py --version 0.1.10 --validate-only
GH_TOKEN="$(gh auth token)" python3 scripts/publish-update.py --version 0.1.10 --publish
```

`--validate-only`（别名 `--dry-run`）只检查产物、仓库状态和权限，不创建或修改 Release。只有 `--publish` 才上传并公开更新。

## 下载托管

当前代码仓库为私有仓库，免登录客户端不能直接读取它的 Release。
公开资源仓库 [mz598907695-del/tabbit-demo-updates](https://github.com/mz598907695-del/tabbit-demo-updates)
只发布安装和更新文件，不发布源码。2026-11-11 已发布首个支持更新的版本 0.1.2，
原代码仓库继续保持私有。

应用检查地址：
`https://github.com/mz598907695-del/tabbit-demo-updates/releases/latest/download/latest.json`

发布时先上传当前版本的更新包，再上传对应签名和清单，全部完成后才把版本设为公开最新版本。
发布后用不带账号的请求核对下载地址，不能将个人访问令牌嵌入应用。
发布脚本只上传四个白名单文件，先检查版本与签名，建立草稿，核对 GitHub 返回的各文件 SHA-256，再公开该版本。
它不会上传源码，不会改变原代码仓库的私有状态，也不会替换已发布版本中内容不同的文件。
后续发布必须提高版本号，不能重新打包同版本后覆盖已发布内容。

构建脚本的 `--base-url` 可以为其他 HTTPS 对象存储生成下载清单，但当前团队发布流程固定使用上述更新仓库。已有客户端的检查地址必须继续可用，不能只修改新版本配置就切断旧客户端的更新入口。

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
