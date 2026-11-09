# 界面代码索引

## 从 DOM 找文件

浏览器外框由 `src/App.tsx` 装配；工具栏、空间菜单及标签栏位于 `src/browser/`。新标签页从其中的 `NewTabPage` 进入 `src/personalized-home-2-0/index.jsx`。下列新标签页路径均相对于 `src/personalized-home-2-0/`。

```text
App.tsx                         浏览器工具栏、垂直标签栏、空间、内容区
└─ BrowserContent
   └─ .content-container       外部阴影、0.5px 内容区描边
      └─ .content-viewport     圆角裁切网页，外壳本身不裁切阴影
         └─ PersonalizedHome
            └─ AIWorkspace    内部侧栏、会话、任务等页面；共用一层图片/视频背景
               └─ .home-layout
                  └─ main.home
                     ├─ HomeBackground              旧插画/程序主题兼容（无壁纸播放器）
                     ├─ .tb-composer-scroll-glass    固定的滚动模糊层
                     ├─ HomeContent
                     │  └─ .home-scroll
                     │     └─ .home-content
                     │        ├─ .brand-toggle
                     │        └─ .home-feed
                     │           ├─ Composer → .tb-composer-frame（输入框 + 统一展开区域）
                     │           ├─ PromotionInlineCarousel（行内活动）
                     │           └─ WorkspaceBoard
                     │              ├─ .board-page-outgoing（过渡快照）
                     │              ├─ .board-page-preview（手势目标页）
                     │              └─ .board-grid（当前可编辑页）
                     │                 └─ BoardItem
                     │                    ├─ BoardItemContent → BoardCard（快捷方式/小组件共享表面）
                     │                    ├─ BoardItemLabel
                     │                    └─ 编辑/调整大小按钮
                     └─ HomeControls                主题按钮、分页、角落活动
```

主题设置通过 portal 放进外框的 `.browser-theme-panel-host`，与内容区左右排列。`App.jsx` 负责连接状态和回调，`ThemePanel.jsx` 负责设置面板与主题选择的 DOM，`DemoDialog.jsx` 负责结果/语音/活动演示弹窗。

## 样式归属

`styles.css` 是首页基础样式入口，不再堆放旧原型。基础布局、组件几何、材质分开管理；`index.jsx` 最后加载 `styles/home-surfaces.css`，它是**首页输入框、快捷方式、小组件与活动卡材质的统一入口**。

| 要调整的效果 | 文件 |
| --- | --- |
| 浏览器外框、内容区阴影/描边 | `src/App.css` |
| 共享亮暗颜色与描边 token | `src/styles/tokens.css`、`src/styles/semantic.css` |
| 首页字体、局部变量、基础重置 | `styles/base.css` |
| 首页宽度、定位、滚动、输入区锚点 | `styles/home-layout.css` |
| 壁纸裁切、过渡层与背景模糊 | `styles/home-background.css` |
| 默认 Logo 的滤镜、自定义 Logo 的尺寸 | `styles/brand.css` |
| 首页卡片填充、描边、阴影、背景模糊、深色提亮 | `styles/home-surfaces.css` |
| 快捷方式基础几何与图标 | `board/shortcut.css`、`board/resizable-shortcut.css` |
| 卡片栅格、拖拽、编辑按钮、切页层 | `board/WorkspaceBoard.jsx`、`board/workspace-board.css` |
| 拖拽预览的每帧合并与取消 | `board/frame-batch.js` |
| 小组件内部排版 | `board/widget-cards.css`、`board/utility-widget-cards.css` |
| 输入框控件 | `Composer.jsx`、`composer.css` |
| 天气壁纸的输入框装饰 | `ComposerWeather.jsx`、`composer-weather.css`；由 `App.jsx` 提供官方壁纸的 `weather` 标记。夜雨显示水珠，暮雪在顶边分段积起约 3px 薄雪，最多 14 秒后停止增长，其他壁纸不显示装饰 |
| 疾风街角的 LOGO 旋转 | `themes/useWindBrandMotion.js`、`themes/wind-brand-motion.js`；独立旋转层跟随现有壁纸视频时钟，中段阵风加速，隐藏及减少动态效果时暂停 |
| 项目/运行位置/审批浮层的定位、焦点和键盘 | `ComposerPopover.jsx` |
| 任务/加号/妙招/模型外层容器、展开与加号旋转 | `ComposerExpansion.jsx`、`composer-expansion.css` |
| 内嵌菜单的焦点、模型键盘导航 | `ComposerInlinePanel.jsx` |
| 任务栏按钮布局 | `task-mount.css` |
| 加号面板的引用列表、上传与双栏布局 | `ComposerAddMenu.jsx`、`composer-add-menu.css` |
| 输入框滚动收合与独立背景层几何 | `composer-scroll.css` |
| 行内活动的布局与内容动画 | `promotion-inline-carousel.css`、`PromotionInlineCarousel.jsx` |
| 角落活动的布局 | `promotion-card.css`、`promotion-carousel.css` |
| 主题按钮与首页角落工具 | `styles/home-controls.css` |
| 主题设置侧栏布局 | `themes/theme-sidebar.css` |
| 设置项目、主题缩略图、上传框、选中态 | `ThemePanel.jsx`、`overlays.css` |
| 内部导航与侧栏 | `ai-workspace/workspace-navigation.css`、`classic-sidebar.css` |
| 内部页面与宿主布局 | `ai-workspace/ai-workspace.css`、`host-workspace.css` |

