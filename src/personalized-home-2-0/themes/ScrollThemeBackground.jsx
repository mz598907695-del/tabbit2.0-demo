import { useEffect, useRef } from 'react';
import { loadScrollRenderer } from './scroll-theme-renderers.js';
import { scrollDistance } from './scroll-themes.js';
import './scroll-themes.css';

const clamp01 = value => Math.min(1, Math.max(0, value));
// Anything interactive keeps its own clicks; only bare wallpaper is offered to the renderer.
const CONTROLS = 'a,button,input,textarea,select,summary,label,[contenteditable="true"],[role="dialog"],dialog,[data-board-item],.board-item,.tb-composer-wrap,.corner-tools,.page-indicator';

function ScrollThemeCanvas({ theme, active }) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const activeRef = useRef(active);
  const syncRef = useRef(() => {});
  activeRef.current = active;

  useEffect(() => {
    const host = hostRef.current, canvas = canvasRef.current;
    const surface = host.closest('.home');
    const scroller = surface?.querySelector(':scope > .home-scroll');
    if (!surface || !scroller) return undefined;
    const content = scroller.querySelector('.home-content');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let renderer = null, create = null, disposed = false, visible = true, frame = 0;
    let width = 0, height = 0, distance = 1, avoidHalf = 350, runway = 0;
    let progress = 0, target = 0, elapsed = 6, previous = 0;
    const canRun = () => !disposed && renderer && activeRef.current && visible && !document.hidden;

    function paint() {
      if (!renderer) return;
      renderer.render({ p: progress, time: elapsed, layout: { avoidHalf } });
      host.dataset.ready = 'true';
      host.dataset.progress = progress.toFixed(3);
    }
    function tick(now) {
      frame = 0;
      if (!canRun()) return;
      const settled = Math.abs(target - progress) < 5e-4;
      // Ambient motion is gentle enough for ~30fps; scrolling gets every frame.
      if (previous && settled && now - previous < 32) { frame = requestAnimationFrame(tick); return; }
      const dt = previous ? Math.min(.05, (now - previous) / 1000) : 1 / 60;
      previous = now;
      if (!reduced.matches) elapsed += dt;
      progress = reduced.matches || settled ? target : progress + (target - progress) * (1 - Math.exp(-dt / .12));
      paint();
      if (reduced.matches && progress === target) return;
      frame = requestAnimationFrame(tick);
    }
    function wake() {
      if (frame || !canRun()) return;
      previous = 0;
      frame = requestAnimationFrame(tick);
    }
    function sync() {
      if (canRun()) { host.dataset.motion = reduced.matches ? 'still' : 'running'; wake(); }
      else { cancelAnimationFrame(frame); frame = 0; host.dataset.motion = renderer ? 'paused' : 'fallback'; }
    }
    syncRef.current = sync;
    // Wallpaper clicks (constellations, startled fish…) for renderers that opt in with pointer().
    function onPointerDown(event) {
      if (!renderer?.pointer || !canRun() || event.button !== 0 || event.target.closest?.(CONTROLS)) return;
      if (event.target === scroller && event.offsetX > scroller.clientWidth) return; // scrollbar
      const rect = host.getBoundingClientRect();
      renderer.pointer({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      wake();
    }
    function readTarget() { target = clamp01(scroller.scrollTop / distance); }
    function measure() {
      const rect = host.getBoundingClientRect();
      width = rect.width; height = rect.height;
      if (!width || !height) return;
      distance = scrollDistance(theme, scroller.clientHeight || height);
      avoidHalf = (content?.offsetWidth ?? 700) / 2;
      // Short homepages get blank runway at the end of the feed, inside the sticky
      // composer's container, so the docked composer stays put for the whole story.
      const base = parseFloat(getComputedStyle(scroller).paddingBottom) || 0;
      const natural = content ? content.offsetTop + content.offsetHeight - runway + base - scroller.clientHeight : 0;
      const nextRunway = Math.max(0, Math.round(distance - Math.max(0, natural)));
      if (nextRunway !== runway) {
        runway = nextRunway;
        surface.style.setProperty('--scroll-theme-runway', `${runway}px`);
      }
      renderer?.resize(width, height, window.devicePixelRatio || 1);
      readTarget();
      if (renderer) paint();
      sync();
    }
    function initialize() {
      if (disposed || !create) return;
      try {
        renderer?.dispose();
        renderer = create(canvas);
        delete host.dataset.error;
        measure();
        progress = target;
        paint();
        sync();
      } catch (error) {
        renderer = null; host.dataset.motion = 'fallback'; host.dataset.error = error.message;
      }
    }
    function contextLost(event) { event.preventDefault(); renderer = null; host.dataset.ready = 'false'; sync(); }

    surface.dataset.scrollTheme = theme.id;
    const resizeObserver = new ResizeObserver(measure);
    [host, scroller, content].filter(Boolean).forEach(element => resizeObserver.observe(element));
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    intersection.observe(host);
    function onScroll() { readTarget(); wake(); }
    scroller.addEventListener('scroll', onScroll, { passive: true });
    surface.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
    canvas.addEventListener('webglcontextlost', contextLost);
    canvas.addEventListener('webglcontextrestored', initialize);
    loadScrollRenderer(theme).then(factory => { create = factory; initialize(); })
      .catch(error => { if (!disposed) { host.dataset.motion = 'fallback'; host.dataset.error = error.message; } });
    measure();

    return () => {
      disposed = true; cancelAnimationFrame(frame); syncRef.current = () => {};
      resizeObserver.disconnect(); intersection.disconnect();
      scroller.removeEventListener('scroll', onScroll);
      surface.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('visibilitychange', sync);
      reduced.removeEventListener('change', sync);
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.removeEventListener('webglcontextrestored', initialize);
      surface.removeAttribute('data-scroll-theme');
      surface.style.removeProperty('--scroll-theme-runway');
      renderer?.dispose();
    };
  }, [theme]);

  useEffect(() => { syncRef.current(); }, [active]);
  return <div ref={hostRef} className="scroll-theme-background" data-theme-id={theme.id} data-ready="false" data-pixel={theme.pixel ? "true" : undefined} aria-hidden="true"
    style={{ backgroundColor: theme.color }}>
    <canvas ref={canvasRef} />
  </div>;
}

export default function ScrollThemeBackground({ theme, active = true }) {
  return theme ? <ScrollThemeCanvas key={theme.id} theme={theme} active={active} /> : null;
}
