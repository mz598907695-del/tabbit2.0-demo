import { useLayoutEffect, useRef, useState } from 'react';
import { BROWSER_LAYOUT_SETTLED_EVENT, isBrowserLayoutChanging } from '../browserLayoutMotion';
import { composerScrollFrame, composerScrollProgress, createComposerScrollRenderer, DOCK_HEIGHT, DOCK_TOP, followScrollProgress } from './composer-scroll';

export function useComposerScroll(rootRef, { overlayOpen }) {
  const options = useRef({ overlayOpen });
  options.current = { overlayOpen };
  const wakeRef = useRef(null);
  const [controlsHidden, setControlsHidden] = useState(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const feed = root?.closest('.home-feed');
    const content = root?.closest('.home-content');
    const scroller = root?.closest('.home-scroll');
    const canvas = root?.closest('.home');
    const glass = canvas?.querySelector(':scope > .tb-composer-scroll-glass');
    const logo = content?.querySelector('.brand-mark');
    let lastLogoProgress = -1;
    if (!root || !feed || !scroller || !glass) return;
    const form = root.querySelector('.tb-composer');
    const input = root.querySelector('.tb-composer-input-frame');
    const toolbar = root.querySelector('.tb-composer-toolbar');
    const end = root.querySelector('.tb-composer-end');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, lastTime = 0, progress = 0, glassProgress = 0, geometry;
    let hidden = false, measureNeeded = true, editing = false, pressedPointer = null, disposed = false;
    const render = createComposerScrollRenderer(root, glass);

    function owns(node) {
      return node instanceof Element && (root.contains(node)
        || node.closest('[data-composer-owner]')?.dataset.composerOwner === root.dataset.composerOwner);
    }

    function measure() {
      // Batch every layout read before render() writes any animated property.
      // The wrapper is the feed's first child and has no margins, so the feed's
      // normal-flow top remains the origin even while the wrapper is sticky.
      const feedBounds = feed.getBoundingClientRect();
      const scrollerBounds = scroller.getBoundingClientRect();
      const canvasBounds = canvas.getBoundingClientRect();
      const rootBounds = root.getBoundingClientRect();
      const formBounds = form.getBoundingClientRect();
      const scrollportTop = scrollerBounds.top + scroller.clientTop;
      geometry = {
        origin: feedBounds.top - scrollportTop + scroller.scrollTop,
        feedHeight: feedBounds.height,
        wrapperHeight: rootBounds.height,
        canvasInset: scrollportTop - canvasBounds.top,
        formOffset: formBounds.top - rootBounds.top,
        formWidth: formBounds.width,
        height: form.offsetHeight,
        taskInset: root.dataset.taskMode === 'true' ? (parseFloat(root.style.getPropertyValue('--composer-task-height')) || 0) + 6 : 0,
        inputShift: (DOCK_HEIGHT - 24) / 2 - input.offsetTop,
        toolbarShift: (DOCK_HEIGHT - 32) / 2 - toolbar.offsetTop,
        endWidth: end.offsetWidth,
      };
      const logoTop = logo?.parentElement?.getBoundingClientRect().top;
      geometry.logoTravel = logoTop == null ? 1 : Math.max(1, logoTop - scrollportTop + scroller.scrollTop - DOCK_TOP);
      geometry.baseGlassEdge = geometry.canvasInset + Math.max(geometry.origin, DOCK_TOP)
        + geometry.formOffset + geometry.height;
      measureNeeded = false;
    }

    function tick(time) {
      frame = 0;
      if (measureNeeded) measure();
      const scrollTop = scroller.scrollTop;
      const logoProgress = Math.max(0, Math.min(1, scrollTop / geometry.logoTravel));
      if (logo && logoProgress !== lastLogoProgress) {
        logo.style.setProperty('--logo-scroll-progress', String(logoProgress));
        lastLogoProgress = logoProgress;
      }
      const requested = composerScrollProgress(scrollTop, geometry.origin, motion.matches);
      const expanded = editing || options.current.overlayOpen;
      // Keep the pressed target still until its native click has been delivered.
      // Menus belong to the editing session; opening one must not freeze a half-folded form.
      const target = pressedPointer !== null ? progress : expanded ? 0 : requested;
      const glassTarget = requested;
      const elapsed = lastTime ? time - lastTime : 16;
      progress = motion.matches ? target : followScrollProgress(progress, target, elapsed);
      // Follow the same reversible easing, even when focus keeps the form expanded.
      glassProgress = motion.matches ? glassTarget : followScrollProgress(glassProgress, glassTarget, elapsed);
      lastTime = time;
      // The glass lives outside the scroller, so native dialogs cannot invalidate
      // a translated, sticky backdrop surface when their own content scrolls.
      const visualFrame = composerScrollFrame(geometry, scrollTop, progress, glassProgress, { target, glassTarget });
      render(geometry, visualFrame, {
        editing: expanded,
        overlayOpen: options.current.overlayOpen,
      });
      if (hidden !== (progress >= .45)) { hidden = progress >= .45; setControlsHidden(hidden); }
      if (visualFrame.animating) frame = requestAnimationFrame(tick);
      else lastTime = 0;
    }
    function wake() { if (!frame) frame = requestAnimationFrame(tick); }
    function resize() { if (!isBrowserLayoutChanging()) { measureNeeded = true; wake(); } }
    function pointerdown(event) {
      if (event.button !== 0 || !event.isPrimary) return;
      if (owns(event.target)) pressedPointer = event.pointerId;
      else editing = false;
      wake();
    }
    function release(event) {
      if (pressedPointer !== event.pointerId) return;
      pressedPointer = null;
      wake();
    }
    function click(event) {
      if (event.button !== 0 || !owns(event.target)) return;
      editing = true;
      wake();
    }
    function focusin(event) {
      if (owns(event.target)) {
        if (pressedPointer === null) editing = true;
      } else if (!options.current.overlayOpen) editing = false;
      wake();
    }
    function focusout() {
      queueMicrotask(() => {
        if (disposed) return;
        if (pressedPointer === null && !options.current.overlayOpen && !owns(document.activeElement)) editing = false;
        wake();
      });
    }
    function keydown(event) {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || event.keyCode === 229
        || options.current.overlayOpen || !editing || !root.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      editing = false;
      document.activeElement?.blur();
      wake();
    }
    function windowBlur() { pressedPointer = null; wake(); }
    const observer = new ResizeObserver(resize);
    [content, feed, scroller, canvas, root, form, input, toolbar, end].filter(Boolean).forEach(element => observer.observe(element, { box: 'border-box' }));
    scroller.addEventListener('scroll', wake, { passive: true });
    document.addEventListener('pointerdown', pointerdown, true);
    document.addEventListener('pointerup', release, true);
    document.addEventListener('pointercancel', release, true);
    document.addEventListener('click', click, true);
    document.addEventListener('focusin', focusin);
    document.addEventListener('focusout', focusout);
    root.addEventListener('keydown', keydown);
    window.addEventListener('blur', windowBlur);
    window.addEventListener('resize', resize);
    window.addEventListener(BROWSER_LAYOUT_SETTLED_EVENT, resize);
    motion.addEventListener('change', wake);
    wakeRef.current = wake;
    measure();
    // A restored scroll position must not flash the full composer first.
    progress = composerScrollProgress(scroller.scrollTop, geometry.origin, motion.matches);
    glassProgress = progress;
    tick(performance.now());
    return () => {
      disposed = true;
      logo?.style.removeProperty('--logo-scroll-progress');
      cancelAnimationFrame(frame);
      observer.disconnect();
      scroller.removeEventListener('scroll', wake);
      document.removeEventListener('pointerdown', pointerdown, true);
      document.removeEventListener('pointerup', release, true);
      document.removeEventListener('pointercancel', release, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('focusin', focusin);
      document.removeEventListener('focusout', focusout);
      root.removeEventListener('keydown', keydown);
      window.removeEventListener('blur', windowBlur);
      window.removeEventListener('resize', resize);
      window.removeEventListener(BROWSER_LAYOUT_SETTLED_EVENT, resize);
      motion.removeEventListener('change', wake);
      wakeRef.current = null;
    };
  }, [rootRef]);

  useLayoutEffect(() => { wakeRef.current?.(); }, [overlayOpen]);
  return controlsHidden;
}
