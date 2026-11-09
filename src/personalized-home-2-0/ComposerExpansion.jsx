import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './composer-expansion.css';

// One measured, reversible extension for task controls and inline pickers.
// The form stays mounted; only this body grows below/above it.
export default function ComposerExpansion({ kind, ownerRef, disabled, children }) {
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
    if (!open) return;
    const root = rootRef.current, body = bodyRef.current, owner = ownerRef.current;
    if (!root || !body || !owner) return;
    const form = owner.querySelector('.tb-composer');
    const above = Boolean(owner.closest('.aiw-conversation-footer, .widget-ai-chat-compose'));
    owner.dataset.expansionSide = above ? 'top' : 'bottom';
    let frame = 0;
    const viewport = window.visualViewport;
    const measure = () => {
      frame = 0;
      const bounds = form.getBoundingClientRect();
      const region = owner.closest('.home-scroll, .aiw-conversation, .widget-ai-chat')?.getBoundingClientRect();
      const top = Math.max(viewport?.offsetTop || 0, region?.top || 0);
      const bottom = Math.min((viewport?.offsetTop || 0) + (viewport?.height || innerHeight), region?.bottom ?? Infinity);
      const available = above ? bounds.top - top - 12 : bottom - bounds.bottom - 12;
      const limit = `${Math.max(64, Math.min(360, Math.floor(available)))}px`;
      if (body.style.maxHeight !== limit) body.style.maxHeight = limit;
      const height = `${body.getBoundingClientRect().height}px`;
      if (owner.style.getPropertyValue('--composer-expansion-height') !== height) owner.style.setProperty('--composer-expansion-height', height);
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
    };
  }, [open, kind, ownerRef]);

  return <div ref={rootRef} className={`tb-composer-expansion${open ? ' is-expanded' : ''}`}
    data-dock-secondary inert={!open || disabled} aria-hidden={!open || disabled}>
    <div ref={bodyRef} className="tb-composer-expansion-body">
      {(open || present) && (open ? children : retained.current)}
    </div>
  </div>;
}
