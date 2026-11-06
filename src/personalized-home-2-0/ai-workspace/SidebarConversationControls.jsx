import { Fragment, useId, useLayoutEffect, useRef, useState } from 'react';
import { BatchListChecks, ChevronRight, Cloud, Ellipsis, Laptop } from '../icons';
import '../context-menu.css';
import '../../styles/dropdown.css';
import './workspace-checkbox.css';
import SidebarAnimatedIcon from './SidebarAnimatedIcon';

export function HistoryGroup({ title, records, onNavigate, activeConversationId, editing, selectedIds, onSelect, onMenu, menuId, onBatchEdit, hasChats, source, onSourceChange }) {
  const [expanded, setExpanded] = useState(true);
  const listId = useId();
  const batchTooltipId = useId();
  const isExpanded = editing || expanded;
  return <section className="aiwc-history-group" aria-label={title}>
    <div className="aiwc-group-header">
      <button type="button" className="aiwc-group-heading" aria-expanded={isExpanded} aria-controls={listId} disabled={editing} onClick={() => setExpanded(value => !value)}>
        <span>{title}</span><ChevronRight className="aiwc-group-chevron" size={14} strokeWidth={1.8} aria-hidden="true"/>
      </button>
      {onBatchEdit && <div className="aiwc-group-actions aiwc-batch-actions">
        <span className="aiwc-batch-tooltip-anchor">
          <button type="button" className="aiwc-small-icon" data-history-actions aria-label="批量编辑会话" aria-describedby={batchTooltipId} disabled={!hasChats || editing} onClick={onBatchEdit}><BatchListChecks size={14}/></button>
          <span id={batchTooltipId} role="tooltip" className="space-tooltip aiwc-batch-tooltip">批量编辑</span>
        </span>
      </div>}
      {source && <div className="aiwc-source-tabs" role="tablist" aria-label="最近对话来源">
        {[['local', '本地', Laptop], ['cloud', '云端', Cloud]].map(([value, label, Icon]) => <button key={value} type="button" role="tab" aria-label={label} aria-describedby={`${listId}-${value}-tooltip`} aria-selected={source === value} aria-controls={listId} tabIndex={source === value ? 0 : -1} onClick={() => { onSourceChange(value); setExpanded(true); }} onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          const next = event.key === 'Home' ? 'local' : event.key === 'End' ? 'cloud' : source === 'cloud' ? 'local' : 'cloud';
          onSourceChange(next); setExpanded(true);
          event.currentTarget.parentElement.querySelector(`[aria-label="${next === 'cloud' ? '云端' : '本地'}"]`)?.focus();
        }}><Icon size={14} strokeWidth={1.8} aria-hidden="true"/><span id={`${listId}-${value}-tooltip`} role="tooltip" className="space-tooltip aiwc-source-tooltip">{label}</span></button>)}
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
      </div>) : <p className="aiwc-empty">{title === '置顶' ? '暂无置顶对话' : `暂无${source === 'cloud' ? '云端' : '本地'}对话`}</p>}
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
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const buttons = [...event.currentTarget.querySelectorAll('[role="menuitem"]:not(:disabled)')];
      const index = buttons.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
      buttons[next]?.focus();
    }
  }}>
    {items.map(({ label: text, Icon, animatedKind, danger, disabled, href, onClick }, index) => {
      const Tag = href ? 'a' : 'button';
      return <Fragment key={text}>{danger && index > 0 && <div className="dropdown-divider-container" role="separator"><div className="dropdown-divider"/></div>}<Tag {...(href ? { href, target: '_blank', rel: 'noopener noreferrer' } : { type: 'button', disabled })} role="menuitem" className={danger ? 'danger' : undefined} onClick={onClick} onPointerEnter={event => { if (event.pointerType !== 'touch') setHoveredItem(text); }} onPointerLeave={() => setHoveredItem(null)} onPointerCancel={() => setHoveredItem(null)} onFocus={event => setFocusedItem(event.currentTarget.matches(':focus-visible') ? text : null)} onBlur={() => setFocusedItem(null)}><span className="dropdown-item-content">{animatedKind ? <SidebarAnimatedIcon kind={animatedKind} size={iconSize} active={hoveredItem === text || focusedItem === text}/> : Icon && <Icon size={iconSize}/>}<span>{text}</span></span></Tag></Fragment>;
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
    if (!deleting) node.querySelector('input')?.select();
    return () => node.close();
  }, [deleting]);
  return <dialog ref={dialogRef} className="aiwc-history-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => event.stopPropagation()}>
    <form onSubmit={event => { event.preventDefault(); onConfirm(title.trim()); }}>
      <h2 id={titleId}>{deleting ? '删除对话' : '重命名对话'}</h2>
      {deleting ? <p>确认删除“{action.record.title}”？此操作无法撤销。</p> : <label>对话名称<input autoFocus value={title} maxLength={120} onChange={event => setTitle(event.target.value)}/></label>}
      <div className="aiwc-dialog-actions">
        <button type="button" autoFocus={deleting} onClick={onClose}>取消</button>
        <button type="submit" className={deleting ? 'is-danger' : 'is-primary'} disabled={!deleting && !title.trim()}>{deleting ? '确认删除' : '保存'}</button>
      </div>
    </form>
  </dialog>;
}
