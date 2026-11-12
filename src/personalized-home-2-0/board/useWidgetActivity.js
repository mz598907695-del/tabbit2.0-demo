import { useLayoutEffect, useState } from 'react';

const observers = new WeakMap();
const MARGIN = 320;
const empty = { visible: false, near: false };

function measureActivity(element, root) {
  const rect = element.getBoundingClientRect(), view = element.ownerDocument.defaultView;
  const clip = root?.getBoundingClientRect() || { top: 0, bottom: view.innerHeight, left: 0, right: view.innerWidth };
  // A horizontally translated incoming page still needs the same vertical
  // contents. Do not unload it just because its animation starts offscreen.
  const moving = Boolean(element.closest('[data-page-swiping]'));
  return {
    visible: (moving || (rect.right > clip.left && rect.left < clip.right)) && rect.bottom > clip.top && rect.top < clip.bottom,
    near: (moving || (rect.right > clip.left - MARGIN && rect.left < clip.right + MARGIN)) && rect.bottom > clip.top - MARGIN && rect.top < clip.bottom + MARGIN,
  };
}

// Observe the homepage scrollport, not just the browser viewport. Prewarm one
// card row before it enters, while keeping the rest of a long board unmounted.
export function observeWidgetViewport(element, callback) {
  const doc = element.ownerDocument;
  const Observer = doc.defaultView?.IntersectionObserver;
  if (!Observer) { callback({ visible: true, near: true }); return () => {}; }
  const root = element.closest('.home-scroll');
  const key = root || doc;
  let state = observers.get(key);
  if (!state) {
    const callbacks = new Map(), values = new Map();
    const receive = field => entries => entries.forEach(entry => {
      if (!callbacks.has(entry.target)) return;
      const previous = values.get(entry.target) || empty;
      const next = entry.target.closest('[data-page-swiping]')
        ? measureActivity(entry.target, root) : { ...previous, [field]: entry.isIntersecting };
      if (previous.visible === next.visible && previous.near === next.near) return;
      values.set(entry.target, next);
      callbacks.get(entry.target)?.(next);
    });
    const visible = new Observer(receive('visible'), { root });
    const near = new Observer(receive('near'), { root, rootMargin: `${MARGIN}px` });
    const refresh = () => callbacks.forEach((callback, element) => {
      const next = measureActivity(element, root), previous = values.get(element) || empty;
      if (previous.visible === next.visible && previous.near === next.near) return;
      values.set(element, next);
      callback(next);
    });
    root?.addEventListener('board-page-layout-ready', refresh);
    state = { callbacks, values, visible, near, refresh };
    observers.set(key, state);
  }
  // Fill the initial viewport before paint; do not wait for the first observer
  // delivery when switching into a board or restoring its scroll position.
  const value = measureActivity(element, root);
  state.values.set(element, value);
  state.callbacks.set(element, callback);
  callback(value);
  state.visible.observe(element);
  state.near.observe(element);
  return () => {
    state.visible.unobserve(element);
    state.near.unobserve(element);
    state.callbacks.delete(element);
    state.values.delete(element);
    if (!state.callbacks.size) { state.visible.disconnect(); state.near.disconnect(); root?.removeEventListener('board-page-layout-ready', state.refresh); observers.delete(key); }
  };
}

export function useWidgetActivity(ref, enabled) {
  const [activity, setActivity] = useState(empty);
  useLayoutEffect(() => {
    if (!enabled || !ref.current) return;
    return observeWidgetViewport(ref.current, setActivity);
  }, [ref, enabled]);
  return enabled ? activity : empty;
}
