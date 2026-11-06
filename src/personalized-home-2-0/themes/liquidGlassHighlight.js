const surfaceSelector = '.tb-composer, .tb-composer-surface, .promotion-inline-carousel, .promotion-card, .board-widget-card, .board-library-preview-frame, .page-indicator-capsule, .page-indicator-action, .board-empty > button, .shortcut-icon, .shortcut-catalog-card, .board-library-shortcut-card, .widget-ai-artwork-card';
const excludedSelector = '.theme-sidebar, .is-dragging, .page-manager-dialog';
const interval = 1000 / 30;
const geometryLifetime = 120;
const lightKeys = ['x', 'y', 'size-x', 'size-y', 'strength'];

// Event-driven rather than a permanent animation loop. The injectable host also
// lets the scheduler and DOM work be exercised without mounting the React app.
export function attachLiquidGlassHighlight(host = window) {
  const doc = host.document;
  const motion = host.matchMedia('(prefers-reduced-motion: reduce)');
  const transparency = host.matchMedia('(prefers-reduced-transparency: reduce)');
  const finePointer = host.matchMedia('(hover: hover) and (pointer: fine)');
  let surface = null;
  let pointer = null;
  let pointerDirty = false;
  let resolvedTarget = null;
  let resolvedSurface = null;
  let rect = null;
  let measuredAt = -Infinity;
  let frame = 0;
  let lastPaint = null;
  let strength = 0;
  const written = new Map();

  function write(key, value) {
    if (written.get(key) === value) return;
    surface.style.setProperty(`--liquid-light-${key}`, value);
    written.set(key, value);
  }

  function clearSurface() {
    observer?.disconnect();
    if (surface) {
      surface.removeAttribute('data-liquid-highlight');
      for (const key of lightKeys) {
        if (written.has(key)) surface.style.removeProperty(`--liquid-light-${key}`);
      }
    }
    surface = null;
    rect = null;
    measuredAt = -Infinity;
    strength = 0;
    written.clear();
  }

  function reset() {
    if (frame) host.cancelAnimationFrame(frame);
    frame = 0;
    pointer = null;
    pointerDirty = false;
    resolvedTarget = null;
    resolvedSurface = null;
    lastPaint = null;
    clearSurface();
  }

  function schedule() {
    if (!frame) frame = host.requestAnimationFrame(paint);
  }

  const observer = typeof host.ResizeObserver === 'function' ? new host.ResizeObserver(() => {
    rect = null;
    if (pointer && surface) schedule();
  }) : null;

  function resolve(target) {
    if (target === resolvedTarget) return resolvedSurface;
    resolvedTarget = target;
    let next = target instanceof host.Element ? target.closest(surfaceSelector) : null;
    if (next?.matches('.tb-composer')) next = next.querySelector('.tb-composer-surface');
    if (next?.matches('.board-library-preview-frame')) next = next.querySelector('.board-widget-card');
    if (next?.closest(excludedSelector)) next = null;
    resolvedSurface = next;
    return next;
  }

  function paint(time) {
    frame = 0;
    if (doc.hidden) { reset(); return; }
    const next = pointer ? resolve(pointer.target) : null;
    const candidate = next || surface;
    // The resolved pointer target can stay cached while docking starts. Check
    // the current ancestor state before throttling or painting a moving surface.
    if (candidate?.matches('.tb-composer-surface') && candidate.closest('.tb-composer-wrap[data-dock-animating="true"]')) {
      reset();
      return;
    }
    // A 120/144Hz pointer must not repaint filtered backgrounds at display rate.
    if (lastPaint !== null && time - lastPaint < interval - .5) { schedule(); return; }
    const elapsed = lastPaint === null ? 16 : Math.min(40, time - lastPaint);
    lastPaint = time;
    if (pointer && !next) pointer = null;
    if (next && next !== surface) {
      clearSurface();
      surface = next;
      surface.setAttribute('data-liquid-highlight', '');
      observer?.observe(surface);
    }
    if (!surface?.isConnected) { reset(); return; }
    const goal = pointer ? 1 : 0;
    strength += (goal - strength) * Math.min(1, elapsed / 80);
    if (Math.abs(goal - strength) < .01) strength = goal;
    if (!pointer && strength === 0) { reset(); return; }
    if (pointer) {
      // Read once on entry/resize, then occasionally only while moving. Fades do
      // not remeasure; scroll/viewport changes discard the cache immediately.
      if (!rect || (pointerDirty && time - measuredAt >= geometryLifetime)) {
        rect = surface.getBoundingClientRect();
        measuredAt = time;
      }
      if (!rect.width || !rect.height) { reset(); return; }
      const x = Math.max(0, Math.min(100, (pointer.x - rect.left) / rect.width * 100));
      const y = Math.max(0, Math.min(100, (pointer.y - rect.top) / rect.height * 100));
      write('x', `${x.toFixed(2)}%`);
      write('y', `${y.toFixed(2)}%`);
      write('size-x', `${Math.max(12, Math.min(180, rect.width * .8)).toFixed(2)}px`);
      write('size-y', `${Math.max(12, Math.min(120, rect.height * .8)).toFixed(2)}px`);
    }
    pointerDirty = false;
    write('strength', strength.toFixed(3));
    if (strength !== goal) schedule();
  }

  function move(event) {
    if (doc.hidden || motion.matches || transparency.matches || !finePointer.matches || event.pointerType === 'touch' || event.buttons) { reset(); return; }
    if (pointer?.target === event.target && pointer.x === event.clientX && pointer.y === event.clientY) return;
    // Resolve only the latest target, once per paint, rather than traversing
    // ancestors for every coalesced pointer event.
    pointer = { target: event.target, x: event.clientX, y: event.clientY };
    pointerDirty = true;
    schedule();
  }

  function leave(event) {
    const current = pointer ? resolve(pointer.target) : surface;
    const next = event.relatedTarget ? resolve(event.relatedTarget) : null;
    // Layout/transform changes can move a surface away from a stationary mouse:
    // pointerout still arrives, but a follow-up pointermove is not guaranteed.
    if (next && next === current) {
      if (pointer) pointer.target = event.relatedTarget;
      return;
    }
    pointer = null;
    pointerDirty = false;
    resolvedTarget = null;
    resolvedSurface = null;
    if (surface) schedule();
    else if (frame) reset();
  }

  doc.addEventListener('pointermove', move, { passive: true });
  doc.addEventListener('pointerout', leave, { passive: true });
  doc.addEventListener('pointerdown', reset, { passive: true });
  doc.addEventListener('scroll', reset, { passive: true, capture: true });
  doc.addEventListener('visibilitychange', reset);
  host.addEventListener('resize', reset, { passive: true });
  host.addEventListener('blur', reset);
  for (const media of [motion, transparency, finePointer]) media.addEventListener('change', reset);
  return () => {
    reset();
    doc.removeEventListener('pointermove', move);
    doc.removeEventListener('pointerout', leave);
    doc.removeEventListener('pointerdown', reset);
    doc.removeEventListener('scroll', reset, true);
    doc.removeEventListener('visibilitychange', reset);
    host.removeEventListener('resize', reset);
    host.removeEventListener('blur', reset);
    for (const media of [motion, transparency, finePointer]) media.removeEventListener('change', reset);
  };
}
