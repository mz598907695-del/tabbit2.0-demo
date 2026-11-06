import { useEffect, useRef } from 'react';
import './monochrome-themes.css';

const CONTROLS = 'a,button,input,textarea,select,[contenteditable="true"],[role="dialog"],[data-board-item],.board-item';

function MonochromeCanvas({ theme, active }) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const activeRef = useRef(active);
  const syncRef = useRef(() => {});
  activeRef.current = active;

  useEffect(() => {
    const host = hostRef.current, canvas = canvasRef.current;
    const surface = host.closest('.home');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let renderer, disposed = false, lost = false, visible = true, focused = false;
    let frame = 0, previous = 0, elapsed = 0, samples = 0;
    const target = { x: .5, y: .5, inside: false, down: false, click: false };
    const pointer = { x: .5, y: .5, dx: 0, dy: 0, active: 0, press: 0, down: false, click: false };
    const trail = [], trailData = new Float32Array(64);
    let lastTrail = -1;
    const canRun = () => !disposed && !lost && renderer && activeRef.current && visible && !document.hidden && !reduced.matches && !focused;

    function stop() { cancelAnimationFrame(frame); frame = 0; previous = 0; }
    function packTrail() {
      trailData.fill(0);
      trail.forEach((point, i) => trailData.set([point.x, point.y, elapsed - point.time, point.strength], i * 4));
    }
    function paint(dt = 0) {
      if (!renderer || lost || disposed) return;
      packTrail();
      renderer.render(elapsed, dt, pointer, trailData);
      host.dataset.ready = 'true';
      host.dataset.frames = String(++samples);
    }
    function tick(now) {
      frame = 0;
      if (!canRun()) return;
      // Thirty frames per second is sufficient for these quiet ambient effects.
      if (previous && now - previous < 32) { frame = requestAnimationFrame(tick); return; }
      const dt = previous ? Math.min(.05, (now - previous) / 1000) : 1 / 30;
      previous = now; elapsed += dt;
      const ease = 1 - Math.exp(-dt / .18);
      const oldX = pointer.x, oldY = pointer.y;
      pointer.x += (target.x - pointer.x) * ease;
      pointer.y += (target.y - pointer.y) * ease;
      pointer.active += ((target.inside ? 1 : 0) - pointer.active) * ease;
      pointer.press += ((target.down ? 1 : 0) - pointer.press) * ease;
      pointer.down = target.down; pointer.click = target.click;
      pointer.dx = target.inside ? pointer.x - oldX : 0;
      pointer.dy = target.inside ? pointer.y - oldY : 0;
      paint(dt); target.click = false;
      if (canRun()) frame = requestAnimationFrame(tick);
    }
    function clearPointer() { target.inside = false; target.down = false; target.click = false; }
    function sync() {
      if (canRun()) {
        host.dataset.motion = 'running';
        if (!frame) frame = requestAnimationFrame(tick);
      } else {
        stop(); clearPointer();
        host.dataset.motion = renderer && !lost ? 'paused' : 'fallback';
      }
    }
    syncRef.current = sync;
    function resize() {
      if (!renderer || lost || disposed) return;
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.resize(width, height); paint(); sync();
    }
    function track(event, pressed = false) {
      if (!canRun() || event.target.closest(CONTROLS)) { clearPointer(); return; }
      const rect = host.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = 1 - (event.clientY - rect.top) / rect.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) { clearPointer(); return; }
      target.x = x; target.y = y; target.inside = true;
      if (pressed) {
        target.down = true; target.click = true;
        // A click impulse belongs at the actual hit point, never the lagging cursor.
        pointer.x = x; pointer.y = y; pointer.dx = 0; pointer.dy = 0;
      }
      const last = trail[trail.length - 1];
      if (pressed || elapsed - lastTrail > .075 && (!last || Math.hypot(x - last.x, y - last.y) > .003)) {
        trail.push({ x, y, time: elapsed, strength: target.down ? 1 : .35 });
        if (trail.length > 16) trail.shift();
        lastTrail = elapsed;
      }
    }
    function down(event) { if (event.button === 0) track(event, true); }
    function move(event) { track(event); }
    function up() { target.down = false; }
    function focus() {
      focused = Boolean(document.activeElement?.matches('input,textarea,[contenteditable="true"]'));
      sync();
    }
    function motion() {
      if (reduced.matches) { pointer.active = 0; pointer.press = 0; pointer.down = false; trail.length = 0; paint(); }
      sync();
    }
    function contextLost(event) {
      event.preventDefault(); lost = true; host.dataset.ready = 'false'; sync();
    }
    let create;
    function initialize() {
      if (disposed) return;
      try {
        renderer?.dispose(); renderer = create(canvas, theme);
        lost = false; delete host.dataset.error;
        resize(); sync();
      } catch (error) {
        renderer = null; host.dataset.ready = 'false'; host.dataset.motion = 'fallback';
        host.dataset.error = error.message; stop();
      }
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    intersection.observe(host);
    surface.addEventListener('pointermove', move, { passive: true });
    surface.addEventListener('pointerdown', down, { passive: true });
    surface.addEventListener('pointerleave', clearPointer, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', clearPointer, { passive: true });
    window.addEventListener('blur', clearPointer);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', focus);
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', motion);
    canvas.addEventListener('webglcontextlost', contextLost);
    canvas.addEventListener('webglcontextrestored', initialize);
    import('./monochrome-renderer.js').then(module => {
      create = module.createMonochromeRenderer; initialize();
    }).catch(error => { if (!disposed) { host.dataset.motion = 'fallback'; host.dataset.error = error.message; } });
    return () => {
      disposed = true; stop(); syncRef.current = () => {};
      resizeObserver.disconnect(); intersection.disconnect();
      surface.removeEventListener('pointermove', move);
      surface.removeEventListener('pointerdown', down);
      surface.removeEventListener('pointerleave', clearPointer);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', clearPointer);
      window.removeEventListener('blur', clearPointer);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', focus);
      document.removeEventListener('visibilitychange', sync);
      reduced.removeEventListener('change', motion);
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.removeEventListener('webglcontextrestored', initialize);
      renderer?.dispose();
    };
  }, [theme]);

  useEffect(() => { syncRef.current(); }, [active]);
  return <div ref={hostRef} className="monochrome-theme-background" data-theme-id={theme.id} data-ready="false" aria-hidden="true"
    style={{ backgroundColor: theme.color, backgroundImage: `url("${theme.preview}")` }}>
    <canvas ref={canvasRef} />
  </div>;
}

export default function MonochromeThemeBackground({ theme, active = true }) {
  return theme ? <MonochromeCanvas key={theme.id} theme={theme} active={active} /> : null;
}
