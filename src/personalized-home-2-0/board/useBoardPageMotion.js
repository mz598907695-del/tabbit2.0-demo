import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { boardPageTravel, boardPageFade } from './board-page-transition';

const foreground = root => [...(root?.querySelectorAll('.board-card-content') || [])];
function fadeContents(root, opacity) { foreground(root).forEach(node => { node.style.opacity = String(opacity); }); }
function clearContentFade(root) { foreground(root).forEach(node => node.style.removeProperty('opacity')); }
function animateContents(root, from, to, options) {
  return foreground(root).map(node => node.animate([{ opacity: from }, { opacity: to }], options));
}
const travelWidth = grid => boardPageTravel(grid.closest('.home-scroll')?.clientWidth || grid.clientWidth);

export function useBoardPageMotion(gridRef, pageId, enabled, pages) {
  const outgoingRef = useRef(null), previewRef = useRef(null);
  const pending = useRef(null), tracking = useRef(null), running = useRef([]);
  const scrollPositions = useRef(new Map());
  const startFrame = useRef(0);
  const [previewPage, setPreviewPage] = useState(null);
  const latest = useRef({ enabled, pages });
  latest.current = { enabled, pages, previewPage };
  const cancelAnimations = useCallback(() => {
    cancelAnimationFrame(startFrame.current);
    startFrame.current = 0;
    // Detach before cancel() restores the old page's underlying position.
    if (outgoingRef.current) {
      outgoingRef.current.replaceChildren();
      outgoingRef.current.style.removeProperty('top');
      outgoingRef.current.style.removeProperty('height');
      outgoingRef.current.style.removeProperty('overflow');
    }
    gridRef.current?.removeAttribute('data-motion-entering');
    running.current.forEach(animation => { animation.onfinish = null; animation.cancel(); });
    running.current = [];
    if (!tracking.current) gridRef.current?.parentElement?.removeAttribute('data-page-swiping');
  }, [gridRef]);
  const clearTracking = useCallback(() => {
    tracking.current = null;
    if (previewRef.current) previewRef.current.style.visibility = 'hidden';
    gridRef.current?.style.removeProperty('transform');
    clearContentFade(gridRef.current);
    clearContentFade(previewRef.current);
    previewRef.current?.style.removeProperty('transform');
    gridRef.current?.parentElement?.removeAttribute('data-page-swiping');
    setPreviewPage(null);
  }, [gridRef]);
  const prepare = useCallback(direction => {
    cancelAnimations();
    pending.current = null;
    const grid = gridRef.current;
    if (!grid) return;
    const scroll = grid.closest('.home-scroll');
    scrollPositions.current.set(pageId, scroll?.scrollTop || 0);
    pending.current = { snapshot: null };
    if (tracking.current?.completed) {
      grid.style.visibility = 'hidden';
      pending.current.handoff = true;
      return;
    }
    if (!latest.current.enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { clearTracking(); return; }
    const snapshot = grid.cloneNode(false);
    const viewport = (scroll || grid).getBoundingClientRect();
    // The outgoing layer lives for 250ms and cannot scroll. Copy just what can
    // actually be seen, rather than duplicating every offscreen widget/glass
    // surface on the long 常用 page.
    for (const child of grid.children) {
      const bounds = child.getBoundingClientRect();
      if (!bounds.width || !bounds.height || bounds.bottom < viewport.top - 24 || bounds.top > viewport.bottom + 24) continue;
      const copy = child.cloneNode(true);
      const canvases = copy.querySelectorAll('canvas');
      child.querySelectorAll('canvas').forEach((canvas, index) => {
        try { canvases[index]?.getContext('2d')?.drawImage(canvas, 0, 0); } catch { /* Keep the existing artwork fallback. */ }
      });
      snapshot.append(copy);
    }
    snapshot.removeAttribute('tabindex'); snapshot.removeAttribute('role');
    snapshot.setAttribute('aria-hidden', 'true'); snapshot.inert = true;
    snapshot.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    pending.current = { snapshot, viewport, gridTop: grid.getBoundingClientRect().top, direction, offset: tracking.current?.distance || 0, width: travelWidth(grid) };
    // Hide the live source before its gesture styles are reset. Reveal it only
    // after React has installed the target page and its entrance animation.
    grid.style.visibility = 'hidden';
    clearTracking();
    grid.parentElement?.setAttribute('data-page-swiping', 'true');
  }, [gridRef, pageId, cancelAnimations, clearTracking]);
  useLayoutEffect(() => {
    const entry = pending.current;
    pending.current = null;
    const grid = gridRef.current, host = outgoingRef.current;
    if (!enabled) clearTracking();
    if (entry && grid) {
      const scroll = grid.closest('.home-scroll');
      grid.closest('.home-feed')?.style.removeProperty('min-height');
      if (scroll) scroll.scrollTop = scrollPositions.current.get(pageId) || 0;
      // Child viewport subscriptions are already installed. Prepare the target
      // scroll region synchronously, before its first animation frame is painted.
      grid.dispatchEvent(new Event('board-page-layout-ready', { bubbles: true }));
      if (entry.handoff) clearTracking();
    }
    if (entry?.snapshot && grid && host && enabled) {
      const gridTop = grid.getBoundingClientRect().top;
      // Clip the old page to its viewport. Its full height must not keep a short
      // target page's scroll range open after restoring that page's position.
      host.style.top = `${entry.viewport.top - gridTop}px`;
      host.style.height = `${entry.viewport.height}px`;
      host.style.overflow = 'clip';
      entry.snapshot.style.top = `${entry.gridTop - entry.viewport.top}px`;
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
      grid.setAttribute('data-motion-entering', '');
      const incoming = grid.animate([
        { transform: `translateX(${direction * (width - entry.offset)}px)` },
        { transform: 'translateX(0)' },
      ], options);
      running.current = [outgoing, incoming];
      // Widget viewport updates flush synchronously after this layout effect.
      // Keep both pages at their starting positions until that render and its
      // first paint are ready, instead of spending the entrance animation's
      // first 100ms mounting the incoming widgets.
      outgoing.pause(); incoming.pause();
      outgoing.currentTime = 0; incoming.currentTime = 0;
      startFrame.current = requestAnimationFrame(() => {
        startFrame.current = requestAnimationFrame(() => {
          startFrame.current = 0;
          running.current.push(...animateContents(entry.snapshot, 1, 0, options), ...animateContents(grid, 0, 1, options));
          outgoing.play(); incoming.play();
        });
      });
      incoming.onfinish = cancelAnimations;
    }
    grid?.style.removeProperty('visibility');
    return cancelAnimations;
  }, [pageId, enabled, gridRef, cancelAnimations, clearTracking]);
  // Prepare one likely neighbor while idle, so the first trackpad movement
  // translates an existing preview instead of mounting a widget board on input.
  useEffect(() => {
    if (!enabled || previewPage || tracking.current) return;
    const current = latest.current.pages.findIndex(page => page.id === pageId);
    const neighbor = latest.current.pages[current + 1] || latest.current.pages[current - 1];
    if (!neighbor) return;
    const warm = () => { if (!tracking.current) setPreviewPage(neighbor); };
    if (window.requestIdleCallback) {
      const idle = window.requestIdleCallback(warm, { timeout: 800 });
      return () => window.cancelIdleCallback(idle);
    }
    const timer = window.setTimeout(warm, 80);
    return () => window.clearTimeout(timer);
  }, [pageId, enabled, previewPage]);
  useLayoutEffect(() => {
    const peer = previewRef.current, grid = gridRef.current;
    const target = tracking.current && latest.current.pages[tracking.current.to];
    if (!peer || !grid) return;
    if (previewPage && !tracking.current) {
      const scroll = grid.closest('.home-scroll'), clip = (scroll || grid).getBoundingClientRect();
      const gridTop = grid.getBoundingClientRect().top;
      peer.style.top = `${clip.top - gridTop}px`;
      peer.style.height = `${clip.height}px`;
      peer.style.overflow = 'clip';
      peer.style.transform = 'none';
      peer.style.setProperty('--board-preview-offset-y', `${gridTop - clip.top + (scroll?.scrollTop || 0) - (scrollPositions.current.get(previewPage.id) || 0)}px`);
      peer.dispatchEvent(new Event('board-page-layout-ready', { bubbles: true }));
    }
    peer.style.visibility = previewPage && target?.id === previewPage.id ? 'visible' : 'hidden';
    if (tracking.current) fadeContents(peer, boardPageFade(tracking.current.distance, tracking.current.width).incoming);
  }, [previewPage, gridRef]);
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
        const fade = boardPageFade(old.distance, old.width);
        running.current = [returning, retreating, ...animateContents(grid, fade.outgoing, 1, options), ...animateContents(peer, fade.incoming, 0, options)];
        returning.onfinish = () => { cancelAnimations(); clearTracking(); };
        return;
      }
      cancelAnimations();
      const page = latest.current.pages[detail.to];
      if (!page) return;
      const samePreview = tracking.current && tracking.current.to === detail.to && tracking.current.from === detail.from;
      if (!samePreview) peer.style.visibility = 'hidden';
      const direction = detail.to > detail.from ? 1 : -1;
      const width = samePreview ? tracking.current.width : travelWidth(grid);
      const distance = Math.min(width, detail.distance ?? detail.progress * width);
      tracking.current = { ...detail, direction, distance, width };
      grid.style.transform = `translateX(${-direction * distance}px)`;
      const fade = boardPageFade(distance, width);
      fadeContents(grid, fade.outgoing);
      fadeContents(peer, fade.incoming);
      peer.style.transform = `translateX(${direction * (width - distance)}px)`;
      const scroll = grid.closest('.home-scroll');
      const clip = (scroll || grid).getBoundingClientRect();
      const gridTop = grid.getBoundingClientRect().top;
      peer.style.top = `${clip.top - gridTop}px`;
      peer.style.height = `${clip.height}px`;
      peer.style.overflow = 'clip';
      peer.style.setProperty('--board-preview-offset-y', `${gridTop - clip.top + (scroll?.scrollTop || 0) - (scrollPositions.current.get(page.id) || 0)}px`);
      if (samePreview || latest.current.previewPage?.id === page.id) peer.style.visibility = 'visible';
      grid.parentElement?.setAttribute('data-page-swiping', 'true');
      if (!samePreview) setPreviewPage(page);
    }
    function commit(event) {
      const old = tracking.current, grid = gridRef.current, peer = previewRef.current;
      if (!old || !grid || !peer || !latest.current.enabled) return;
      event.preventDefault();
      cancelAnimations();
      let finished = false;
      const complete = () => {
        if (finished) return;
        finished = true;
        grid.style.transform = `translateX(${-old.direction * old.width}px)`;
        peer.style.transform = 'translateX(0)';
        fadeContents(grid, 0);
        fadeContents(peer, 1);
        old.completed = true;
        cancelAnimations();
        event.detail.commit();
      };
      event.detail.finish = complete;
      // Finish the exact preview the fingers were moving. React swaps the live
      // board only at rest, rather than rebuilding it halfway through a swipe.
      const remaining = 1 - Math.min(1, old.distance / Math.max(1, old.width));
      const options = { duration: Math.round(160 + 100 * remaining), easing: 'cubic-bezier(.2,.75,.2,1)', fill: 'both' };
      const outgoing = grid.animate([{ transform: grid.style.transform }, { transform: `translateX(${-old.direction * old.width}px)` }], options);
      const incoming = peer.animate([{ transform: peer.style.transform }, { transform: 'translateX(0)' }], options);
      const fade = boardPageFade(old.distance, old.width);
      running.current = [outgoing, incoming, ...animateContents(grid, fade.outgoing, 0, options), ...animateContents(peer, fade.incoming, 1, options)];
      incoming.onfinish = complete;
    }
    home.addEventListener('page-swipe-progress', progress);
    home.addEventListener('page-swipe-commit', commit);
    return () => {
      home.removeEventListener('page-swipe-progress', progress);
      home.removeEventListener('page-swipe-commit', commit); cancelAnimations();
    };
  }, [gridRef, cancelAnimations, clearTracking]);
  return { outgoingRef, previewRef, previewPage, prepare };
}
