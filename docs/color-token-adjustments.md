# 颜色 Token 调整台账

## composer-task-controls

- 应用位置：输入框上方任务挂载行的“选择项目”和“云端／本地”按钮
- Hover 填充：复用 `--nine-color-fill-layer-strong` 的 RGB，透明度固定为 `5%`，随亮暗模式变化
- 按钮：图标 `14px`、文字 `12px`、图文间距 `4px`、高度 `24px`、左右内边距 `6px`
- 行容器：左右内边距 `0`，与输入框间距 `6px`
- 外框：仅任务模式顶部圆角 `16px`；底部及其他模式圆角沿用原值
- 实现文件：`src/personalized-home-2-0/task-mount.css`、`src/personalized-home-2-0/composer-expansion.css`

## app-icon-default-browser-link

- 应用位置：应用图标标题旁“设置为默认浏览器”链接文字
- 默认外观与图片主题：复用 `--nine-color-action-primary-text` → `--color-blue-6`（B6）；亮色 `#005ba6`，深色 `#a6daff`
- 彩色主题：分别复用 orange / yellow / green / cyan / blue / purple / hotpink 的 6 级 Token，随亮暗模式自动变化；通过空间色板的 `linkColor` 映射使用
- Hover：仅增加下划线，颜色保持相同等级；后缀“，即可解锁”仍使用原提示文字色
- 实现文件：`src/spaceColors.ts`、`src/personalized-home-2-0/ThemePanel.jsx`、`src/personalized-home-2-0/overlays.css`

## homepage-shared-tile-surface

- 语义：首页快捷方式与小组件的统一容器表面（图片小组件也使用同一外框）；深色活动卡片复用同一套材质
- 填充：亮色与首页对话输入框共用 `--home-content-surface-fill`，值为 `rgba(255, 255, 255, 0.8)`；深色在看板内局部覆盖为 `linear-gradient(#33333366, #3333334d)`
- 描边：亮色使用 `--home-card-outline` → `.5px solid --nine-color-border-alpha-subtle`；深色关闭额外描边，快捷方式、小组件和活动卡片统一使用 `--widget-edge-light`（20% 白色）绘制顶部 0.5px 内高光，位于图片之上
- 默认阴影：亮色为 `0 2px 4px -2px rgba(0, 0, 0, 0.04)`；深色为 `none`
- Hover 阴影：亮色沿用 `--tile-hover-shadow`；深色与默认态相同
- 背景模糊：深色固定 `blur(30px) saturate(100%)`；亮色普通模式 30px，玻璃模式 16px
- 尺寸与形状：保留各自圆角与布局
- 下拉淡化：保留淡化反馈；使用现有页面背景 token 的独立覆盖层（70%）及文字 30%，不再降低整个看板 opacity；面板退场结束后恢复，避免背景模糊重新合成闪烁
- 应用范围：`.home .workspace-board` 中 `.shortcut-icon`、`.board-widget-card`；深色模式下还包括 `.promotion-inline-carousel`、`.corner-promotion .promotion-card`
- 实现文件：`src/personalized-home-2-0/styles/home-surfaces.css`

## composer-dropdown-controls

- 应用范围：对话输入框“加号 / 妙招”搜索框及模型菜单开关
- 搜索框默认描边：复用 `--nine-color-border-alpha-regular`，`1px` 内描边
- 搜索框激活描边：亮色黑色 `40%`；深色白色 `40%`，保留 `1px` 内描边
- 模型开关关闭轨道：`--nine-color-fill-layer-strong`，与自定义面板开关一致
- 模型开关开启轨道：现有 `--accent`，跟随空间主题标准色，默认蓝色
- 开启态圆点：`--nine-color-action-primary-on`（固定白色）；深色关闭圆点：`--nine-color-text-title`（白色）；亮色关闭圆点保留基础容器填充
- 实现文件：`src/personalized-home-2-0/composer.css`

## dark-page-scrollbar

- 语义：深色页面原生滚动条
- 深色根节点：`color-scheme: dark`，修正原来始终使用浅色原生控件的问题
- 默认滑块颜色：复用 `--nine-color-text-disabled`，深色为 `rgba(255, 255, 255, 0.35)`；轨道透明
- 应用范围：继承默认滚动条颜色的页面滚动容器；组件自身显式配置的滚动条颜色和隐藏策略保留
- 实现文件：`src/App.css`

## home-logo-standard-color