内容库里的快捷方式和小组件也复用 BoardCard；首页输入框、会话页底部输入框与小组件 AI 对话页输入框共享同一材质规则，内容库内的生成输入框仍保留默认材质。首页材质在 `home-surfaces.css` 中收口；不要再往全局、Liquid Glass 文件或组件末尾添加同一张卡片的覆盖值。

### 当前材质值

| 表面 | 浅色 | 深色 |
| --- | --- | --- |
| 首页 / 对话页输入框 | 白色 80%，黑色 15% 的 0.5px 内描边 | 与快捷方式/小组件相同，聚焦时维持统一材质 |
| 快捷方式/小组件 | 白色 80%，0.5px token 描边 | `linear-gradient(#33333366, #3333334d)`，无外阴影 |
| 活动卡 | 输入框的基础材质 | 与快捷方式/小组件相同 |
| 深色卡片顶边光 | — | 0.5px，`rgba(255,255,255,.3)` |
| 深色卡片底边 | — | 0.5px，`rgba(255,255,255,.06)` |

深色主页表面的 `::before` 材质层使用 `brightness(1.5)`，浅色为 `brightness(1)`；背景模糊保留各自材质值，图片、图标和文字保持原亮度；`::after` 在背景上方绘制描边/边光，避免浅色内描边被 `::before` 的背景覆盖。展开更多、妙招或模型选择器时，下方卡片和标签维持原样。浅色 Liquid Glass 栅格保留 16px 模糊，不透明端点关闭采样。浅色输入框聚焦阴影通过局部变量变化，深色输入框聚焦时与卡片维持相同材质。

快捷方式、扩展快捷方式和小组件均使用 `board/BoardCard.jsx`。统一结构为 `.board-card > .board-card-content`：外层负责材质、边光和 hover；内层裁切图片并承载小组件尺寸查询。所有卡片效果只改 `styles/home-surfaces.css`，不再在小组件外层 article 额外画边光。 深色上下边光统一由 `--home-surface-edge` 的两个 inset 阴影绘制，叠在内容上方。

## 交互与数据

