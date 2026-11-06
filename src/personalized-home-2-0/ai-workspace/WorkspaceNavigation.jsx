import { useId, useState } from 'react';
import { PanelLeftClose, MessageSquare, SquarePen, FolderOpen, Lightbulb, CalendarClock, LayoutGrid, LayoutDashboard, Star, Share2, Bell, Gauge, Search, ChevronRight, Pin, Home, ArrowUpRight, Plus, CircleCheck, Pause, Clock3, FileText, Image, Globe, PanelsTopLeft, Sparkles, Folder, ArrowRight } from '../icons';
import './workspace-navigation.css';
import { INITIAL_DATA, PAGE_TABS } from './workspace-data';
import ClassicSidebar from './ClassicSidebar';
import { getWorkspaceItems } from './workspace-outputs';

const MODULES = {
  home: { label: '首页', Icon: Home },
  chats: { label: '对话', Icon: MessageSquare },
  files: { label: 'AI 输出物', Icon: FolderOpen },
  skills: { label: '妙招', Icon: Lightbulb },
  tasks: { label: '定时任务', Icon: CalendarClock },
  bookmarks: { label: '收藏', Icon: Star },
  shares: { label: '分享', Icon: Share2 },
  notifications: { label: '通知', Icon: Bell },
  usage: { label: '会员与用量', Icon: Gauge },
};
const CONTEXT = {
  chats: [['全部', MessageSquare], ['云端', Globe], ['本地', PanelsTopLeft]],
  files: [['全部', FolderOpen], ['网页', Globe], ['文档', FileText], ['图片', Image], ['表格', LayoutGrid], ['AI 卡片', Sparkles], ['AI 看板', PanelsTopLeft], ['其他', Folder]],
  skills: [['全部', Lightbulb], ['官方预装', CircleCheck], ['已安装', Pin], ['我创建的', SquarePen]],
  tasks: [['全部', CalendarClock], ['生效中', CircleCheck], ['已暂停', Pause]],
  bookmarks: [['全部收藏', Star], ['学习', Folder], ['AI', Folder], ['设计', Folder], ['工作', Folder]],
  shares: [['全部', Share2], ['网页', Globe], ['对话', MessageSquare]],
  notifications: [['全部', Bell], ['产品公告', Sparkles], ['客服反馈', MessageSquare], ['会员和支付', Gauge]],
  usage: [['会员和用量', Gauge], ['重置券', Sparkles], ['订单中心', FileText]],
};

