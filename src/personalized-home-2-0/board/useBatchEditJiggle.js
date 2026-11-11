import { useLayoutEffect, useRef } from 'react';
import { isPageActive, subscribePageActivity } from '../../pageActivity.js';

const TAU = Math.PI * 2;

function itemSeed(id) {
  let seed = 2166136261;
  for (const character of id) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return seed >>> 0;
}

/**
 * A single, interruptible clock for the board's edit-state motion.
 * Board placement must use CSS `translate`, leaving `rotate` independent of it.
 */
export default function useBatchEditJiggle(rootRef, enabled, paused = false) {
  const optionsRef = useRef({ enabled, paused });
  const controllerRef = useRef(null);

  useLayoutEffect(() => {
    optionsRef.current = { enabled, paused };
    controllerRef.current?.wake();
  }, [enabled, paused]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const items = new Map();
    let frame = 0;
    let previousTime = 0;
    let clock = 0;
    let dirty = true;
    let disposed = false;

    function restore(item) {
      item.angle = 0;
      item.velocity = 0;
      if (item.originalRotate) item.node.style.rotate = item.originalRotate;
      else item.node.style.removeProperty('rotate');
    }

    const visibility = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const item = items.get(entry.target);
        if (!item) continue;
        item.visible = entry.isIntersecting;
        if (!item.visible) restore(item);
      }
      wake();
    }, { root: root.closest('.home-scroll'), rootMargin: '80px' });

    function collectItems() {
      dirty = false;
      // Gesture snapshots copy the data attributes too; only live tiles edit.
      const present = new Set(root.querySelectorAll(':scope > .board-grid > [data-board-item]'));
      for (const [node, item] of items) {
        if (present.has(node)) continue;
        visibility.unobserve(node);
        restore(item);
        items.delete(node);
      }
      for (const node of present) {
        if (items.has(node)) continue;
        const seed = itemSeed(node.dataset.boardItem || '');
        const widget = node.dataset.itemType === 'widget';
        items.set(node, {
          node,
          originalRotate: node.style.rotate,
          phase: (seed % 997) / 997 * TAU,
          period: .44 + (seed % 7) * .018,
          amplitude: widget ? .32 + (seed % 4) * .035 : .85 + (seed % 4) * .08,
          angle: 0,
          velocity: 0,
          visible: true,
        });
        visibility.observe(node);
      }
    }

    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      for (const item of items.values()) restore(item);
    }

    function tick(time) {
      frame = 0;
      if (disposed) return;
      if (dirty) collectItems();
      if (preference.matches || !isPageActive(document)) { reset(); return; }

      const dt = previousTime ? Math.min((time - previousTime) / 1000, .04) : 1 / 60;
      previousTime = time;
      clock += dt;
      const running = optionsRef.current.enabled && !optionsRef.current.paused;
      let moving = false;

      for (const item of items.values()) {
        if (!item.visible) continue;
        const active = running && !item.node.classList.contains('is-dragging');
        const target = active ? Math.sin(clock / item.period * TAU + item.phase) * item.amplitude : 0;
        // Exact critically damped step: retarget without resetting angular velocity.
        const omega = active ? 48 : 32;
        const offset = item.angle - target;
        const coefficient = item.velocity + omega * offset;
        const decay = Math.exp(-omega * dt);
        item.angle = target + (offset + coefficient * dt) * decay;
        item.velocity = (item.velocity - omega * coefficient * dt) * decay;
        if (!active && Math.abs(item.angle) < .001 && Math.abs(item.velocity) < .02) {
          restore(item);
          continue;
        }
        item.node.style.rotate = `${item.angle.toFixed(4)}deg`;
        moving = true;
      }

      if (moving) frame = requestAnimationFrame(tick);
      else previousTime = 0;
    }

    function wake() {
      if (disposed) return;
      if (preference.matches || !isPageActive(document)) { reset(); return; }
      // Outside edit mode, preview mounts and widget text updates need no
      // discovery pass, visibility observers or animation frame. Let an
      // already-running exit finish settling before going dormant.
      if (!optionsRef.current.enabled && !previousTime && !frame) return;
      if (!frame) frame = requestAnimationFrame(tick);
    }

    const changes = new MutationObserver(records => {
      if (records.some(record => record.type === 'childList')) dirty = true;
      wake();
    });
    changes.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    preference.addEventListener('change', wake);
    const releaseActivity = subscribePageActivity(wake, document);
    controllerRef.current = { wake };
    wake();

    return () => {
      disposed = true;
      reset();
      changes.disconnect();
      visibility.disconnect();
      preference.removeEventListener('change', wake);
      releaseActivity();
      controllerRef.current = null;
    };
  }, [rootRef]);
}
