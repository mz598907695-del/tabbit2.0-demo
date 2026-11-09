import { useLayoutEffect, useRef } from 'react';

function focusItem(node, panel) {
  if (!node) return;
  node.focus({ preventScroll: true });
  const list = node.closest('.tb-model-options') || panel.closest('.tb-composer-expansion-body');
  if (!list) return;
  const item = node.getBoundingClientRect(), bounds = list.getBoundingClientRect();
  if (item.bottom > bounds.bottom) list.scrollTop += item.bottom - bounds.bottom + 4;
  else if (item.top < bounds.top) list.scrollTop += item.top - bounds.top - 4;
}

// Shared inline panel chrome. Each picker keeps its own selection/search logic.
export default function ComposerInlinePanel({ kind, id, label, active, children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    // The reference picker also focuses when navigating its nested views.
    if (!active || kind === 'add') return;
    const frame = requestAnimationFrame(() => {
      const panel = ref.current;
      const target = panel.querySelector('[data-composer-initial], [aria-checked="true"]')
        || panel.querySelector('input, button');
      focusItem(target, panel);
    });
    return () => cancelAnimationFrame(frame);
  }, [kind, active]);

  function keydown(event) {
    if (kind !== 'model' || event.defaultPrevented || event.nativeEvent.isComposing) return;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = [...ref.current.querySelectorAll('[data-composer-menu-item]:not(:disabled)')];
    if (!items.length) return;
    event.preventDefault();
    event.stopPropagation();
    const index = items.indexOf(event.target);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
    focusItem(items[next], ref.current);
  }

  return <div ref={ref} id={id} className={`tb-composer-inline-panel tb-composer-${kind}-menu tb-composer-inline-${kind}`}
    role={kind === 'model' ? 'menu' : 'dialog'} aria-label={label} onKeyDown={keydown}>
    {children}
  </div>;
}