function NavItem({ id, page, onNavigate, label, Icon, meta, quiet = false, filter, selected = false }) {
  const module = MODULES[id];
  const ItemIcon = Icon || module?.Icon;
  return <button type="button" className={`aiwn-item ${quiet ? 'is-quiet' : ''}`} aria-current={selected || (page === id && !filter) ? 'page' : undefined} onClick={() => onNavigate(id, filter)}>
    {ItemIcon && <ItemIcon size={16} strokeWidth={1.7} />}<span>{label || module?.label}</span>{meta && <small>{meta}</small>}
  </button>;
}
function SearchButton({ onSearch, compact = false }) {
  return <button type="button" className={`aiwn-search ${compact ? 'is-compact' : ''}`} onClick={onSearch}><Search size={16}/><span>{compact ? '搜索' : '搜索全部内容'}</span></button>;
}
function Header({ title, page, onClose, onNavigate, notification = false, unreadCount = 0 }) {
  return <header className="aiwn-header"><button type="button" className="aiwn-title" onClick={() => onNavigate('home')} title="返回首页">{title}</button><div className="aiwn-header-actions">{notification && <button type="button" className="aiwn-icon aiwn-notification" aria-label="通知" aria-current={page === 'notifications' ? 'page' : undefined} onClick={() => onNavigate('notifications')}><Bell size={17}/>{unreadCount > 0 && <i/>}</button>}<button type="button" className="aiwn-icon" aria-label="收起 AI 侧边栏" onClick={onClose}><PanelLeftClose size={17}/></button></div></header>;
}
function Section({ title, action, onAction, children, className = '' }) {
  return <section className={`aiwn-section ${className}`}><div className="aiwn-section-heading">{onAction ? <button type="button" onClick={onAction}>{title}<ChevronRight size={12}/></button> : <span>{title}</span>}{action}</div>{children}</section>;
}
function HistoryList({ onNavigate, data, pinned = true, recent = true, limit = 4 }) {
  const pinnedRecords = data.chats.filter(item => item.pinned);
  const recentRecords = data.chats.filter(item => !item.pinned);
  return <>{pinned && <Section title="置顶" onAction={() => onNavigate('chats', 'pinned')}>{pinnedRecords.map(item => <button type="button" className="aiwn-history" key={item.id} onClick={() => onNavigate('chats', `detail:${item.id}`)}><span>{item.title}</span><Pin size={12}/></button>)}</Section>}{recent && <Section title="最近对话" onAction={() => onNavigate('chats')}>{recentRecords.slice(0, limit).map(item => <button type="button" className="aiwn-history" key={item.id} onClick={() => onNavigate('chats', `detail:${item.id}`)}><span>{item.title}</span></button>)}</Section>}</>;
}
function UsageFooter({ onNavigate, page, short = false }) {
  return <footer className="aiwn-footer"><button type="button" className="aiwn-usage" aria-current={page === 'usage' ? 'page' : undefined} onClick={() => onNavigate('usage')}><Gauge size={17}/><span>{short ? '剩余 85%' : '本周剩余 85%'}</span><ChevronRight size={13}/></button><button type="button" className="aiwn-upgrade" onClick={() => onNavigate('usage')}>升级<ArrowUpRight size={12}/></button></footer>;
}
function NewChat({ onNewChat, outlined = false, label = '新建对话' }) {
  return <button type="button" className={`aiwn-new-chat ${outlined ? 'is-outlined' : ''}`} onClick={() => onNewChat()}><SquarePen size={16}/><span>{label}</span><Plus size={14}/></button>;
}
function GroupedNavigation(props) {
  const { page, onNavigate, onClose, onSearch, onNewChat, data } = props;
  return <><Header title="Tabbit" onClose={onClose} onNavigate={onNavigate} page={page}/><div className="aiwn-scroll"><NewChat onNewChat={onNewChat} outlined/><SearchButton onSearch={onSearch}/><Section title="工作">{['chats','tasks','skills'].map(id => <NavItem key={id} id={id} page={page} onNavigate={onNavigate}/>)}</Section><Section title="资料">{['files','bookmarks'].map(id => <NavItem key={id} id={id} page={page} onNavigate={onNavigate}/>)}</Section><Section title="管理">{['shares','notifications'].map(id => <NavItem key={id} id={id} page={page} onNavigate={onNavigate} meta={id === 'notifications' ? data.notifications.filter(item => item.unread).length || undefined : undefined}/>)}</Section><HistoryList data={data} onNavigate={onNavigate} pinned={false} limit={2}/></div><UsageFooter onNavigate={onNavigate} page={page}/></>;
}
function RailNavigation(props) {
  const { page, onNavigate, onClose, onSearch, onNewChat, data, activeFilter } = props;
  const active = page === 'home' ? 'chats' : page;
  const contextTitle = MODULES[active]?.label || '对话';
  const filters = CONTEXT[active] || [];
  const contextFilter = PAGE_TABS[active]?.find(([id]) => id === activeFilter)?.[1] || activeFilter || '';
  function navigateFilter(next, filter) { onNavigate(next, filter); }
  return <><nav className="aiwn-rail" aria-label="全部功能"><button type="button" className="aiwn-rail-home" onClick={() => onNavigate('home')} aria-label="返回首页" title="返回首页"><Home size={19}/></button><div className="aiwn-rail-items">{['chats','tasks','skills','files','bookmarks','shares','notifications'].map(id => { const { Icon, label } = MODULES[id]; return <button type="button" key={id} aria-current={active === id ? 'page' : undefined} onClick={() => onNavigate(id)} title={label}><Icon size={19}/><span>{label === '定时任务' ? '任务' : id === 'files' ? '输出物' : label}</span>{id === 'notifications' && data.notifications.some(item => item.unread) && <i/>}</button>; })}</div><button type="button" className="aiwn-rail-account" aria-current={page === 'usage' ? 'page' : undefined} onClick={() => onNavigate('usage')} title="会员与用量"><Gauge size={19}/><span>用量</span></button></nav><div className="aiwn-context"><Header title={contextTitle} onClose={onClose} onNavigate={onNavigate} page={page}/><div className="aiwn-scroll"><SearchButton onSearch={onSearch} compact/>{active === 'chats' ? <><NewChat onNewChat={onNewChat}/><div className="aiwn-source-tabs" aria-label="对话来源">{['全部','云端','本地'].map(label => <button type="button" key={label} aria-pressed={contextFilter === label || (!contextFilter && label === '全部')} onClick={() => navigateFilter('chats', label)}>{label}</button>)}</div><HistoryList data={data} onNavigate={onNavigate}/></> : <><Section title={active === 'usage' ? '账户' : '分类'}>{filters.map(([label, Icon]) => <NavItem key={label} id={active} Icon={Icon} label={label} filter={label} selected={contextFilter === label || (!contextFilter && filters[0]?.[0] === label)} onNavigate={navigateFilter}/>)}</Section>{active === 'tasks' && <Section title="即将执行">{data.tasks.filter(item => item.type === 'active').slice(0, 2).map(item => <button type="button" key={item.id} className="aiwn-context-preview" onClick={() => onNavigate('tasks', `detail:${item.id}`)}><strong>{item.title}</strong><span>{item.date}</span></button>)}</Section>}{['files','bookmarks','skills'].includes(active) && <Section title="最近使用">{getWorkspaceItems(data, active).slice(0, 2).map(item => <button type="button" key={item.id} className="aiwn-context-preview" onClick={() => onNavigate(active, `detail:${item.id}`)}><strong>{item.title}</strong><span>{item.date || '最近使用'}</span></button>)}</Section>}</>}</div><div className="aiwn-context-footer"><button type="button" onClick={() => onNavigate('home')}><Home size={14}/>返回首页<ArrowRight size={13}/></button></div></div></>;
}
function ActionNavigation(props) {
  const { page, onNavigate, onClose, onSearch, onNewChat, data } = props;
  const activeTasks = data.tasks.filter(item => item.type === 'active');
  const nextTask = activeTasks[0];
  const pausedCount = data.tasks.filter(item => item.type === 'paused').length;
  return <><Header title="工作台" onClose={onClose} onNavigate={onNavigate} page={page} notification unreadCount={data.notifications.filter(item => item.unread).length}/><div className="aiwn-scroll"><SearchButton onSearch={onSearch}/><button type="button" className="aiwn-task-primary" onClick={() => onNavigate('tasks', 'create')}><Plus size={16}/><span>新建定时任务</span></button><Section title="正在推进" action={<button type="button" className="aiwn-heading-action" onClick={() => onNavigate('tasks')}>查看全部</button>}>{nextTask ? <button type="button" className="aiwn-next-run" onClick={() => onNavigate('tasks', `detail:${nextTask.id}`)}><span className="aiwn-next-label"><Clock3 size={14}/>下一次执行</span><strong>{nextTask.title}</strong><span className="aiwn-next-meta">{nextTask.date}<ArrowUpRight size={14}/></span></button> : <button type="button" className="aiwn-next-run" onClick={() => onNavigate('tasks', 'create')}><span className="aiwn-next-label"><Clock3 size={14}/>暂无生效中的任务</span><strong>让下一件事自动开始</strong><span className="aiwn-next-meta">创建定时任务<Plus size={14}/></span></button>}<div className="aiwn-task-counts"><button type="button" onClick={() => onNavigate('tasks', '生效中')}><CircleCheck size={14}/>生效中 <small>{activeTasks.length}</small><ChevronRight size={12}/></button><button type="button" onClick={() => onNavigate('tasks', '已暂停')}><Pause size={14}/>已暂停 <small>{pausedCount}</small><ChevronRight size={12}/></button></div></Section><Section title="开始工作"><NewChat onNewChat={onNewChat}/><NavItem id="chats" page={page} onNavigate={onNavigate} label="对话记录"/><NavItem id="skills" page={page} onNavigate={onNavigate}/></Section><Section title="资料与成果">{['files','bookmarks','shares'].map(id => <NavItem key={id} id={id} page={page} onNavigate={onNavigate}/>)}</Section></div><UsageFooter onNavigate={onNavigate} page={page}/></>;
}
function ResourceNavigation(props) {
  const { page, onNavigate, onClose, onSearch, onNewChat, data } = props;
  const recentResources = [
    { page: 'files', record: getWorkspaceItems(data, 'files')[0], Icon: FileText, category: 'AI 输出物' },
    { page: 'files', record: getWorkspaceItems(data, 'files').find(item => item.type === 'board'), Icon: PanelsTopLeft, category: 'AI 看板' },
    { page: 'bookmarks', record: data.bookmarks.find(item => item.type === '设计') || data.bookmarks[0], Icon: Star, category: '收藏' },
  ].filter(item => item.record);
  return <><Header title="内容中枢" onClose={onClose} onNavigate={onNavigate} page={page} notification unreadCount={data.notifications.filter(item => item.unread).length}/><div className="aiwn-scroll"><SearchButton onSearch={onSearch}/><Section title="我的内容"><nav className="aiwn-resource-grid" aria-label="内容类型">{['files','bookmarks','shares'].map(id => {const {Icon,label}=MODULES[id]; return <button type="button" key={id} onClick={() => onNavigate(id)} aria-current={page === id ? 'page' : undefined}><Icon size={19} strokeWidth={1.6}/><span>{label}</span><ArrowUpRight size={11}/></button>;})}</nav></Section><Section title="最近打开" onAction={() => onSearch()}>{recentResources.map(({page: destination, record, Icon, category}) => <button type="button" key={record.id} className="aiwn-resource-recent" onClick={() => onNavigate(destination, `detail:${record.id}`)}><Icon size={17}/><span><strong>{record.title}</strong><small>{category} · {record.date}</small></span></button>)}</Section><Section title="用 AI 继续工作"><NewChat onNewChat={onNewChat}/><NavItem id="chats" page={page} onNavigate={onNavigate} label="对话记录"/><NavItem id="skills" page={page} onNavigate={onNavigate}/><NavItem id="tasks" page={page} onNavigate={onNavigate}/></Section></div><UsageFooter onNavigate={onNavigate} page={page}/></>;
}

