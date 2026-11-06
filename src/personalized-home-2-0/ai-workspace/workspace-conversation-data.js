export const CONVERSATION_STORAGE_KEY = 'personalized-home-2-0-ai-workspace-conversation-messages-v3';

const SAMPLE_REPLIES = {
  'chat-1': '可以围绕「开始工作、继续工作、查看结果」组织首页。\n\n1. 把新建、妙招和定时任务放在主导航。\n2. 用置顶和最近对话承接正在进行的事情。\n3. 将生成的文件、AI 卡片和 AI 看板集中到 AI 输出物。\n\n这样既能直接开始，也能顺着上下文继续。',
  'chat-2': '本周进展可以分成四部分：\n\n• 首页导航：确认经典对话栏的方向。\n• 文件管理：统一分类、预览与列表视图。\n• 通知体验：调整为弹窗，补齐分类和未读筛选。\n• 视觉规范：统一内容宽度、间距与背景。\n\n待确认：小屏布局，以及长列表滚动时的标题吸顶。下周优先完成这两项验证。',
  'chat-3': '设计的日常，常常藏在很小的动作里。\n\n值得记录的不只是「看起来好看」，还包括：第一次使用是否知道从哪里开始；离开后能不能轻松回来；系统是否在恰当的时候给出反馈。\n\n可以把每次观察记成：场景、动作、感受、下一次会怎么改。',
  'chat-4': '三种协作方式适合不同的工作：\n\n• 对话：快速提问、探索想法和澄清需求。\n• 项目：整理长期资料，保留共同的上下文。\n• 任务：目标明确、有可检查的交付结果。\n\n设计入口时，可以从用户想完成的事情出发，再让工具形式自然出现。',
  'chat-5': '给周末留一点空白。\n\n周六上午出发，午后沿海边散步，傍晚找一个可以看日落的地方。周日睡到自然醒，去附近的小店坐一会儿，再慢慢返程。\n\n下一步可以补充出发城市、交通方式和预算，让计划更具体。',
  'chat-6': '行动清单可以用「事项、负责人、时间、依赖」四个字段整理。\n\n1. 确认首页导航方案——产品——本周五——设计评审通过。\n2. 完成文件页面样式——设计——下周一——分类结构确认。\n3. 验证响应式与键盘操作——测试——下周三——原型更新。\n\n没有明确负责人的事项，先放入待确认列表。',
};

export function initialConversationMessages(conversation) {
  const demo = conversation.id === 'chat-1' ? 'home-structure' : conversation.id === 'chat-4' ? 'tool-comparison' : undefined;
  const opening = [
    { id: `${conversation.id}-opening-user`, role: 'user', text: conversation.title, attachments: [] },
    { id: `${conversation.id}-opening-assistant`, role: 'assistant', text: SAMPLE_REPLIES[conversation.id] || conversation.description || '可以从目标、现状和下一步开始，一起把这件事梳理清楚。', attachments: [], demo },
  ];
  if (conversation.id === 'chat-4') return [...opening,
    { id: `${conversation.id}-follow-up-user`, role: 'user', text: '如果只保留一个主入口，应该怎么设计？', attachments: [] },
    { id: `${conversation.id}-follow-up-assistant`, role: 'assistant', text: '建议保留对话入口，再根据目标切换工作方式。', attachments: [], demo: 'tool-entry' },
  ];
  if (conversation.id !== 'chat-1') return opening;
  return [...opening,
    { id: `${conversation.id}-follow-up-user`, role: 'user', text: '那移动端怎么处理？信息不能太挤。', attachments: [] },
    { id: `${conversation.id}-follow-up-assistant`, role: 'assistant', text: '移动端建议采用渐进披露。', attachments: [], demo: 'mobile-layout' },
  ];
}

// Keep only message content and attachment labels. File objects and temporary
// preview URLs belong to Composer and are never retained in conversation storage.
export function makeConversationExchange(payload, exchangeId) {
  const attachments = (payload.attachments || []).map(file => ({
    name: typeof file.name === 'string' ? file.name : '附件',
    size: typeof file.size === 'number' ? file.size : undefined,
  }));
  const user = {
    id: `${exchangeId}-user`, role: 'user', text: payload.query || '', attachments,
    reference: typeof payload.reference === 'string' ? payload.reference : '',
    mode: payload.mode === '任务' ? '任务' : '对话',
  };
  const assistant = {
    id: `${exchangeId}-assistant`, role: 'assistant', attachments: [],
    text: payload.mode === '任务'
      ? '已记录这条示例任务。此处用于预览对话与任务的交互，尚未连接任务执行服务。'
      : '已记录这条示例消息。你可以继续补充想法，或切换到其他对话后再回来。此处尚未连接 AI 服务。',
  };
  return [user, assistant];
}

export function readConversationMessages(conversation, storage) {
  try {
    const saved = JSON.parse(storage.getItem(CONVERSATION_STORAGE_KEY) || '{}')[conversation.id];
    if (Array.isArray(saved) && saved.length && saved.every(message =>
      message && typeof message.id === 'string' && ['user', 'assistant'].includes(message.role) &&
      typeof message.text === 'string' && (!message.reference || typeof message.reference === 'string') && Array.isArray(message.attachments) &&
      message.attachments.every(file => file && typeof file.name === 'string')
    )) return saved;
  } catch { /* Private mode or invalid local data falls back to the sample. */ }
  return initialConversationMessages(conversation);
}

export function writeConversationMessages(conversationId, messages, storage) {
  let saved = {};
  try {
    const parsed = JSON.parse(storage.getItem(CONVERSATION_STORAGE_KEY) || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed;
  } catch { /* Replace a malformed record with the next valid local change. */ }
  try {
    storage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify({ ...saved, [conversationId]: messages }));
  } catch { /* Keep the active session usable when storage is unavailable. */ }
}
