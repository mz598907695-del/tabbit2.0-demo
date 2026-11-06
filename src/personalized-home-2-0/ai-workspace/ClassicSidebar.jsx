import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Bell, Ellipsis, BatchListChecks, ListChecks, Pencil, Pin, PinOff, Search, Trash2 } from '../icons';
import './classic-sidebar.css';
import SidebarScrollArea from './SidebarScrollArea';
import SidebarToggleIcon from './SidebarToggleIcon';
import SidebarAnimatedIcon from './SidebarAnimatedIcon';
import { getSidebarChats } from './workspace-chat-actions';
import { HistoryActionDialog, HistoryGroup, HistoryMenu } from './SidebarConversationControls';

const entries = [
  ['skills', '妙招'],
  ['tasks', '定时任务'],
  ['files', 'AI 输出物'],
];

function PrimaryNavItem({ id, label, selected, enabled, reducedMotion, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!enabled) { setHovered(false); setFocused(false); }
  }, [enabled]);
  const external = false;
  const Tag = external ? 'a' : 'button';
  return <Tag
    {...(external ? { href: '?preview=bookmarks', target: '_blank', rel: 'noopener noreferrer', title: '在新标签页打开收藏' } : { type: 'button', onClick })}
    className={`aiwc-nav-item${external ? ' aiwc-external' : ''}${id === 'home' ? ' aiwc-new' : ''}`}
    aria-current={!external && selected ? 'page' : undefined}
    onPointerEnter={event => { if (event.pointerType !== 'touch') setHovered(true); }}
    onPointerLeave={() => setHovered(false)}
    onPointerCancel={() => setHovered(false)}
    onFocus={event => setFocused(event.currentTarget.matches(':focus-visible'))}
    onBlur={() => setFocused(false)}
  >
    <span className="aiwc-nav-leading">
      <SidebarAnimatedIcon kind={id} active={enabled && (hovered || focused)} reducedMotion={reducedMotion || !enabled} size={16}/>
      <span>{label}</span>
    </span>
    <span className="aiwc-nav-actions" aria-hidden={!external || undefined}>
      {external && <ArrowUpRight className="aiwc-jump-icon" size={16} strokeWidth={1.8} aria-hidden="true"/>}
    </span>
  </Tag>;
}

function IconButton({ label, Icon, onClick, selected, children }) {
  return <button type="button" className="aiwc-icon" aria-label={label} title={label} aria-current={selected ? 'page' : undefined} onClick={onClick}>
    <Icon size={16} strokeWidth={1.8}/>{children}
  </button>;
}

