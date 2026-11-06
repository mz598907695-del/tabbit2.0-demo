import { useLayoutEffect, useRef, useState } from 'react';
import { setNativeCursor } from '../nativeCursor';

const STORAGE_KEY = 'personalized-home-2-0-theme-sidebar-width';
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 300;
const MAX_WIDTH = 360;
const MIN_CONTENT_WIDTH = 420;

function widthLimit(available) {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, available - MIN_CONTENT_WIDTH));
}

export default function ThemeSidebarResizeHandle() {
  const handle = useRef(null);
  const host = useRef(null);
  const available = useRef(0);
  const preferred = useRef(DEFAULT_WIDTH);
  const current = useRef(DEFAULT_WIDTH);
  const drag = useRef(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [maximum, setMaximum] = useState(MAX_WIDTH);

  function apply(value) {
    const next = Math.round(Math.max(MIN_WIDTH, Math.min(widthLimit(available.current), Number(value) || DEFAULT_WIDTH)));
    host.current?.style.setProperty('--theme-sidebar-width', `${next}px`);
    current.current = next;
    setWidth(next);
    return next;
  }

  function save(value) {
    preferred.current = value;
    try { localStorage.setItem(STORAGE_KEY, String(value)); } catch { /* Keep the session value. */ }
  }

  useLayoutEffect(() => {
    const element = handle.current;
    const panelHost = element.closest('.browser-theme-panel-host') || element.closest('.home-layout');
    const container = panelHost.closest('.browser-content-row') || panelHost;
    host.current = panelHost;
    try {
      const defaultKey = `${STORAGE_KEY}-default`;
      if (localStorage.getItem(defaultKey) !== String(DEFAULT_WIDTH)) {
        localStorage.setItem(STORAGE_KEY, String(DEFAULT_WIDTH));
        localStorage.setItem(defaultKey, String(DEFAULT_WIDTH));
      }
      const saved = Number(localStorage.getItem(STORAGE_KEY));
      if (Number.isFinite(saved) && saved >= MIN_WIDTH && saved <= MAX_WIDTH) preferred.current = saved;
    } catch { /* Use the default width. */ }
    const resize = () => {
      available.current = container.clientWidth;
      setMaximum(widthLimit(available.current));
      apply(preferred.current);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => {
      observer.disconnect();
      panelHost.classList.remove('is-theme-sidebar-resizing');
      panelHost.style.removeProperty('user-select');
      setNativeCursor('default');
    };
  }, []);

  function finish(cancel = false) {
    const start = drag.current;
    if (!start) return;
    drag.current = null;
    if (cancel) apply(start.width);
    else save(current.current);
    host.current?.classList.remove('is-theme-sidebar-resizing');
    if (handle.current?.hasPointerCapture(start.pointerId)) handle.current.releasePointerCapture(start.pointerId);
    setNativeCursor(handle.current?.matches(':hover') ? 'colResize' : 'default');
  }

  return <div
    ref={handle}
    className="theme-sidebar-resizer"
    role="separator"
    tabIndex={0}
    aria-label="调整自定义 Tabbit 侧边栏宽度"
    aria-orientation="vertical"
    aria-valuemin={MIN_WIDTH}
    aria-valuemax={maximum}
    aria-valuenow={width}
    title="拖拽调整宽度，双击恢复默认"
    onPointerEnter={() => setNativeCursor('colResize')}
    onPointerLeave={() => { if (!drag.current) setNativeCursor('default'); }}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.focus({ preventScroll:true });
      drag.current = { pointerId:event.pointerId, x:event.clientX, width:current.current };
      event.currentTarget.setPointerCapture(event.pointerId);
      host.current?.classList.add('is-theme-sidebar-resizing');
      setNativeCursor('colResize');
    }}
    onPointerMove={event => {
      if (drag.current) apply(drag.current.width + drag.current.x - event.clientX);
    }}
    onPointerUp={() => finish()}
    onPointerCancel={() => finish(true)}
    onLostPointerCapture={() => finish(true)}
    onDoubleClick={() => save(apply(DEFAULT_WIDTH))}
    onKeyDown={event => {
      if (event.key === 'Escape' && drag.current) { event.preventDefault(); finish(true); return; }
      const step = event.shiftKey ? 32 : 8;
      const next = {
        ArrowLeft:width + step,
        ArrowRight:width - step,
        Home:MIN_WIDTH,
        End:maximum,
      }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      save(apply(next));
    }}
  />;
}
