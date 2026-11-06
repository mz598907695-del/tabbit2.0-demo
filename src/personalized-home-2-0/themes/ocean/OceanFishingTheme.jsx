import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, Pause, Play, X } from "../../icons";
import { createFishingSimulation, stepFishingSimulation, resizeFishingSimulation, settleFishingSimulation } from './fishing-physics.js';
import { createOceanRenderer, getOceanView, OCEAN_ATLAS_URL } from './ocean-renderer.js';
import { clamp, depthName, fishArtSources, fishFits, fishLimit, fishPopulation, oceanDepth } from './scene-layout.js';
import { createFishSwimmers, resumeFishSwimmer, stepFishSwimmers } from './fish-motion.js';
import './ocean.css';

const statusCopy = {
  idle: '点击鱼竿，抛一封信给大海',
  casting: '鱼线正在落入海中',
  exploring: '向下滚动探索 · 点击游鱼咬钩',
  biting: '咬钩了',
  reeling: '正在收线 · 滚动可中断',
  caught: '相遇片刻，再放回大海',
};

export default forwardRef(function OceanFishingTheme({ homeRef, blocked, pageKey, onPhaseChange }, ref) {
  const canvasRef = useRef(null);
  const lineRef = useRef(null);
  const backgroundRef = useRef(null);
  const staticArtRef = useRef(null);
  const fishRefs = useRef([]);
  const session = useRef(null);
  const callbacks = useRef({ onPhaseChange, blocked });
  callbacks.current = { onPhaseChange, blocked };
  const [phase, setPhase] = useState('idle');
  const [band, setBand] = useState('日光浅海');
  const [paused, setPaused] = useState(false);
  const [scrollRoot, setScrollRoot] = useState(null);
  const [extent, setExtent] = useState(0);
  const [catchName, setCatchName] = useState('');

  useImperativeHandle(ref, () => ({ cast: () => session.current?.cast() }), []);
  useEffect(() => {
    const home = homeRef.current;
    const scroll = home?.querySelector('.home-scroll');
    const canvas = lineRef.current;
    if (!home || !scroll || !canvas) return;
    setScrollRoot(scroll);
    const ctx = canvas.getContext('2d');
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const state = {
      width: 1, height: 1, origin: { x: 0, y: 0 }, worldObstacles: [], phase: 'idle', sim: null,
      time: 0, phaseTime: 0, lastTime: 0, lastPaint: -1, paused: false, reduced: media.matches,
      dirty: true, frame: 0, catchIndex: -1, fishPositions: [], reelStart: 0,
      release: null, bgReady: false, destroyed: false,
      swimmers: createFishSwimmers(fishPopulation), fishDom: [], screenObstacles: [],
    };
    let measureFrame = 0;
    const renderer = createOceanRenderer(canvasRef.current, { onFallback: () => {
      canvasRef.current?.setAttribute('hidden', '');
      backgroundRef.current?.setAttribute('data-fallback', 'true');
    } });
    if (!renderer) backgroundRef.current?.setAttribute('data-fallback', 'true');

    function changePhase(next) {
      state.phase = next;
      state.phaseTime = 0;
      setPhase(next);
      callbacks.current.onPhaseChange?.(next);
      state.dirty = true;
    }
    function measure() {
      const rect = home.getBoundingClientRect();
      const oldWidth = state.width, oldHeight = state.height;
      state.width = rect.width; state.height = rect.height;
      state.lastFishScroll = null;
      const reel = home.querySelector('.ocean-reel')?.getBoundingClientRect();
      if (reel) state.origin = { x: reel.left - rect.left + reel.width * 65 / 72, y: reel.top - rect.top + scroll.scrollTop + 9 };
      if (state.sim && (oldWidth !== state.width || oldHeight !== state.height)) {
        cancelReel();
        resizeFishingSimulation(state.sim, { origin: state.origin, scaleX: state.width / oldWidth, scaleY: state.height / oldHeight });
      }
      // Store world-space rectangles once per layout, not once per animation frame.
      state.worldObstacles = [...home.querySelectorAll('[data-board-item], .promotion-inline, .promotion-inline-carousel')].map(node => {
        const b = node.getBoundingClientRect();
        return { left: b.left - rect.left, right: b.right - rect.left, top: b.top - rect.top + scroll.scrollTop, bottom: b.bottom - rect.top + scroll.scrollTop };
      });
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(state.width * dpr); canvas.height = Math.round(state.height * dpr);
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (state.phase !== 'idle') setExtent(Math.round(state.height * 2.7));
      state.dirty = true;
      wake();
    }
    function cancelReel() {
      if (state.phase === 'biting' || state.phase === 'reeling') {
        const index = state.catchIndex, position = state.fishPositions[index];
        state.release = position ? { index, x: position.x, y: position.y, direction: position.direction, facing: position.facing, returning: true } : null;
        state.catchIndex = -1;
        changePhase('exploring');
      }
    }
    function stop() {
      state.sim = null; state.catchIndex = -1; state.release = null;
      changePhase('idle');
      // Retain the current scroll extent until the visitor is back at the top.
      if (scroll.scrollTop < 1) setExtent(0);
      wake();
    }
    function cast() {
      if (callbacks.current.blocked || ['casting', 'biting', 'reeling'].includes(state.phase)) return;
      cancelReel();
      scroll.scrollTop = 0;
      measure();
      setExtent(Math.round(state.height * 2.7));
      setCatchName('');
      state.catchIndex = -1; state.release = null; state.sim = null;
      changePhase('casting');
      wake();
    }
    function bite(index) {
      const position = state.fishPositions[index];
      if (state.phase !== 'exploring' || !position?.visible || callbacks.current.blocked || state.release?.returning || !state.sim) return;
      state.catchIndex = index;
      state.biteFrom = { ...position };
      state.catchDirection = state.sim.hook.x >= position.x ? 1 : -1;
      setCatchName(fishPopulation[index].name);
      changePhase('biting');
      wake();
    }
    function onScroll() {
      state.dirty = true;
      if (state.phase === 'idle' && scroll.scrollTop < 1) setExtent(0);
      wake();
    }
    function interrupt(event) {
      if (event.type === 'keydown' && !['Escape', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
      if (event.type === 'keydown' && event.key === 'Escape') stop();
      else cancelReel();
    }
    function drawLine(scrollTop) {
      if (!ctx) return;
      ctx.clearRect(0, 0, state.width, state.height);
      const sim = state.sim;
      if (!sim) return;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      // Interpolate the solved rope nodes so long paid-out sections do not
      // expose the simulation's coarse segments as sharp visual corners.
      const points = sim.points;
      ctx.moveTo(points[0].x, points[0].y - scrollTop);
      for (let i = 1; i < points.length - 2; i += 1) {
        const p = points[i], next = points[i + 1];
        ctx.quadraticCurveTo(p.x, p.y - scrollTop, (p.x + next.x) / 2, (p.y + next.y) / 2 - scrollTop);
      }
      const penultimate = points[points.length - 2], end = points[points.length - 1];
      ctx.quadraticCurveTo(penultimate.x, penultimate.y - scrollTop, end.x, end.y - scrollTop);
      ctx.strokeStyle = 'rgba(22,58,76,.3)'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,245,218,.88)'; ctx.lineWidth = 1; ctx.stroke();
      const hook = sim.hook;
      ctx.save(); ctx.translate(hook.x, hook.y - scrollTop);
      ctx.rotate(clamp(hook.vx / 450, -.55, .55));
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 5); ctx.bezierCurveTo(0, 15, -11, 15, -11, 6);
      ctx.lineTo(-8, 8); ctx.strokeStyle = '#fff2c9'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, -7, 2, 4, 0, 0, Math.PI * 2); ctx.fillStyle = '#edb379'; ctx.fill();
      ctx.restore();
      if (sim.splash && !state.reduced) {
        const age = sim.elapsed - sim.splash.at;
        if (age < 1.2) {
          ctx.beginPath(); ctx.ellipse(sim.splash.x, sim.splash.y - scrollTop, 8 + age * 36, 2 + age * 7, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,247,209,${Math.max(0, .7 * (1 - age / 1.2))})`; ctx.lineWidth = 1; ctx.stroke();
        }
      }
    }
    function updateFish(scrollTop, depth, dt, blockedNow) {
      // The composer can stick while the rest of the board scrolls.
      if (state.lastFishScroll !== scrollTop) {
        state.screenObstacles = state.worldObstacles.map(rect => ({ ...rect, top: rect.top - scrollTop, bottom: rect.bottom - scrollTop }));
        const composer = home.querySelector('.tb-composer-wrap');
        if (composer) {
          const b = composer.getBoundingClientRect(), h = home.getBoundingClientRect();
          state.screenObstacles.push({ left: b.left - h.left, right: b.right - h.left, top: b.top - h.top, bottom: b.bottom - h.top });
        }
        state.lastFishScroll = scrollTop;
      }
      const obstacles = state.screenObstacles;
      const waterY = getOceanView(state.width, state.height, depth).waterY;
      const pinnedIndex = state.catchIndex >= 0 ? state.catchIndex : state.release?.index ?? -1;
      for (let i = 0; i < fishPopulation.length; i += 1) {
        const fish = fishPopulation[i], swimmer = state.swimmers[i];
        // A deeper species starts in its own water layer when first reached,
        // rather than inheriting the shallow surface's compressed Y range.
        if (!swimmer.entered && state.phase !== 'idle' && state.phase !== 'casting' && depth >= fish.min && depth <= fish.max) {
          swimmer.x = fish.x * state.width; swimmer.y = fish.y * state.height;
          swimmer.u = fish.x; swimmer.v = fish.y; swimmer.entered = true;
        }
      }
      stepFishSwimmers(state.swimmers, blockedNow || ['idle', 'casting'].includes(state.phase) ? 0 : dt, {
        width: state.width, height: state.height, waterY, reducedMotion: state.reduced, pinnedIndex,
      });
      const freeLimit = fishLimit(state.width) - (pinnedIndex >= 0 ? 1 : 0);
      let freeCount = 0;
      fishPopulation.forEach((fish, i) => {
        const node = fishRefs.current[i];
        if (!node) return;
        const swimmer = state.swimmers[i];
        const { width, height } = swimmer;
        let { x, y, facing, direction } = swimmer;
        let visible = state.phase !== 'idle' && state.phase !== 'casting' && depth >= fish.min && depth <= fish.max;
        if (state.catchIndex === i && state.sim) {
          const hook = state.sim.hook;
          direction = state.catchDirection;
          const target = { x: hook.x - direction * width * .43, y: hook.y - scrollTop + 5 };
          if (state.phase === 'biting') {
            const p = Math.min(1, state.phaseTime / .45), ease = p * p * (3 - 2 * p);
            x = state.biteFrom.x + (target.x - state.biteFrom.x) * ease;
            y = state.biteFrom.y + (target.y - state.biteFrom.y) * ease;
            facing = state.biteFrom.facing + (direction - state.biteFrom.facing) * ease;
          } else { x = target.x; y = target.y; facing = direction; }
          visible = true;
        } else if (state.release?.index === i) {
          direction = state.release.direction;
          if (state.release.returning) {
            const p = state.reduced ? 1 : Math.min(1, state.phaseTime / .65), ease = p * p * (3 - 2 * p);
            const destinationX = clamp(state.release.x + direction * 35, width / 2 + 16, state.width - width / 2 - 16);
            const destinationY = Math.min(state.height - 80 - height / 2, Math.max(state.release.y, waterY + height / 2 + 12));
            x = state.release.x + (destinationX - state.release.x) * ease;
            y = state.release.y + (destinationY - state.release.y) * ease;
            facing = state.release.facing + (direction - state.release.facing) * ease;
            visible = true;
            if (p >= 1) { resumeFishSwimmer(swimmer, { direction, facing }); state.release = null; }
          } else {
            facing = direction;
            x = state.release.x + state.phaseTime * 120 * direction;
            y = state.release.y + Math.sin(state.phaseTime * 2) * 12;
            visible = !state.reduced && state.phaseTime < 1.8;
          }
        } else {
          // Continue the route behind occupied UI instead of teleporting to
          // a side lane. Hidden fish retain their position and heading.
          visible = visible && freeCount < freeLimit && y - height / 2 >= waterY + 8 && fishFits(x, y, width, height, state, obstacles);
          if (visible) freeCount += 1;
        }
        if (pinnedIndex === i) {
          swimmer.u = x / state.width; swimmer.v = y / state.height;
          swimmer.x = x; swimmer.y = y; swimmer.facing = facing; swimmer.direction = direction;
        }
        const paint = state.fishDom[i] ?? (state.fishDom[i] = {});
        if (paint.width !== width) {
          node.style.width = `${width}px`; node.style.height = `${height}px`; paint.width = width;
        }
        if (visible) {
          node.style.transform = `translate3d(${(x - width / 2).toFixed(2)}px,${(y - height / 2).toFixed(2)}px,0)`;
          node.style.setProperty('--fish-direction', facing.toFixed(3));
        }
        if (paint.visible !== visible) {
          node.style.visibility = visible ? 'visible' : 'hidden';
          node.setAttribute('aria-hidden', String(!visible)); paint.visible = visible;
        }
        const interactive = visible && state.phase === 'exploring' && !blockedNow && !state.release?.returning;
        if (paint.interactive !== interactive) {
          node.style.pointerEvents = interactive ? 'auto' : 'none'; node.disabled = !interactive; paint.interactive = interactive;
        }
        const position = state.fishPositions[i] ?? (state.fishPositions[i] = {});
        position.x = x; position.y = y; position.visible = visible;
        position.direction = direction; position.facing = facing;
      });
    }
    function frame(now) {
      state.frame = 0;
      if (state.destroyed || document.hidden) { state.lastTime = 0; return; }
      const dt = state.lastTime ? Math.min(.05, (now - state.lastTime) / 1000) : 0;
      state.lastTime = now;
      const blockedNow = callbacks.current.blocked || state.paused;
      if (blockedNow && ['biting', 'reeling'].includes(state.phase)) cancelReel();
      if (!blockedNow) { state.time += dt; state.phaseTime += dt; }
      let scrollTop = scroll.scrollTop;
      if (state.phase === 'casting' && state.phaseTime >= (state.reduced ? 0 : .33) && !state.sim) {
        state.sim = createFishingSimulation({ origin: state.origin, waterY: state.height * .68, target: { x: state.width * .87, y: state.height * .78 } });
        if (state.reduced) changePhase('exploring');
      }
      if (state.phase === 'biting' && state.phaseTime > (state.reduced ? 0 : .48)) {
        state.reelStart = scrollTop;
        state.reelHook = { ...state.sim.hook };
        changePhase('reeling');
      }
      let target = { x: state.width * .87, y: scrollTop + state.height * .75 };
      if (state.phase === 'reeling' && !blockedNow) {
        const duration = state.reduced ? .01 : clamp(1.25 + state.reelStart / 1700, 1.25, 3);
        const p = state.reduced ? 1 : Math.min(1, state.phaseTime / duration), ease = p * p * (3 - 2 * p);
        scroll.scrollTop = state.reelStart * (1 - ease);
        scrollTop = scroll.scrollTop;
        target = { x: state.reelHook.x + (state.origin.x + 80 - state.reelHook.x) * ease,
          y: state.reelHook.y + (state.origin.y + 64 - state.reelHook.y) * ease };
        if (p >= 1) {
          const pos = state.fishPositions[state.catchIndex];
          state.release = { index: state.catchIndex, x: pos?.x || target.x, y: pos?.y || target.y, direction: state.catchDirection };
          state.catchIndex = -1;
          state.sim = null;
          changePhase('caught');
        }
      }
      const depth = oceanDepth(scrollTop, state.height);
      const view = getOceanView(state.width, state.height, depth);
      if (state.sim && !blockedNow) {
        const params = { origin: state.origin, target, waterY: view.waterY + scrollTop, reeling: state.phase === 'reeling' };
        if (state.reduced) settleFishingSimulation(state.sim, params);
        else stepFishingSimulation(state.sim, dt, params);
        if (state.sim.phase === 'underwater' && state.phase === 'casting') changePhase('exploring');
      }
      if (state.phase === 'caught' && state.phaseTime > 2) {
        state.release = null;
        changePhase('idle');
        if (scroll.scrollTop < 1) setExtent(0);
      }
      drawLine(scrollTop);
      // Only the rope and fish need 60Hz. The painted underwater light is subtle
      // and capped at 20Hz; idle/paused wallpaper is a single static GPU frame.
      const active = !blockedNow && !state.reduced && state.phase !== 'idle';
      if (state.dirty || (active && now - state.lastPaint >= 50) || !state.bgReady) {
        const painted = renderer?.render({ time: state.time, depth, width: state.width, height: state.height, reducedMotion: state.reduced });
        state.bgReady = painted !== false;
        state.lastPaint = now;
        // The fallback uses exactly the GPU camera, including sky overscan.
        if (state.dirty && staticArtRef.current) {
          const imageWidth = state.width / view.visibleW, imageHeight = state.height / view.visibleH;
          Object.assign(staticArtRef.current.style, {
            width: `${imageWidth}px`, height: `${imageHeight}px`,
            transform: `translate(${-view.offsetX * imageWidth}px,${-view.offset * imageHeight}px)`,
          });
        }
        const nextBand = depthName(depth);
        if (state.band !== nextBand) { state.band = nextBand; setBand(nextBand); }
        state.dirty = false;
      }
      updateFish(scrollTop, depth, dt, blockedNow);
      if (active || (!blockedNow && ['casting', 'biting', 'reeling', 'caught'].includes(state.phase)) || !state.bgReady) wake();
    }
    function wake() { if (!state.frame && !state.destroyed && !document.hidden) state.frame = requestAnimationFrame(frame); }
    function visibility() { state.lastTime = 0; if (document.hidden) cancelReel(); else { state.dirty = true; wake(); } }
    function motion() { state.reduced = media.matches; state.dirty = true; wake(); }
    session.current = { cast, stop, bite, wake, setPaused(value) { state.paused = value; state.dirty = true; state.lastTime = 0; wake(); } };
    const resize = new ResizeObserver(measure);
    resize.observe(home); resize.observe(home.querySelector('.home-content'));
    // A same-size item move does not resize its container. Refresh hit safety
    // after packed layout changes, coalescing all changed item attributes.
    const layoutObserver = new MutationObserver(() => {
      if (!measureFrame) measureFrame = requestAnimationFrame(() => { measureFrame = 0; measure(); });
    });
    layoutObserver.observe(home.querySelector('.home-content'), { subtree: true, childList: true, attributes: true, attributeFilter: ['data-x', 'data-y', 'data-w', 'data-h'] });
    scroll.addEventListener('scroll', onScroll, { passive: true });
    home.addEventListener('wheel', interrupt, { passive: true });
    home.addEventListener('touchstart', interrupt, { passive: true });
    home.addEventListener('pointerdown', interrupt);
    home.addEventListener('keydown', interrupt);
    document.addEventListener('visibilitychange', visibility);
    media.addEventListener('change', motion);
    measure();
    callbacks.current.onPhaseChange?.('idle');
    return () => {
      state.destroyed = true; cancelAnimationFrame(state.frame); cancelAnimationFrame(measureFrame); resize.disconnect(); layoutObserver.disconnect(); renderer?.destroy();
      scroll.removeEventListener('scroll', onScroll); home.removeEventListener('wheel', interrupt);
      home.removeEventListener('touchstart', interrupt); home.removeEventListener('pointerdown', interrupt);
      home.removeEventListener('keydown', interrupt); document.removeEventListener('visibilitychange', visibility);
      media.removeEventListener('change', motion); session.current = null;
    };
  }, [homeRef]);
  useEffect(() => { session.current?.wake(); }, [blocked]);
  useEffect(() => { session.current?.setPaused(paused); }, [paused]);
  useEffect(() => { session.current?.stop(); }, [pageKey]);
  useEffect(() => { if (phase === 'caught') homeRef.current?.querySelector('.ocean-reel')?.focus({ preventScroll: true }); }, [phase, homeRef]);

  return <>
    <div ref={backgroundRef} className="ocean-background" aria-hidden="true">
      <img ref={staticArtRef} className="ocean-static-art" src={OCEAN_ATLAS_URL} alt="" />
      <canvas ref={canvasRef} />
    </div>
    <canvas ref={lineRef} className="ocean-line" aria-hidden="true" />
    <div className="ocean-fish-layer" data-phase={phase}>
      {fishPopulation.map((fish, i) => <button type="button" key={fish.id} ref={node => { fishRefs.current[i] = node; }}
        className={`ocean-fish ocean-fish-${fish.art}`} aria-label={`让${fish.name}咬钩`} onClick={() => session.current?.bite(i)}
        style={{ visibility: 'hidden', '--fish-direction': fish.direction }}>
        <img src={fishArtSources[fish.art]} alt="" draggable="false" decoding="async" />
      </button>)}
    </div>
    <div className="ocean-caption" data-phase={phase}>
      <span className="ocean-edition">TIDAL LETTERS <span>／</span> {band}</span>
      <span className="ocean-instruction" role="status">{phase === 'caught' && catchName ? `${catchName} · ` : ''}{statusCopy[phase]}</span>
      <div className="ocean-caption-actions">
        <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? '继续海洋动态' : '暂停海洋动态'}>{paused ? <Play size={13} /> : <Pause size={13} />}</button>
        {phase !== 'idle' && <button type="button" onClick={() => session.current?.stop()} aria-label="收起鱼线"><X size={14} /></button>}
      </div>
    </div>
    {scrollRoot && createPortal(<div className="ocean-scroll-extent" style={{ height: extent }} aria-hidden="true">
      {extent > 0 && <span className="ocean-depth-note"><ArrowUp size={16} /> 点击游鱼，一起回到海面</span>}
    </div>, scrollRoot)}
  </>;
});
