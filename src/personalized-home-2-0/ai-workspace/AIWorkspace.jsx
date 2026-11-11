import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Home, Search, X, ArrowUpRight, MessageSquare, Folder, Lightbulb, CalendarClock, LayoutGrid, Star, Share2, Bell, Gauge, Check, ArrowRight } from '../icons';
import WorkspaceNavigation from './WorkspaceNavigation';
import WorkspaceContent from './WorkspaceContent';
import WorkspaceConversation from './WorkspaceConversation';
import WorkspaceOverview from './WorkspaceOverview';
import { WORKSPACE_VARIANTS, resolveWorkspaceVariant } from './workspace-variants';
import { readWorkspaceData, TYPE_LABELS } from './workspace-data';
import { getWorkspaceItems, resolveWorkspaceRoute } from './workspace-outputs';
import './ai-workspace.css';
import './host-workspace.css';
import SidebarToggleIcon from './SidebarToggleIcon';
import SidebarResizeHandle from './SidebarResizeHandle';
import { SIDEBAR_WIDTH_DEFAULT } from './sidebar-width';
import { WorkspaceSettingsContext } from './WorkspaceSchemeSettings';
import WorkspaceNotificationsPopover from './WorkspaceNotificationsPopover';
import { updateWorkspaceChat, deleteWorkspaceChats } from './workspace-chat-actions';
import { WorkspaceNavigationSlot } from './workspace-secondary-context';
import { WallpaperTransitionBackground } from '../HomeBackground';


const WorkspaceBookmarksPage = lazy(() => import('./bookmarks/WorkspaceBookmarksPage'));

