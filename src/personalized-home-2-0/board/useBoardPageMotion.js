import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export function useBoardPageMotion(gridRef, pageId, enabled, pages) {
  const outgoingRef = useRef(null), previewRef = useRef(null);
  const pending = useRef(null), tracking = useRef(null), running = useRef([]);
  const [previewPage, setPreviewPage] = useState(null);
  const latest = useRef({ enabled, pages });
  latest.current = { enabled, pages };
  const cancelAnimations = useCallback(() => {
    // Detach before cancel() restores the old page's underlying position.
    if (outgoingRef.current?.hasChildNodes()) outgoingRef.current.replaceChildren();
    running.current.forEach(animation => { animation.onfinish = null; animation.cancel(); });
    running.current = [];
    if (!tracking.current) gridRef.current?.parentElement?.removeAttribute('data-page-swiping');
  }, [gridRef]);
  const clearTracking = useCallback(() => {
    tracking.current = null;
    if (previewRef.current) previewRef.current.style.visibility = 'hidden';
    gridRef.current?.style.removeProperty('transform');
    previewRef.current?.style.removeProperty('transform');
    gridRef.current?.parentElement?.removeAttribute('data-page-swiping');
    setPreviewPage(null);
  }, [gridRef]);
  const prepare = useCallback(direction => {
    cancelAnimations();
    pending.current = null;
    const grid = gridRef.current;
    if (!latest.current.enabled || !grid || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { clearTracking(); return; }
    // A shorter target must not collapse the scroll range and move the sticky
    // composer. Retain the current feed height until the user scrolls to the top.
    const scroll = grid.closest('.home-scroll'), feed = grid.closest('.home-feed');
    if (scroll?.scrollTop > 0 && feed) feed.style.minHeight = `${feed.offsetHeight}px`;
    const snapshot = grid.cloneNode(true);
    snapshot.removeAttribute('tabindex'); snapshot.removeAttribute('role');
    snapshot.setAttribute('aria-hidden', 'true'); snapshot.inert = true;
    snapshot.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    const canvases = snapshot.querySelectorAll('canvas');
    grid.querySelectorAll('canvas').forEach((canvas, index) => {
      try { canvases[index]?.getContext('2d')?.drawImage(canvas, 0, 0); } catch { /* Keep the existing artwork fallback. */ }
    });
    pending.current = { snapshot, direction, offset: tracking.current?.distance || 0, width: grid.clientWidth };
    // Hide the live source before its gesture styles are reset. Reveal it only
    // after React has installed the target page and its entrance animation.
    grid.style.visibility = 'hidden';
    clearTracking();
  }, [gridRef, cancelAnimations, clearTracking]);
  useLayoutEffect(() => {
    const entry = pending.current;
    pending.current = null;
    const grid = gridRef.current, host = outgoingRef.current;
    if (!enabled) clearTracking();
    if (entry && grid && host && enabled) {
      host.replaceChildren(entry.snapshot);
      grid.parentElement?.setAttribute('data-page-swiping', 'true');
      const direction = entry.direction, width = entry.width;
      const progress = Math.min(1, entry.offset / Math.max(1, width));
      const options = { duration: Math.round(150 + 100 * (1 - progress)), easing: 'cubic-bezier(.2, .75, .2, 1)', fill: 'both' };
      // Keep both material planes opaque: fading a grid cuts its cards off
      // from the wallpaper backdrop and causes a brightness jump on finish.
      const outgoing = entry.snapshot.animate([
        { transform: `translateX(${-direction * entry.offset}px)` },
        { transform: `translateX(${-direction * width}px)` },
      ], options);
      const incoming = grid.animate([
        { transform: `translateX(${direction * (width - entry.offset)}px)` },
        { transform: 'translateX(0)' },
      ], options);
      running.current = [outgoing, incoming];
      incoming.onfinish = cancelAnimations;
    }
    grid?.style.removeProperty('visibility');
    return cancelAnimations;
  }, [pageId, enabled, gridRef, cancelAnimations, clearTracking]);
  useLayoutEffect(() => {
    const peer = previewRef.current;
    const target = tracking.current && latest.current.pages[tracking.current.to];
    if (peer) peer.style.visibility = previewPage && target?.id === previewPage.id ? 'visible' : 'hidden';
  }, [previewPage]);
  useEffect(() => {
    const home = gridRef.current?.closest('.home');
    if (!home) return;
    function progress(event) {
      const detail = event.detail, grid = gridRef.current, peer = previewRef.current;
      if (!grid || !peer || !latest.current.enabled) return;
      if (!detail) {
        const old = tracking.current;
        if (!old) return;
        cancelAnimations();
        const progress = Math.min(1, old.distance / Math.max(1, old.width));
        const options = { duration: Math.round(150 + 100 * progress), easing: 'cubic-bezier(.2, .75, .2, 1)', fill: 'both' };
        const returning = grid.animate([{ transform: grid.style.transform }, { transform: 'translateX(0)' }], options);
        const retreating = peer.animate([{ transform: peer.style.transform }, { transform: `translateX(${old.direction * old.width}px)` }], options);
        running.current = [returning, retreating];
        returning.onfinish = () => { cancelAnimations(); clearTracking(); };
        return;
      }
      cancelAnimations();
      const page = latest.current.pages[detail.to];
      if (!page) return;
      const samePreview = tracking.current && tracking.current.to === detail.to && tracking.current.from === detail.from;
      if (!samePreview) peer.style.visibility = 'hidden';
      const direction = detail.to > detail.from ? 1 : -1;
      const width = samePreview ? tracking.current.width : grid.clientWidth;
      const distance = Math.min(width, detail.distance ?? detail.progress * width);
      tracking.current = { ...detail, direction, distance, width };
      grid.style.transform = `translateX(${-direction * distance}px)`;
      peer.style.transform = `translateX(${direction * (width - distance)}px)`;
      if (samePreview) peer.style.visibility = 'visible';
      grid.parentElement?.setAttribute('data-page-swiping', 'true');
      if (!samePreview) setPreviewPage(page);
    }
    const scroll=gridRef.current?.closest('.home-scroll'),feed=gridRef.current?.closest('.home-feed');
    const releaseScrollFloor=()=>{ if(scroll?.scrollTop<=0)feed?.style.removeProperty('min-height'); };
    scroll?.addEventListener('scroll',releaseScrollFloor,{passive:true});
    home.addEventListener('page-swipe-progress', progress);
    return () => {
      scroll?.removeEventListener('scroll',releaseScrollFloor);
      feed?.style.removeProperty('min-height');
      home.removeEventListener('page-swipe-progress', progress); cancelAnimations();
    };
  }, [gridRef, cancelAnimations, clearTracking]);
  return { outgoingRef, previewRef, previewPage, prepare };
}
