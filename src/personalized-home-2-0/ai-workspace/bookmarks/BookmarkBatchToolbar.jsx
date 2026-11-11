import { useLayoutEffect, useRef, useState } from 'react';
import { GripVertical } from '../../icons';


export default function BookmarkBatchToolbar({ children }) {
  const dock = useRef(null), toolbar = useRef(null), drag = useRef(null), offset = useRef({ x: 0, y: 0 });
  const [position, setPosition] = useState(offset.current), [moving, setMoving] = useState(false);
  function place(next) {
    const bar = toolbar.current, main = dock.current?.parentElement;
    if (!bar || !main) return;
    const bounds = main.getBoundingClientRect(), rect = bar.getBoundingClientRect();
    const base = { x: rect.x - offset.current.x, y: rect.y - offset.current.y };
    const top = main.querySelector('.bkm-topbar')?.getBoundingClientRect().bottom ?? bounds.top;
    const minX = bounds.left + 8 - base.x, maxX = bounds.right - rect.width - 8 - base.x;
    const minY = top + 8 - base.y, maxY = bounds.bottom - rect.height - 8 - base.y;
    const value = { x: Math.max(minX, Math.min(maxX, next.x)), y: Math.max(Math.min(minY, maxY), Math.min(maxY, next.y)) };
    offset.current = value;
    // Keep geometry current even when pointer events arrive before React paints.
    bar.style.transform = `translate(${value.x}px, ${value.y}px)`;
    setPosition(previous => previous.x === value.x && previous.y === value.y ? previous : value);
  }
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => place(offset.current));
    observer.observe(dock.current.parentElement); observer.observe(toolbar.current);
    return () => observer.disconnect();
  }, []);
  function end(event, cancel = false) {
    if (!drag.current || event.pointerId !== undefined && event.pointerId !== drag.current.id) return;
    const start = drag.current; drag.current = null; setMoving(false);
    if (cancel) place(start.offset);
    if (event.currentTarget.hasPointerCapture?.(start.id)) event.currentTarget.releasePointerCapture(start.id);
  }
  return <div className="bkm-batch-dock" ref={dock}>
    <div ref={toolbar} className={`board-batch-toolbar bkm-batch-toolbar${moving ? ' is-moving' : ''}`} role="group" aria-label="批量整理" style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
      <button className="bkm-batch-grip" aria-label="拖动批量工具栏" title="拖动调整位置；方向键移动，Home 或双击复位" onDoubleClick={() => place({ x: 0, y: 0 })}
        onPointerDown={event => {
          if (event.button !== 0 || drag.current) return;
          event.preventDefault(); event.stopPropagation(); event.currentTarget.focus();
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, offset: { ...offset.current } };
          event.currentTarget.setPointerCapture(event.pointerId); setMoving(true);
        }}
        onPointerMove={event => { const start = drag.current; if (start && event.pointerId === start.id) place({ x: start.offset.x + event.clientX - start.x, y: start.offset.y + event.clientY - start.y }); }}
        onPointerUp={event => end(event)} onPointerCancel={event => end(event, true)} onLostPointerCapture={event => end(event, true)}
        onKeyDown={event => {
          if (event.key === 'Escape' && drag.current) { event.preventDefault(); event.stopPropagation(); end(event, true); }
          const delta = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[event.key];
          if (delta || event.key === 'Home') {
            event.preventDefault(); event.stopPropagation();
            place(delta ? { x: offset.current.x + delta[0], y: offset.current.y + delta[1] } : { x: 0, y: 0 });
          }
        }}><GripVertical size={16}/></button>
      {children}
    </div>
  </div>;
}
