/* eslint-disable -- Preserved upstream prototype snapshot; see ../README.md for isolated validation. */
import { useId, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, Bell, CalendarClock, CheckCheck, ChevronRight,
  FileText, FolderOpen, Lightbulb, MessageCircle, Plus, Share2, Star,
} from '../icons';
import './workspace-overview.css';
import { getWorkspaceItems } from './workspace-outputs';

const WORK_TYPES = [
  { page: 'chats', label: '对话', icon: MessageCircle },
  { page: 'files', label: 'AI 输出物', icon: FileText },
];

const LIBRARIES = [
  { page: 'files', label: 'AI 输出物', detail: '文件、AI 卡片与 AI 看板', icon: FolderOpen },
  { page: 'bookmarks', label: '收藏', detail: '留下值得再读的内容', icon: Star },
  { page: 'shares', label: '分享', detail: '管理分享过的内容', icon: Share2 },
];

function readItems(data, page) {
  return getWorkspaceItems(data, page);
}

function recentItems(data, filter) {
  const groups = WORK_TYPES.filter(group => filter === 'all' || group.page === filter)
    .map(group => readItems(data, group.page).slice(0, 6).map(item => ({ ...group, item })));
  // Each collection is newest-first. Interleave its records without inventing a
  // cross-collection chronology from localized display dates.
  return Array.from({ length: 6 }, (_, index) => groups.map(group => group[index]))
    .flat().filter(Boolean).slice(0, 6);
}