| 行为 | 文件 |
| --- | --- |
| 首页左右手势识别、原生阶段与触觉 | `usePageSwipe.js`、`page-swipe.js` |
| 卡片页位移、取消回弹、快照清理 | `board/useBoardPageMotion.js` |
| 当前卡片 DOM / 手势预览共享的内容 | `board/BoardItem.jsx`、`BoardItemContent.jsx`、`BoardPagePreview.jsx` |
| 卡片保存、撤销、投影与响应式列数 | `board/state.js`、`layout.js` |
| 批量编辑抖动 | `board/useBatchEditJiggle.js` |
| 输入框滚动折叠 | `useComposerScroll.js`、`composer-scroll.js` |
| 活动计时、暂停与恢复 | `promotion-clock.js` |
| 垂直标签栏中的空间切换 | `src/VerticalSpaceSwipe.tsx`、`src/spaceTransition.ts` |
| 手动主题切换渐变、媒体就绪交接 | `themes/useWallpaperSelectionTransition.js` |
| 主题选择与外观模式同步 | `App.jsx`、`themes/imageAppearance.js`、`themes/image-luminance.js` |
| 官方图片、名称与顺序 | `themes/officialWallpapers.js` |
| 已整理的官方主题 | `themes/officialWallpapers.js` 保存官方主题顺序；已移除的 4 款仅供旧空间解析，不在图库显示。临时排序/删除控件已移除 |
| 空间滑动时的亮暗过渡 | `themes/useSpaceAppearanceTransition.js`、`themes/spaceAppearanceTransition.js`、`themes/space-appearance-values.js`；文字 token、材质、模糊及描边随进度混合，取消时回退，提交后等待真实模式接管。`scripts/diagnostics/space-appearance.html` 独立验证双向、半程、取消、提交及打断，不修改真实空间设置 |
| 自定义图片/视频上传与 IndexedDB | `themes/useWallpapers.js`、`themes/wallpapers.js` |
| 视频封面生成、就绪等待 | `themes/wallpaper-video.js` |
| 视频空间首帧衔接 | `themes/wallpaperVideoPresentation.js` 等到实际视频帧后淡入；正常播放不挂图库封面，首帧显现完成前保留旧背景，点击切空间与手势共用就绪条件。帧回调仅在进入时运行，图库仍使用静态封面 |
| 视频静音循环、多层时间同步、隐藏暂停 | `themes/WallpaperMedia.jsx`、`themes/wallpaperVideoPlayback.js` |
| 全窗口壁纸定位、底部对齐 | `themes/useWindowWallpaperLayout.js`、`HomeBackground.jsx`、`themes/WallpaperMedia.jsx`、`themes/WallpaperImage.jsx` |
| 空间壁纸过渡与交接 | `themes/useSpaceWallpaperTransition.js`、`src/windowWallpaper.ts` |

图片和视频封面亮度按 64×64 采样、线性亮度与 alpha 加权计算，低于 `0.4` 使用深色模式。旧主题渲染器与旧图片查询保留，用于已经保存的空间；它们不是当前主题列表的入口。不要把保存兼容误当作废弃代码删除。

壁纸定位以整个新标签页 `.aiw-shell` 为基准，内部 AI 侧边栏展开、收起及调整宽度不改变图片的位置或缩放；各局部容器只裁切同一张窗口坐标画布。

## 切页与性能约束

- `board-grid` 和 `board-page-preview` 只做水平位移。给含有背景模糊卡片的祖先加 `opacity < 1`、`filter` 或对应的 `will-change`，会建立新的 backdrop root，让卡片丢失壁纸采样。淡化内容时使用独立绘制层。
- 手势开始读取一次页宽，后续移动不反复测量、也不逐事件触发 React 状态更新。目标页只在目标变化时创建，过渡完成必须清空预览与离场快照。
- 批量编辑动画只收集当前栅格，排除离场快照；非编辑状态不因卡片内容或预览挂载而启动动画帧。
- 快捷方式和小组件的 hover 在深浅模式统一为 1.06 倍、280ms 的轻微放大，填充和基础阴影维持默认态。只缩放卡片本身，名称和栅格位置不动；编辑、拖拽、切页和减少动态效果时不放大。
- 无进度条的行内活动使用截止时间定时器；只有角落活动的可见进度条使用逐帧更新。
- 隐藏页面与手势预览中的日历、日期卡不运行日期计时器；壁纸几何不变时不重复写样式和发布布局事件。

