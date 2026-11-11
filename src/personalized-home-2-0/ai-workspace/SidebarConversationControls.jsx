import { ArrowUpRight } from 'lucide-react';
import { openBookmarkTab } from './bookmarks/open-bookmarks';
import { Fragment, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getHomeRoot } from '../home-host';
import warningIcon from '../../assets/delete-space-warning.png';
import '../../DeleteSpaceDialog.css';
import '../../EditSpaceDialog.css';
import { BatchListChecks, ChevronRight, Cloud, Ellipsis, Laptop, Plus, Search, X } from '../icons';
import '../context-menu.css';
import '../../styles/dropdown.css';
import './workspace-checkbox.css';
import SidebarAnimatedIcon from './SidebarAnimatedIcon';
import SegmentedControl from './SegmentedControl';

export function HistorySourceTabs({ source, onSourceChange, controlsId, search, onSearchChange }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const triggerRef = useRef(null);
  const searchId = useId();
  function closeSearch() { setSearchOpen(false); onSearchChange(''); triggerRef.current?.focus(); }
  return <>
    <div className="aiwc-source-switch">
      <SegmentedControl className="aiwc-source-tabs" label="最近对话来源" value={source} controlsId={controlsId} onChange={onSourceChange} options={[{ value:'local', label:'本地', Icon:Laptop }, { value:'cloud', label:'云端', Icon:Cloud }]}/>
      <button ref={triggerRef} type="button" className="aiwc-small-icon aiwc-search-trigger" aria-label={searchOpen ? '收起会话搜索' : '搜索会话'} title={searchOpen ? '收起搜索' : '搜索会话'} aria-expanded={searchOpen} aria-controls={searchOpen ? searchId : undefined} onClick={() => searchOpen ? closeSearch() : setSearchOpen(true)}><Search size={14} aria-hidden="true"/></button>
    </div>
    {searchOpen && <HistorySearch id={searchId} value={search} onChange={onSearchChange} onClose={closeSearch}/>}
  </>;
}

function HistorySearch({ id, value, onChange, onClose }) {
  const inputRef = useRef(null);
  useLayoutEffect(() => { inputRef.current?.focus(); }, []);
  return <div id={id} className="aiwc-history-search" role="search" aria-label="搜索侧栏会话">
    <Search size={14} aria-hidden="true"/>
    <input ref={inputRef} type="search" aria-label="搜索会话" placeholder="搜索会话…" value={value} autoComplete="off" spellCheck={false} onChange={event => onChange(event.target.value)} onKeyDown={event => {
      if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); onClose(); }
    }}/>
    <button type="button" className="aiwc-small-icon" aria-label={value ? '清空会话搜索' : '关闭会话搜索'} onClick={() => { if (value) { onChange(''); inputRef.current?.focus(); } else onClose(); }}><X size={12} aria-hidden="true"/></button>
  </div>;
}

