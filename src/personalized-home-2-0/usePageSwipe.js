import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { createPageSwipeGesture, PAGE_SWIPE_IDLE_MS } from './page-swipe.js';

const protectedControls = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"], [role="spinbutton"], [role="combobox"]';

export function isPageSwipeInput(element) {
  return Boolean(element?.isContentEditable || element?.closest?.(protectedControls));
}

export function hasPageSwipeHorizontalScroll(target, root, styleOf = getComputedStyle) {
  for (let node = target; node && node !== root; node = node.parentElement) {
    if (node.scrollWidth > node.clientWidth + 1 && /^(auto|scroll)$/.test(styleOf(node).overflowX)) return true;
  }
  return false;
}

export function isPageSwipeProtectedTarget(target, root, styleOf = getComputedStyle) {
  if (!target || !root.contains(target)) return true;
  // A clickable card does not own wheel input. Only actual editors, menus and
  // nested horizontal scrollers keep the gesture instead of changing pages.
  if (isPageSwipeInput(target) || target.closest?.('.utility-widget-editor, .tb-composer-wrap, [role="dialog"], [role="menu"], [data-page-swipe-ignore]')) return true;
  // Nested horizontal lists keep ownership, even at their first/last item.
  return hasPageSwipeHorizontalScroll(target, root, styleOf);
}

