import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './composer-expansion.css';

// Independent, measured extensions keep task controls and pickers mounted together.
// The form stays at its anchor while each extension grows on its assigned side.
export default function ComposerExpansion({ kind, ownerRef, disabled, side, heightProperty = '--composer-expansion-height', reserveTaskSpace = false, children }) {
  const open = Boolean(kind);
  const rootRef = useRef(null);
  const bodyRef = useRef(null);
  const retained = useRef(null);
  const [present, setPresent] = useState(open);
  if (open) retained.current = children;

  useEffect(() => {
    if (open) { setPresent(true); return; }
    const timer = setTimeout(() => setPresent(false), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320);
    return () => clearTimeout(timer);
  }, [open]);

  useLayoutEffect(() => {
    const root = rootRef.current, body = bodyRef.current, owner = ownerRef.current;
    if (!root || !body || !owner) return;
    const homeContent = heightProperty === '--composer-task-height' && owner.parentElement?.classList.contains('home-feed')
      ? owner.closest('.home-content') : null;
    const setHeight = height => {
      if (owner.style.getPropertyValue(heightProperty) !== height) owner.style.setProperty(heightProperty, height);
      if (homeContent && homeContent.style.getPropertyValue(heightProperty) !== height) homeContent.style.setProperty(heightProperty, height);
    };
    if (!open) {
      setHeight('0px');
      return () => homeContent?.style.removeProperty(heightProperty);
    }
    const form = owner.querySelector('.tb-composer');
    const above = side === 'top' || Boolean(owner.closest('.aiw-conversation-footer, .widget-ai-chat-compose'));
    root.dataset.expansionSide = above ? 'top' : 'bottom';
    let frame = 0;
    const viewport = window.visualViewport;
    const measure = () => {
      frame = 0;
      const bounds = form.getBoundingClientRect();
      const region = owner.closest('.home-scroll, .aiw-conversation, .widget-ai-chat')?.getBoundingClientRect();
      const top = Math.max(viewport?.offsetTop || 0, region?.top || 0);
      const bottom = Math.min((viewport?.offsetTop || 0) + (viewport?.height || innerHeight), region?.bottom ?? Infinity);
      const taskHeight = reserveTaskSpace ? parseFloat(owner.style.getPropertyValue('--composer-task-height')) || 0 : 0;
      const available = above ? bounds.top - top - taskHeight - 12 : bottom - bounds.bottom - 12;
      const limit = `${Math.max(64, Math.min(360, Math.floor(available)))}px`;
      if (body.style.maxHeight !== limit) body.style.maxHeight = limit;
      const height = `${body.getBoundingClientRect().height}px`;
      setHeight(height);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(body);
    observer.observe(form);
    const scroll = event => { if (!body.contains(event.target)) schedule(); };
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', scroll, true);
    viewport?.addEventListener?.('resize', schedule);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', scroll, true);
      viewport?.removeEventListener?.('resize', schedule);
      homeContent?.style.removeProperty(heightProperty);
    };
  }, [open, kind, ownerRef, side, heightProperty, reserveTaskSpace]);

  return <div ref={rootRef} className={`tb-composer-expansion${side === 'top' ? ' tb-composer-task-expansion' : ''}${open ? ' is-expanded' : ''}`}
    style={{ height:open ? `var(${heightProperty}, 0px)` : 0 }}
    data-dock-secondary inert={!open || disabled} aria-hidden={!open || disabled}>
    <div ref={bodyRef} className="tb-composer-expansion-body">
      {(open || present) && (open ? children : retained.current)}
    </div>
  </div>;
}
