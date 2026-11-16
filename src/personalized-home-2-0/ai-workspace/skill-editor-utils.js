import { SKILL_CATEGORIES } from './workspace-skills.js';

export const SKILL_IMPORT_LIMIT = 256 * 1024;
export const SKILL_HOME_PATTERN = 'tabbit://newtab';
const text = value => typeof value === 'string' ? value : '';
const kinds = new Set(['prompt', 'script', 'task']);
const categories = new Set(SKILL_CATEGORIES.map(([id]) => id));
const categoryFor = value => categories.has(value) ? value : 'tools';
const names = /^[\p{L}\p{N}_-]+$/u;
export function skillVariableReferences(prompt = '') {
  return [...new Set([...prompt.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map(match => match[1].trim()))];
}
export function skillEditorDraft(item = {}) {
  const kind = kinds.has(item.skillType) ? item.skillType : 'prompt';
  return {
    title:text(item.title), description:text(item.description), skillType:kind, category:categoryFor(item.category),
    prompt:text(item.prompt), code:text(item.code || item.script || (kind === 'script' ? item.prompt : '')), skillMarkdown:text(item.skillMarkdown || (kind === 'task' ? item.prompt : '')),
    taskDescription:text(item.taskDescription || (kind === 'task' ? item.description : '')),
    runMode:item.runMode === 'auto' ? 'auto' : 'manual', autoSend:Boolean(item.autoSend),
    websites:Array.isArray(item.websites) ? item.websites.filter(v => typeof v === 'string') : ['*://*/*'],
    variables:Array.isArray(item.variables) ? item.variables.map(v => ({name:text(v?.name), defaultValue:text(v?.defaultValue)})) : [],
  };
}
export function validSkillWebsite(value) {
  if (value === SKILL_HOME_PATTERN || value === '全部网站' || value === '<all_urls>') return true;
  // Match URL rules without evaluating them as expressions or executing content.
  return /^(?:https?|\*):\/\/(?:\*|(?:\*\.)?[a-z\d](?:[a-z\d.-]*[a-z\d])?(?::\d{1,5})?)(?:\/[^\s]*)?$/i.test(value);
}
export function validateSkillDraft(draft) {
  if (!draft.title.trim()) return '请填写妙招名称。';
  if (draft.title.trim().length > 100) return '名称请控制在 100 个字符以内。';
  if (!kinds.has(draft.skillType)) return '请选择有效的妙招类型。';
  if (draft.skillType === 'prompt') {
    if (!draft.prompt.trim()) return '请填写提示词内容。';
    const all = draft.variables.map(v => v.name.trim());
    if (all.some(name => !names.test(name))) return '变量名称请使用中文、字母、数字、下划线或短横线，且不能为空。';
    if (new Set(all).size !== all.length) return '变量名称不能重复。';
    const missing = skillVariableReferences(draft.prompt).filter(name => !all.includes(name));
    if (missing.length) return `请配置正文引用的变量：${missing.join('、')}。`;
  } else {
    if (!draft.websites.length) return '请至少添加一条适用网站规则。';
    const invalid = draft.websites.find(site => !validSkillWebsite(site));
    if (invalid) return `网站规则无效：${invalid}。请填写网址或通配符规则，如 https://*.example.com/*。`;
    if (draft.skillType === 'script' && !draft.code.trim()) return '请填写脚本代码。';
    if (draft.skillType === 'task' && !draft.taskDescription.trim()) return '请填写调用描述，说明何时应使用这个任务。';
    if (draft.skillType === 'task' && !draft.skillMarkdown.trim()) return '请填写 SKILL.md。';
  }
  return '';
}
export function normalizeSkillDraft(draft, item = {}) {
  draft = {...draft,category:categoryFor(draft.category),websites:draft.websites.map(site => site.trim()).filter(Boolean)};
  const error = validateSkillDraft(draft);
  if (error) throw new Error(error);
  return { ...item, ...draft, title:draft.title.trim(), description:draft.description.trim(),
    taskDescription:draft.taskDescription.trim(),
    variables:draft.variables.map(v => ({name:v.name.trim(),defaultValue:v.defaultValue})),
    websites:[...new Set(draft.websites.map(site => site.trim()).filter(Boolean))],
  };
}
export function parseSkillImport(filename, source, currentKind = 'prompt') {
  if (new TextEncoder().encode(source).length > SKILL_IMPORT_LIMIT) throw new Error('文件太大，请选择 256 KB 以内的文本文件。');
  const content = source.replace(/^\uFEFF/, '');
  if (!content.trim()) throw new Error('文件内容为空。');
  const extension = filename.split('.').pop().toLowerCase();
  if (!['txt','md','js','json'].includes(extension)) throw new Error('请上传 TXT、MD、JS 或 JSON 文件。');
  if (extension === 'json') {
    let data;
    try { data = JSON.parse(content); } catch { throw new Error('JSON 格式有误，请检查后重试。'); }
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('JSON 应为一个妙招对象。');
    for (const key of ['title','name','description','prompt','code','script','skillMarkdown','taskDescription','skillType','kind','runMode']) {
      if (Object.hasOwn(data,key) && typeof data[key] !== 'string') throw new Error(`JSON 中的 ${key} 必须是文本。`);
    }
    if (Object.hasOwn(data,'autoSend') && typeof data.autoSend !== 'boolean') throw new Error('JSON 中的 autoSend 必须为 true 或 false。');
    if (Object.hasOwn(data,'websites') && (!Array.isArray(data.websites) || data.websites.some(site => typeof site !== 'string'))) throw new Error('JSON 中的 websites 应为网站规则文本数组。');
    if (Object.hasOwn(data,'variables') && (!Array.isArray(data.variables) || data.variables.some(v => !v || typeof v !== 'object' || typeof v.name !== 'string' || (Object.hasOwn(v,'defaultValue') && typeof v.defaultValue !== 'string')))) throw new Error('JSON 中的 variables 应包含文本名称 name 和可选文本默认值 defaultValue。');
    if (Object.hasOwn(data,'runMode') && !['manual','auto'].includes(data.runMode)) throw new Error('JSON 中的 runMode 应为 manual 或 auto。');
    const skillType = data.skillType ?? data.kind ?? currentKind;
    if (!kinds.has(skillType)) throw new Error('JSON 中的 skillType 应为 prompt、script 或 task。');
    const selectedContent = skillType === 'prompt' ? data.prompt : skillType === 'script' ? data.code || data.script : data.skillMarkdown;
    if (typeof selectedContent !== 'string' || !selectedContent.trim()) throw new Error('JSON 缺少所选类型的正文：prompt、code 或 skillMarkdown。');
    const draft = skillEditorDraft({...data,title:text(data.title).trim() || text(data.name).trim() || filename.replace(/\.[^.]+$/, ''),skillType});
    // Only editor fields are imported; identities, author, installation and publication are never overwritten.
    return draft;
  }
  const skillType = extension === 'js' ? 'script' : currentKind;
  const field = skillType === 'script' ? 'code' : skillType === 'task' ? 'skillMarkdown' : 'prompt';
  const result = {skillType,[field]:content};
  if (skillType === 'prompt') result.variables = skillVariableReferences(content).map(name => ({name,defaultValue:''}));
  return result;
}
export function createAssistedSkillDraft(kind, requirement, title = '') {
  const goal = requirement.trim();
  if (!goal) throw new Error('先描述你想完成什么。');
  if (kind === 'task') return `# ${title.trim() || '任务妙招'}\n\n## 调用场景\n${goal}\n\n## 输入\n用户提供的目标、资料与约束。\n\n## 执行步骤\n1. 明确目标、输入和完成标准；缺少信息时先询问。\n2. 围绕上述目标收集并整理相关材料。\n3. 按来源核对关键事实，并标明待确认信息。\n4. 生成可检查的结果，说明下一步行动。\n\n## 输出\n结果摘要、依据与待办清单。`;
  return `// 需求：${goal.replace(/\r?\n/g, ' ')}\n// 起始模板：读取当前网页的标题、正文和来源。\n// 请根据需求补充处理逻辑，并在使用前检查。\n(() => {\n  const result = {\n    title: document.title,\n    url: location.href,\n    text: (document.querySelector('main, article') || document.body).innerText\n  };\n  return result;\n})();`;
}
