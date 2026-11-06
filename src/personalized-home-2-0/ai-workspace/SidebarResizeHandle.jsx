import { useLayoutEffect, useRef, useState } from 'react';
import { clampSidebarWidth, sidebarWidthLimit, SIDEBAR_WIDTH_DEFAULT, SIDEBAR_WIDTH_KEY, SIDEBAR_WIDTH_MIN } from './sidebar-width';
import { setNativeCursor } from '../../nativeCursor';

export default function SidebarResizeHandle() {
  const handle = useRef(null);
  const drag = useRef(null);
  const preferred = useRef(SIDEBAR_WIDTH_DEFAULT);
  const available = useRef(0);
  const currentWidth = useRef(SIDEBAR_WIDTH_DEFAULT);
  const [width, setWidth] = useState(SIDEBAR_WIDTH_DEFAULT);
  const [maximum, setMaximum] = useState(400);
  function apply(value) {
    const next = clampSidebarWidth(value, available.current);
    handle.current?.parentElement.style.setProperty('--aiw-sidebar-width', `${next}px`);
    currentWidth.current = next;
    setWidth(next);
    return next;
  }
  function save(value) {
    preferred.current = value;
    try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(value)); } catch { /* session only */ }
  }
  useLayoutEffect(() => {
    const shell = handle.current.parentElement;
    preferred.current = SIDEBAR_WIDTH_DEFAULT;
    try {
      // Apply the requested default once, replacing older stored widths such as 224px.
      // Subsequent manual resizing still persists normally.
      const defaultKey = `${SIDEBAR_WIDTH_KEY}-default`;
      if (localStorage.getItem(defaultKey) !== String(SIDEBAR_WIDTH_DEFAULT)) {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(SIDEBAR_WIDTH_DEFAULT));
        localStorage.setItem(defaultKey, String(SIDEBAR_WIDTH_DEFAULT));
      }
      const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
      if (saved !== null && Number.isFinite(Number(saved))) preferred.current = Number(saved);
    } catch { /* default width */ }
    const resize = () => {
      available.current = shell.clientWidth;
      setMaximum(sidebarWidthLimit(available.current));
      apply(preferred.current);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(shell);
    return () => { observer.disconnect(); shell.classList.remove('is-sidebar-resizing'); setNativeCursor('default'); };
  }, []);
  function finish(event, cancel = false) {
    if (!drag.current) return;
    const start = drag.current;
    drag.current = null;
    if (cancel) apply(start.width);
    else save(currentWidth.current);
    handle.current.parentElement.classList.remove('is-sidebar-resizing');
    if (handle.current.hasPointerCapture(start.id)) handle.current.releasePointerCapture(start.id);
    setNativeCursor(handle.current?.matches(':hover') ? 'colResize' : 'default');
  }
  return <div ref={handle} className="aiw-sidebar-resizer" role="separator" tabIndex={0}
    aria-label="调整侧栏宽度" aria-orientation="vertical" aria-valuemin={SIDEBAR_WIDTH_MIN} aria-valuemax={maximum} aria-valuenow={width}
    title="拖拽调整侧栏宽度，双击恢复默认"
    onPointerEnter={() => setNativeCursor('colResize')}
    onPointerLeave={() => { if (!drag.current) setNativeCursor('default'); }}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      drag.current = { id: event.pointerId, x: event.clientX, width };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.parentElement.classList.add('is-sidebar-resizing');
      setNativeCursor('colResize');
    }}
    onPointerMove={event => { if (drag.current) apply(drag.current.width + event.clientX - drag.current.x); }}
    onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)}
    onLostPointerCapture={event => finish(event, true)}
    onDoubleClick={() => save(apply(SIDEBAR_WIDTH_DEFAULT))}
    onKeyDown={event => {
      if (event.key === 'Escape' && drag.current) { event.preventDefault(); finish(event, true); return; }
      const step = event.shiftKey ? 32 : 8;
      const next = { ArrowLeft: width - step, ArrowRight: width + step, Home: SIDEBAR_WIDTH_MIN, End: maximum }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      save(apply(next));
    }}/>;
}
