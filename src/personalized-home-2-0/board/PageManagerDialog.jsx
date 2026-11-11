import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import WorkspaceSecondaryPage from '../ai-workspace/WorkspaceSecondaryPage';
import PageManager from './PageManager';
import './page-manager-dialog.css';

export default function PageManagerDialog({ pages, activePageId, onReorder, onRename, onDelete, onAdd, onSelect, onClose, onBusyChange, homeAnchorRef }) {
  const rootRef = useRef(null);
  const managerRef = useRef(null);
  const busyRef = useRef(onBusyChange);
  const openerRef = useRef(typeof document === 'undefined' ? null : document.activeElement);
  const [host, setHost] = useState(null);
  busyRef.current = onBusyChange;
  useLayoutEffect(() => {
    const nextHost = homeAnchorRef?.current || document.querySelector('.home');
    // The content scroll position lives in .home-scroll, not this viewport.
    // Clear any legacy focus-induced offset before anchoring the full page.
    if (nextHost) { nextHost.scrollTop = 0; nextHost.scrollLeft = 0; }
    setHost(nextHost);
  }, [homeAnchorRef]);

  useLayoutEffect(() => {
    if (!host || !rootRef.current) return;
    const opener = openerRef.current;
    const root = rootRef.current;
    host.scrollTop = 0;
    host.scrollLeft = 0;
    const siblings = [...host.children].filter(node => node !== root).map(node => ({ node, inert: node.inert }));
    siblings.forEach(({ node }) => { node.inert = true; });
    busyRef.current?.(true);
    return () => {
      siblings.forEach(({ node, inert }) => { node.inert = inert; });
      busyRef.current?.(false);
      queueMicrotask(() => {
        if (opener?.isConnected && !opener.closest('[inert]') && !document.querySelector('dialog[open]')) opener.focus?.({ preventScroll: true });
      });
    };
  }, [host]);

  function back() {
    if (!managerRef.current?.cancelTransient()) onClose();
  }
  if (!host) return null;
  return createPortal(<div ref={rootRef} className="page-manager-overlay" onKeyDownCapture={event => {
    if (event.key !== 'Escape' || event.nativeEvent.isComposing) return;
    if (managerRef.current?.cancelTransient()) { event.preventDefault(); event.stopPropagation(); }
  }}>
    <WorkspaceSecondaryPage title="看板设置" backLabel="返回首页" onBack={back}
      actions={<button type="button" className="page-overview-done" onClick={back}>完成</button>}>
      <div className="page-overview-body">
        <header className="page-overview-heading">
          <h1 tabIndex={-1}>看板设置</h1>
          <p>{pages.length} 个看板<span>·</span>点击进入，拖动调整顺序</p>
        </header>
        <PageManager ref={managerRef} pages={pages} activePageId={activePageId} onReorder={onReorder} onRename={onRename} onDelete={onDelete} onAdd={onAdd}
          onSelect={id => { onSelect?.(id); onClose(); }}/>
      </div>
    </WorkspaceSecondaryPage>
  </div>, host);
}
