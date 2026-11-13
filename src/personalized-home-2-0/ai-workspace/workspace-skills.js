// Catalogue examples are derived, not written over the user's saved skills.
export const SKILL_CATEGORIES = [
  ['study', '学习研究'], ['writing', '内容创作'], ['design', '创意设计'],
  ['office', '办公效率'], ['business', '金融商业'], ['development', '开发技术'],
  ['tools', '实用工具'], ['fun', '休闲娱乐'], ['marketing', '营销运营'],
];
export const SKILL_TYPES = [['all', '全部'], ['prompt', '提示词'], ['script', '网页脚本'], ['task', '任务']];
const samples = [
  ['study','论文阅读助手','梳理研究问题、方法与结论，整理值得继续追问的线索。','prompt'],
  ['study','每日研究速递','按关注主题整理论文与研究动态，生成一份阅读清单。','task'],
  ['study','知识脉络整理','把零散笔记串成知识结构，标出概念之间的联系。','prompt'],
  ['writing','写作搭子','从提纲到初稿，帮你组织观点，保留自己的表达。','prompt'],
  ['writing','长文变短帖','提炼文章亮点，改写成适合社交平台的短内容。','prompt'],
  ['writing','文字润色','检查语句与结构，让表达清楚、自然、有重点。','prompt'],
  ['design','界面灵感收集','整理当前网页的布局、配色与字体，留下设计参考。','script'],
  ['design','设计评审清单','从用户目标、视觉层级与交互反馈检查设计方案。','prompt'],
  ['design','配色灵感','根据场景与情绪生成配色建议，说明适用位置。','prompt'],
  ['office','会议行动清单','把会议记录整理成行动项、负责人和截止时间。','prompt'],
  ['office','周五工作回顾','汇总本周进展与未完成事项，整理下周计划。','task'],
  ['office','表格数据整理','检查重复项与格式，整理可继续分析的数据。','prompt'],
  ['business','行业研究框架','整理市场、产品与竞争维度，列出需要验证的问题。','prompt'],
  ['business','财报阅读笔记','提取关键指标与变化，区分已知事实和待核实信息。','prompt'],
  ['business','商业动态简报','汇总关注企业的公开动态，整理来源与时间。','task'],
  ['development','代码评审搭子','检查边界条件、可读性与潜在错误，给出修改建议。','prompt'],
  ['development','网页结构检查','查看页面标题与链接结构，整理可访问性检查项。','script'],
  ['development','接口文档整理','从接口定义整理参数、响应与调用示例。','prompt'],
  ['tools','网页局部放大镜','放大当前网页的细节，让阅读与查看更轻松。','script'],
  ['tools','天气查看','按城市整理天气变化与出行提醒。','task'],
  ['tools','网页干净摘录','整理页面正文、标题和来源，留下易读的摘录。','script'],
  ['fun','周末旅行灵感','根据时间与兴趣规划一段轻松的短途旅行。','prompt'],
  ['fun','打地鼠小游戏','在网页里玩一局轻松的小游戏，休息一下。','script'],
  ['fun','烟花页面特效','为当前网页加入可点击的烟花效果。','script'],
  ['marketing','小红书选题搭子','围绕目标人群整理选题、标题与内容切入点。','prompt'],
  ['marketing','活动复盘助手','整理目标、结果与反馈，沉淀下一次行动建议。','prompt'],
  ['marketing','品牌声音检查','检查内容的语气、用词与品牌表达是否一致。','prompt'],
  // Append examples to preserve existing catalogue IDs and saved edits.
  ["study", "概念对照表", "比较相近概念，整理定义、差异与使用场景。", "prompt"],
  ["study", "阅读计划", "按学习目标拆分阅读任务，安排复习节奏。", "task"],
  ["study", "研究资料摘录", "摘录网页中的研究摘要与来源，汇入阅读笔记。", "script"],
  ["writing", "标题灵感", "围绕核心观点生成标题，比较不同表达角度。", "prompt"],
  ["writing", "故事大纲", "梳理人物、冲突与情节，搭建故事结构。", "prompt"],
  ["writing", "每日写作练习", "按主题整理写作题目与练习提示。", "task"],
  ["design", "交互文案检查", "检查按钮、提示与空状态文案是否清楚一致。", "prompt"],
  ["design", "设计交付清单", "整理组件状态、尺寸与交付注意事项。", "prompt"],
  ["design", "网页色彩提取", "收集页面中的颜色，生成可参考的色板。", "script"],
  ["office", "邮件草稿助手", "将要点整理成清楚、得体的工作邮件。", "prompt"],
  ["office", "每日待办整理", "整理当天事项，区分优先级与依赖关系。", "task"],
  ["office", "会议议程", "围绕会议目标整理议题与讨论顺序。", "prompt"],
  ["business", "竞品对照表", "按目标人群、功能与价格整理公开信息。", "prompt"],
  ["business", "商业计划提纲", "梳理用户、价值主张与需要验证的假设。", "prompt"],
  ["business", "每周市场观察", "整理市场变化与公开来源，形成观察清单。", "task"],
  ["development", "测试用例草稿", "根据需求梳理正常流程、边界与异常场景。", "prompt"],
  ["development", "错误日志分析", "整理日志线索，列出可能原因与验证步骤。", "prompt"],
  ["development", "网页链接检查", "汇总当前页面的链接及文字，辅助人工检查。", "script"],
  ["tools", "单位换算助手", "整理常用单位换算，附上计算过程。", "prompt"],
  ["tools", "网页目录生成", "提取标题层级，为长页面生成阅读目录。", "script"],
  ["tools", "出行准备清单", "根据目的地与行程整理需要携带的物品。", "prompt"],
  ["fun", "电影片单灵感", "根据心情与偏好整理电影候选清单。", "prompt"],
  ["fun", "趣味问答", "围绕感兴趣的主题生成一组趣味问题。", "prompt"],
  ["fun", "周末活动清单", "按兴趣整理可尝试的休闲活动。", "task"],
  ["marketing", "社媒发布计划", "围绕活动目标安排选题与发布节奏。", "prompt"],
  ["marketing", "用户反馈归纳", "归类反馈中的问题、需求与改进线索。", "prompt"],
  ["marketing", "运营周报", "整理内容表现与活动进展，生成复盘提纲。", "task"],
];
const catalogue = samples.map(([category,title,description,skillType], index) => ({
  id:`skill-catalogue-${category}-${index}`, title, description, skillType, category,
  type:index % 3 === 0 ? 'official' : 'community', author:index % 3 === 0 ? 'Tabbit 官方' : ['灵感实验室','效率研究所','社区创作者'][index % 3],
  // Installation counts are independent sample data, never converted from usage totals.
  installCount: [184, 126, 98, 215, 77, 143, 89, 62, 105][index % 9] + Math.floor(index / 9) * 7,
  createdAt:1793318400000-index*86400000, prompt:description,
}));
const legacyCategories = { 'skill-1':'study', 'skill-2':'office', 'skill-3':'tools', 'skill-4':'business', 'skill-5':'design', 'skill-6':'office' };
const officialIcons = new Map([
  ['代码评审搭子','5'], ['界面灵感收集','3'], ['会议行动清单','4'], ['小红书选题搭子','6'],
  ['论文阅读助手','1'], ['写作搭子','2'], ['行业研究框架','7'],
  ['网页局部放大镜','8'], ['周末旅行灵感','9'], ['标题灵感','10'],
  ['概念对照表','11'], ['竞品对照表','12'], ['交互文案检查','13'], ['邮件草稿助手','14'],
]);
export function getSkillCatalogue(saved = []) {
  const byId = new Map(catalogue.map(item => [item.id, item]));
  saved.forEach(item => byId.set(item.id, { ...byId.get(item.id), ...item }));
  return [...byId.values()].filter(item => !item.deleted).map(item => ({ ...item,
    category:item.category || legacyCategories[item.id] || 'tools',
    author:item.author || (item.type === 'official' ? 'Tabbit 官方' : item.type === 'custom' ? '我' : '社区创作者'),
    installCount:Number.isFinite(item.installCount) && item.installCount >= 0 ? Math.floor(item.installCount) : item.type === 'custom' ? 0 : null,
    installed:item.type === 'official' || (item.installed ?? item.type === 'installed'),
    enabled:item.type === 'official' || item.enabled !== false,
    ...(item.type === 'official' ? {officialIcon:officialIcons.get(item.title) || '1'} : {}),
  }));
}

