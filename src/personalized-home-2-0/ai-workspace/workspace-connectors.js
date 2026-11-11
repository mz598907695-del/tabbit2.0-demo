import { sortSkillItems } from './workspace-skills.js';

// Local catalogue examples; adding a card does not authorize an external service.
export const CONNECTOR_CATEGORIES = [['all', '全部'], ['connector', '连接器'], ['mcp', 'MCP']];
export const CONNECTOR_EXAMPLES = [
  { id:'notion', title:'Notion', mark:'N', color:'#707070', category:'知识管理', description:'把笔记、文档与项目资料带入对话，整理知识与想法。', capabilities:['查找笔记与页面','整理文档内容','汇总项目资料'], usageCount:12400, createdAt:8 },
  { id:'github', title:'GitHub', mark:'GH', color:'#8064ba', category:'开发工具', description:'围绕代码仓库、问题与变更记录，梳理开发进展。', capabilities:['浏览仓库内容','整理 Issue 与变更','辅助代码讨论'], usageCount:18200, createdAt:7 },
  { id:'drive', title:'Google Drive', mark:'D', color:'#2b9360', category:'文件管理', description:'集中查找云端文件，让文档资料成为工作的参考。', capabilities:['查找文件','阅读文档资料','整理资料目录'], usageCount:9800, createdAt:6 },
  { id:'gmail', title:'Gmail', mark:'M', color:'#c7524b', category:'邮件沟通', description:'整理邮件线索、提炼待办，准备清楚得体的回复。', capabilities:['搜索邮件','归纳邮件要点','准备回复草稿'], usageCount:8600, createdAt:5 },
  { id:'calendar', title:'Google Calendar', mark:'31', color:'#4475c4', category:'日程管理', description:'查看日程与会议安排，规划一天的工作节奏。', capabilities:['查看日程','整理会议安排','准备会前资料'], usageCount:7200, createdAt:4 },
  { id:'slack', title:'Slack', mark:'S', color:'#ad598c', category:'团队沟通', description:'从团队讨论中提炼决策、进展与需要跟进的事项。', capabilities:['查找团队讨论','汇总讨论要点','整理跟进事项'], usageCount:11200, createdAt:3 },
  { id:'linear', title:'Linear', mark:'L', color:'#7167d9', category:'项目管理', description:'围绕任务与项目整理优先级，跟进团队工作进展。', capabilities:['查看项目任务','梳理优先级','汇总项目进展'], usageCount:6300, createdAt:2 },
  { id:'figma', title:'Figma', mark:'F', color:'#be6646', category:'设计协作', description:'把设计稿与组件说明带入讨论，辅助设计协作。', capabilities:['查看设计内容','整理组件说明','辅助设计评审'], usageCount:9100, createdAt:1 },
  { id:'filesystem-mcp', title:'文件系统 MCP', mark:'FS', color:'#a27940', category:'文件管理', connectionType:'mcp', description:'围绕本地文件与目录整理资料，辅助检索和阅读。', capabilities:['浏览授权目录','检索文件内容','整理文件资料'], usageCount:4300, createdAt:0 },
  { id:'browser-mcp', title:'浏览器 MCP', mark:'WEB', color:'#448b91', category:'网页工具', connectionType:'mcp', description:'将网页内容与浏览操作带入任务，辅助收集信息。', capabilities:['查看网页内容','整理网页信息','辅助页面操作'], usageCount:5100, createdAt:-1 },
  { id:'database-mcp', title:'数据库 MCP', mark:'DB', color:'#7672b8', category:'数据分析', connectionType:'mcp', description:'围绕数据表与查询结果，探索数据并整理分析线索。', capabilities:['查看数据表结构','查询授权数据','整理分析结果'], usageCount:3700, createdAt:-2 },
].map(item => ({ connectionType:'connector', ...item }));
export const CONNECTOR_STORAGE_KEY = 'personalized-home-2-0-my-connectors';
export function readConnectorIds() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONNECTOR_STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? [...new Set(saved.filter(id => CONNECTOR_EXAMPLES.some(item => item.id === id)))] : [];
  } catch { return []; }
}
export function connectorSections({ scope = 'discover', query = '', sort = 'latest', added = [], category = 'all' } = {}) {
  const term = query.trim().toLocaleLowerCase();
  const items = sortSkillItems(CONNECTOR_EXAMPLES.filter(item => (scope !== 'mine' || added.includes(item.id)) && (category === 'all' || item.connectionType === category) && `${item.title} ${item.description} ${item.category}`.toLocaleLowerCase().includes(term)), sort);
  return [{ id:scope === 'mine' ? 'added' : 'all', label:scope === 'mine' ? '已添加' : sort === 'hot' ? '最热' : '最新', items }];
}
