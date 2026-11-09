import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getHomeRoot } from './home-host';

function focusBesideTrigger(trigger, direction) {
  const elements = [...document.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')]
    .filter(node => !node.closest('.tb-composer-popover, [inert]') && node.getClientRects().length);
  const index = elements.indexOf(trigger);
  (elements[index + direction] || trigger)?.focus({ preventScroll: true });
}

export default function ComposerPopover({ anchor, kind, id, label, width, maxHeight, onClose, children, closing = false }) {
  const layerRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [geometry, setGeometry] = useState(null);
  const isDialog = kind === 'project';

  function position() {
    const layer = layerRef.current;
    if (!layer || !anchor?.isConnected) return;
    const viewport = window.visualViewport;
    const dialogBounds = anchor.closest('dialog')?.getBoundingClientRect();
    const viewLeft = Math.max(viewport?.offsetLeft || 0, dialogBounds?.left || 0);
    const viewTop = Math.max(viewport?.offsetTop || 0, dialogBounds?.top || 0);
    const viewRight = Math.min((viewport?.offsetLeft || 0) + (viewport?.width || window.innerWidth), dialogBounds?.right ?? Infinity);
    const viewBottom = Math.min((viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight), dialogBounds?.bottom ?? Infinity);
    const viewWidth = viewRight - viewLeft;
    const viewHeight = viewBottom - viewTop;
    const triggerBounds = anchor.getBoundingClientRect();
    const bounds = triggerBounds;
    const layerWidth = Math.min(width, Math.max(0, viewWidth - 24));
    const above = Math.max(0, bounds.top - viewTop - 20);
    const below = Math.max(0, viewTop + viewHeight - bounds.bottom - 20);
    const desiredHeight = Math.min(maxHeight, layer.scrollHeight + 2);
    // Prefer opening below, shrinking the scrollable body to fit. Only flip
    // when there is not enough room for even one usable menu row.
    const side = below >= Math.min(desiredHeight, 48) || below >= above ? 'bottom' : 'top';
    const height = Math.min(maxHeight, Math.max(0, viewHeight - 24), side === 'bottom' ? below : above);
    const left = Math.min(viewLeft + viewWidth - layerWidth - 12, Math.max(viewLeft + 12, ['runtime', 'approval'].includes(kind) ? bounds.right - layerWidth : bounds.left));
    const shownHeight = Math.min(desiredHeight, height);
    const preferredTop = side === 'bottom' ? bounds.bottom + 8 : bounds.top - shownHeight - 8;
    const top = Math.min(viewTop + viewHeight - shownHeight - 12, Math.max(viewTop + 12, preferredTop));
    // A backdrop-filtered ancestor establishes a containing block for fixed
    // descendants. Bounds above are viewport coordinates; CSS offsets are local.
    const containingBlock = layer.offsetParent;
    const containingBounds = containingBlock?.getBoundingClientRect();
    const localLeft = left - (containingBounds ? containingBounds.left + containingBlock.clientLeft - containingBlock.scrollLeft : 0);
    const localTop = top - (containingBounds ? containingBounds.top + containingBlock.clientTop - containingBlock.scrollTop : 0);
    setGeometry(current => current && current.left === localLeft && current.top === localTop && current.width === layerWidth && current.maxHeight === height && current.side === side
      ? current : { left: localLeft, top: localTop, width: layerWidth, maxHeight: height, side });
  }

  // Initial placement and real content changes need a measurement, not every
  // render caused by the resulting coordinates themselves.
  useLayoutEffect(position, [anchor, kind, width, maxHeight, children]);
  useLayoutEffect(() => {
    if (!geometry) return;
    const layer = layerRef.current;
    const target = layer.querySelector('[data-composer-initial], [aria-checked="true"]') || layer.querySelector('input, textarea, button');
    target?.focus({ preventScroll: true });
    if (target && !isDialog) {
      const scrollArea = target.closest('.tb-model-options') || layer;
      const offset = target.getBoundingClientRect().bottom - scrollArea.getBoundingClientRect().bottom + 6;
      if (offset > 0) scrollArea.scrollTop += offset;
    }
  }, [Boolean(geometry)]);
  useEffect(() => {
    const outside = event => {
      if (closing) return;
      if (layerRef.current?.contains(event.target) || anchor?.contains(event.target)) return;
      closeRef.current(false);
    };
    let frame = 0;
    const schedulePosition = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; position(); });
    };
    const observer = new ResizeObserver(schedulePosition);
    const composer = anchor?.closest('.tb-composer-wrap');
    if (layerRef.current) observer.observe(layerRef.current);
    if (anchor) observer.observe(anchor);
    composer?.addEventListener('composergeometrychange', schedulePosition);
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('resize', schedulePosition);
    window.addEventListener('scroll', schedulePosition, true);
    window.visualViewport?.addEventListener?.('resize', schedulePosition);
    window.visualViewport?.addEventListener?.('scroll', schedulePosition);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      composer?.removeEventListener('composergeometrychange', schedulePosition);
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('resize', schedulePosition);
      window.removeEventListener('scroll', schedulePosition, true);
      window.visualViewport?.removeEventListener?.('resize', schedulePosition);
      window.visualViewport?.removeEventListener?.('scroll', schedulePosition);
    };
  }, [anchor, kind, width, maxHeight, closing]);

  function keydown(event) {
    event.stopPropagation();
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.key === 'Escape') { event.preventDefault(); closeRef.current(true); return; }
    const menuItems = [...layerRef.current.querySelectorAll('[data-composer-menu-item]:not(:disabled)')];
    const current = menuItems.indexOf(document.activeElement);
    if (!isDialog && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? menuItems.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : menuItems.length - 1)) % menuItems.length;
      menuItems[next]?.focus();
    }
    if (event.key === 'Tab') {
      const controls = [...layerRef.current.querySelectorAll('input:not(:disabled), textarea, button:not(:disabled)')];
      const atEdge = event.shiftKey ? document.activeElement === controls[0] : document.activeElement === controls.at(-1);
      if (!isDialog || atEdge) {
        event.preventDefault();
        closeRef.current(false);
        focusBesideTrigger(anchor, event.shiftKey ? -1 : 1);
      }
    }
  }

  return createPortal(<div
    ref={layerRef}
    data-composer-owner={anchor?.closest('[data-composer-owner]')?.dataset.composerOwner}
    id={id}
    className={`dropdown-surface tb-composer-popover tb-composer-${kind}-menu`}
    role={isDialog ? 'dialog' : 'menu'}
    aria-label={label}
    data-placement={geometry?.side}
    data-closing={closing || undefined}
    inert={closing}
    aria-hidden={closing || undefined}
    style={geometry ? { left: geometry.left, top: geometry.top, width: geometry.width, maxHeight: geometry.maxHeight } : { width, visibility: 'hidden' }}
    onKeyDown={keydown}
  >{children}</div>, anchor?.closest('dialog') || getHomeRoot());
}
