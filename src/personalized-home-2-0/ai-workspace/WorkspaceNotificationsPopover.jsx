import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getHomeRoot } from '../home-host';
import WorkspaceNotifications from './WorkspaceNotifications';

const PANEL_WIDTH = 570;
const PANEL_HEIGHT = 460;
const GAP = 8;
const EDGE = 12;

export default function WorkspaceNotificationsPopover({ anchor, align = 'left', initialEntry, onClose }) {
  const panelRef = useRef(null);
  const [geometry, setGeometry] = useState(null);
  const position = useCallback(() => {
    const panel = panelRef.current;
    if (!panel || !anchor?.isConnected || !anchor.getClientRects().length) { onClose(false); return; }
    const viewport = window.visualViewport;
    const viewLeft = viewport?.offsetLeft || 0, viewTop = viewport?.offsetTop || 0;
    const viewRight = viewLeft + (viewport?.width || innerWidth), viewBottom = viewTop + (viewport?.height || innerHeight);
    const bounds = anchor.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, Math.max(0, viewRight - viewLeft - EDGE * 2));
    const height = Math.min(PANEL_HEIGHT, Math.max(0, viewBottom - viewTop - EDGE * 2));
    const side = viewBottom - EDGE - bounds.bottom - GAP >= height ? 'bottom' : 'top';
    const preferredTop = side === 'bottom' ? bounds.bottom + GAP : bounds.top - height - GAP;
    const top = Math.max(viewTop + EDGE, Math.min(viewBottom - EDGE - height, preferredTop));
    const preferredLeft = align === 'right' ? bounds.right - width : bounds.left;
    const left = Math.max(viewLeft + EDGE, Math.min(viewRight - EDGE - width, preferredLeft));
    // Native popovers are in the top layer: fixed coordinates remain viewport-relative.
    // Older engines use the portal's containing block as a fallback.
    const containing = panel.showPopover && panel.matches(':popover-open') ? null : panel.offsetParent;
    const box = containing?.getBoundingClientRect();
    const x = left - (box ? box.left + containing.clientLeft - containing.scrollLeft : 0);
    const y = top - (box ? box.top + containing.clientTop - containing.scrollTop : 0);
    setGeometry(current => current && current.left === x && current.top === y && current.width === width && current.height === height && current.side === side
      ? current : { left:x, top:y, width, height, side });
  }, [align, anchor, onClose]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    panel.showPopover?.();
    position();
    const attributes = ['aria-expanded', 'aria-controls', 'aria-haspopup'];
    const previous = attributes.map(name => anchor.getAttribute(name));
    anchor.setAttribute('aria-expanded', 'true');
    anchor.setAttribute('aria-controls', 'aiw-notifications-dropdown');
    anchor.setAttribute('aria-haspopup', 'dialog');
    panel.querySelector('[role="tab"][aria-selected="true"]')?.focus({ preventScroll:true });
    return () => {
      panel.hidePopover?.();
      attributes.forEach((name,index) => previous[index] === null ? anchor.removeAttribute(name) : anchor.setAttribute(name, previous[index]));
    };
  }, [anchor, position]);

  useEffect(() => {
    const outside = event => {
      if (!panelRef.current?.contains(event.target) && !anchor.contains(event.target)) onClose(false);
    };
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(true); }
    };
    let frame = 0;
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; position(); }); };
    const observer = new ResizeObserver(schedule);
    observer.observe(anchor);
    observer.observe(panelRef.current);
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', keydown, true);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', keydown, true);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, [anchor, onClose, position]);

  return createPortal(<section ref={panelRef} id="aiw-notifications-dropdown" popover="manual" role="dialog" aria-label="通知" className="dropdown-surface aiw-notifications-popover" data-placement={geometry?.side}
    style={geometry ? { left:geometry.left, top:geometry.top, width:geometry.width, height:geometry.height } : { visibility:'hidden' }}>
    <WorkspaceNotifications initialEntry={initialEntry}/>
  </section>, getHomeRoot());
}
