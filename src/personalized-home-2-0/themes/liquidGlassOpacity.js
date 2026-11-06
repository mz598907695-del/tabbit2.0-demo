import { applyLiquidGlassOpacity, normalizeLiquidGlassOpacity } from './liquidGlassMaterial.js';

const rangeKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

// Native range movement stays local to this input. React/preferences only see a
// completed edit, while the page receives at most one material update per frame.
export function attachLiquidGlassOpacity(input, { value = 50, disabled = false, onCommit }, host = window) {
  const doc = input.ownerDocument;
  const root = doc.documentElement;
  let committed = normalizeLiquidGlassOpacity(value);
  let draft = committed;
  let inactive = disabled;
  let frame = null;
  let gesture = null;
  let pointerId = null;
  let cancelledPointer = null;
  let disposed = false;
  const pressedKeys = new Set();
  const listeners = [];

  function paintControl() {
    input.value = String(draft);
    const fill = `${draft}%`;
    if (input.style.getPropertyValue('--overlay-range-value') !== fill) input.style.setProperty('--overlay-range-value', fill);
  }
  function stopFrame() {
    if (frame !== null) host.cancelAnimationFrame(frame);
    frame = null;
  }
  function paintMaterial() {
    stopFrame();
    applyLiquidGlassOpacity(root, draft);
  }
  function preview() {
    if (disposed) return;
    if (inactive || cancelledPointer !== null) { draft = committed; paintControl(); return; }
    draft = normalizeLiquidGlassOpacity(input.value);
    if (frame === null) frame = host.requestAnimationFrame(() => {
      frame = null;
      if (!disposed) { paintControl(); applyLiquidGlassOpacity(root, draft); }
    });
  }
  function clearGesture() {
    gesture = null;
    pointerId = null;
    pressedKeys.clear();
  }
  function commit() {
    if (disposed || inactive || cancelledPointer !== null) return;
    draft = normalizeLiquidGlassOpacity(input.value);
    clearGesture();
    paintControl();
    paintMaterial();
    if (draft !== committed) {
      committed = draft;
      onCommit?.(committed);
    }
  }
  function cancel() {
    clearGesture();
    draft = committed;
    paintControl();
    paintMaterial();
  }
  function onPointerDown(event) {
    if (inactive || event.button !== 0 || event.isPrimary === false) return;
    if (gesture === 'keyboard') commit();
    cancelledPointer = null;
    gesture = 'pointer';
    pointerId = event.pointerId;
  }
  function onPointerUp(event) {
    if (cancelledPointer === event.pointerId) { cancelledPointer = null; return; }
    if (gesture === 'pointer' && pointerId === event.pointerId) commit();
  }
  function onPointerCancel(event) {
    if (cancelledPointer === event.pointerId) cancelledPointer = null;
    if (gesture === 'pointer' && pointerId === event.pointerId) cancel();
  }
  function onKeyDown(event) {
    if (event.key === 'Escape' && (gesture || draft !== committed)) {
      event.preventDefault();
      event.stopPropagation();
      if (gesture === 'pointer') cancelledPointer = pointerId;
      cancel();
    } else if (!inactive && rangeKeys.has(event.key) && gesture !== 'pointer') {
      cancelledPointer = null;
      gesture = 'keyboard';
      pressedKeys.add(event.key);
    }
  }
  function onKeyUp(event) {
    if (gesture !== 'keyboard' || !rangeKeys.has(event.key)) return;
    pressedKeys.delete(event.key);
    if (!pressedKeys.size) commit();
  }
  function onChange() {
    // Native change can fire on every keyboard step or before pointerup. Keep
    // those inside their edit; assistive changes without a gesture commit here.
    preview();
    if (!gesture) commit();
  }
  function onBlur() {
    if (cancelledPointer !== null) { cancelledPointer = null; cancel(); }
    else commit();
  }
  function abandon() { if (gesture === 'pointer') cancelledPointer = pointerId; cancel(); }
  // A release outside the window may never reach this document. Once it is
  // active again, assistive changes must not be blocked by that abandoned ID.
  function resume() { cancelledPointer = null; }
  function onVisibilityChange() { if (doc.hidden) abandon(); else resume(); }
  function listen(target, name, handler, capture = false) {
    target.addEventListener(name, handler, capture);
    listeners.push(() => target.removeEventListener(name, handler, capture));
  }
  listen(input, 'pointerdown', onPointerDown);
  listen(input, 'input', preview);
  listen(input, 'change', onChange);
  listen(input, 'keydown', onKeyDown);
  listen(input, 'blur', onBlur);
  listen(doc, 'pointerup', onPointerUp, true);
  listen(doc, 'pointercancel', onPointerCancel, true);
  listen(doc, 'keyup', onKeyUp, true);
  listen(doc, 'visibilitychange', onVisibilityChange);
  listen(host, 'blur', abandon);
  listen(host, 'focus', resume);
  paintControl();

  return {
    sync(nextValue, nextDisabled = false) {
      if (disposed) return;
      committed = normalizeLiquidGlassOpacity(nextValue);
      inactive = nextDisabled;
      if (gesture === 'pointer') cancelledPointer = pointerId;
      cancel();
    },
    dispose() {
      if (disposed) return;
      cancel();
      disposed = true;
      for (const remove of listeners) remove();
    },
  };
}