- 应用位置：首页随空间标准色显示的 LOGO `.brand-mark-tinted`
- 深色颜色透明度：`80%`，使用 `color-mix(in srgb, var(--brand-mark-color) 80%, transparent)`
- 亮色颜色透明度：保留 `50%`；滚动淡出动画保留
- 实现文件：`src/personalized-home-2-0/styles.css`

## tab-radius-preference

- 设置位置：外观 → 布局 → 标签页大圆角
- 默认开启：沿用 `--tab-radius: 999px`
- 关闭：`--tab-radius: 10px`
- 应用范围：横向／垂直标签页、分组与拖拽预览、新标签页按钮、垂直标签栏搜索框等复用 `--tab-radius` 的标签栏控件
- 设置保存：现有 `personalized-home-2-0-preferences` 中的 `largeTabRadius`，旧配置默认开启
- 实现文件：`src/App.css`、`src/personalized-home-2-0/preferences.js`、`src/personalized-home-2-0/App.jsx`、`src/personalized-home-2-0/Overlays.jsx`

## sidebar-upgrade-text

- 应用位置：对话页侧边栏“立即升级”按钮 `.aiwc-upgrade`
- 文字颜色：复用 `--nine-color-text-fixed-black`，亮暗模式均为纯黑色
- 实现文件：`src/personalized-home-2-0/ai-workspace/classic-sidebar.css`

> 本文件记录当前对话中确认的颜色 Token 调整。最终 Token 文件应以“最终确认”项为准，并保留语义与应用映射。

> 规则：默认优先复用现有 Token；只有用户明确要求“新增 Token”时才创建新的专用 Token。

> 最终整理规则：全部调整完成后，统一核对颜色值、亮暗模式与应用语义；相同且可以共用的项目合并为一条 Token，再输出最终 Token 文件和应用映射。

## container-fill

- 语义：全局页面容器遮罩
- 模式：深色模式
- 状态：已确认
- 原值：`linear-gradient(180deg, rgb(31 32 32 / 85%), rgb(31 32 32 / 0%) 99%)`
- 新值：`linear-gradient(rgba(34, 34, 34, 0.85), rgba(25, 25, 25, 0.2))`
- 基础 Token：`--color-bg-global-mask`
- 语义 Token：`--nine-color-bg-global-mask`
- 应用位置：`src/App.css` 中 `.container-fill`，通过模式覆盖后的 Token 自动取值
- 当前应用：深色模式下覆盖浏览器内容容器的全局渐变遮罩
- 亮色模式：保持 `linear-gradient(180deg, rgba(245, 245, 245, 0.85), #f5f5f500 99%)` 不变
- 更正记录：此前误记为 `bg-overlay`，该改动已撤回

## tab-selected-background

- 语义：标签栏选中态背景
- 模式：亮色模式、深色模式
- 状态：已确认
- 原值：`rgba(255, 255, 255, 0.94)`，亮暗模式共用硬编码值
- 新值：`var(--nine-color-fill-tab-selected)`
- 基础 Token：`--color-fill-tab-selected`
- 语义 Token：`--nine-color-fill-tab-selected`
- 亮色模式：保持原视觉值 `rgba(255, 255, 255, 0.94)`
- 深色模式：`rgba(224, 224, 224, 0.3)`
- 应用位置：水平标签选中态、垂直标签选中态、标签组选中态
- 实现文件：`src/App.css`
- 保留效果：原有选中态阴影与文字样式不变
- 交互状态：垂直标签组选中后 hover 继续使用本 Token，不再被硬编码白色覆盖
- 选中态内描边：亮色保持 `rgba(0, 0, 0, 0.08)`；深色水平标签、水平标签组和拖拽容器统一为 `rgba(255, 255, 255, 0.15)`
- 垂直选中态内描边：深色仍保持 `rgba(255, 255, 255, 0.08)`
- 拖拽状态：拖拽预览容器和拖拽附着状态下的分组容器均使用 `--nine-color-fill-tab-selected`；深色内描边同步为白色 `0.15`
- 拖拽圆角：普通标签和标签组的拖拽预览统一使用最大圆角 `999px`
- 既有 Token：`--color-fill-a4` / `--nine-color-fill-floating` 未修改

## new-tab-icon