export function HistoryGroup({ title, records, onNavigate, activeConversationId, editing, selectedIds, onSelect, onMenu, menuId, onBatchEdit, onNewChat, hasChats, source, panelId, searching = false }) {
  const [expanded, setExpanded] = useState(true);
  const generatedListId = useId();
  const listId = panelId || generatedListId;
  const batchTooltipId = useId();
  const newChatTooltipId = useId();
  const isExpanded = editing || searching || expanded;
  return <section className="aiwc-history-group" data-source={source} aria-label={title}>
    <div className="aiwc-group-header">
      <button type="button" className="aiwc-group-heading" aria-expanded={isExpanded} aria-controls={listId} disabled={editing || searching} onClick={() => setExpanded(value => !value)}>
        <span>{title}</span><ChevronRight className="aiwc-group-chevron" size={14} strokeWidth={1.8} aria-hidden="true"/>
      </button>
      {onBatchEdit && <div className="aiwc-group-actions aiwc-batch-actions">
        {onNewChat && <span className="aiwc-batch-tooltip-anchor">
          <button type="button" className="aiwc-small-icon" aria-label="新建对话" aria-describedby={newChatTooltipId} onClick={onNewChat}><Plus size={14} aria-hidden="true"/></button>
          <span id={newChatTooltipId} role="tooltip" className="space-tooltip aiwc-batch-tooltip">新建对话</span>
        </span>}
        <span className="aiwc-batch-tooltip-anchor">
          <button type="button" className="aiwc-small-icon" data-history-actions aria-label="批量编辑会话" aria-pressed={editing} aria-describedby={batchTooltipId} disabled={!hasChats} onClick={onBatchEdit}><BatchListChecks size={14}/></button>
          <span id={batchTooltipId} role="tooltip" className="space-tooltip aiwc-batch-tooltip">批量编辑</span>
        </span>
      </div>}

    </div>
    <div className="aiwc-history-collapse" data-expanded={isExpanded} inert={!isExpanded} aria-hidden={!isExpanded || undefined}>
    <div id={listId} className="aiwc-history-list" role={source ? 'tabpanel' : undefined} aria-label={source ? `${source === 'cloud' ? '云端' : '本地'}最近对话` : undefined}>
      {records.length ? records.map(record => <div className="aiwc-history-row" key={record.id} data-chat-id={record.id} data-current={record.id === activeConversationId || undefined} data-selected={editing && selectedIds.has(record.id) || undefined}>
        {editing ? <label className="aiwc-history-selection">
          <input className="aiw-checkbox" type="checkbox" checked={selectedIds.has(record.id)} onChange={() => onSelect(record.id)} aria-label={`选择 ${record.title}`}/>
          <span title={record.title}>{record.title}</span>
        </label> : <>
          <button type="button" className="aiwc-history-item" title={record.title} aria-current={record.id === activeConversationId ? 'page' : undefined} onClick={() => onNavigate('chats', `detail:${record.id}`)}>{record.title}</button>
          <button type="button" className="aiwc-small-icon aiwc-row-more" aria-label={`${record.title}的更多操作`} title="更多操作" aria-haspopup="menu" aria-expanded={menuId === record.id} onClick={event => onMenu(event.currentTarget, record)}><Ellipsis size={14}/></button>
        </>}
      </div>) : <p className="aiwc-empty" role="status">{searching ? '未找到匹配的会话' : title === '置顶' ? '暂无置顶对话' : `暂无${source === 'cloud' ? '云端' : '本地'}对话`}</p>}
    </div>
    </div>
  </section>;
}

