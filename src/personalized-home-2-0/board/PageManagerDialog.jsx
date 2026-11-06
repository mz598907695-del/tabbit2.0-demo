import { getHomeRoot } from "../home-host";
import { useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from "../icons";
import PageManager from './PageManager';
import './board-dialogs.css';
import './page-manager-dialog.css';

export default function PageManagerDialog({ pages, activePageId, onReorder, onRename, onDelete, onAdd, onClose, onBusyChange }) {
  const id = useId();
  const dialogRef = useRef(null);
  const managerRef = useRef(null);
  const backdropDown = useRef(false);
  const busyRef = useRef(onBusyChange);
  busyRef.current = onBusyChange;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    const home = document.querySelector('.home');
    const position = () => {
      const rect = home?.getBoundingClientRect();
      const left = Math.max(0, rect?.left || 0);
      const top = Math.max(0, rect?.top || 0);
      const width = Math.max(0, Math.min(rect?.right || innerWidth, innerWidth) - left);
      const height = Math.max(0, Math.min(rect?.bottom || innerHeight, innerHeight) - top);
      const availableWidth = Math.max(240, width - 32);
      const availableHeight = Math.max(200, height - 32);
      dialog.style.setProperty('--page-manager-left', `${left + (width - Math.min(640, availableWidth)) / 2}px`);
      dialog.style.setProperty('--page-manager-top', `${top + (height - Math.min(560, availableHeight)) / 2}px`);
      dialog.style.setProperty('--page-manager-available-width', `${availableWidth}px`);
      dialog.style.setProperty('--page-manager-available-height', `${availableHeight}px`);
    };
    position();
    if (!dialog.open) dialog.showModal();
    const initialFocus = dialog.querySelector('.page-manager-add-trigger:not(:disabled)')
      || dialog.querySelector('.page-manager-grip:not(:disabled)')
      || dialog.querySelector('button');
    initialFocus?.focus({ preventScroll: true });
    const observer = new ResizeObserver(position);
    if (home) observer.observe(home);
    window.addEventListener('resize', position);
    busyRef.current?.(true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      if (dialog.open) dialog.close();
      busyRef.current?.(false);
      queueMicrotask(() => {
        if (!document.querySelector('dialog[open]') && opener?.isConnected) opener.focus?.({ preventScroll: true });
      });
    };
  }, []);

  function outside(event) {
    if (event.target !== dialogRef.current) return false;
    const rect = dialogRef.current.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  }

  return createPortal(<dialog ref={dialogRef} className="board-dialog board-library-dialog page-manager-dialog"
    aria-labelledby={`${id}-title`}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!managerRef.current?.cancelTransient()) onClose(); }}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape' && !event.defaultPrevented && managerRef.current?.cancelTransient()) event.preventDefault();
    }}
    onPointerDown={event => { backdropDown.current = outside(event); }}
    onPointerCancel={() => { backdropDown.current = false; }}
    onClick={event => { const dismiss = backdropDown.current && outside(event); backdropDown.current = false; if (dismiss) onClose(); }}>
    <header className="page-manager-dialog-header">
      <h2 id={`${id}-title`}>页面设置</h2>
      <button type="button" className="board-dialog-close" aria-label="关闭页面设置" onClick={onClose}><X size={18} aria-hidden="true" /></button>
    </header>
    <PageManager ref={managerRef} pages={pages} activePageId={activePageId} onReorder={onReorder} onRename={onRename} onDelete={onDelete} onAdd={onAdd} />
  </dialog>, getHomeRoot());
}