- 语义：标签项中的新标签页图标颜色
- 模式：亮色模式、深色模式
- 状态：已确认
- 颜色依据：一级标题颜色
- 使用现有语义 Token：`--nine-color-text-title`
- 亮色模式：`rgba(0, 0, 0, 1)`
- 深色模式：`rgba(255, 255, 255, 1)`
- 应用位置：水平标签、垂直标签、所有标签页列表及拖拽预览中的新标签页图标
- 实现方式：原 SVG 内部写死黑色，现仅针对该图标改用 SVG mask，以 `--nine-color-text-title` 作为填充色
- 未改变：水平与垂直标签栏的“新增标签”加号按钮保持原有颜色
- 实现文件：`src/App.css`
- 更正记录：曾误改“新增标签”加号按钮，现已恢复并应用到正确的新标签页标签图标

## tab-group-title

- 语义：标签栏分组名称文字颜色
- 状态：已确认
- 使用现有语义 Token：`--nine-color-text-title`
- 应用位置：水平标签栏分组名称、垂直标签栏分组名称
- 未改变：分组数量和展开箭头继续使用原有辅助文字颜色
- 实现文件：`src/App.css`

## tab-unselected-title

- 语义：未选中标签页文字颜色
- 状态：已确认
- 使用现有语义 Token：`--nine-color-text-title`
- 应用位置：水平标签栏、垂直标签栏的未选中标签页标题
- 选中态：颜色保持一致，通过选中背景和 `font-weight: 500` 区分
- 实现文件：`src/App.css`

## grouped-tab-unselected-hover

- 语义：水平分组内部未选中标签的 Hover 背景
- 状态：已确认
- 深色模式：使用现有 `--nine-color-fill-layer-strong`，实际值为 `rgba(255, 255, 255, 0.07)`
- 深色内阴影：移除
- 亮色模式：保持原来的 `rgba(255, 255, 255, 0.4)` 与 `0.5px #fff` 内阴影不变
- 拖拽状态：继续保持透明背景且无阴影
- 实现文件：`src/App.css`

## horizontal-tab-group-container

- 语义：水平标签栏分组容器背景与内描边
- 状态：已确认
- 深色背景：使用现有 `--nine-color-fill-layer-strong`，实际值为 `rgba(255, 255, 255, 0.07)`
- 深色 Hover 背景：`rgba(255, 255, 255, 0.1)`
- 深色内描边：`0 0 0 0.5px rgba(255, 255, 255, 0.15) inset`
- 应用位置：普通分组容器、拖拽附着状态的分组容器
- 亮色模式：保持原样
- 选中状态：继续使用标签选中态背景与白色 `0.08` 内描边
- 实现文件：`src/App.css`

## horizontal-space-entry

- 语义：水平标签栏空间入口内阴影与描边
- 状态：已确认
- 深色样式：`0 0 4px rgba(255, 255, 255, 0.3) inset, inset 0 0 0 var(--border-thin) var(--nine-color-border-alpha-subtle)`
- 亮色模式：保持原来的黑色 `0.1` 内阴影与语义描边
- 单空间入口：保持原有无阴影状态
- 实现文件：`src/App.css`

## address-field-active

- 语义：地址栏输入框激活填充
- 状态：已确认
- 使用现有语义 Token：`--nine-color-border-alpha-subtle`
- 亮色模式：`rgba(17, 25, 37, 0.1)`
- 深色模式：`rgba(255, 255, 255, 0.12)`
- Hover 状态：保持原有 `--color-fill-a3` 不变
- 实现文件：`src/App.css`

## chat-entry-content

- 语义：Chat 入口图标与文字颜色
- 状态：已确认
- 使用现有语义 Token：`--nine-color-text-title`
- 实现方式：文字继承按钮颜色；图标通过 `currentColor` 使用相同颜色
- 亮色模式：黑色
- 深色模式：白色
- 实现文件：`src/App.css`、`src/App.tsx`

## page-content-container

- 语义：页面内容区背景与内描边
- 状态：已确认
- 深色背景：`rgba(20, 20, 20, 0.85)`
- 深色内描边：`0 0 0 0.5px rgba(255, 255, 255, 0.12) inset`
- 深色外阴影：`0 1px 3px rgba(0, 0, 0, 0.3)`
- 应用位置：水平、垂直布局的页面内容容器，包含新标签页内容容器
- 亮色模式：保持原样
- 实现文件：`src/App.css`

## organize-tabs-center-icon

