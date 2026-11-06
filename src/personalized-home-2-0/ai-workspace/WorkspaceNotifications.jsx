import { useEffect, useRef, useState } from 'react';
import { Bell, BrushCleaning, ExternalLink } from '../icons';
import { markNotificationsRead, NOTIFICATION_TABS, selectNotifications } from './notification-data';
import './workspace-notifications.css';
import './workspace-checkbox.css';

const ACTIONS = {
  product: { label: '了解更多', page: 'skills' },
  feedback: { label: '查看相关对话', page: 'chats' },
  billing: { label: '查看用量', page: 'usage' },
};

export default function WorkspaceNotifications({ data, setData, initialEntry, onNavigate }) {
  const [category, setCategory] = useState(() => NOTIFICATION_TABS.some(([id]) => id === initialEntry) ? initialEntry : 'all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const listRef = useRef(null);
  const entryId = initialEntry?.startsWith('detail:') ? initialEntry.slice(7) : undefined;
  const items = selectNotifications(data.notifications, category, unreadOnly);
  const hasUnread = data.notifications.some(item => item.unread);

  useEffect(() => {
    if (!entryId) return;
    setData(previous => markNotificationsRead(previous, [entryId]));
    const frame = requestAnimationFrame(() => {
      const target = [...(listRef.current?.querySelectorAll('[data-notification-id]') || [])].find(node => node.dataset.notificationId === entryId);
      target?.scrollIntoView({ block: 'nearest' });
      target?.querySelector('button')?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [entryId, setData]);

  function changeCategory(next) {
    setCategory(next);
    if (listRef.current) listRef.current.scrollTop = 0;
  }
  function tabKeyDown(event, index) {
    const next = event.key === 'ArrowRight' ? (index + 1) % NOTIFICATION_TABS.length : event.key === 'ArrowLeft' ? (index + NOTIFICATION_TABS.length - 1) % NOTIFICATION_TABS.length : event.key === 'Home' ? 0 : event.key === 'End' ? NOTIFICATION_TABS.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    changeCategory(NOTIFICATION_TABS[next][0]);
    event.currentTarget.parentElement.children[next]?.focus();
  }
  function markRead(item) {
    if (!item.unread) return;
    setData(previous => markNotificationsRead(previous, [item.id]));
    setAnnouncement('通知已标为已读');
    // An unread-only result disappears immediately; keep keyboard focus in the dialog.
    if (unreadOnly) listRef.current?.focus({ preventScroll: true });
  }

  return <>
    <div className="aiwn-toolbar">
      <div className="aiwn-tabs" role="tablist" aria-label="通知分类">
        {NOTIFICATION_TABS.map(([id, label], index) => <button key={id} id={`aiwn-tab-${id}`} role="tab" aria-selected={category === id} aria-controls="aiwn-panel" tabIndex={category === id ? 0 : -1} onClick={() => changeCategory(id)} onKeyDown={event => tabKeyDown(event, index)}>{label}</button>)}
      </div>
      {data.notifications.length > 0 && <div className="aiwn-tools">
        <label className="aiwn-unread-filter"><input className="aiw-checkbox" type="checkbox" checked={unreadOnly} onChange={event => { setUnreadOnly(event.target.checked); if (listRef.current) listRef.current.scrollTop = 0; }}/>未读消息</label>
        <button className="aiwn-clear aiw-icon-button" title="全部标为已读" aria-label="全部标为已读" disabled={!hasUnread} onClick={() => { setData(previous => markNotificationsRead(previous)); setAnnouncement('所有通知已标为已读'); }}><BrushCleaning size={16} strokeWidth={1.6}/></button>
      </div>}
    </div>
    <div ref={listRef} id="aiwn-panel" className={`aiwn-list ${items.length ? '' : 'is-empty'}`} role="tabpanel" aria-labelledby={`aiwn-tab-${category}`} tabIndex={0}>
      {items.length ? <>
        {items.map(item => {
          const action = ACTIONS[item.type];
          return <article key={item.id} className="aiwn-card" data-notification-id={item.id}>
            <button className="aiwn-message" aria-label={`${item.unread ? '标为已读' : '通知'}：${item.title}`} aria-describedby={`aiwn-description-${item.id}`} onClick={() => markRead(item)}>
              <span className="aiwn-meta">{item.unread && <i className="aiwn-unread-dot" aria-label="未读"/>}<span className="aiwn-subject">{item.title}</span><time>{item.date}</time></span>
              <span id={`aiwn-description-${item.id}`} className="aiwn-description">{item.description}</span>
            </button>
            {action && <button className="aiwn-link" onClick={() => { markRead(item); onNavigate(action.page); }}>{action.label}<ExternalLink size={14} strokeWidth={1.6}/></button>}
          </article>;
        })}
        <p className="aiwn-end">没有更多通知</p>
      </> : <div className="aiwn-empty">
        <span className="aiwn-empty-icon" aria-hidden="true"><Bell size={32} strokeWidth={1.5}/><span>zᶻ</span></span>
        <strong>目前一切平静</strong><p>{unreadOnly ? '暂时没有未读消息' : '新通知将显示在此处'}</p>
      </div>}
    </div>
    <span className="aiwn-announcement" role="status">{announcement}</span>
  </>;
}