function LightRailNavigation({ page, onNavigate, onClose, onSearch, onNewChat, data }) {
  const unreadCount = data.notifications.filter(item => item.unread).length;
  return <>
    <header className="aiwn-light-top">
      <button type="button" className="aiwn-icon" aria-label="返回首页" title="返回首页" aria-current={page === 'home' ? 'page' : undefined} onClick={() => onNavigate('home')}><Home size={17}/></button>
      <button type="button" className="aiwn-icon" aria-label="收起 AI 侧边栏" title="收起 AI 侧边栏" onClick={onClose}><PanelLeftClose size={17}/></button>
    </header>
    <div className="aiwn-light-actions">
      <button type="button" className="aiwn-light-button" onClick={onSearch} aria-label="搜索全部内容"><Search size={19}/><span>搜索</span></button>
      <button type="button" className="aiwn-light-button aiwn-light-new" onClick={() => onNewChat()} aria-label="新建对话"><SquarePen size={19}/><span>新建</span></button>
    </div>
    <nav className="aiwn-light-modules" aria-label="全部功能">
      {['chats','tasks','skills','files','bookmarks','shares','notifications'].map(id => {
        const { Icon, label } = MODULES[id];
        const shortLabel = id === 'tasks' ? '任务' : id === 'files' ? '输出物' : label;
        return <button type="button" key={id} className="aiwn-light-button" aria-label={label} aria-current={page === id ? 'page' : undefined} onClick={() => onNavigate(id)}>
          <Icon size={19} strokeWidth={1.6}/><span>{shortLabel}</span>
          {id === 'notifications' && unreadCount > 0 && <i className="aiwn-light-unread" aria-label={`${unreadCount} 条未读通知`}/>}
        </button>;
      })}
    </nav>
    <footer className="aiwn-light-footer"><button type="button" className="aiwn-light-button" aria-label="会员与用量，本周剩余 85%" aria-current={page === 'usage' ? 'page' : undefined} onClick={() => onNavigate('usage')}><Gauge size={19}/><span>用量</span><small>85%</small></button></footer>
  </>;
}