- 语义：智能标签图标中间星形颜色
- 状态：已确认
- 使用现有语义 Token：`--nine-color-text-title`
- 保留内容：外围绿色、蓝色和橙色图形保持原色
- 应用位置：空间入口、智能标签整理菜单入口
- 实现方式：在原图标上叠加星形 mask，以一级标题颜色填充
- 实现文件：`src/App.css`、`src/App.tsx`、`src/assets/organize-tabs-center.svg`

## space-menu-action-icons

- 语义：空间面板单色功能图标颜色
- 状态：已确认
- 使用现有语义 Token：`--nine-color-text-title`
- 已接入图标：切换水平/垂直标签栏、收起所有标签组、展开所有标签组
- 已有 IconFont：继续继承菜单文字颜色
- 保留原色：彩色空间头像和智能标签图标外围彩色图形
- 实现方式：将原本写死黑色的 SVG 改为 mask，以一级标题颜色填充
- 实现文件：`src/App.css`、`src/App.tsx`

## dropdown-surfaces

- 语义：所有公共下拉面板的深色表面与特效
- 状态：已确认
- 深色填充：`rgba(27, 27, 27, 0.85)`
- 深色特效：`0 0 0 0.5px rgba(255, 255, 255, 0.2) inset, 0 4px 12px 0 rgba(0, 0, 0, 0.3), 0 -1px 2px 0 rgba(0, 0, 0, 0.3)`
- 深色外描边：`1px solid rgba(0, 0, 0, 0.5)`
- 应用基类：`.dropdown-panel`、`.dropdown-surface`
- 应用范围：空间菜单、标签列表、空间图标选择、AI 筛选/历史菜单、编辑器添加/妙招/模型/任务菜单
- 排除：嵌入式透明菜单保持无背景、无阴影、无外描边；右键菜单属于独立组件族
- 亮色模式：保持原样
- 实现文件：`src/styles/dropdown.css`

## customize-panel-card-surface

- 语义：自定义面板内部卡片统一表面
- 状态：已确认
- 亮色填充：`rgba(255, 255, 255, 0.6)`
- 深色填充：`rgba(255, 255, 255, 0.12)`
- 描边：`.5px solid var(--nine-color-border-alpha-subtle)`，使用弱透明线条 token（亮色为 10%）
- 统一范围：常规设置卡片、主题深浅选择卡片、应用图标选中卡片、官方主题选中卡片
- 应用图标与“更多主题”选中卡片例外：深色模式填充统一为 `rgba(255, 255, 255, 0.3)`；亮色继续使用统一卡片填充
- 应用图标 Hover 容器：`--nine-color-fill-layer-strong`（5% 语义 token）
- “更多主题”卡片 Hover 容器：`--nine-color-fill-layer-strong`（5% 语义 token）
- “更多主题”返回按钮：图标使用 `--nine-color-text-title`，默认填充改为透明，保留原描边；Hover 使用 `--nine-color-fill-layer-strong`
- 背景模糊与各卡片原有圆角保持不变
- 实现文件：`src/personalized-home-2-0/overlays.css`

## customize-panel-toggle-colors

- 语义：自定义面板开关组件颜色
- 状态：试调中
- 未开启轨道：`--nine-color-fill-layer-strong`
- 开启轨道：使用现有 `--accent` 跟随空间标准色；默认预置回退 `--nine-color-action-primary`（品牌蓝），其他预置使用 `spaceColors[].color`，不使用染色透明度
- 开启态圆形滑块：`--nine-color-action-primary-on`（白色）
- 圆形滑块：`--nine-color-fill-container-base`
- 深色未开启滑块：改用 `--nine-color-text-title`（白色），避免在深色轨道上不可见；开启态滑块使用白色 token
- 聚焦描边继续使用 `--nine-color-border-alpha-regular`，滑块阴影暂不修改
- 实现文件：`src/personalized-home-2-0/overlays.css`

## theme-control-accent

- 语义：开关、单选框选中态跟随空间主题色
- 复用现有 `--accent`；默认颜色使用 `--nine-color-action-primary`，其他空间预置使用对应标准色 `spaceColors[].color`
- 应用范围：自定义面板开关、外观深浅选择单选框、模型菜单开关与选择标记；首页及独立挂载的外观面板同步
- 白色滑块保留；不受主框架染色浓度控制
- 实现文件：`src/personalized-home-2-0/App.jsx`、`src/personalized-home-2-0/overlays.css`、`src/personalized-home-2-0/composer.css`

## home-panel-entry-buttons

