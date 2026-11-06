import { useLayoutEffect, useRef } from 'react';
import { positionContextSubmenu } from './context-menu-position';

// Remain inside the parent's DOM tree for containment and modal focus handling;
// a manual popover lets this surface escape the parent's scrolling viewport.
export default function ContextSubmenu({ parentRef, anchorKey, label, focusOnOpen = false, onBack, onDismiss, children }) {
  const submenuRef = useRef(null);

  useLayoutEffect(() => {
    const node = submenuRef.current;
    const parent = parentRef.current;
    const anchor = [...(parent?.children || [])].find(child => child.getAttribute('data-setting-key') === anchorKey);
    if (!node || !parent || !anchor) return;
    node.showPopover?.();
    const reposition = () => {
      const position = positionContextSubmenu({
        parentRect: parent.getBoundingClientRect(),
        anchorRect: anchor.getBoundingClientRect(),
        submenuRect: node.getBoundingClientRect(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });
      node.style.left = `${position.left}px`;
      node.style.top = `${position.top}px`;
      node.dataset.side = position.side;
    };
    reposition();
    const frame = requestAnimationFrame(reposition);
    const observer = new ResizeObserver(reposition);
    observer.observe(parent);
    observer.observe(node);
    parent.addEventListener('scroll', reposition);
    window.addEventListener('resize', reposition);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      parent.removeEventListener('scroll', reposition);
      window.removeEventListener('resize', reposition);
      if (node.matches(':popover-open')) node.hidePopover();
    };
  }, [parentRef, anchorKey]);

  useLayoutEffect(() => {
    if (!focusOnOpen) return;
    const node = submenuRef.current;
    (node?.querySelector('[role="menuitemradio"][aria-checked="true"]:not(:disabled)') || node?.querySelector('button:not(:disabled)'))?.focus({ preventScroll: true });
  }, [anchorKey, focusOnOpen]);

  return <div ref={submenuRef} popover="manual" className="home-context-menu context-submenu" role="menu" aria-label={label}
    onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}
    onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape' || event.key === 'ArrowLeft') { event.preventDefault(); onBack(); }
      else if (event.key === 'Tab') { event.preventDefault(); onDismiss(); }
      else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) event.preventDefault();
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const buttons = [...event.currentTarget.querySelectorAll(':scope > button:not(:disabled)')];
        const index = buttons.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
        buttons[next]?.focus({ preventScroll: true });
      }
    }}>{children}</div>;
}
