const TITLES = [
  '梳理新用户的第一次使用流程', '把调研访谈整理成问题清单',
  '设计评审前需要确认什么', '给首页写一组简洁的引导文案',
  '比较三种通知交互方案', '制定下个月的阅读计划',
  '整理收藏里还没读完的文章', '为项目复盘准备讨论提纲',
  '将零散灵感整理成产品方向', '周末去哪里散步',
  '理解一个陌生行业的基本概念', '把长报告提炼成一页摘要',
  '检查移动端页面的操作路径', '设计一个轻量的习惯记录工具',
  '为团队分享准备开场白', '整理学习笔记的目录',
  '给新功能列一份验收清单', '分析用户反馈中的共同问题',
  '规划一次两天一夜的短途旅行', '写一份清晰的需求变更说明',
  '整理今天的会议与待办事项', '给演示文稿调整叙事顺序',
  '把想法拆成可以开始的小步骤', '为下次访谈准备追问问题',
  '记录本周值得保留的设计细节', '整理桌面文件的分类方式',
  '练习用简单的话解释复杂概念', '给个人项目安排第一周计划',
  '整理一份常用快捷键清单', '回顾这个月的学习收获',
];

export const CONVERSATION_DEMOS = TITLES.map((title, index) => ({
  id: `chat-long-list-${index + 1}`, title,
  description: `围绕「${title}」整理思路和下一步。这是一条本地演示对话。`,
  type: index % 2 === 0 ? 'cloud' : 'local',
  date: `10 月 ${19 - Math.floor(index / 2)} 日`,
  tag: '示例',
}));

// One-time fixture expansion: later deletions and edits must survive reloads.
export function mergeConversationDemoData(data) {
  if (data.chatDemoVersion >= 1) return data;
  if (!data.chats.length) return { ...data, chatDemoVersion: 1 };
  const existing = new Set(data.chats.map(chat => chat.id));
  return {
    ...data,
    chatDemoVersion: 1,
    chats: [...data.chats, ...CONVERSATION_DEMOS.filter(chat => !existing.has(chat.id)).map(chat => ({ ...chat }))],
  };
}