`npm run check` 统一执行未使用绑定检查、31 项行为回归以及类型与构建检查；行为测试覆盖活动计时、拖拽预览取消、图片亮度与壁纸读取/上传校验。

在开发应用调试台、首页可见且弹窗关闭时，可重复运行切页诊断（会切页并恢复原页）：

```js
await (await import('/scripts/diagnostics/home-swipe.js')).checkHomeSwipe({ cycles: 2 })
```

首页左右入口（主题、自定义面板 / 展开 AI 侧边栏）的填充和背景模糊与内部侧栏共用 `ai-workspace/host-workspace.css` 的同一组规则：浅色白色 15%、深色黑色 15%、blur(8px)。入口尺寸、描边和 hover 仍在 `styles/home-controls.css`。

对话页输入框材质也由 `styles/home-surfaces.css` 管理，通过共同的父容器选择器覆盖 `.home-feed`、`.aiw-conversation-footer` 和 `.widget-ai-chat-compose`，包含亮暗、激活态、背景与描边层；会话页自己的样式仅控制位置与宽度。

任务和加号菜单共享 `.tb-composer-frame` 的外层材质与 `ComposerExpansion`。首页在普通流中向下展开，对话页将展开区域锚定到输入框上方，输入框位置不动；加号打开时旋转 45°。面板内容按可用空间限制高度并支持滚动，宽度小于 480px 时加号面板改为单列。折叠动画期间内容 inert，结束后卸载，观察器与滚动监听仅在展开时启用。原有项目、运行位置、审批策略和引用选择逻辑保留，输入框不重新挂载。

输入框外层在展开时由 0 过渡到四周 6px 留白，圆角从 24px 同步过渡到 30px，耗时 320ms；收起时反向播放。留白通过背景层 inset 动画绘制，不改变输入框的尺寸和位置。

妙招和模型选择也使用同一个 `ComposerExpansion`，由 `ComposerInlinePanel` 统一面板容器、初始焦点和模型方向键导航。加号、妙招、模型互斥，关闭后在任务模式下恢复任务栏。模型在宽容器内每组两列、窄容器一列，多选切换和妙招管理入口保留在面板底部；不再使用原先的妙招/模型浮层及独立进出动画。桌面 WebKit 验证了 16 组亮暗/材质/方向状态、单选/多选/5 个模型上限、妙招搜索与应用，以及键盘焦点与关闭行为。

输入框外框填充：默认/图片外观复用 `--nine-color-fill-layer-strong`（浅色 rgba(17,25,37,.05)、深色白色 7%）；彩色外观使用当前色板颜色的 15% 透明度，通过局部 `--composer-frame-fill` 覆盖。颜色由 `App.jsx` 现有空间外观同步统一发布，返回默认或图片时移除覆盖；不改全局颜色 token。

对话/任务分段选择器的横向动画位于 `composer.css`：同一个 `::before` 底色层移动，按钮只绘制文字；深浅色与液态玻璃选中材质通过局部 `--composer-mode-fill` / `--composer-mode-shadow` 统一给底色层。输入框外框的 0.5px 描边同样由 `composer-expansion.css` 背景层绘制，使用描边 token 的 RGB、5% 透明度。

深色模糊材质的色带处理也统一在 `styles/home-surfaces.css`：背景层叠加 `asset/material-dither.png` 静态微噪点（128px、2/255 透明度、64px 平铺），用于打散渐变与提亮后的色阶断层。只作用于材质背景，不给文字/图标加噪点，也不增加 SVG 滤镜或运行时动画。

## 浏览器外框文件

| 职责 | 文件 |
| --- | --- |
| 窗口模式、空间与页面装配 | `src/App.tsx` |
| 工具栏、地址栏、书签栏 | `src/browser/BrowserToolbar.tsx` |
| 图标与 favicon 渲染 | `src/browser/BrowserIcons.tsx` |
| 空间入口与菜单 | `src/browser/SpaceMenu.tsx` |
| 水平标签、分组与拖拽 | `src/browser/HorizontalTabs.tsx` |
| 垂直标签、筛选、定位与预览 | `src/browser/VerticalTabs.tsx` |
| 共享空间 context | `src/browser/SpaceContext.tsx` |
| 标签种子数据、会话布局缓存 | `src/browser/tabs-data.ts` |

