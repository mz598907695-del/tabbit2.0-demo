import { mergeConversationDemoData } from './workspace-chat-mocks.js';
import { mergeOutputDemoData } from './workspace-output-mocks.js';
export const MODULES = [
  { id: 'chats', label: '对话', description: '接着上次的思路，开始下一步。', action: '新建对话' },
  { id: 'files', label: 'AI 输出物', description: 'AI 对话里的资料与生成的内容，都在这里。', action: '创建输出物' },
  { id: 'skills', label: '妙招·连接器', description: '把重复的步骤，变成顺手的一招。', action: '创建妙招' },
  { id: 'tasks', label: '定时任务', description: '把需要持续关注的事交给 Tabbit。', action: '新建任务' },
  { id: 'bookmarks', label: '收藏', description: '值得再读的网页，随时找得到。', action: '添加收藏' },
  { id: 'shares', label: '分享', description: '统一查看和管理你分享的内容。', action: '创建示例分享' },
  { id: 'usage', label: '会员与用量', description: '了解当前权益、周期用量与使用记录。', action: '查看会员计划' },
  { id: 'notifications', label: '通知', description: '产品动态和与你有关的消息。', action: '全部标为已读' },
];
export const PAGE_TABS = {
  chats: [['all', '全部'], ['cloud', '云端'], ['local', '本地'], ['pinned', '已置顶']],
  files: [['all', '全部'], ['web', '网页'], ['doc', '文档'], ['image', '图片'], ['table', '表格'], ['card', 'AI 卡片'], ['board', 'AI 看板'], ['other', '其他']],
  skills: [['all', '全部'], ['official', '官方预装'], ['installed', '已安装'], ['custom', '我创建的']],
  tasks: [['all', '全部'], ['active', '生效中'], ['paused', '已暂停'], ['empty', '空状态']],
  assets: [['all', '全部'], ['home', '首页'], ['board', '看板'], ['card', 'AI 卡片']],
  bookmarks: [['all', '全部收藏'], ['AI', 'AI'], ['设计', '设计'], ['工作', '工作'], ['学习', '学习']],
  shares: [['all', '全部'], ['web', '网页'], ['chat', '对话']],
  usage: [['membership', '会员和用量'], ['coupons', '重置券'], ['orders', '订单中心']],
  notifications: [['all', '全部'], ['product', '公告'], ['feedback', '服务消息'], ['billing', '会员和支付']],
};
export const INITIAL_DATA = {
  chats: [
    { id: 'chat-1', title: '首页信息架构，如何再简洁一点', description: '从功能入口到工作流，梳理统一导航的三个关键层级。', type: 'cloud', date: '今天 14:01', pinned: true, tag: '产品设计' },
    { id: 'chat-2', title: '整理本周项目进展', description: '已整理 4 项进展、2 个待确认问题和下周计划。', type: 'cloud', date: '今天 09:43', pinned: true, tag: '工作' },
    { id: 'chat-3', title: '阅读笔记：设计的日常', description: '记录值得留下的观察，让思考有迹可循。', type: 'local', date: '昨天', tag: '阅读' },
    { id: 'chat-4', title: 'AI 工具的交互方式对比', description: '比较对话、项目和任务三种协作方式。', type: 'cloud', date: '昨天', tag: '研究' },
    { id: 'chat-5', title: '下一次出发，去看海', description: '一份慢下来的周末旅行计划。', type: 'cloud', date: '10 月 21 日', tag: '生活' },
    { id: 'chat-6', title: '把会议记录变成行动清单', description: '明确负责人、交付时间和依赖关系。', type: 'local', date: '10 月 20 日', tag: '工作' },
  ],
  files: [
    { id: 'file-1', title: '首页 2.0 产品需求文档', description: '导航、主题与小组件的设计说明', type: 'doc', format: 'PDF', size: '2.4 MB', date: '今天 14:12', source: '首页信息架构，如何再简洁一点' },
    { id: 'file-2', title: '本周项目进展', description: '里程碑与行动清单', type: 'table', format: 'XLSX', size: '128 KB', date: '今天 10:30', source: '整理本周项目进展' },
    { id: 'file-3', title: '山丘上的一阵风', description: '首页壁纸灵感', type: 'image', format: 'PNG', size: '1.8 MB', date: '昨天', image: '/personalized-home-2-0/asset/widgets/landscape.png', source: '下一次出发，去看海' },
    { id: 'file-4', title: '让复杂的工具变得简单', description: '设计研究的网页摘录', type: 'web', format: '网页', size: '阅读 6 分钟', date: '昨天', source: 'AI 工具的交互方式对比' },
    { id: 'file-5', title: '国际时钟 AI 卡片', description: '三个时区的时钟配置', type: 'other', format: 'JSON', size: '8 KB', date: '10 月 20 日', source: 'AI 卡片创作' },
    { id: 'file-6', title: '会议纪要 · 体验优化', description: '评审结论与后续待办', type: 'doc', format: 'DOCX', size: '92 KB', date: '10 月 19 日', source: '把会议记录变成行动清单' },
  ],
  skills: [
    { id: 'skill-1', title: '把长文读薄', description: '提炼核心观点、论证脉络与值得追问的问题。', type: 'official', skillType: 'prompt', tag: '阅读', used: '1.2k', prompt: '请帮我提炼这篇文章的核心观点、论证脉络和三个值得追问的问题。' },
    { id: 'skill-2', title: '一份清晰的项目周报', description: '从零散记录中，整理进展、风险和下一步。', type: 'official', skillType: 'prompt', tag: '工作', used: '986', prompt: '请把我的工作记录整理成项目周报，包括进展、风险和下一步。' },
    { id: 'skill-3', title: '网页干净阅读', description: '聚焦正文，收起页面上分散注意力的元素。', type: 'installed', skillType: 'script', tag: '网页', used: '已安装', prompt: '请分析当前网页，并给出适合阅读的正文摘要。' },
    { id: 'skill-4', title: '每天的行业简报', description: '定时收集关注领域的变化，保留重要信号。', type: 'installed', skillType: 'task', tag: '研究', used: '已安装', prompt: '帮我创建一个每天整理行业简报的任务。' },
    { id: 'skill-5', title: '设计评审搭子', description: '从目标、层级和操作成本三个角度检查方案。', type: 'custom', skillType: 'prompt', tag: '设计', used: '我创建的', prompt: '请从用户目标、信息层级、操作成本三个角度评审我的设计。' },
    { id: 'skill-6', title: '会议之后', description: '提取共识、分歧和负责人，直接进入下一步。', type: 'official', skillType: 'prompt', tag: '协作', used: '764', prompt: '从这份会议记录中提取共识、分歧、行动项、负责人和截止时间。' },
  ],
  tasks: [
    { id: 'task-1', title: '每天一份 AI 行业简报', description: '汇总产品更新与值得关注的研究。', type: 'active', date: '明天 09:00', schedule: '每天 09:00', lastRun: '今天 09:00 · 已完成', tag: '研究' },
    { id: 'task-2', title: '周五整理项目周报', description: '整理本周成果、阻塞问题与下周计划。', type: 'active', date: '周五 17:00', schedule: '每周五 17:00', lastRun: '10 月 16 日 · 已完成', tag: '工作' },
    { id: 'task-3', title: '关注设计灵感', description: '收集优秀网站和界面设计案例。', type: 'paused', date: '已暂停', schedule: '每周一 10:00', lastRun: '10 月 19 日 · 已完成', tag: '设计' },
  ],
  assets: [
    { id: 'asset-1', title: '我的首页', description: '日常灵感与常用入口', type: 'home', date: '今天', image: '/personalized-home-2-0/asset/themes/previews/01.webp', tag: '12 个快捷方式' },
    { id: 'asset-2', title: '工作空间', description: '项目资料与效率工具', type: 'home', date: '昨天', image: '/personalized-home-2-0/asset/themes/previews/20.webp', tag: '8 个快捷方式' },
    { id: 'asset-3', title: '产品设计资料库', description: '把调研与灵感放在一起', type: 'board', date: '昨天', tag: '6 项内容' },
    { id: 'asset-4', title: '本周阅读', description: '留一点时间给好文章', type: 'board', date: '10 月 21 日', tag: '4 项内容' },
    { id: 'asset-5', title: '国际时钟', description: '上海、东京与旧金山', type: 'card', date: '10 月 20 日', tag: 'AI 卡片' },
    { id: 'asset-6', title: '灵感便签', description: '记下稍纵即逝的想法', type: 'card', date: '10 月 19 日', tag: 'AI 卡片' },
  ],
  bookmarks: [
    { id: 'bookmark-1', title: 'Anthropic · Claude', description: '帮助思考、写作与创造的 AI 助手', type: 'AI', domain: 'claude.ai', date: '今天' },
    { id: 'bookmark-2', title: 'OpenAI · Codex', description: '从想法到实现的协作工具', type: 'AI', domain: 'openai.com', date: '昨天' },
    { id: 'bookmark-3', title: '设计的日常', description: '观察身边微小而重要的设计', type: '设计', domain: 'design.example', date: '昨天' },
    { id: 'bookmark-4', title: '首页 2.0 项目资料', description: '需求、评审与交付记录', type: '工作', domain: 'project.example', date: '10 月 21 日' },
    { id: 'bookmark-5', title: '学习如何学习', description: '建立更适合自己的学习方法', type: '学习', domain: 'learn.example', date: '10 月 20 日' },
    { id: 'bookmark-6', title: '界面设计的细节', description: '关于间距、层级和反馈', type: '设计', domain: 'design.example', date: '10 月 19 日' },
  ],
  shares: [
    { id: 'share-1', title: 'AI 工具交互方式对比', description: '一份可以继续讨论的研究摘要', type: 'chat', date: '今天 11:20', views: 12, enabled: true },
    { id: 'share-2', title: '周末旅行计划', description: '去海边，让时间慢下来', type: 'web', date: '昨天 16:40', views: 8, enabled: true },
    { id: 'share-3', title: '首页体验评审', description: '第一轮设计评审记录', type: 'chat', date: '10 月 18 日', views: 24, enabled: false },
  ],
  notifications: [
    { id: 'notice-1', title: '你的 Tabbit，有了新的可能', description: '新首页支持自由组合快捷方式与小组件。试着留下一点空间，给每天会用到的内容。', type: 'product', date: '今天 10:00', unread: true },
    { id: 'notice-2', title: '关于你反馈的快捷方式问题', description: '我们收到了你的反馈，并已在最新版本中优化快捷方式的拖拽与尺寸调整体验。感谢你帮助 Tabbit 变得更好。', type: 'feedback', date: '昨天 16:30', unread: true },
    { id: 'notice-3', title: '本周用量已重置', description: '新的使用周期开始了。你可以在会员与用量页面查看剩余额度和使用明细。', type: 'billing', date: '10 月 21 日 00:00', unread: false },
    { id: 'notice-4', title: '让妙招成为你的工作习惯', description: '收藏常用的提示词，或者创建自己的妙招。下次遇到相似的问题，就从上次的好方法开始。', type: 'product', date: '10 月 20 日 09:00', unread: false },
  ],
};
export const TYPE_LABELS = { cloud: '云端', local: '本地', web: '网页', doc: '文档', image: '图片', table: '表格', other: '其他', official: '官方', installed: '已安装', custom: '自定义', prompt: '提示词', script: '网页脚本', task: '任务', active: '生效中', paused: '已暂停', home: '首页', board: 'AI 看板', card: 'AI 卡片', chat: '对话', product: '产品公告', feedback: '客服反馈', billing: '会员和支付' };

