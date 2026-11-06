import { useLayoutEffect, useRef, useState } from 'react';
import { setNativeCursor } from './nativeCursor';

const STORAGE_KEY = 'tabbit-vertical-sidebar-width';
const DEFAULT_WIDTH = 256;
export default function VerticalSidebarResizeHandle({ collapsed }: { collapsed:boolean }) {
  const handle = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId:number; x:number; width:number } | null>(null);
  const preferred = useRef(DEFAULT_WIDTH);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [maximum, setMaximum] = useState(420);
  function apply(value:number) {
    const shell = handle.current?.parentElement;
    if (!shell) return DEFAULT_WIDTH;
    const max = Math.max(200, Math.min(420, shell.clientWidth - 480));
    const next = Math.max(200, Math.min(max, value));
    shell.style.setProperty('--vertical-sidebar-width', `${next}px`);
    setMaximum(max); setWidth(next);
    return next;
  }
  function save(value:number) {
    preferred.current = value;
    try { localStorage.setItem(STORAGE_KEY, String(value)); } catch { /* Keep the session value. */ }
  }
  useLayoutEffect(() => {
    const shell = handle.current!.parentElement!;
    try { const value = Number(localStorage.getItem(STORAGE_KEY)); if (value >= 200 && value <= 420) preferred.current = value; } catch { /* Default width. */ }
    const update = () => apply(preferred.current);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(shell);
    return () => { observer.disconnect(); shell.classList.remove('is-vertical-resizing'); setNativeCursor('default'); };
  }, []);
  function finish(cancel = false) {
    const start = drag.current;
    if (!start) return;
    drag.current = null;
    if (cancel) apply(start.width); else save(width);
    handle.current?.parentElement?.classList.remove('is-vertical-resizing');
    if (handle.current?.hasPointerCapture(start.pointerId)) handle.current.releasePointerCapture(start.pointerId);
    setNativeCursor(handle.current?.matches(':hover') ? 'colResize' : 'default');
  }
  return <div ref={handle} className="vertical-sidebar-resizer" role="separator" aria-label="调整垂直标签栏宽度" aria-orientation="vertical" aria-valuemin={200} aria-valuemax={maximum} aria-valuenow={width} aria-hidden={collapsed || undefined} inert={collapsed} tabIndex={collapsed ? -1 : 0}
    onPointerEnter={() => { if (!collapsed) setNativeCursor('colResize'); }}
    onPointerLeave={() => { if (!drag.current) setNativeCursor('default'); }}
    onPointerDown={event => {
      if (event.button !== 0 || collapsed) return;
      event.preventDefault(); event.stopPropagation();
      drag.current = { pointerId:event.pointerId, x:event.clientX, width };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.parentElement?.classList.add('is-vertical-resizing');
      setNativeCursor('colResize');
    }}
    onPointerMove={event => { if (drag.current) apply(drag.current.width + event.clientX - drag.current.x); }}
    onPointerUp={() => finish()} onPointerCancel={() => finish(true)} onLostPointerCapture={() => finish(true)}
    onDoubleClick={() => save(apply(DEFAULT_WIDTH))}
    onKeyDown={event => {
      if (event.key === 'Escape') { finish(true); return; }
      if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault(); save(apply(width + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 32 : 8)));
    }}/>
}
