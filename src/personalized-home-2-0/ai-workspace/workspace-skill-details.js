import { SKILL_CATEGORIES, SKILL_TYPES } from './workspace-skills.js';

export function getSkillDetails(item) {
  const kind = ['prompt', 'task', 'script'].includes(item.skillType) ? item.skillType : 'prompt';
  const steps = kind === 'task' ? ['提供目标与资料', '按步骤整理分析', '检查并保存结果']
    : kind === 'script' ? ['打开适用网页', '手动选择妙招', '查看页面效果'] : ['补充你的材料', '将提示词填入对话', '确认后发送'];
  return {
    kind, typeLabel: SKILL_TYPES.find(([value]) => value === kind)[1],
    category: SKILL_CATEGORIES.find(([value]) => value === item.category)?.[1] || '实用工具',
    author: item.author === 'Tabbit 官方' ? '官方' : item.author || '我',
    version: item.version || '1.0', updatedAt: item.updatedAt || item.date || '未提供',
    websites: Array.isArray(item.websites) && item.websites.length ? item.websites : ['全部网站'],
    prompt: item.prompt || item.description || '',
    taskDescription: item.taskDescription || item.description || '',
    triggers: Array.isArray(item.triggers) ? item.triggers : [item.title],
    taskContent: item.skillMarkdown || `# ${item.title}\n\n## 目标\n${item.description || '根据用户提供的材料完成任务。'}\n\n## 输入\n用户提供的目标、相关材料与输出要求。\n\n## 执行步骤\n1. 确认目标与材料是否完整，缺少信息时先询问。\n2. 围绕目标整理材料，区分事实与待确认内容。\n3. 输出可检查的结果，并列出下一步建议。\n\n## 输出\n结果摘要、详细内容与待确认事项。`,
    script: item.code || item.script || `// ${item.title} · 展示用代码示例\n// 本地原型只展示代码，不注入或执行。\nfunction previewPage() {\n  return {\n    title: document.title,\n    url: location.href,\n    headings: [...document.querySelectorAll('h1, h2')]\n      .map(node => node.textContent.trim())\n  };\n}`,
    steps,
    images: Array.isArray(item.images) ? item.images.filter(image => image && typeof image.src === 'string') : [],
  };
}