整理范围、实际性能对比与验证边界见 [项目 review 记录](code-review-2026-11-08.md)。

## 视频壁纸

“更多主题 → 我的”的上传入口同时接收图片及 MP4 / MOV / WebM 视频。图片保持 20 MB 限制，视频为 100 MB；校验文件头并通过实际解码后保存原始字节。视频实际呈现后截取 JPEG 封面，同视频 Blob 一起存入现有 IndexedDB；不改变数据库版本或旧图片记录。

完整背景统一由 `WallpaperMedia` 选择图片或视频：图片继续使用透明边距裁切逻辑，视频使用 `cover`、水平居中与底部对齐。视频强制 `muted`、`volume=0`、`loop`、`autoPlay`、`playsInline`，不显示控制条。浏览器外框一份播放器，标签页的 `AIWorkspace` 底层一份播放器，首页和内部侧栏共用后者；`HomeBackground` 只保留旧插画/程序主题，不再重复创建图片或视频。两份播放器按 URL 共享播放时钟，依靠媒体事件校准，无逐帧 JS 动画循环；隐藏区域/后台暂停，重新显示时与仍在播放的副本同步。卸载释放解码器，删除/退出时同时回收视频和封面的 object URL。

主题列表及色板入口使用静态封面；亮暗模式按封面一次判定，阈值继续为 0.4，不随视频每一帧变化。空间切换携带封面并等待视频解码出首帧后交接，预热只加载封面。

桌面 WebKit 验证了三种容器格式的保存/重新读取/删除、静音自动播放、实际循环、晚加入副本同步、隐藏/恢复、卸载清理及白色视频的浅色判定；四个副本的本机播放偏差低于 20ms。行为测试覆盖格式伪装、大小、解码失败、视频就绪、同步和监听释放。

视频播放器在布局 effect 的每次 setup 中恢复 `src`，再注册播放管理；cleanup 仍移除地址释放解码器。这样应用的 StrictMode 和热更新在同一 DOM 上重放清理/初始化时不会留下空播放器。开发应用选择视频后可运行实际生命周期回归：

```js
await (await import('/scripts/diagnostics/video-playback.js')).checkVideoPlayback()
```

封面生成先在文档内挂载静音临时播放器，seek 到代表帧，再等待视频帧呈现后截图；不能直接在 `loadeddata` 时截取 WebKit 尚未可绘制的硬件解码帧。默认截取前 1 秒内的画面；遇到全黑片头会继续尝试视频的 35% / 65% 位置。生成后移除临时播放器、帧回调和 object URL。`posterVersion` 标记生成版本，`refreshWallpaperVideoPoster` 自动修复旧封面；修复在后台逐个执行，更新封面地址而保留正在播放的视频地址与进度。写入前重新读取记录，避免把已删除的视频恢复。


主题切换通过 `useWallpaperSelectionTransition.js` 保留旧背景，在外框和标签页两层目标媒体解码就绪后共用 `--space-wallpaper-progress` 做 360ms 渐变；完成后保留目标媒体节点，只移除旧层。空间手势优先控制原来的进度，空间提交不会再播放一次手动渐变，减少动态效果时直接交接。

更多主题的官方、社区、我的列表各自保留 DOM 和滚动容器，通过 220ms 透明度过渡切换；非活动列表设置 inert / aria-hidden。返回同一分类不再自动滚回选中项，重新打开或选择新主题时才定位选中项。小封面预先加载，视频列表始终使用静态封面。

桌面端验证图片、视频、颜色之间的渐变、连续切换、分类过渡和滚动位置，可在开发调试台运行（使用不可见独立容器，不改当前主题）：