// A top-layer popover escapes the scroll container without changing row geometry.
export function HistoryMenu({ anchor, label, items, onClose, placement = 'bottom', autoFocus = true, onPointerEnter, onPointerLeave }) {
  const menuRef = useRef(null);
  const iconSize = 16;
  const [hoveredItem, setHoveredItem] = useState(null);
  const [focusedItem, setFocusedItem] = useState(null);
  useLayoutEffect(() => {
    const node = menuRef.current;
    node.showPopover();
    const rect = anchor.getBoundingClientRect();
    const bounds = node.getBoundingClientRect();
    const preferredLeft = placement === 'right' ? rect.right + 4 : rect.left;
    const fallbackLeft = placement === 'right' ? rect.left - bounds.width - 4 : rect.right - bounds.width;
    const left = preferredLeft + bounds.width <= innerWidth - 8 ? preferredLeft : fallbackLeft;
    node.style.left = `${Math.max(8, Math.min(left, innerWidth - bounds.width - 8))}px`;
    const firstItem = node.querySelector('[role="menuitem"]');
    const firstRowOffset = firstItem ? firstItem.getBoundingClientRect().top - bounds.top : 0;
    node.style.top = `${Math.max(8, Math.min((placement === 'right' ? rect.top - firstRowOffset : rect.bottom + 4), innerHeight - bounds.height - 8))}px`;
    if (autoFocus) node.querySelector('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true });
    const outside = event => { if (!node.contains(event.target) && !anchor.contains(event.target)) onClose(false); };
    const scroll = event => { if (!node.contains(event.target)) onClose(false); };
    const dismiss = () => onClose(false);
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('blur', dismiss);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('blur', dismiss);
      if (node.matches(':popover-open')) node.hidePopover();
    };
  }, [anchor, onClose, placement, autoFocus]);
  return <div ref={menuRef} popover="manual" className="aiwc-history-menu dropdown-panel aiwc-navigation-menu" data-placement={placement} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} role="menu" aria-label={label} onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); onClose(true); }
    else if (event.key === 'Tab') { event.preventDefault(); onClose(true); }
    else if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const buttons = [...event.currentTarget.querySelectorAll('[role="menuitem"]:not(:disabled)')];
      const index = buttons.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : buttons.length - 1)) % buttons.length;
      buttons[next]?.focus();
    }
  }}>
    {items.map(({ label: text, Icon, iconName, animatedKind, danger, disabled, href, onClick, trailingAction, secondaryAction }, index) => {
      const Tag = href ? 'a' : 'button';
      const item = <Tag {...(href ? { href, target: '_blank', rel: 'noopener noreferrer' } : { type: 'button', disabled })} role="menuitem" className={danger ? 'danger' : undefined} onClick={onClick} onPointerEnter={event => { if (event.pointerType !== 'touch') setHoveredItem(text); }} onPointerLeave={() => setHoveredItem(null)} onPointerCancel={() => setHoveredItem(null)} onFocus={event => setFocusedItem(event.currentTarget.matches(':focus-visible') ? text : null)} onBlur={() => setFocusedItem(null)}><span className="dropdown-item-content">{animatedKind ? <SidebarAnimatedIcon kind={animatedKind} size={iconSize} active={hoveredItem === text || focusedItem === text}/> : iconName ? <span className={`iconfont icon-${iconName}`} aria-hidden="true"/> : Icon && <Icon size={iconSize}/>}<span>{text}</span></span></Tag>;
      return <Fragment key={text}>
        {danger && index > 0 && <div className="dropdown-divider-container" role="separator"><div className="dropdown-divider"/></div>}
        {trailingAction ? <div className="aiwc-menu-action-row" role="none">{item}{secondaryAction && <a onClick={openBookmarkTab} className="aiwc-menu-jump" role="menuitem" href={secondaryAction.href} target="_blank" rel="noopener noreferrer" aria-label={secondaryAction.label} title={secondaryAction.label}><ArrowUpRight size={14} aria-hidden="true"/></a>}<button type="button" role="menuitem" className="aiwc-menu-pin" aria-label={trailingAction.label} title={trailingAction.title} data-pinned={trailingAction.active || undefined} onClick={trailingAction.onClick}><span className={`iconfont icon-${trailingAction.iconName}`} aria-hidden="true"/></button></div> : item}
      </Fragment>;
    })}
  </div>;
}

export function HistoryActionDialog({ action, onClose, onConfirm }) {
  const dialogRef = useRef(null);
  const [title, setTitle] = useState(action.record.title);
  const titleId = useId();
  const deleting = action.type === 'delete';
  useLayoutEffect(() => {
    const node = dialogRef.current;
    node.showModal();
    node.focus({ preventScroll:true });
    return () => node.close();
  }, [deleting]);
  const descriptionId = `${titleId}-description`;
  return createPortal(<dialog ref={dialogRef} tabIndex={-1} autoFocus className={`delete-space-dialog${deleting ? '' : ' edit-space-dialog'} aiwc-conversation-dialog`} role={deleting ? 'alertdialog' : undefined} aria-label={deleting ? undefined : '重命名会话'} aria-labelledby={deleting ? titleId : undefined} aria-describedby={deleting ? descriptionId : undefined} onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => event.stopPropagation()}>
    <form className="aiwc-conversation-form" onSubmit={event => { event.preventDefault(); if (deleting || title.trim()) onConfirm(title.trim()); }}>
      {deleting ? <div className="delete-space-content">
        <img className="delete-space-warning" src={warningIcon} alt="" draggable="false"/>
        <h2 id={titleId}>删除对话</h2>
        <p id={descriptionId}>确认删除“{action.record.title}”？删除后不可恢复。</p>
      </div> : <>
        <label className="edit-space-field">
          <span className="edit-space-label">重命名会话</span>
          <span className="edit-space-input-row"><input value={title} maxLength={120} onChange={event => setTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }}/></span>
        </label>
      </>}
      <div className={`delete-space-actions${deleting ? '' : ' edit-space-actions'}`}>
        <button type="button" className="delete-space-cancel" onClick={onClose}>取消</button>
        <button type="submit" className={deleting ? 'delete-space-confirm' : 'edit-space-confirm'} disabled={!deleting && !title.trim()}>{deleting ? '确认删除' : '保存'}</button>
      </div>
    </form>
  </dialog>, getHomeRoot());
}
