import { useRef, useState } from 'react';
import { ChartCandlestick, ClipboardList, Cog, FileImage, FileSpreadsheet, FileText, FileType, Globe, Lightbulb, MessageSquareText, Microscope, Plus, Presentation, Search, TrendingUp, UserRoundSearch, X } from "./icons";
import { DEFAULT_COMMANDS } from './composer-data';
import './composer-ideas.css';

export const IDEAS = [
  { name: '深度研究', Icon: Microscope, tone: 'blue', description: '梳理关键问题、可靠来源与不同观点，形成有依据的研究结论。', prompt: '请围绕以下主题开展深入研究，梳理关键问题、可靠来源和不同观点，并给出有依据的结论。\n\n研究主题：' },
  { name: '金融市场分析', Icon: ChartCandlestick, tone: 'green', description: '分析市场走势、关键驱动与主要风险，注明数据来源和时间。', prompt: '请分析以下市场或资产，整理近期走势、关键驱动因素和主要风险，并注明数据来源与时间。\n\n分析对象：' },
  { name: '生成网页', Icon: Globe, tone: 'blue', description: '将需求转为布局清晰、风格合适且可交互的网页。', prompt: '请根据以下需求制作一个网页，包含清晰的布局、合适的视觉风格和可用的交互。\n\n网页需求：' },
  { name: '生成 PDF', Icon: FileText, tone: 'rose', description: '整理文档内容，统一标题层级、排版与图文布局。', prompt: '请将以下内容整理为适合导出 PDF 的文档，统一排版、标题层级和图文布局。\n\n文档内容：' },
  { name: '生成 PPT', Icon: Presentation, tone: 'amber', description: '围绕主题与受众，组织叙事结构、每页重点和图表。', prompt: '请根据以下主题制作演示文稿，梳理叙事结构、每页重点和图表建议。\n\n演示主题与受众：' },
  { name: '生成 Excel', Icon: FileSpreadsheet, tone: 'green', description: '设计清晰的表格字段，补充必要公式与数据展示。', prompt: '请根据以下需求制作 Excel 表格，设置清晰的字段、必要公式和数据展示。\n\n表格需求：' },
  { name: '生成 Word', Icon: FileType, tone: 'blue', description: '撰写并排版文档，保持清晰的标题层级与段落结构。', prompt: '请根据以下要求撰写并排版 Word 文档，使用清晰的标题层级与段落结构。\n\n文档要求：' },
  { name: '生成图片', Icon: FileImage, tone: 'amber', description: '根据描述构思主体、构图、色彩与视觉风格。', prompt: '请根据以下描述生成图片，注意主体、构图、色彩与视觉风格。\n\n图片描述：' },
];

const COMMAND_PRESENTATION = {
  meeting: { Icon: ClipboardList, description: '提炼会议结论、待办事项、负责人和截止时间。' },
  promotion: { Icon: TrendingUp, description: '整理工作贡献、能力表现与待提升项，生成评审反馈。' },
  interview: { Icon: UserRoundSearch, description: '汇总候选人经验、能力证据与待确认的问题。' },
  customer: { Icon: MessageSquareText, description: '记录客户反馈、需求、沟通共识与后续行动。' },
  weekly: { Icon: ClipboardList, description: '汇总本周进展、当前风险、待协调事项与下周计划。' },
};