```js
await (await import('/scripts/diagnostics/theme-transitions.jsx')).checkThemeTransitions()
```


标签页播放器复用检查（桌面 WebKit 的独立文档，不写用户设置）同时覆盖真实 `AIWorkspace` / `HomeBackground` 的播放器数量、侧栏展开/收起不重建媒体、不改变壁纸位置、侧栏与卡片模糊、视频切换和旧解码器释放：

```js
await (await import('/scripts/diagnostics/theme-transitions.jsx')).checkSharedWallpaper()
```

稳定显示视频时总计两份播放器（外框 + 标签页），主题渐变期间会暂时保留新旧媒体，结束后回到两份。没有用 canvas 逐帧复制视频来替代浏览器播放，因此不会为此新增 JS 画帧循环。

## 切换任务的冲击波

- 入口：`Composer.jsx` 的 `useTaskShockwave.js` 在任务按钮的 pointerdown / Enter / 空格按下时先触发光环，再由 click 正常提交模式；模式监听为妙招/程序切换兜底，同一次切换不会重播。指针进入按钮只预载渲染模块，不截图、不启动 GPU。保留输入框和任务区现有布局/展开动画；首页、会话页及小组件对话页共用同一 Composer。
- 画面：`effects/task-shockwave.js` 按输入框中心定位，在 `.glass-surface`（独立展示时为文档视口）上叠加临时 canvas。按最新要求覆盖整个窗口，标签栏、工具栏、内外侧栏都参与，不再剔除工具栏。圆角跟随窗口外框，pointer-events 为 none。
- 原生截图：`src-tauri/src/shockwave.rs` 的 `capture_shockwave_content` 使用 WKWebView 自身的 snapshot API，仅截取传入内容矩形，使用当前已呈现的画面，不等待任务 UI 的下一次绘制；PNG 通过二进制 IPC 返回，不写文件、不申请全屏录制权限。像素比不超过 2、总像素不超过 400 万，3 秒超时；同区域快速触发复用尚未完成的截图。
- 渲染：`effects/shockwave-shader.js` 用一次 WebGL2 片元着色绘制极光四环、整体镜片弯折、小幅色散、侧边/底部折射及边缘扫光。描边使用单独的几何线条 mask，不把文字或图标当作描边提亮。镜片主体替换原图，避免透明叠加两份位移文字造成重影。光环先立即运行，不等待截图；原生截图就绪后在 100ms 内渐入弯折/色散，不重置波前。整体动画 1000ms，亮暗模式共用同一组紫粉配色与 40% 透明度。
- 生命周期：重选已选任务不重播；切回对话、键盘输入、指针操作、滚动、尺寸变化、隐藏和卸载会取消旧动画/迟到的截图。完成后移除画布、监听、RAF、mask 和纹理，并释放 WebGL 上下文；没有空闲帧循环。
- 降级：减少动态效果时不截图、不弯折/色散/描边扫光，只原地显示半强度 600ms 淡光。浏览器预览/非 macOS 或原生截图失败时保留彩色光环；无 WebGL2 时保持正常交互。

桌面调试台检查真实入口、原生截图、GPU 清理，以及独立文档中的严格模式、取消、草稿与减少动态效果行为：

```js
await (await import('/scripts/diagnostics/task-shockwave.js')).checkTaskShockwave()
```

数值与渲染预算行为测试位于 `scripts/tests/shockwave.test.mjs`；`shockwave-start.test.mjs` 验证截图未返回时先绘制、迟到截图不重播和取消后的资源释放；网页侧 `npm run check`，原生侧 `cargo check --offline`。


定值集中在 `effects/shockwave-settings.js`：1000ms、提亮 1.2、光带宽度 150px、弯折 14px、边缘折射 8px、色散 20%、smoothstep 扩散。亮暗模式都使用 `#af65ff → #7384ff → #c577ff → #ff96f5`，透明度统一 40%。描边扫光为 0，跳过描边 mask 的几何收集与上传。调试面板、入口、配色预设和临时会话参数存储已移除。
