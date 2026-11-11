import { useLayoutEffect, useRef } from 'react';

export default function SidebarScrollArea({ scrollRef, onKeyDown, children }) {
  const thumbRef = useRef(null);
  const dragRef = useRef(null);
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const thumb = thumbRef.current;
    const observed = new Set();
    const update = () => {
      // Read scroll geometry before touching the thumb's paint properties.
      const height = scroll.clientHeight, scrollHeight = scroll.scrollHeight, top = scroll.scrollTop;
      const track = Math.max(0, height - 4);
      const size = Math.min(track, Math.max(24, track * height / Math.max(1, scrollHeight)));
      const hidden = scrollHeight <= height + 1;
      const thumbHeight = `${size}px`;
      const transform = `translateY(${(track - size) * top / Math.max(1, scrollHeight - height)}px)`;
      if (thumb.hidden !== hidden) thumb.hidden = hidden;
      if (thumb.style.height !== thumbHeight) thumb.style.height = thumbHeight;
      if (thumb.style.transform !== transform) thumb.style.transform = transform;
    };
    const observer = new ResizeObserver(update);
    observer.observe(scroll);
    const syncChildren = () => {
      const children = new Set(scroll.children);
      for (const child of observed) {
        if (children.has(child)) continue;
        observer.unobserve(child);
        observed.delete(child);
      }
      for (const child of children) {
        if (observed.has(child)) continue;
        observer.observe(child);
        observed.add(child);
      }
      update();
    };
    syncChildren();
    const mutations = new MutationObserver(syncChildren);
    mutations.observe(scroll, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    scroll.addEventListener('scroll', update, { passive: true });
    update();
    return () => { observer.disconnect(); mutations.disconnect(); scroll.removeEventListener('scroll', update); };
  }, [scrollRef]);
  return <div className="aiwc-scroll-area">
    <div className="aiwc-scroll" ref={scrollRef} tabIndex={-1} onKeyDown={onKeyDown}>{children}</div>
    <div className="aiwc-scroll-thumb" ref={thumbRef} hidden aria-hidden="true"
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        const scroll = scrollRef.current;
        dragRef.current = { y: event.clientY, top: scroll.scrollTop, ratio: (scroll.scrollHeight - scroll.clientHeight) / Math.max(1, scroll.clientHeight - 4 - event.currentTarget.offsetHeight) };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const drag = dragRef.current;
        if (drag) scrollRef.current.scrollTop = drag.top + (event.clientY - drag.y) * drag.ratio;
      }}
      onPointerUp={event => { dragRef.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onLostPointerCapture={() => { dragRef.current = null; }}/>
  </div>;
}