export default function WorkspaceOverview({ data, onNavigate, onNewChat }) {
  const [filter, setFilter] = useState('all');
  const headingId = useId();
  const recentId = useId();
  const attentionId = useId();
  const libraryId = useId();
  const recent = recentItems(data, filter);
  const unread = readItems(data, 'notifications').filter(item => item.unread);
  const tasks = readItems(data, 'tasks').filter(item => item.type === 'active');
  const currentType = WORK_TYPES.find(type => type.page === filter) || WORK_TYPES[0];
  const openDetail = (page, item) => onNavigate(page, `detail:${item.id}`);

  return <section className="aiw-overview" aria-labelledby={headingId}>
    <div className="aiw-overview-page-header"><header className="aiw-overview-header">
      <div className="aiw-overview-heading-copy">
        <h1 id={headingId}>今天，从这里继续</h1>
      </div>
      <button className="aiw-overview-action is-primary" onClick={() => onNewChat()}>
        <Plus size={16} aria-hidden="true"/><span>新建对话</span>
      </button>
    </header>

    <nav className="aiw-overview-actions" aria-label="开始新的工作">
      <button className="aiw-overview-action" onClick={() => onNavigate('tasks', 'create')}>
        <CalendarClock size={16} aria-hidden="true"/><span>创建定时任务</span>
      </button>
      <button className="aiw-overview-action" onClick={() => onNavigate('skills', 'all')}>
        <Lightbulb size={16} aria-hidden="true"/><span>浏览妙招</span>
      </button>
    </nav></div>

    <div className="aiw-overview-columns">
      <section className="aiw-overview-work" aria-labelledby={recentId}>
        <div className="aiw-overview-section-heading">
          <h2 id={recentId}>最近工作</h2>
          <button className="aiw-overview-text-link" onClick={() => onNavigate(currentType.page, 'all')}>
            查看{currentType.label}<ArrowRight size={14} aria-hidden="true"/>
          </button>
        </div>
        <div className="aiw-overview-panel">
          <div className="aiw-overview-filters" role="group" aria-label="最近工作类型">
            {[{ page: 'all', label: '全部', icon: FolderOpen }, ...WORK_TYPES].map(({ page, label, icon: Icon }) => <button
              key={page} aria-pressed={filter === page} onClick={() => setFilter(page)}
            >{label}</button>)}
          </div>
          {recent.length ? <ul className="aiw-overview-recent-list">
            {recent.map(({ page, label, icon: Icon, item }) => <li key={`${page}:${item.id}`}>
              <button className="aiw-overview-record" onClick={() => openDetail(page, item)}>
                <span className="aiw-overview-record-icon"><Icon size={18} strokeWidth={1.65} aria-hidden="true"/></span>
                <span className="aiw-overview-record-copy"><strong>{item.title}</strong><small>{label}{item.date && <><span aria-hidden="true"> · </span>{item.date}</>}</small></span>
                <ChevronRight className="aiw-overview-record-arrow" size={15} aria-hidden="true"/>
              </button>
            </li>)}
          </ul> : <div className="aiw-overview-empty">
            <FolderOpen size={24} strokeWidth={1.5} aria-hidden="true"/>
            <strong>这里还没有{filter === 'all' ? '工作记录' : currentType.label}</strong>
            <p>{filter === 'all' || filter === 'chats' ? '从一个问题开始，留下新的思路。' : '添加内容后，可以从这里快速回到它。'}</p>
            <button className="aiw-overview-text-link" onClick={() => filter === 'all' || filter === 'chats' ? onNewChat() : onNavigate(filter, 'create')}>
              {filter === 'all' || filter === 'chats' ? '新建对话' : '创建输出物'}<ArrowRight size={14} aria-hidden="true"/>
            </button>
          </div>}
          <p className="aiw-overview-panel-note">{filter === 'all' ? '汇集对话与 AI 输出物的最近记录' : `展示最近保存的${currentType.label}`}</p>
        </div>
      </section>

      <section className="aiw-overview-attention" aria-labelledby={attentionId}>
        <div className="aiw-overview-section-heading"><h2 id={attentionId}>待处理</h2><span>消息与日程</span></div>
        <div className="aiw-overview-panel aiw-overview-attention-panel">
          <div className="aiw-overview-subheading">
            <button onClick={() => onNavigate('notifications', 'all')}><Bell size={15} aria-hidden="true"/><span>未读消息</span><small>{unread.length}</small><ChevronRight size={14} aria-hidden="true"/></button>
          </div>
          {unread.length ? <ul className="aiw-overview-attention-list">
            {unread.slice(0, 2).map(item => <li key={item.id}><button onClick={() => openDetail('notifications', item)}>
              <span className="aiw-overview-unread" aria-hidden="true"/><span><strong>{item.title}</strong><small>{item.description}</small></span>
            </button></li>)}
          </ul> : <p className="aiw-overview-calm"><CheckCheck size={16} aria-hidden="true"/>消息已读完，可以专注手上的事。</p>}
          <div className="aiw-overview-next">
            <div className="aiw-overview-subheading">
              <button onClick={() => onNavigate('tasks', 'active')}><CalendarClock size={15} aria-hidden="true"/><span>生效任务</span><small>{tasks.length}</small><ChevronRight size={14} aria-hidden="true"/></button>
            </div>
            {tasks.length ? <ul className="aiw-overview-attention-list aiw-overview-task-list">
              {tasks.slice(0, 2).map(item => <li key={item.id}><button onClick={() => openDetail('tasks', item)}>
                <span className="aiw-overview-task-mark" aria-hidden="true"/><span><strong>{item.title}</strong><small>{item.schedule || item.date || '查看执行安排'}</small></span><ChevronRight size={14} aria-hidden="true"/>
              </button></li>)}
            </ul> : <div className="aiw-overview-no-tasks"><p>还没有生效中的任务</p><button className="aiw-overview-text-link" onClick={() => onNavigate('tasks', 'create')}>安排一项任务<ArrowRight size={14} aria-hidden="true"/></button></div>}
          </div>
          <p className="aiw-overview-panel-note">任务为示例，尚未连接自动执行</p>
        </div>
      </section>
    </div>

    <section className="aiw-overview-library" aria-labelledby={libraryId}>
      <div className="aiw-overview-section-heading"><h2 id={libraryId}>资料与成果</h2><span>按内容找到需要的东西</span></div>
      <div className="aiw-overview-library-grid">
        {LIBRARIES.map(({ page, label, detail, icon: Icon }) => <button key={page} onClick={() => onNavigate(page, 'all')}>
          <span className="aiw-overview-library-top"><Icon size={20} strokeWidth={1.6} aria-hidden="true"/><small>{readItems(data, page).length} 项</small></span>
          <strong>{label}<ArrowUpRight size={14} aria-hidden="true"/></strong><span>{detail}</span>
        </button>)}
      </div>
    </section>
  </section>;
}