// Scheme 1 owns its anatomy and styles; the seven comparison schemes stay intact.
export default function ClassicSidebar({ page, data, active = true, activeConversationId, onNavigate, onClose, onSearch, onNewChat, onUpdateChat, onDeleteChats }) {
  const [menu, setMenu] = useState(null);
  const [action, setAction] = useState(null);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState([]);
  const [source, setSource] = useState('cloud');
  const visibleChats = getSidebarChats(data.chats, source);
  const scrollRef = useRef(null);
  const focusTarget = useRef(null);
  const navigationHoverTimer = useRef(null);
  const cancelNavigationHover = useCallback(() => window.clearTimeout(navigationHoverTimer.current), []);
  const leaveNavigationHover = useCallback(() => {
    window.clearTimeout(navigationHoverTimer.current);
    navigationHoverTimer.current = window.setTimeout(() => setMenu(current => current?.id === 'navigation' ? null : current), 180);
  }, []);
  useEffect(() => () => window.clearTimeout(navigationHoverTimer.current), []);
  function enterNavigationHover(event) {
    if (event.pointerType === 'touch' || !active) return;
    const anchor = event.currentTarget;
    cancelNavigationHover();
    navigationHoverTimer.current = window.setTimeout(() => {
      focusTarget.current = { anchor };
      setMenu(current => current?.id === 'navigation' ? current : { anchor, id: 'navigation', hover: true });
    }, 150);
  }
  const selectedIds = new Set(selected.filter(id => visibleChats.some(chat => chat.id === id)));
  const restoreFocus = useCallback(() => requestAnimationFrame(() => {
    const target = focusTarget.current;
    const row = target?.id && scrollRef.current?.querySelector(`[data-chat-id="${CSS.escape(target.id)}"] .aiwc-row-more`);
    const fallback = scrollRef.current?.querySelector('[data-history-actions]:not(:disabled)') || scrollRef.current?.querySelector('[aria-label="新建对话"]');
    [row, target?.anchor, fallback].find(node => node?.isConnected && node.getClientRects().length && !node.disabled)?.focus({ preventScroll: true });
  }), []);
  const closeMenu = useCallback((restore = false) => {
    window.clearTimeout(navigationHoverTimer.current);
    setMenu(null);
    if (restore) restoreFocus();
  }, [restoreFocus]);
  function openMenu(anchor, record) {
    focusTarget.current = { anchor, id: record?.id };
    setMenu(current => current?.anchor === anchor ? null : { anchor, id: record?.id || 'recent' });
  }
  function finishEditing() { setEditing(false); setSelected([]); restoreFocus(); }
  function startEditing() {
    setMenu(null); setSelected([]); setEditing(true);
    requestAnimationFrame(() => scrollRef.current?.querySelector('input[type="checkbox"]')?.focus({ preventScroll: true }));
  }
  function editingKeyDown(event) {
    if (event.key === 'Escape' && editing && !menu && !action) {
      event.preventDefault(); event.stopPropagation(); finishEditing();
    }
  }
  function selectChat(id) { setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]); }
  function closeAction() { setAction(null); restoreFocus(); }
  const menuRecord = data.chats.find(chat => chat.id === menu?.id);
  const menuItems = menu?.id === 'navigation' ? [
    { label: '收藏管理', animatedKind: 'bookmarks', onClick: () => { closeMenu(true); onNavigate('bookmarks'); } },
    { label: '分享管理', animatedKind: 'shares', onClick: () => { closeMenu(true); onNavigate('shares'); } },
  ] : menuRecord ? [
    { label: menuRecord.pinned ? '取消置顶' : '置顶', Icon: menuRecord.pinned ? PinOff : Pin, onClick: () => { onUpdateChat(menuRecord.id, { pinned: !menuRecord.pinned }); closeMenu(true); } },
    { label: '重命名', Icon: Pencil, onClick: () => { setMenu(null); setAction({ type: 'rename', record: menuRecord }); } },
    { label: '删除', Icon: Trash2, danger: true, onClick: () => { setMenu(null); setAction({ type: 'delete', record: menuRecord }); } },
  ] : editing ? [
    { label: selectedIds.size === visibleChats.length ? '取消全选' : '全选', Icon: ListChecks, disabled: !visibleChats.length, onClick: () => { setSelected(selectedIds.size === visibleChats.length ? [] : visibleChats.map(chat => chat.id)); closeMenu(true); } },
  ] : [{ label: '批量编辑', Icon: BatchListChecks, disabled: !visibleChats.length, onClick: startEditing }];
  useEffect(() => { if (!active) { setMenu(null); setAction(null); } }, [active]);
  const unread = data.notifications.filter(item => item.unread).length;
  const [visible, setVisible] = useState(() => !document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(preference.matches);
    document.addEventListener('visibilitychange', update);
    preference.addEventListener('change', updateMotion);
    return () => {
      document.removeEventListener('visibilitychange', update);
      preference.removeEventListener('change', updateMotion);
    };
  }, []);
  return <>
    <header className="aiwc-header">
      <button type="button" className="aiwc-brand" aria-label="返回首页" title="返回首页" onClick={() => onNavigate('home')}>
        <img src="/personalized-home-2-0/asset/icons/tabbit-solid.svg" alt="" width="18" height="18" draggable="false"/>
      </button>
      <div className="aiwc-header-actions">
        <IconButton label="搜索全部内容" Icon={Search} onClick={onSearch}/>
        <IconButton label="通知" Icon={Bell} selected={page === 'notifications'} onClick={() => onNavigate('notifications')}>
          {unread > 0 && <i className="aiwc-unread" aria-label={`${unread} 条未读通知`}/>}
        </IconButton>
        <IconButton label="收起 AI 侧边栏" Icon={SidebarToggleIcon} onClick={onClose}/>
      </div>
    </header>
    <SidebarScrollArea scrollRef={scrollRef} onKeyDown={editingKeyDown}>
      <nav className="aiwc-primary" aria-label="主要功能">
        <PrimaryNavItem id="home" label="新会话" selected={page === 'home'} enabled={active && visible} reducedMotion={reducedMotion} onClick={onNewChat}/>
        {entries.map(([id, label]) => <PrimaryNavItem key={id} id={id} label={label} selected={page === id} enabled={active && visible} reducedMotion={reducedMotion} onClick={() => onNavigate(id)}/>)}
        <button type="button" className="aiwc-nav-item aiwc-nav-more" aria-haspopup="menu" aria-expanded={menu?.id === 'navigation'} onPointerEnter={enterNavigationHover} onPointerLeave={leaveNavigationHover} onPointerCancel={leaveNavigationHover} onClick={event => {
          cancelNavigationHover();
          const anchor = event.currentTarget;
          focusTarget.current = { anchor };
          setMenu({ anchor, id: 'navigation', hover: false });
        }}><span className="aiwc-nav-leading"><Ellipsis size={16} strokeWidth={2} aria-hidden="true"/><span>更多</span></span><span className="aiwc-nav-actions" aria-hidden="true"/></button>
      </nav>
      {[{ title: '置顶', pinned: true }, { title: '最近', pinned: false }].filter(group => !group.pinned || visibleChats.some(item => item.pinned)).map(group => <HistoryGroup hasChats={Boolean(visibleChats.length)} key={group.title} title={group.title} records={visibleChats.filter(item => Boolean(item.pinned) === group.pinned).slice(0, group.pinned ? undefined : 8)} source={!group.pinned ? source : undefined} onSourceChange={next => { setSource(next); setSelected([]); setMenu(null); }} onNavigate={onNavigate} activeConversationId={activeConversationId} editing={editing} selectedIds={selectedIds} onSelect={selectChat} onMenu={openMenu} menuId={menu?.id} onBatchEdit={!group.pinned ? startEditing : undefined}/>)}
    </SidebarScrollArea>
    <footer className={`aiwc-footer${editing ? ' is-editing' : ''}`} onKeyDown={editingKeyDown}>
      {editing ? <>
        <span className="aiwc-selected-count" role="status">已选 {selectedIds.size} 项</span>
        <button type="button" className="aiwc-batch-cancel" onClick={finishEditing}>取消</button>
        <button type="button" className="aiwc-batch-delete" disabled={!selectedIds.size} onClick={() => { onDeleteChats([...selectedIds]); finishEditing(); }}>确认删除</button>
      </> : <>
      <button type="button" className="aiwc-usage" aria-label="会员与用量，本周剩余 98%，示例数据" title="查看会员与用量（示例）" aria-current={page === 'usage' ? 'page' : undefined} onClick={() => onNavigate('usage')}><svg className="aiwc-usage-ring" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="var(--nine-color-border-alpha-regular)" strokeWidth="2"/><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="30.16 37.7" transform="rotate(-54 8 8)"/></svg><span>本周剩余 98 %</span></button>
      <button type="button" className="aiwc-upgrade" onClick={() => onNavigate('usage')}><svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7.714703039453125,0.5966140273125C7.885546239453125,0.5650202333125,8.061431439453125,0.5847226209125,8.219992639453125,0.6530105103125L8.286643039453125,0.6854812103125L8.350445739453125,0.7230788803125C8.474480639453125,0.8036465203125001,8.575889539453126,0.9144509403125001,8.645529739453124,1.0449376103125L8.678000439453125,1.1115880003125L8.704205539453124,1.1810867203125C8.758547339453125,1.3447393803124998,8.763303739453125,1.5213210603125,8.717307139453126,1.6886551203125C8.715230939453125,1.6962030203125,8.713419439453125,1.7039833203125,8.711041439453126,1.7114415203125L7.591086339453125,5.2228350203125L7.581402339453125,5.2501788203125L11.666444439453125,5.2501788203125C11.886628439453125,5.2497501203125,12.102577439453125,5.3114133203125,12.289084439453125,5.4284825203125C12.476038439453125,5.5458517203125,12.625601439453124,5.7141413203125,12.720888439453125,5.9132647203125C12.816155439453125,6.1123915203125,12.853316439453126,6.3343496203125,12.827414439453126,6.5535641203125C12.801507439453125,6.7728114203125,12.713576439453124,6.9802546203125,12.574484439453125,7.1517086203125C12.563627439453125,7.1650824203125,12.552302439453126,7.1780844203125,12.540305439453125,7.1904454203125L6.765077139453125,13.1405603203125L6.765077139453125,13.1405603203125C6.636922339453125,13.2764323203125,6.469676539453125,13.3696693203125,6.285422339453125,13.4037433203125C6.090264339453125,13.4398333203125,5.888497339453125,13.4084883203125,5.713482839453125,13.3148763203125C5.538480239453125,13.2212643203125,5.400434039453125,13.0705593203125,5.322125439453125,12.8881993203125C5.243906039453125,12.7058933203125,5.230205539453125,12.5024123203125,5.282818839453125,12.3111323203125L5.289084439453125,12.2883453203125L6.409039039453125,8.7769527203125L6.418723139453125,8.7501793203125L2.333111239453125,8.7501793203125L2.333111239453125,8.7501793203125C2.113123419453125,8.7499323203125,1.8973910194531252,8.6882753203125,1.711040909453125,8.5713048203125C1.524192539453125,8.4539804203125,1.3745141294531251,8.2860870203125,1.279237529453125,8.087093320312501C1.183939704453125,7.8879447203125,1.146803230453125,7.6654739203125,1.172710827553125,7.4462237203125C1.198645543453125,7.2270412203125,1.286589499453125,7.0194831203125,1.425640519453125,6.8480792203125C1.436468689453125,6.8347478203125,1.4478583294531249,6.8216667203125,1.459820209453125,6.8093419203125L7.235047839453125,0.8597976303125C7.362638939453125,0.7232726503125,7.530388339453125,0.6307116183125,7.714703039453125,0.5966140273125Z" fill="#000000"/></svg><span>立即升级</span></button>
      </>}
    </footer>
    {menu && (menu.id === 'recent' || menu.id === 'navigation' || menuRecord) && <HistoryMenu anchor={menu.anchor} placement={menu.id === 'navigation' ? 'right' : 'bottom'} label={menu.id === 'navigation' ? '更多' : menuRecord ? `${menuRecord.title}的操作` : '最近的操作'} items={menuItems} onClose={closeMenu} autoFocus={!menu.hover} onPointerEnter={menu.id === 'navigation' ? cancelNavigationHover : undefined} onPointerLeave={menu.id === 'navigation' ? leaveNavigationHover : undefined}/>}
    {action && <HistoryActionDialog action={action} onClose={closeAction} onConfirm={title => {
      if (action.type === 'delete') onDeleteChats([action.record.id]);
      else onUpdateChat(action.record.id, { title });
      closeAction();
    }}/>}
  </>;
}
