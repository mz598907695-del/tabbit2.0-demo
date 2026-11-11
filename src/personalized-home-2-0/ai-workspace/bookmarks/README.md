# 收藏管理

从 `【0047】 个性化首页2.0/src/ai-workspace/` 迁入收藏页相关组件、数据模型与导入导出逻辑。原项目保持只读；未迁入首页、小组件、主题库或其他工作区页面。

- `bookmarks.html` / `src/bookmarks-main.tsx` 是独立入口；只挂载收藏管理器。
- 工作区中的收藏入口复用同一管理器。导航项和更多菜单上的跳转图标独立打开新标签页，固定图标仍只负责固定。
- 复用当前项目语义颜色、可用图标、网站图标资源与菜单；收藏 CSS 限定在 `.personalized-home` 内，批量工具栏仅包含所需的局部样式。
- 数据使用 `tabbit.bookmarks.v2`，布局使用 `tabbit.bookmarks.ui.v2`。首次迁移当前 Demo 的旧收藏并补充演示目录；不覆盖旧工作区数据。其他标签页通过 storage 事件同步，撤销在并发写入后失效以避免覆盖新数据。
- 支持目录、列表/分栏、搜索、增删改、移动、拖拽、多选、剪切复制、撤销及 HTML/JSON 导入导出。收藏存储属于本地 Demo，未接入浏览器原生收藏或云同步；“导航栏仅显示图标”保留为收藏页内的效果预览。

验证：`node --test scripts/tests/bookmark-model.test.mjs scripts/tests/bookmark-navigation.test.mjs`、`npm run check:source`、`npm run build`。浏览器检查使用 Tabbit，覆盖独立标签页保留来源页、新建/改名/移动/删除/撤销、跨标签页同步、搜索、分栏、导入和 HTML 导出回读，以及深浅色与窄屏。