function DirectoryBranch({ id, page, activeFilter, onNavigate, initialOpen = false, meta }) {
  const [expanded, setExpanded] = useState(initialOpen);
  const childrenId = useId();
  const { label, Icon } = MODULES[id];
  const categories = PAGE_TABS[id].filter(([filter]) => filter !== 'all');
  const currentFilter = PAGE_TABS[id].find(([filter, name]) => filter === activeFilter || name === activeFilter)?.[0];
  return <div className={`aiwn-directory-branch ${page === id ? 'is-active' : ''}`}>
    <div className="aiwn-directory-row">
      <button type="button" className="aiwn-directory-destination" aria-current={page === id && (!currentFilter || currentFilter === 'all') ? 'page' : undefined} onClick={() => onNavigate(id, id === 'usage' ? 'membership' : 'all')}><Icon size={16} strokeWidth={1.7}/><span>{label}</span>{meta != null && <small>{meta}</small>}</button>
      <button type="button" className="aiwn-directory-toggle" aria-label={`${expanded ? '收起' : '展开'}${label}分类`} aria-expanded={expanded} aria-controls={childrenId} onClick={() => setExpanded(value => !value)} onKeyDown={event => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); setExpanded(event.key === 'ArrowRight'); }
      }}><ChevronRight size={14}/></button>
    </div>
    <div id={childrenId} className="aiwn-directory-children" hidden={!expanded}>
      {categories.map(([filter, name]) => <button type="button" key={filter} aria-current={page === id && currentFilter === filter ? 'page' : undefined} onClick={() => onNavigate(id, filter)}><span>{name}</span></button>)}
    </div>
  </div>;
}