- 语义：首页 AI 侧边栏入口与自定义面板入口按钮
- 状态：已确认
- 默认填充：`transparent`
- 描边：保留 `.5px solid var(--nine-color-border-alpha-regular)`
- Hover 填充：`--nine-color-fill-layer-strong`（5% 语义 token）
- 应用位置：`.aiw-launcher`、`.theme-button`
- 实现文件：`src/personalized-home-2-0/styles.css`

## common-segmented-tabs

- 语义：通用胶囊形 Tab／分段选择器
- 状态：试调中
- 亮色模式：保持现有样式
- 深色容器填充：`rgba(0, 0, 0, 0.35)`
- 深色选中态填充：`rgba(255, 255, 255, 0.12)`
- 深色选中态特效：`0 4px 12px 0 rgba(0, 0, 0, 0.1), 0 -1px 2px 0 rgba(0, 0, 0, 0.1), 0 0 1px 0.5px rgba(255, 255, 255, 0.12) inset`
- 首页对话框“对话 / 任务”Tab 项水平内边距：左右各 `12px`
- 首页对话框“对话 / 任务”Tab 项宽度：根据文字内容自适应，不再等分拉伸；其他位置不修改尺寸
- 当前统一范围：“更多主题”分类 Tab、自定义设置中的分段选择器、内容添加对话框 Tab、首页对话框“对话 / 任务”Tab、对话页侧边栏来源 Tab
- 实现文件：`src/personalized-home-2-0/overlays.css`、`src/personalized-home-2-0/composer.css`、`src/personalized-home-2-0/themes/wallpaper-contrast.css`、`src/personalized-home-2-0/board/board-dialogs.css`、`src/personalized-home-2-0/ai-workspace/classic-sidebar.css`

## modal-outline

- 语义：空间创建、编辑、删除弹窗表面与特效
- 状态：已确认
- 亮色模式：继续使用现有 `--nine-color-fill-floating` 与 `--nine-color-border-alpha-regular`，其余效果保持原样
- 深色填充：与下拉面板一致，`rgba(27, 27, 27, 0.85)`；最终整理时合并同色填充
- 深色特效：`0 0 0 1px rgba(255, 255, 255, 0.2) inset, 0 4px 12px 0 rgba(0, 0, 0, 0.3), 0 -1px 2px 0 rgba(0, 0, 0, 0.3)`；阴影与下拉面板一致，弹窗内描边按后续要求为 `1px`
- 深色外描边：`1px solid rgba(0, 0, 0, 0.5)`，与下拉面板一致
- 遮罩与圆角：保持弹窗自身样式，不随下拉面板修改
- 应用位置：空间创建、编辑、删除弹窗共用基类 `.delete-space-dialog`
- 实现文件：`src/DeleteSpaceDialog.css`

## modal-action-buttons

- 语义：空间弹窗普通主按钮与次要按钮颜色
- 状态：已确认
- 普通主按钮填充：使用现有 `--nine-color-fill-action-inverse`（中性色按钮填充）
- 普通主按钮文字：使用现有 `--nine-color-text-on-neutral`（中性色按钮文字）
- 普通主按钮应用位置：创建空间、确认修改
- 次要按钮深色填充：`rgba(255, 255, 255, 0.1)`
- 次要按钮文字：继续使用一级标题颜色
- 次要按钮亮色填充：保持原来的 `rgba(0, 0, 0, 0.07)`
- 危险主按钮：确认删除继续使用危险色与固定白色文字
- 深色普通主按钮 Hover：叠加黑色 `10%`
- 深色次要按钮 Hover：叠加白色 `10%`
- 深色危险按钮 Hover：叠加白色 `10%`
- 亮色按钮 Hover：保持原样
- 实现文件：`src/DeleteSpaceDialog.css`、`src/EditSpaceDialog.css`

## edit-space-input-active

- 语义：编辑空间与创建空间输入框激活描边
- 状态：已确认
- 亮色激活内描边：`1px rgba(0, 0, 0, 0.4)`
- 深色激活内描边：`1px rgba(255, 255, 255, 0.4)`
- 填充：保持透明
- 默认未激活描边：继续使用现有标准透明线条
- 应用位置：编辑空间、创建空间的空间名称输入框
- 实现文件：`src/EditSpaceDialog.css`

## vertical-active-locator

