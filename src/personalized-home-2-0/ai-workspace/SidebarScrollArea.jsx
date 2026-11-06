import { useLayoutEffect, useRef } from 'react';

export default function SidebarScrollArea({ scrollRef, onKeyDown, children }) {
  const thumbRef = useRef(null);
  const dragRef = useRef(null);
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const thumb = thumbRef.current;
    const update = () => {
      const height = scroll.clientHeight;
      const track = Math.max(0, height - 4);
      const size = Math.min(track, Math.max(24, track * height / scroll.scrollHeight));
      thumb.hidden = scroll.scrollHeight <= height + 1;
      thumb.style.height = `${size}px`;
      thumb.style.transform = `translateY(${(track - size) * scroll.scrollTop / Math.max(1, scroll.scrollHeight - height)}px)`;
    };
    const observer = new ResizeObserver(update);
    observer.observe(scroll);
    for (const child of scroll.children) observer.observe(child);
    const mutations = new MutationObserver(() => {
      for (const child of scroll.children) observer.observe(child);
      update();
    });
    mutations.observe(scroll, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    scroll.addEventListener('scroll', update, { passive: true });
    update();
    return () => { observer.disconnect(); mutations.disconnect(); scroll.removeEventListener('scroll', update); };
  }, [scrollRef]);
  return <div className="aiwc-scroll-area">
    <div className="aiwc-scroll" ref={scrollRef} onKeyDown={onKeyDown}>{children}</div>
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