function DirectoryNavigation({ page, activeFilter, onNavigate, onClose, onSearch, onNewChat, data }) {
  const branchProps = { page, activeFilter, onNavigate };
  return <>
    <Header title="Tabbit" onClose={onClose} onNavigate={onNavigate} page={page}/>
    <div className="aiwn-scroll">
      <SearchButton onSearch={onSearch}/><NewChat onNewChat={onNewChat} outlined/>
      <nav aria-label="功能目录">
        <Section title="工作">{['chats','tasks','skills'].map(id => <DirectoryBranch key={id} id={id} initialOpen={id === 'chats'} {...branchProps}/>)}</Section>
        <Section title="资料">{['files','bookmarks','shares'].map(id => <DirectoryBranch key={id} id={id} {...branchProps}/>)}</Section>
        <Section title="动态"><DirectoryBranch id="notifications" {...branchProps} meta={data.notifications.filter(item => item.unread).length || undefined}/></Section>
      </nav>
    </div>
    <footer className="aiwn-directory-footer"><DirectoryBranch id="usage" {...branchProps} meta="85%"/></footer>
  </>;
}

function OverviewNavigation({ page, onNavigate, onClose, onSearch, onNewChat, data }) {
  return <>
    <Header title="Tabbit" onClose={onClose} onNavigate={onNavigate} page={page}/>
    <div className="aiwn-scroll">
      <NewChat onNewChat={onNewChat} outlined/><SearchButton onSearch={onSearch}/>
      <nav className="aiwn-overview-primary" aria-label="工作区入口">
        <NavItem id="overview" page={page} label="总览" Icon={LayoutDashboard} onNavigate={onNavigate}/>
        <NavItem id="home" page={page} label="返回首页" onNavigate={onNavigate}/>
      </nav>
      <Section title="工作">{['chats','tasks','skills'].map(id => <NavItem key={id} id={id} page={page} onNavigate={onNavigate}/>)}</Section>
      <Section title="资料">{['files','bookmarks','shares'].map(id => <NavItem key={id} id={id} page={page} onNavigate={onNavigate}/>)}</Section>
      <Section title="账户"><NavItem id="notifications" page={page} onNavigate={onNavigate} meta={data.notifications.filter(item => item.unread).length || undefined}/></Section>
    </div>
    <UsageFooter onNavigate={onNavigate} page={page} short/>
  </>;
}

export default function WorkspaceNavigation({ variant = 1, page = 'home', data = INITIAL_DATA, active = true, activeFilter, activeConversationId, onNavigate, onClose, onSearch, onNewChat, onUpdateChat, onDeleteChats }) {
  const View = [ClassicSidebar, GroupedNavigation, RailNavigation, ActionNavigation, ResourceNavigation, LightRailNavigation, DirectoryNavigation, OverviewNavigation][Number(variant) - 1] || ClassicSidebar;
  return <aside className={`aiw-navigation aiwn-variant-${variant}`} aria-label="AI 工作区导航"><View onUpdateChat={onUpdateChat} onDeleteChats={onDeleteChats} data={data} active={active} activeFilter={activeFilter} activeConversationId={activeConversationId} page={page} onNavigate={onNavigate} onClose={onClose} onSearch={onSearch} onNewChat={onNewChat}/></aside>;
}
