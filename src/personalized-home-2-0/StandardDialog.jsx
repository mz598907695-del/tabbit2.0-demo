import { useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from './icons';
import { getHomeRoot } from './home-host';
import warningIcon from '../assets/delete-space-warning.webp';
import './standard-dialog.css';

export default function StandardDialog({ title, description, onClose, children, footer, className = '', alert = false, warning = alert, initialFocusRef, anchorRef }) {
  const ref = useRef(null), closeRef = useRef(onClose), backdropDown = useRef(false);
  const id = useId();
  closeRef.current = onClose;
  useLayoutEffect(() => {
    const dialog = ref.current, opener = document.activeElement;
    dialog.showModal();
    const position = () => {
      const anchor = anchorRef?.current;
      if (!anchor?.isConnected) return;
      const rect = (anchor.closest('dialog') || anchor).getBoundingClientRect(), box = dialog.getBoundingClientRect();
      Object.assign(dialog.style, { inset: 'auto', margin: '0', left: `${Math.max(16, Math.min(innerWidth - box.width - 16, rect.left + (rect.width - box.width) / 2))}px`, top: `${Math.max(16, Math.min(innerHeight - box.height - 16, rect.top + (rect.height - box.height) / 2))}px` });
    };
    position();
    const cancelTop = event => {
      if ([...document.querySelectorAll('dialog[open]')].at(-1) !== dialog) return;
      event.preventDefault(); event.stopImmediatePropagation(); closeRef.current();
    };
    const shortcut = event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'w') cancelTop(event); };
    window.addEventListener('tabbit-close-tab', cancelTop, true);
    window.addEventListener('keydown', shortcut, true);
    const observer = anchorRef?.current ? new ResizeObserver(position) : null;
    if (observer) { observer.observe(anchorRef.current); observer.observe(dialog); window.addEventListener('resize', position); }
    (initialFocusRef?.current || dialog.querySelector('input,textarea,button'))?.focus({ preventScroll: true });
    return () => {
      observer?.disconnect(); window.removeEventListener('resize', position);
      window.removeEventListener('tabbit-close-tab', cancelTop, true);
      window.removeEventListener('keydown', shortcut, true);
      dialog.close();
      queueMicrotask(() => {
        const active = document.activeElement;
        if ((!active || active === document.body || dialog.contains(active)) && opener?.isConnected && !opener.closest('[inert]')) opener.focus?.({ preventScroll: true });
      });
    };
  }, []);
  const outside = event => {
    if (event.target !== ref.current) return false;
    const r = ref.current.getBoundingClientRect();
    return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
  };
  return createPortal(<dialog ref={ref} className={`standard-dialog home-standard-dialog ${alert ? 'standard-confirm-dialog' : ''} ${className}`} role={alert ? 'alertdialog' : undefined} aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); closeRef.current(); }} onKeyDown={event => event.stopPropagation()}
    onPointerDown={event => { event.stopPropagation(); backdropDown.current = outside(event); }}
    onPointerCancel={() => { backdropDown.current = false; }}
    onClick={event => { event.stopPropagation(); const dismiss = backdropDown.current && outside(event); backdropDown.current = false; if (dismiss && !alert) closeRef.current(); }}>
    <header className="standard-dialog-header">
      {warning && <img className="standard-dialog-warning" src={warningIcon} alt="" draggable={false}/>}
      <div className="standard-dialog-heading"><h2 id={`${id}-title`}>{title}</h2>{description && <p id={`${id}-description`}>{description}</p>}</div>
      {!alert && <button type="button" className="standard-dialog-close" aria-label={`关闭${title}`} onClick={onClose}><X size={16}/></button>}
    </header>
    {children}
    {footer && <footer className="standard-dialog-actions">{footer}</footer>}
  </dialog>, getHomeRoot());
}

export function NameDialog({ title, value, onChange, onSubmit, onClose, error, inputRef, inputLabel = '看板名称', confirmLabel = '保存' }) {
  const id = useId();
  return <StandardDialog title={title} onClose={onClose} initialFocusRef={inputRef}>
    <form className="standard-dialog-form" onSubmit={event => { event.preventDefault(); event.stopPropagation(); if (value.trim()) onSubmit(event); }}>
      <div className="standard-dialog-body"><label className="standard-dialog-field" htmlFor={id}>{inputLabel}<input ref={inputRef} id={id} aria-label={inputLabel} value={value} onChange={event => onChange(event.target.value)} placeholder="输入看板名称" maxLength={24} autoComplete="off" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
        onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault(); }}/></label>
        {error && <p id={`${id}-error`} className="standard-dialog-error" role="alert">{error}</p>}
      </div>
      <footer className="standard-dialog-actions"><button className="standard-dialog-secondary" type="button" onClick={onClose}>取消</button><button className="standard-dialog-primary" type="submit" disabled={!value.trim()}>{confirmLabel}</button></footer>
    </form>
  </StandardDialog>;
}

export function ConfirmDialog({ title, description, onConfirm, onClose, confirmLabel = '确认删除', className = '', anchorRef, busy = false, danger = true, error = '' }) {
  const cancelRef = useRef(null);
  return <StandardDialog title={title} description={description} className={className} onClose={onClose} anchorRef={anchorRef} initialFocusRef={cancelRef} alert warning={danger} footer={<>
    <button ref={cancelRef} className="standard-dialog-secondary" type="button" disabled={busy} onClick={onClose}>取消</button>
    <button className={danger ? "standard-dialog-danger" : "standard-dialog-primary"} type="button" disabled={busy} onClick={onConfirm}>{confirmLabel}</button>
  </>}>{error && <p className="standard-dialog-error standard-dialog-confirm-error" role="alert">{error}</p>}</StandardDialog>;
}