const destinations = [
  ['home', '首页', Home, '开始新对话，查看常用网站'], ['overview', '总览', LayoutGrid, '最近工作与待处理事项'], ['chats', '对话', MessageSquare, '云端与本地的对话记录'],
  ['files', 'AI 输出物', Folder, '文件、网页、文档、图片、表格、AI 卡片与 AI 看板'], ['skills', '妙招', Lightbulb, '提示词、网页脚本与任务'],
  ['tasks', '定时任务', CalendarClock, '生效中、已暂停与执行记录'],
  ['bookmarks', '收藏', Star, '文件夹与收藏内容'], ['shares', '分享', Share2, '网页和对话的分享管理'],
  ['notifications', '通知', Bell, '公告、反馈与会员消息'], ['usage', '用量', Gauge, '会员、重置券与订单'],
];
const AI_WORKSPACE_CONTENT_COLLAPSE_WIDTH = 760;
const AI_WORKSPACE_SIDEBAR_MOTION_MS = 320;
function readVariant() {
  const fromUrl = new URLSearchParams(window.location.search).get('scheme');
  let stored;
  try { stored = localStorage.getItem('personalized-home-2-0-ai-workspace-variant'); } catch { /* session-only fallback */ }
  return resolveWorkspaceVariant(fromUrl, stored);
}
export default function AIWorkspace({ children, wallpaper, reflectionWallpaper = wallpaper, wallpaperTransition, wallpaperBlur = false, onActivityChange, onNavigatePage, onNewChat, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState(readVariant);
  const [page, setPage] = useState(() => new URLSearchParams(window.location.search).get('preview') === 'ai-sidebar' && variant === 8 ? 'overview' : 'home');
  const [contentPage, setContentPage] = useState('chats');
  const [contentVisited, setContentVisited] = useState(false);
  const [navigationSlot, setNavigationSlot] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [navigationKey, setNavigationKey] = useState(0);
  const [workspaceData, setWorkspaceData] = useState(readWorkspaceData);
  const [activeFilter, setActiveFilter] = useState('all');
  const [filter, setFilter] = useState(undefined);
  const [modal, setModal] = useState(null);
  const [notificationEntry, setNotificationEntry] = useState(undefined);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationAnchor, setNotificationAnchor] = useState(null);
  const [query, setQuery] = useState('');
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 650px)').matches);
  const [sidebarOverlay, setSidebarOverlay] = useState(false);
  const navHostRef = useRef(null);
  const shellRef = useRef(null);
  const openRef = useRef(open);
  const autoCollapsedSidebar = useRef(false);
  const contentWasNarrow = useRef(null);
  const responsiveMotionTimer = useRef(0);
  const responsiveMotionFrame = useRef(0);
  const pageHostRef = useRef(null);
  const dialogRef = useRef(null);
  const launchRef = useRef(null);
  const restoreLauncherFocus = useRef(false);
  const previousFocus = useRef(null);
  const activeContent = page !== 'home';
  const activeModule = activeContent && page !== 'overview' && page !== 'conversation';
  const activeConversation = page === 'conversation' ? workspaceData.chats.find(item => item.id === conversationId) : null;
  const navigationOverlay = compact || sidebarOverlay;
  useEffect(() => { onActivityChange?.(!disabled && Boolean(activeContent || modal || notificationOpen || (navigationOverlay && open))); }, [activeContent, modal, notificationOpen, navigationOverlay, open, disabled, onActivityChange]);
  useEffect(() => { if (disabled) { setModal(null); setNotificationOpen(false); } }, [disabled]);
  useEffect(() => { if (pageHostRef.current) pageHostRef.current.scrollTop = 0; }, [page]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 650px)');
    const change = () => setCompact(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useLayoutEffect(() => {
    const shell = shellRef.current;
    const navigation = navHostRef.current;
    if (!shell || !navigation) return;

    const syncSidebar = () => {
      const width = shell.clientWidth;
      // Switching away from New Tab hides its persistent host with display:none.
      // That zero-width measurement is not a responsive resize: keep the current
      // sidebar state so revealing New Tab does not replay collapse/expand.
      if (width === 0) return;
      const isNarrow = width < AI_WORKSPACE_CONTENT_COLLAPSE_WIDTH;
      if (contentWasNarrow.current === isNarrow) return;
      contentWasNarrow.current = isNarrow;
      window.clearTimeout(responsiveMotionTimer.current);
      cancelAnimationFrame(responsiveMotionFrame.current);

      if (isNarrow) {
        if (!openRef.current) { setSidebarOverlay(true); return; }
        autoCollapsedSidebar.current = true;
        openRef.current = false;
        setOpen(false);
        responsiveMotionTimer.current = window.setTimeout(() => setSidebarOverlay(true), AI_WORKSPACE_SIDEBAR_MOTION_MS);
      } else if (autoCollapsedSidebar.current) {
        autoCollapsedSidebar.current = false;
        setSidebarOverlay(false);
        responsiveMotionFrame.current = requestAnimationFrame(() => {
          responsiveMotionFrame.current = requestAnimationFrame(() => {
            openRef.current = true;
            setOpen(true);
          });
        });
      } else {
        setSidebarOverlay(false);
      }
    };

    const observer = new ResizeObserver(syncSidebar);
    observer.observe(shell);
    syncSidebar();
    return () => {
      observer.disconnect();
      window.clearTimeout(responsiveMotionTimer.current);
      cancelAnimationFrame(responsiveMotionFrame.current);
    };
  }, [variant]);
  useEffect(() => { if (navigationOverlay && open) navHostRef.current?.querySelector('button')?.focus({ preventScroll: true }); }, [navigationOverlay, open]);
  useEffect(() => {
    try { localStorage.setItem('personalized-home-2-0-ai-workspace-variant', String(variant)); } catch { /* session-only fallback */ }
  }, [variant]);
  useEffect(() => {
    try { localStorage.setItem('personalized-home-2-0-ai-workspace-demo-v1', JSON.stringify(workspaceData)); } catch { /* session-only fallback */ }
  }, [workspaceData]);
  useEffect(() => {
    function syncBookmarks(event) {
      if (event.key !== 'personalized-home-2-0-ai-workspace-demo-v1' || !event.newValue) return;
      const latest = readWorkspaceData();
      setWorkspaceData(previous => JSON.stringify(previous) === JSON.stringify(latest) ? previous : latest);
    }
    window.addEventListener('storage', syncBookmarks);
    return () => window.removeEventListener('storage', syncBookmarks);
  }, []);
  useEffect(() => {
    if (!modal) return;
    const dialog = dialogRef.current;
    if (document.activeElement !== document.body && !dialog?.contains(document.activeElement)) previousFocus.current = document.activeElement;
    dialog?.showModal();
    if (modal === 'search') dialog?.querySelector('input')?.focus({ preventScroll: true });
    return () => {
      dialog?.close();
      requestAnimationFrame(() => {
        if (document.querySelector('dialog[open]')) return;
        const target = previousFocus.current;
        if (target?.isConnected && target.getClientRects().length && !target.closest('[inert]')) target.focus?.({ preventScroll: true });
        else (navHostRef.current?.querySelector('[aria-label="通知"]') || launchRef.current)?.focus({ preventScroll: true });
      });
    };
  }, [modal]);
  function navigate(next, nextFilter, trigger) {
    onNavigatePage?.();
    ({ page: next, filter: nextFilter } = resolveWorkspaceRoute(next, nextFilter, workspaceData));
    if (next === 'notifications') {
      if (notificationOpen) { closeNotifications(true); return; }
      const anchor = trigger || navHostRef.current?.querySelector('[data-notification-trigger]') || document.activeElement;
      setNotificationEntry(nextFilter); setNotificationAnchor(anchor); setModal(null); setNotificationOpen(true); return;
    }
    closeNotifications(false);
    const conversation = next === 'chats' && workspaceData.chats.find(item => nextFilter === `detail:${item.id}` || nextFilter === item.title);
    if (conversation) {
      setConversationId(conversation.id); setPage('conversation'); setModal(null);
      return;
    }
    if (next !== 'home' && next !== 'overview') { setContentPage(next); setContentVisited(true); }
    setNavigationKey(key=>key+1); setPage(next); setFilter(nextFilter); setModal(null);
  }
  const closeNotifications = useCallback(restoreFocus => {
    setNotificationOpen(false);
    if (restoreFocus) requestAnimationFrame(() => notificationAnchor?.isConnected && notificationAnchor.focus?.({ preventScroll:true }));
  },[notificationAnchor]);
  function changeVariant(next) {
    setVariant(next);
    const url = new URL(window.location.href);
    url.searchParams.set('scheme', String(next));
    window.history.replaceState(window.history.state, '', url);
    // Settings stays visible while comparing navigation; the current page stays mounted.
    if (next !== 8 && page === 'overview') navigate('home');
  }
  function updateChat(id, patch) { setWorkspaceData(previous => updateWorkspaceChat(previous, id, patch)); }
  function deleteChats(ids) { setWorkspaceData(previous => deleteWorkspaceChats(previous, ids)); }
  useEffect(() => {
    if (conversationId && !workspaceData.chats.some(chat => chat.id === conversationId)) {
      // Keep the session host mounted so other conversations retain their drafts.
      if (page === 'conversation') setPage('home');
    }
  }, [workspaceData.chats, conversationId, page]);
  function newChat(prompt) { navigate('home'); onNewChat?.(typeof prompt === 'string' ? prompt : ''); }
  useEffect(() => {
    const startSession = () => {
      window.clearTimeout(responsiveMotionTimer.current);
      cancelAnimationFrame(responsiveMotionFrame.current);
      autoCollapsedSidebar.current = false;
      openRef.current = false;
      restoreLauncherFocus.current = false;
      setOpen(false);
      // Reset the session without discarding the current responsive mode.
      // The resize observer will not fire again when the width stays unchanged.
      const width = shellRef.current?.clientWidth;
      if (width > 0) setSidebarOverlay(width < AI_WORKSPACE_CONTENT_COLLAPSE_WIDTH);
      setPage('home');
      setFilter(undefined);
      setModal(null);
      setNotificationOpen(false);
      onNewChat?.('');
    };
    window.addEventListener('tabbit-new-session', startSession);
    return () => window.removeEventListener('tabbit-new-session', startSession);
  }, [onNewChat]);
  function closeSidebar() { window.clearTimeout(responsiveMotionTimer.current); cancelAnimationFrame(responsiveMotionFrame.current); autoCollapsedSidebar.current = false; openRef.current = false; restoreLauncherFocus.current = true; setOpen(false); setModal(null); setNotificationOpen(false); }
  useEffect(() => {
    if (open || !restoreLauncherFocus.current) return;
    const motion = navHostRef.current && getComputedStyle(navHostRef.current).getPropertyValue('--aiw-sidebar-motion');
    const delay = Number.parseFloat(motion) || 0;
    let frame;
    function restoreFocus() {
      const launcher = launchRef.current;
      if (!launcher || launcher.inert) return;
      if (getComputedStyle(launcher).visibility !== 'visible') {
        frame = requestAnimationFrame(restoreFocus);
        return;
      }
      launcher.focus({ preventScroll: true });
      restoreLauncherFocus.current = false;
    }
    const timer = window.setTimeout(restoreFocus, delay);
    return () => { window.clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [open]);
  function openSearch() { setQuery(''); setModal('search'); }
  function navKeyDown(event) {
    if (event.key === 'Escape' && !modal) { event.preventDefault(); closeSidebar(); }
    if (!navigationOverlay || event.key !== 'Tab') return;
    const buttons = [...navHostRef.current.querySelectorAll('button:not(:disabled),input,a[href],[tabindex="0"]')].filter(item=>item.getClientRects().length);
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  const searchResults = useMemo(() => {
    if (modal !== 'search') return [];
    const needle = query.toLowerCase();
    const entries = destinations.map(([id, label, Icon, description]) => ({ id, label, Icon, description }));
    for (const id of Object.keys(workspaceData)) {
      if (id === 'assets' || !Array.isArray(workspaceData[id])) continue;
      const Icon = destinations.find(destination => destination[0] === id)?.[2] || Folder;
      for (const item of getWorkspaceItems(workspaceData, id)) {
        entries.push({ id, label:item.title, description:TYPE_LABELS[item.type] || item.type, filter:`detail:${item.id}`, Icon });
      }
    }
    return entries.filter(item => `${item.label}${item.description}`.toLowerCase().includes(needle));
  }, [modal, query, workspaceData]);
  return <WorkspaceSettingsContext.Provider value={{ variant, onVariant: changeVariant, onCompare: () => setModal('compare') }}><div ref={shellRef} className={`aiw-shell ${open ? 'is-open' : ''} ${sidebarOverlay ? 'is-sidebar-overlay' : ''} ${activeContent ? 'has-content' : ''} ${(wallpaper || wallpaperTransition) && !activeContent ? 'has-home-wallpaper' : ''}`} data-variant={variant} inert={disabled} aria-hidden={disabled || undefined} style={{ visibility: disabled ? 'hidden' : undefined }}>
    {/* One media plane spans the homepage and internal sidebar. */}
    {!activeContent && <WallpaperTransitionBackground wallpaper={wallpaper} blurred={wallpaperBlur} transition={wallpaperTransition}/>}
    <div className="aiw-nav-host" ref={navHostRef} inert={!open || disabled} aria-hidden={!open || undefined} role={navigationOverlay && open ? 'dialog' : undefined} aria-modal={navigationOverlay && open || undefined} aria-label="AI 导航" onKeyDown={navKeyDown}><WorkspaceNavigation onUpdateChat={updateChat} onDeleteChats={deleteChats} active={open && !disabled && !modal} variant={variant} page={page === 'conversation' ? 'chats' : page} activeConversationId={page === 'conversation' ? conversationId : undefined} data={workspaceData} activeFilter={activeFilter} onNavigate={navigate} onClose={closeSidebar} onSearch={openSearch} onNewChat={newChat} /></div>
    {open && !navigationOverlay && variant === 1 && <SidebarResizeHandle key={SIDEBAR_WIDTH_DEFAULT}/>}
    {navigationOverlay && open && <button className="aiw-nav-backdrop" aria-label="关闭导航抽屉" tabIndex={-1} onClick={closeSidebar}/>} 
    <WorkspaceNavigationSlot.Provider value={navigationSlot}><div className="aiw-stage">
      <div className="aiw-home" hidden={activeContent} inert={activeContent || Boolean(modal) || (navigationOverlay && open)} aria-hidden={activeContent || undefined}>{children}</div>
      {contentVisited && <div className="aiw-page-host" ref={pageHostRef} hidden={!activeModule} inert={!activeModule || (navigationOverlay && open)}>
        <div hidden={contentPage === 'bookmarks'} inert={contentPage === 'bookmarks'}><WorkspaceContent wallpaper={reflectionWallpaper} active={!disabled && activeModule && contentPage !== 'bookmarks'} page={contentPage} variant={variant} initialFilter={filter} navigationKey={navigationKey} data={workspaceData} setData={setWorkspaceData} onFilterChange={setActiveFilter} onNavigate={navigate} onNewChat={newChat}/></div>
        {contentPage === 'bookmarks' && <Suspense fallback={<div role="status">正在打开收藏…</div>}><WorkspaceBookmarksPage embedded active={!disabled && activeModule}/></Suspense>}
      </div>}
      <div className="aiw-page-host aiw-overview-host" hidden={page !== 'overview'} inert={page !== 'overview' || (navigationOverlay && open)}><WorkspaceOverview data={workspaceData} onNavigate={navigate} onNewChat={newChat}/></div>
      {conversationId && <WorkspaceConversation conversations={workspaceData.chats} conversationId={conversationId} active={!disabled && page === 'conversation'} blocked={Boolean(modal) || (navigationOverlay && open)}/>} 
      <header className="aiw-stage-topbar" aria-label="导航和功能区">
        <button ref={launchRef} className="aiw-launcher" inert={open} aria-hidden={open || undefined} tabIndex={open ? -1 : 0} aria-label="展开 AI 侧边栏" title="AI 侧边栏" aria-expanded="false" onClick={() => { window.clearTimeout(responsiveMotionTimer.current); cancelAnimationFrame(responsiveMotionFrame.current); autoCollapsedSidebar.current = false; openRef.current = true; setOpen(true); }}><SidebarToggleIcon size={16} expanded={false}/></button>
        {activeConversation && <h1 className="aiw-stage-title" title={activeConversation.title}>{activeConversation.title}</h1>}
        <div ref={setNavigationSlot} className="aiw-secondary-slot" inert={Boolean(modal) || (navigationOverlay && open)}/>
      </header>
    </div></WorkspaceNavigationSlot.Provider>
    {notificationOpen && <WorkspaceNotificationsPopover anchor={notificationAnchor} initialEntry={notificationEntry} onClose={closeNotifications}/>}
    {modal && <dialog ref={dialogRef} className={`aiw-dialog aiw-${modal}-dialog`} aria-labelledby="aiw-dialog-title" onCancel={event => { event.preventDefault(); setModal(null); }} onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)setModal(null);}}}>
      <div className="aiw-dialog-heading"><h2 id="aiw-dialog-title">{modal === 'search' ? '搜索全部内容' : '选择适合你的工作方式'}</h2><button className="aiw-icon-button" aria-label="关闭窗口" onClick={()=>setModal(null)}><X size={18}/></button></div>
      {modal === 'search' ? <>
        <label className="aiw-global-search"><Search size={19}/><input aria-label="搜索全部内容" autoFocus placeholder="搜索对话、AI 输出物、妙招或功能…" value={query} onChange={event=>setQuery(event.target.value)}/><kbd>Esc</kbd></label>
        <p className="aiw-search-caption">{query ? `${searchResults.length} 条结果` : '功能入口与示例内容'}</p>
        <div className="aiw-search-results">{searchResults.map((item,i)=><button key={`${item.id}-${i}`} onClick={()=>navigate(item.id, item.filter)}><item.Icon size={18}/><span><strong>{item.label}</strong><small>{item.description}</small></span><ArrowUpRight size={15}/></button>)}{!searchResults.length && <p className="aiw-no-results">未找到相关内容，试试其他关键词。</p>}</div>
      </> : <>
        <p className="aiw-dialog-intro">{WORKSPACE_VARIANTS.length} 套方案共用内容与示例数据，切换时保留当前模块和筛选。方案 8 另有工作总览。先看入口是否清楚，再比较常用操作是否顺手。</p>
        <div className="aiw-comparison-list">{WORKSPACE_VARIANTS.map(item=><button key={item.id} aria-pressed={variant===item.id} onClick={()=>{changeVariant(item.id);setModal(null);}}><span className="aiw-option-number">0{item.id}</span><span><strong>{item.name}{item.id===1 && <small>原稿结构</small>}{item.id===2 && <small>基线</small>}{item.id>5 && <small>新增</small>}</strong><p>{item.lead}</p><em>{item.good} · {item.tradeoff}</em></span>{variant===item.id?<Check size={18}/>:<ArrowRight size={18}/>}</button>)}</div>
        <p className="aiw-prototype-note">本地原型 · 内容与账号数据为示例</p>
      </>}
    </dialog>}
  </div></WorkspaceSettingsContext.Provider>;
}