export function getPublishedSkill(item) {
  const publication = item.publication;
  if (item.deleted || publication?.status !== 'published' || !publication.snapshot) return null;
  return { ...publication.snapshot, id:item.id, type:'custom', author:publication.snapshot.author || item.author || '我',
    publication, installCount:item.installCount ?? 0, _publicView:true,
    createdAt:Date.parse(publication.publishedAt) || item.createdAt || 0 };
}

export function skillSections(items, { scope='discover', kind='all', query='', sort='latest', authorFilter=null } = {}) {
  const term = query.trim().toLocaleLowerCase();
  const matches = item => !item.deleted && (kind === 'all' || item.skillType === kind) &&
    `${item.title} ${item.description} ${item.author}`.toLocaleLowerCase().includes(term);
  if (authorFilter) {
    const authored = items.flatMap(item => item.type === 'custom' ? (item.publication?.visibility === 'plaza' ? [getPublishedSkill(item)].filter(Boolean) : []) : [item])
      .filter(item => item.author === authorFilter && matches(item));
    return [{id:'all',label:'全部妙招',items:sortSkillItems(authored,sort)}];
  }
  const ordered = sortSkillItems(items.filter(matches), sort);
  if (scope === 'mine') return [
    { id:'official', label:'官方预装', items:ordered.filter(item => item.type === 'official') },
    { id:'installed', label:'已安装', items:ordered.filter(item => item.installed && !['custom','official'].includes(item.type)) },
    { id:'custom', label:'我创建的', items:ordered.filter(item => item.type === 'custom') },
  ];
  const available = sortSkillItems(items.flatMap(item => item.type === 'official' ? [] : item.type === 'custom'
    ? (item.publication?.visibility === 'plaza' ? [getPublishedSkill(item)].filter(Boolean) : []) : [item]).filter(matches), sort);
  return [
    { id:'all', label:sort === 'hot' ? '最热' : '最新', items:available.slice(0,8) },
    ...SKILL_CATEGORIES.map(([id,label]) => ({ id,label,items:available.filter(item => item.category === id) })),
  ].filter(section => section.items.length);
}
export function saveSkill(items, item) {
  const next = item.type === 'official' ? {...item, installed:true, enabled:true} : item;
  return items.some(existing => existing.id === next.id) ? items.map(existing => existing.id === next.id ? next : existing) : [...items,next];
}

export function sortSkillItems(items, sort = 'latest') {
  const popularity = item => (item.connectionType ? item.usageCount : item.installCount) || 0;
  return [...items].sort((a,b) => sort === 'hot' ? popularity(b) - popularity(a) || (b.createdAt || 0) - (a.createdAt || 0) : (b.createdAt || 0) - (a.createdAt || 0));
}