export function usePageSwipe(rootRef, { blocked, pages, index, onSelect, swipeWidth }) {
  const latest = useRef(null);
  latest.current = { blocked, pages, index, onSelect, swipeWidth };
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let swipeThreshold = 120;
    let swipeExtent = 240;
    const makeGesture = () => {
      swipeExtent = latest.current.swipeWidth === 'root' ? root.clientWidth : root.querySelector('.workspace-board')?.clientWidth || 760;
      swipeThreshold = Math.max(80, swipeExtent / 2);
      const flickDistance = Math.min(72, Math.max(24, swipeThreshold * .25));
      // Native phase events own the lifetime. A stationary finger is not a new
      // gesture; the fallback's idle timer explicitly resets when phases are absent.
      // Commit only after crossing half the page, regardless of swipe velocity.
      return createPageSwipeGesture({ threshold: swipeThreshold, flickDistance, flickVelocity: .55, resetMs: Infinity, commitOnRelease: true });
    };
    let gesture = makeGesture();
    let pointerDown = false;
    let composing = false;
    let cachedTarget = null;
    let protectedTarget = false;
    let nestedHorizontal = false;
    let lastWheel = -Infinity;
    let idleTimer = 0;
    let previewPending = false;
    let previewOrigin = null;
    let nativePhases = false;
    let fingersDown = false;
    let nativeCommitted = false;
    let nativeEnding = false;
    let nativeEndTimer = 0;
    let thresholdHaptic = false;
    let traceTimer = 0;
    const traceRecords = [];
    const traceEnabled = import.meta.env.DEV
      && '__TAURI_INTERNALS__' in window
      && localStorage.getItem('tabbit-swipe-trace') === 'true';
    const flushTrace = () => {
      window.clearTimeout(traceTimer);
      if (traceEnabled && traceRecords.length) {
        void invoke('record_swipe_trace', { records: traceRecords.splice(0) }).catch(() => {});
      }
    };
    const trace = (type, detail = {}) => {
      if (!traceEnabled) return;
      traceRecords.push({ type, time: Date.now(), monotonic: Math.round(performance.now()), nativePhases, fingersDown, nativeCommitted, nativeEnding, previewPending, previewOrigin, index: latest.current.index, ...detail });
      if (traceRecords.length >= 128) flushTrace();
      else { window.clearTimeout(traceTimer); traceTimer = window.setTimeout(flushTrace, 400); }
    };
    const publishPreview = detail => root.dispatchEvent(new CustomEvent('page-swipe-progress', { detail }));
    const clearPreview = () => {
      if (previewPending) trace('clear-preview');
      if (previewPending) publishPreview(null);
      previewPending = false;
      previewOrigin = null;
    };
    const clearTarget = () => { cachedTarget = null; };
    const down = () => { pointerDown = true; clearTarget(); };
    const up = () => { pointerDown = false; };
    const compositionStart = () => { composing = true; };
    const compositionEnd = () => { composing = false; };
    const reset = () => { window.clearTimeout(idleTimer); window.clearTimeout(nativeEndTimer); nativeEnding = false; fingersDown = false; nativeCommitted = false; thresholdHaptic = false; clearPreview(); pointerDown = false; composing = false; clearTarget(); gesture.reset(); };
    function scheduleNativeEnd() {
      window.clearTimeout(nativeEndTimer);
      nativeEndTimer = window.setTimeout(() => {
        nativeEnding = false;
        if (!nativeCommitted) settleGesture();
      }, 80);
    }
    function trackpadPhase(event) {
      trace('phase', { phase: event.detail });
      nativePhases = true;
      window.clearTimeout(idleTimer);
      if (event.detail === 'began') {
        window.clearTimeout(nativeEndTimer);
        nativeEnding = false;
        clearPreview();
        gesture = makeGesture();
        clearTarget();
        fingersDown = true;
        nativeCommitted = false;
        thresholdHaptic = false;
      } else if (event.detail === 'cancelled') {
        window.clearTimeout(nativeEndTimer);
        nativeEnding = false;
        fingersDown = false;
        clearPreview();
        gesture.reset();
      } else if (event.detail === 'ended' || event.detail === 'momentum' || event.detail === 'momentum-ended') {
        if (event.detail === 'momentum-ended' && fingersDown) return;
        fingersDown = false;
        if (nativeCommitted || nativeEnding) return;
        // AppKit phase notifications may arrive before WebKit dispatches the
        // final coalesced wheel samples. Drain them before deciding to roll back.
        nativeEnding = true;
        scheduleNativeEnd();
      }
    }
    function wheel(event) {
      const now = performance.now();
      const current = latest.current;
      // Avoid layout/style reads for every frame of a trackpad's momentum tail.
      if (event.target !== cachedTarget || now - lastWheel >= PAGE_SWIPE_IDLE_MS) {
        cachedTarget = event.target;
        protectedTarget = isPageSwipeProtectedTarget(event.target, root);
        nestedHorizontal = hasPageSwipeHorizontalScroll(event.target, root);
      }
      lastWheel = now;
      // Text focus alone must not disable swiping over the board or blank space.
      // The actual wheel target still protects the composer and nested controls.
      const disabled = current.blocked || current.pages.length < 2 || pointerDown || composing
        || document.hidden || protectedTarget;
      // Reset even a rejected/poisoned browser stream after it becomes idle.
      // Native finger phases, when available, retain ownership through pauses.
      if (!nativePhases) {
        window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(() => {
          settleGesture();
        }, 120);
      }
      // The native release phase settles the gesture. Momentum after that
      // belongs to the completed gesture and cannot change the result.
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY) && !event.ctrlKey;
      // Native finger-down starts a fresh gesture immediately. Its momentum
      // cannot re-arm or consume a second page, regardless of its speed/pauses.
      if (nativePhases && ((!fingersDown && !nativeEnding) || nativeCommitted)) {
        trace('wheel-suppressed', { x: event.deltaX, y: event.deltaY, disabled });
        if (horizontal && !nestedHorizontal && event.cancelable) event.preventDefault();
        return;
      }
      const result = gesture.feed(event, now, disabled);
      trace('wheel', { x: event.deltaX, y: event.deltaY, disabled, captured: result.capture, direction: result.direction, progress: result.preview, cancel: result.cancel });
      // Keep native horizontal overscroll from moving the composer with the grid.
      // Scrollable attachments and other real horizontal lists keep their input.
      if (result.capture || (horizontal && !nestedHorizontal && event.cancelable)) event.preventDefault();
      if (disabled || result.cancel) { thresholdHaptic = false; clearPreview(); }
      if (Number.isFinite(result.preview) && result.preview !== 0) {
        const thresholdProgress = Math.abs(result.preview);
        if (thresholdProgress >= 1 && !thresholdHaptic) {
          thresholdHaptic = true;
          if ('__TAURI_INTERNALS__' in window) {
            void invoke('page_switch_haptic').catch(error => console.warn('Page switch haptic unavailable:', error));
          }
        } else if (thresholdProgress < .9) thresholdHaptic = false;
        const direction = Math.sign(result.preview);
        const from = previewOrigin ?? current.index;
        const to = Math.max(0, Math.min(current.pages.length - 1, from + direction));
        if (to !== from) {
          const distance = Math.min(swipeExtent, Math.abs(result.preview) * swipeThreshold);
          previewPending = true;
          previewOrigin = from;
          publishPreview({ from, to, progress: Math.min(1, distance / Math.max(1, swipeExtent)), distance });
        } else clearPreview();
      }
      if (!result.direction) return;
      commitDirection(result.direction);
    }
    function commitDirection(direction) {
      const current = latest.current;
      const from = previewOrigin ?? current.index;
      const next = Math.max(0, Math.min(current.pages.length - 1, from + direction));
      previewOrigin = null;
      previewPending = false;
      if (nativePhases) nativeCommitted = true;
      if (next === current.index) return;
      trace('commit', { next });
      current.onSelect(next);
      setAnnouncement(`已切换到${current.pages[next].name}，第 ${next + 1} 个看板，共 ${current.pages.length} 个`);
    }
    function settleGesture() {
      const result = gesture.finish();
      thresholdHaptic = false;
      trace('settle', { direction: result.direction, progress: result.preview });
      if (result.direction) commitDirection(result.direction);
      else clearPreview();
    }
    window.addEventListener('tabbit-trackpad-phase', trackpadPhase);
    root.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    window.addEventListener('blur', reset);
    window.addEventListener('resize', clearTarget);
    document.addEventListener('focusin', clearTarget);
    document.addEventListener('compositionstart', compositionStart, true);
    document.addEventListener('compositionend', compositionEnd, true);
    document.addEventListener('visibilitychange', reset);
    return () => {
      window.clearTimeout(idleTimer);
      window.clearTimeout(nativeEndTimer);
      clearPreview();
      flushTrace();
      window.removeEventListener('tabbit-trackpad-phase', trackpadPhase);
      root.removeEventListener('wheel', wheel);
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      window.removeEventListener('blur', reset);
      window.removeEventListener('resize', clearTarget);
      document.removeEventListener('focusin', clearTarget);
      document.removeEventListener('compositionstart', compositionStart, true);
      document.removeEventListener('compositionend', compositionEnd, true);
      document.removeEventListener('visibilitychange', reset);
    };
  }, [rootRef]);

  return announcement;
}