export default function ComposerIdeasMenu({ customCommands, onSelect, onCreate, onManage }) {
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  const bodyRef = useRef(null);
  const listRef = useRef(null);
  const keyword = query.trim().toLocaleLowerCase();
  const matches = entry => `${entry.name} ${entry.description}`.toLocaleLowerCase().includes(keyword);
  const myIdeas = [
    ...customCommands.map(command => ({ ...command, Icon: Lightbulb, tone: 'neutral', description: command.prompt.replace(/\s+/g, ' ') })),
    ...DEFAULT_COMMANDS.map(command => ({ ...command, ...COMMAND_PRESENTATION[command.id], tone: 'neutral' })),
  ].filter(matches);
  const officialIdeas = IDEAS.map(idea => ({ ...idea, id: idea.name, mode: '任务' })).filter(matches);

  function changeQuery(value) {
    setQuery(value);
    if (listRef.current) listRef.current.scrollTop = 0;
  }

  function keydown(event) {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.key === 'Escape' && query) {
      event.preventDefault();
      event.stopPropagation();
      changeQuery('');
      searchRef.current?.focus({ preventScroll: true });
      return;
    }
    const inSearch = event.target === searchRef.current;
    const controls = [...bodyRef.current.querySelectorAll('[data-composer-menu-item]:not(:disabled)')];
    const index = controls.indexOf(event.target);
    if (!inSearch && index < 0) return;
    if (!['ArrowDown', 'ArrowUp'].includes(event.key) && (inSearch || !['Home', 'End'].includes(event.key))) return;
    event.preventDefault();
    event.stopPropagation();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1);
    const target = next < 0 ? searchRef.current : controls[Math.min(next, controls.length - 1)];
    target?.focus({ preventScroll: true });
    if (target && listRef.current?.contains(target)) {
      const row = target.getBoundingClientRect();
      const list = listRef.current.getBoundingClientRect();
      if (row.bottom > list.bottom) listRef.current.scrollTop += row.bottom - list.bottom;
      else if (row.top < list.top) listRef.current.scrollTop += row.top - list.top;
    }
  }

  function renderIdea({ id, name, Icon, tone, prompt, mode }) {
    return <button key={id} type="button" className="tb-composer-menu-row tb-idea-row" data-composer-menu-item="" aria-label={name} onClick={() => onSelect(prompt, mode)}>
      <span className="tb-idea-icon" data-tone={tone}><Icon size={16} aria-hidden="true" /></span>
      <span className="tb-idea-copy"><strong>{name}</strong></span>
    </button>;
  }

  return <div ref={bodyRef} className="tb-ideas-body" onKeyDown={keydown}>
    <div className="tb-dropdown-search">
      <Search size={16} aria-hidden="true" />
      <input ref={searchRef} data-composer-initial="" aria-label="搜索妙招" placeholder="搜索妙招" value={query} autoComplete="off" onChange={event => changeQuery(event.target.value)} />
      {query && <button type="button" aria-label="清除妙招搜索" onClick={() => { changeQuery(''); searchRef.current?.focus({ preventScroll: true }); }}><X size={14} aria-hidden="true" /></button>}
    </div>
    <div ref={listRef} className="tb-ideas-list" role="group" aria-label="妙招列表">
      <section className="tb-ideas-section" aria-label="我的妙招">
        <div className="tb-dropdown-heading">
          <h3>我的妙招</h3>
          <button type="button" className="tb-ideas-create" data-composer-menu-item="" onClick={onCreate} disabled={customCommands.length >= 30} title={customCommands.length >= 30 ? '已达到 30 个自定义妙招上限' : undefined}>
            <Plus size={14} aria-hidden="true" /><span>新建妙招</span>
          </button>
        </div>
        {myIdeas.map(renderIdea)}
      </section>
      {officialIdeas.length > 0 && <section className="tb-ideas-section" aria-label="官方预装">
        <div className="tb-dropdown-heading"><h3>官方预装</h3></div>
        {officialIdeas.map(renderIdea)}
      </section>}
      {!myIdeas.length && !officialIdeas.length && <div className="tb-ideas-empty" role="status"><Search size={23} aria-hidden="true" /><strong>没有找到相关妙招</strong><span>试试其他关键词，或新建自己的妙招。</span></div>}
    </div>
    <footer className="tb-ideas-footer tb-dropdown-footer">
      <button type="button" className="tb-composer-menu-row" data-composer-menu-item="" onClick={onManage}><Cog size={16} aria-hidden="true" /><span>管理妙招</span></button>
    </footer>
  </div>;
}
