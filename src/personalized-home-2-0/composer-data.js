export const COMMAND_STORAGE_KEY = 'personalized-home-2-0-composer-commands';
export const MAX_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export const MODEL_GROUPS = [
  { label: '', models: [{ name: 'Auto', icon: 'auto' }] },
  { label: 'Max', models: [{ name: 'Opus 4.6', icon: 'opus' }, { name: 'Opus 5', icon: 'opus' }, { name: 'GPT-5.6 Terra', icon: 'openai' }] },
  { label: 'Pro', models: [{ name: 'deep', icon: 'deep' }, { name: 'Kimi K2.6', icon: 'kimi' }, { name: 'GLM 5.2', icon: 'glm' }, { name: 'LongCat 2.0', icon: 'longcat' }] },
  { label: 'Lite', models: [{ name: 'LongCat Flash INT8', icon: 'longcat' }] },
];

export const DEFAULT_COMMANDS = [
  { id: 'meeting', name: '总结会议结论', prompt: '请根据以下会议内容，整理关键结论、待办事项、负责人和截止时间；未明确的信息请标注待确认。\n\n会议内容：' },
  { id: 'promotion', name: '生成晋升评审反馈', prompt: '请根据以下工作成果与评审记录，生成晋升评审反馈，包括主要贡献、能力表现、待提升项和发展建议；请区分事实与判断。\n\n参考内容：' },
  { id: 'interview', name: '总结面试反馈', prompt: '请根据以下面试记录，总结候选人的相关经验、能力证据、待确认问题与综合反馈，不补充未经记录支持的信息。\n\n面试记录：' },
  { id: 'customer', name: '生成客户回访记录', prompt: '请根据以下沟通内容，生成客户回访记录，包括客户反馈、问题与需求、已达成共识和后续行动。\n\n沟通内容：' },
  { id: 'weekly', name: '生成项目周报', prompt: '请根据以下项目进展，生成一份简洁的项目周报，包含本周完成、当前风险、待协调事项和下周计划。\n\n项目进展：' },
];

export function readCustomCommands(storage) {
  try {
    const saved = JSON.parse(storage.getItem(COMMAND_STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    const seen = new Set(DEFAULT_COMMANDS.map(command => command.name));
    return saved.filter(command => {
      if (typeof command?.name !== 'string' || typeof command?.prompt !== 'string') return false;
      const name = command.name.trim();
      if (!name || name.length > 40 || !command.prompt.trim() || command.prompt.length > 4000 || seen.has(name)) return false;
      seen.add(name);
      return true;
    }).slice(0, 30).map((command, index) => ({ id: `custom-${index}`, name: command.name.trim(), prompt: command.prompt.trim() }));
  } catch { return []; }
}

export function partitionAttachments(files, currentCount, existingFiles = []) {
  const accepted = [];
  const errors = [];
  const identity = file => JSON.stringify([file.webkitRelativePath || file.relativePath || file.name, file.size, file.lastModified ?? 0]);
  const known = new Set(existingFiles.map(identity));
  let overLimit = false;
  for (const file of files) {
    const key = identity(file);
    if (known.has(key)) errors.push(`「${file.name.slice(0, 60)}」已添加`);
    else if (file.size > MAX_ATTACHMENT_BYTES) {
      errors.push(`「${file.name.slice(0, 60)}」超过 20 MB`);
    } else if (currentCount + accepted.length >= MAX_ATTACHMENTS) overLimit = true;
    else { accepted.push(file); known.add(key); }
  }
  if (overLimit) errors.push('最多添加 10 个文件，请移除部分文件后重试');
  return { accepted, errors };
}

export function isPreviewableImage(file) {
  return /^image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)$/i.test(file.type)
    || (!file.type && /\.(png|jpe?g|gif|webp|avif|bmp|ico)$/i.test(file.name));
}

export function formatAttachmentSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}