- 语义：垂直标签栏“定位当前标签页”悬浮按钮
- 状态：已确认
- 填充：复用现有 `--nine-color-fill-tab-selected`（标签页选中填充）
- 图标颜色：继续使用现有 `--nine-color-text-title`（一级标题颜色）
- 背景模糊：使用现有 `--nine-backdrop-blur-30`
- 内描边：继续使用 `0.5px --nine-color-border-alpha-regular`
- Hover：继续保持仅放大至 `1.1`，暂不改变颜色
- 实现文件：`src/App.css`

## horizontal-tab-scroll-arrows

- 语义：横向分类 Tab 左右滚动箭头（妙招分类、输出物等共用 `.aiwp-tab-arrow`）
- 填充：悬浮容器 `--nine-color-fill-floating`；亮色 `rgba(255, 255, 255, 0.9)`，深色 `rgba(44, 45, 46, 0.9)`
- 背景模糊：`--nine-backdrop-blur-30`（30px）
- 图标：`--nine-color-text-title`
- 描边：`.5px solid var(--nine-color-border-alpha-regular)`
- Hover：保持相同颜色
- 实现文件：`src/personalized-home-2-0/ai-workspace/workspace-page-header.css`

## composer-surface


- 语义：新标签页 AI 对话输入框表面
- 状态：调整中
- 深色填充：`rgba(60, 60, 60, 0.6)`
- 亮色填充：保持原来的 `rgba(255, 255, 255, 0.8)`
- 深色默认特效：`0 2px 4px -2px rgba(0, 0, 0, 0.1), 0 0 0 0.5px rgba(255, 255, 255, 0.12) inset`
- 深色激活特效：`0 2px 4px -2px rgba(0,0,0,.1),0 0 0 .5px rgba(255,255,255,.2) inset`
- 应用位置：首页展开态与吸顶态的 AI 对话输入框表面
- 实现文件：`src/personalized-home-2-0/composer-scroll.css`、`src/personalized-home-2-0/themes/liquid-glass-performance.css`

## ai-output-card-surface

- 语义：AI 输出物与妙招页面通用卡片表面
- 状态：试调中
- 深色填充：与首页 AI 对话输入框一致，`rgba(60, 60, 60, 0.6)`；最终整理时合并同色填充
- 深色默认阴影：`0 1px 2px 0 rgba(0, 0, 0, 0.3)`，AI 输出物与妙招官方／普通网格卡片统一使用
- 深色 Hover 填充：`rgba(60, 60, 60, 1)`，AI 输出物与妙招官方／普通网格卡片统一使用
- 深色卡片悬浮操作条描边：`.5px solid var(--nine-color-border-alpha-subtle)`，实际为 `.5px solid rgba(255, 255, 255, 0.12)`；应用于 `.aiwf-card > .aiwf-file-actions`
- 亮色样式、描边与 Hover 阴影：保持原样
- 应用位置：AI 输出物网格 `.aiw-content-files .aiwf-card`；妙招官方卡片 `.aiws-official-card`、普通网格卡片 `.aiws-cards:not(.is-list) .aiws-card`；列表行保持透明
- 实现文件：`src/personalized-home-2-0/ai-workspace/workspace-files.css`、`src/personalized-home-2-0/ai-workspace/workspace-skills.css`

## dark-space-preset-tint

- 语义：空间预置颜色在深色模式下的默认染色浓度
- 状态：已确认
- 第一个预置：深色默认继续为 `10%`
- 其余七个预置：深色默认统一为 `20%`
- 亮色默认：第一个滑块值继续为 `10`（实际染色 `10%`）；其余七个滑块值统一为 `70`，映射后的实际染色为 `40%`
- 预置选择规则：点击预置颜色时使用该模式下的预置默认浓度；深色非首个预置直接为 `20%`，不继承上一个颜色的手动浓度
- 手动调整范围：选定预置后仍可用调试面板单独微调；再次选择预置时回到预置默认值
- 旧默认迁移：现有空间在深色模式仍保存旧的 `50%` 时，即使存在旧手动标记，也迁移为 `20%`
- 浅色旧默认迁移：现有非首个预置仍保存旧滑块值 `50` 时迁移为 `70`，对应新的实际染色 `40%`
- 模式切换：未手动调整的预置会在亮色/深色之间自动切换各自默认浓度
- 重置规则：主题设置的“重置主框架效果”和玻璃调试面板的“重置当前空间材质”都使用相同的模式默认值；深色模式第一个预置滑块值为 `10`、其余为 `20`；浅色模式第一个维持 `10`、其余为 `70`（实际染色 `40%`）；同时恢复标准材质并清除手动材质标记
- 应用位置：主题面板选择空间颜色、深色模式下创建新空间、主题设置重置、玻璃调试面板重置
- 实现文件：`src/spaceColors.ts`、`src/personalized-home-2-0/Overlays.jsx`、`src/personalized-home-2-0/App.jsx`、`src/App.tsx`