export function filterWorkspaceItems(items, { filter = 'all', query = '', kind = 'all', sort = 'recent' } = {}) {
  const search = query.trim().toLocaleLowerCase();
  let result = items.filter(item => {
    const matchesText = `${item.title} ${item.description || ''} ${item.tag || ''} ${item.domain || ''}`.toLocaleLowerCase().includes(search);
    const matchesTab = filter === 'all' || (filter === 'pinned' ? !!item.pinned : filter === 'installed' ? item.type === 'installed' || !!item.installed : item.type === filter);
    return matchesText && matchesTab && (kind === 'all' || item.skillType === kind);
  });
  // Data is stored newest-first; never compare localized display date strings.
  if (sort === 'name') result = [...result].sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
  if (sort === 'oldest') result = [...result].reverse();
  return result;
}
export function readWorkspaceData() {
  try {
    const saved = JSON.parse(localStorage.getItem('personalized-home-2-0-ai-workspace-demo-v1') || 'null');
    if (saved && Object.keys(INITIAL_DATA).every(key => Array.isArray(saved[key]))) return mergeConversationDemoData(mergeOutputDemoData(saved));
  } catch { /* Storage may be unavailable. */ }
  return mergeConversationDemoData(mergeOutputDemoData(structuredClone(INITIAL_DATA)));
}