## glass-tint-slider-mapping

- 语义：侧边栏主框架染色浓度滑块到实际玻璃染色透明度的映射
- 状态：已确认
- 控件范围：继续显示并保存 `0–100`
- 实际映射：线性映射到 `5%–55%`，即 `0 → 5%`、`50 → 30%`、`100 → 55%`
- token 处理：仅调整数值映射，不新增颜色 token
- 应用位置：主题设置侧边栏“主框架效果 > 浓度”与玻璃调试面板“染色浓度”共用的原生玻璃染色输出
- 实现文件：`src/GlassControls.tsx`

## glass-debug-panel-visibility

- 语义：玻璃调试面板可见性
- 状态：已确认关闭
- 处理：界面隐藏玻璃调试面板，保留其底层空间玻璃同步与原生材质更新逻辑
- 正式入口：继续使用主题设置侧边栏“主框架效果”控制材质和染色浓度
- token 处理：不新增或修改颜色 token
- 实现文件：`src/GlassControls.tsx`

## home-content-surface

- 应用：首页对话输入框的基础材质；活动卡片在浅色模式复用，深色模式使用 `homepage-shared-tile-surface` 的渐变与顶部高光。
- 浅色填充 token 同时复用于首页快捷方式和小组件；深色看板卡片使用 `homepage-shared-tile-surface` 中的局部覆盖。
- `--home-content-surface-fill`：亮色 `rgba(255, 255, 255, 0.8)`；深色 `rgba(46, 46, 46, 0.5)`。
- `--home-content-surface-outline`：0.5px 内描边；亮色黑色 15%，深色白色 12%。
- `--home-content-surface-shadow`：亮色 `0 2px 4px -2px rgba(0, 0, 0, 0.04)`；深色 `0 2px 4px -2px rgba(0, 0, 0, 0)`。
- `--home-content-surface-backdrop`：复用 `--nine-backdrop-blur-30`（30px），饱和度 100%。
- 输入框激活态沿用同名 token 的局部覆盖，保留已有激活反馈。
- 仅深色模式下，首页输入框背景层、活动卡片、快捷方式和小组件使用 `filter: brightness(1.2)`，提亮 20%。
- 快捷方式图标随亮暗模式选择资源；深色优先使用现有白色版本（Notion、DeepL、Perplexity、OpenAI、Dribbble、Trickle、蔚来、大疆、Pinterest），保留图标自身镂空与细节。
- 实现文件：`src/personalized-home-2-0/themes/liquid-glass-performance.css`。

## composer-frame-fill

- 应用：任务、添加参考、妙招与模型选择共用的输入框外层底托。
- 默认和图片外观：复用 `--nine-color-fill-layer-strong`，浅色 `rgba(17,25,37,.05)`，深色 `rgba(255,255,255,.07)`。
- 彩色外观：局部 `--composer-frame-fill` 为 `color-mix(in srgb, 当前色板颜色 15%, transparent)`，亮暗模式均为 15%。命中预设时使用色板颜色 `spaceColors.color`，自定义颜色保留实际值。
- 回到默认或图片外观时移除局部覆盖，保持全局 token 不变。
- 外层描边：0.5px，沿用 `--nine-color-border-alpha-subtle` 的 RGB 色值，将透明度设为 5%；浅色为 `rgba(17,25,37,.05)`，深色为 `rgba(255,255,255,.05)`。
- 实现：`src/personalized-home-2-0/App.jsx`、`composer-expansion.css`。

## 深色材质色带处理

- 首页/对话页输入框、小组件、快捷方式、活动卡片继续使用现有深色渐变、30px 模糊和 1.5 倍背景提亮。
- 共用背景层叠加透明度 2/255 的静态微噪点贴图，以减轻模糊渐变的色阶断层；不调整颜色 token，不影响前景图片、图标或文字。
- 实现：`src/personalized-home-2-0/styles/home-surfaces.css`、`public/personalized-home-2-0/asset/material-dither.png`。
