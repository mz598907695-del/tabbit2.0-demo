import { useEffect, useLayoutEffect, useRef } from "react";
import { ArtRenderer, getSceneView } from "./ArtRenderer.js";
import "./themes.css";

const channels = ["breath", "head", "tail", "paw", "blink", "ear"];
const environmentKinds = {
  water: 1, wind: 2, grass: 2, light: 3, shadow: 3, sunset: 3,
  snow: 4, mist: 5, moon: 6, paper: 11, fold: 8, felt: 9,
  clay: 10, relief: 11, ink: 12, line: 13, pencil: 14, print: 15,
};
const propKinds = {
  dew: 16, bamboo: 27, puddle: 1, boat: 1, tide: 1, leaf: 17,
  seeds: 18, chalkstar: 19, fold: 26, bubble: 20, lavender: 18,
  fireflies: 21, maple: 17, rain: 22, pebble: 1, snowball: 23,
  moon: 6, yarn: 24, reed: 18, petals: 25,
};
const smooth = (value) => value * value * (3 - 2 * value);
const clamp = (value) => Math.max(0, Math.min(1, value));

function sample(frames, time) {
  if (!frames?.length) return {};
  let a = frames[0];
  let b = frames.at(-1);
  for (let index = 1; index < frames.length; index += 1) {
    if (time <= frames[index].t) {
      a = frames[index - 1];
      b = frames[index];
      break;
    }
  }
  const progress = smooth(clamp((time - a.t) / (b.t - a.t || 1)));
  return Object.fromEntries(channels.map((key) => [
    key, (a[key] || 0) + ((b[key] || 0) - (a[key] || 0)) * progress,
  ]));
}

function makeState(scene) {
  return {
    scene, elapsed: 0, pose: [0, 0, 0, 0], actionFrom: [0, 0, 0, 0],
    propPose: [0, 0, 0], actionStart: -99, propActionStart: -99,
    blink: 0, earMotion: 0, cleaned: 1, comparing: false, effects: [],
    nextAction: scene.timing?.intro ?? 0.9,
    nextAmbient: scene.id === "05" ? 4.5 : 1.2,
    cueIndex: 0, phase: 0, actionCount: 0, environmentCount: 0,
  };
}

function calculatePose(state) {
  const scene = state.scene;
  const period = scene.idleDuration || 8;
  const idle = sample(scene.idleKeyframes, (state.elapsed % period) / period);
  const actionTime = (state.elapsed - state.actionStart) / (scene.duration || 3);
  const action = actionTime >= 0 && actionTime <= 1 ? sample(scene.keyframes, actionTime) : {};
  const motion = scene.motion;
  state.pose = ["breath", "head", "tail", "paw"].map((key) => (
    (motion[key] || 0) * ((idle[key] || 0) + (action[key] || 0))
  ));
  const blend = smooth(clamp((state.elapsed - state.actionStart) / 0.16));
  if (blend < 1) {
    state.pose = state.pose.map((value, index) => state.actionFrom[index] * (1 - blend) + value * blend);
  }
  state.blink = Math.min(1, Math.max(action.blink || 0, idle.blink || 0));
  state.earMotion = (motion.ear || 0) * ((idle.ear || 0) + (action.ear || 0));
  state.phase = actionTime >= 0 && actionTime <= 1 ? actionTime : 0;
  const propMotion = scene.propMotion;
  if (propMotion) {
    const wave = state.elapsed / (propMotion.period || 5) * Math.PI * 2;
    const age = state.elapsed - state.propActionStart;
    const tap = age >= 0 && age < 3 ? Math.sin(age * 6) * Math.exp(-age * 1.25) : 0;
    const contact = (action.paw || action.head || 0) * 0.38;
    state.propPose = [
      (propMotion.x || 0) * (Math.sin(wave) * 0.55 + tap * 0.8 + contact),
      (propMotion.y || 0) * ((1 - Math.cos(wave)) * 0.35 + tap * 0.65 + contact * 0.4),
      (propMotion.angle || 0) * (Math.sin(wave) * 0.6 + tap + contact),
    ];
  } else state.propPose = [0, 0, 0];
}

function insidePolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Mirror texture CLAMP_TO_EDGE for a clean preview when the mobile view extends
// beyond the artwork. This canvas stays detached; the page still has one canvas.
function paintClampedPreview(target, image, view, viewportWidth, viewportHeight) {
  const scale = Math.min(1, 1280 / Math.max(viewportWidth, viewportHeight));
  target.width = Math.max(1, Math.round(viewportWidth * scale));
  target.height = Math.max(1, Math.round(viewportHeight * scale));
  const context = target.getContext("2d", { alpha: false });
  if (!context) return null;
  const width = target.width;
  const height = target.height;
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const [left, top, viewWidth, viewHeight] = view;
  // Shared pixel boundaries prevent hairline gaps between the image and its edge strips.
  const x = Math.round(-left / viewWidth * width);
  const y = Math.round(-top / viewHeight * height);
  const right = Math.round((1 - left) / viewWidth * width);
  const bottom = Math.round((1 - top) / viewHeight * height);
  const artWidth = right - x;
  const artHeight = bottom - y;
  context.drawImage(image, x, y, artWidth, artHeight);
  if (y > 0) context.drawImage(image, 0, 0, sourceWidth, 1, x, 0, artWidth, y);
  if (bottom < height) context.drawImage(image, 0, sourceHeight - 1, sourceWidth, 1, x, bottom, artWidth, height - bottom);
  if (x > 0) context.drawImage(image, 0, 0, 1, sourceHeight, 0, y, x, artHeight);
  if (right < width) context.drawImage(image, sourceWidth - 1, 0, 1, sourceHeight, right, y, width - right, artHeight);
  if (x > 0 && y > 0) context.drawImage(image, 0, 0, 1, 1, 0, 0, x, y);
  if (right < width && y > 0) context.drawImage(image, sourceWidth - 1, 0, 1, 1, right, 0, width - right, y);
  if (x > 0 && bottom < height) context.drawImage(image, 0, sourceHeight - 1, 1, 1, 0, bottom, x, height - bottom);
  if (right < width && bottom < height) context.drawImage(image, sourceWidth - 1, sourceHeight - 1, 1, 1, right, bottom, width - right, height - bottom);
  return target.toDataURL("image/png");
}

/** Local lifecycle only: no source-gallery UI, storage, or global test hooks. */
function createBackground(canvas, host, preview) {
  let renderer = null;
  let state = null;
  let currentImage = null;
  let pendingImage = null;
  let requestedScene = null;
  let previewImage = null;
  let pendingPreviewImage = null;
  let previewCanvas = null;
  let previewKey = "";
  let generation = 0;
  let disposed = false;
  let ready = false;
  let contextLost = false;
  let inactive = false;
  let frame = 0;
  let previousTime = 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const frozen = () => !ready || inactive || contextLost || reducedMotion.matches || document.hidden || disposed;

  function stop() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
  }

  function render() {
    if (ready && state && renderer) renderer.render(state);
  }

  function addEffect(x, y, kind, power = 1) {
    state.effects.push({ x, y, start: state.elapsed, kind, power });
    state.effects = state.effects.slice(-8);
  }

  function action() {
    state.actionFrom = [...state.pose];
    state.actionStart = state.elapsed;
    state.actionCount += 1;
    state.cueIndex = 0;
    state.nextAction = state.elapsed + (state.scene.timing?.interval ?? 7.5);
    host.dataset.actionCount = String(state.actionCount);
  }

  function update(delta) {
    state.elapsed += delta;
    if (state.elapsed >= state.nextAction) action();
    const scene = state.scene;
    const ambient = scene.ambient;
    if (ambient && state.elapsed >= state.nextAmbient) {
      addEffect(ambient.x, ambient.y, propKinds[scene.propType] || ambient.kind, 0.7);
      state.nextAmbient = state.elapsed + ambient.interval;
    }
    state.effects = state.effects.filter((effect) => state.elapsed - effect.start < 3.8);
    calculatePose(state);
    if (scene.id === "05") {
      const times = [0.17, 0.38, 0.59];
      while (state.cueIndex < times.length && state.phase >= times[state.cueIndex]) {
        const [x, y] = scene.mouth;
        addEffect(x, y + 0.009, 1, 0.8);
        state.cueIndex += 1;
      }
    }
    if (scene.collection === 2 && state.phase >= 0.3 && state.cueIndex === 0) {
      addEffect(ambient?.x ?? scene.prop[0], ambient?.y ?? scene.prop[1], propKinds[scene.propType] || 7, 0.85);
      state.cueIndex = 1;
    }
    render();
  }

  function tick(now) {
    frame = 0;
    if (frozen()) return;
    update(Math.min((now - previousTime) / 1000, 0.05));
    previousTime = now;
    frame = window.requestAnimationFrame(tick);
  }

  function syncPlayback() {
    stop();
    host.dataset.motion = frozen() ? "paused" : "running";
    if (state) host.dataset.elapsed = state.elapsed.toFixed(3);
    if (!frozen()) {
      previousTime = performance.now();
      frame = window.requestAnimationFrame(tick);
    }
  }

  function cancelPendingPreview() {
    if (!pendingPreviewImage) return;
    pendingPreviewImage.onload = null;
    pendingPreviewImage.onerror = null;
    pendingPreviewImage.src = "";
    pendingPreviewImage = null;
  }

  function layoutPreview() {
    if (!requestedScene) return;
    const viewportWidth = Math.max(1, host.clientWidth);
    const viewportHeight = Math.max(1, host.clientHeight);
    const view = getSceneView(requestedScene, viewportWidth, viewportHeight);
    const [left, top, width, height] = view;
    const overflow = left < 0 || top < 0 || left + width > 1 || top + height > 1;
    const key = `${requestedScene.id}:${viewportWidth}:${viewportHeight}`;
    if (previewKey === key) return;
    if (overflow && previewImage) {
      previewCanvas ||= document.createElement("canvas");
      const dataUrl = paintClampedPreview(previewCanvas, previewImage, view, viewportWidth, viewportHeight);
      if (dataUrl) {
        preview.style.left = "0";
        preview.style.top = "0";
        preview.style.width = "100%";
        preview.style.height = "100%";
        preview.style.backgroundImage = `url("${dataUrl}")`;
        host.dataset.previewMode = "edge-clamp";
        previewKey = key;
        return;
      }
    }
    preview.style.left = `${-left / width * 100}%`;
    preview.style.top = `${-top / height * 100}%`;
    preview.style.width = `${100 / width}%`;
    preview.style.height = `${100 / height}%`;
    const url = `/personalized-home-2-0/asset/themes/previews/${requestedScene.id}.webp`;
    preview.style.backgroundImage = `url("${url}")`;
    host.dataset.previewMode = "image";
    if (!overflow) {
      cancelPendingPreview();
      previewKey = key;
      return;
    }
    if (!pendingPreviewImage && !previewImage) {
      const token = generation;
      const scene = requestedScene;
      const image = new Image();
      pendingPreviewImage = image;
      image.decoding = "async";
      image.onload = () => {
        if (disposed || token !== generation || requestedScene !== scene) return;
        pendingPreviewImage = null;
        image.onload = null;
        image.onerror = null;
        previewImage = image;
        previewKey = "";
        layoutPreview();
      };
      image.onerror = () => {
        if (disposed || token !== generation) return;
        pendingPreviewImage = null;
        image.onload = null;
        image.onerror = null;
        previewKey = key;
      };
      image.src = url;
    }
  }

  function resize() {
    if (disposed) return;
    layoutPreview();
    if (!renderer || contextLost) return;
    renderer.resize();
    render();
  }

  function handlePointer(event) {
    // The scroll surface sits above the artwork. Listen on the canvas's own
    // homepage region and let controls keep their normal pointer behavior.
    if (event.target.closest(".home-content, .corner-tools, .corner-promotion, .page-indicator")) return;
    if (event.button !== 0 || frozen()) return;
    const bounds = canvas.getBoundingClientRect();
    const [x, y] = renderer.toArt(event.clientX - bounds.left, event.clientY - bounds.top);
    const paddingX = 7 / Math.max(1, bounds.width) * renderer.view[2];
    const paddingY = 7 / Math.max(1, bounds.height) * renderer.view[3];
    const scene = state.scene;
    const cat = scene.cat;
    const prop = scene.prop;
    if (x >= cat[0] - paddingX && x <= cat[0] + cat[2] + paddingX
      && y >= cat[1] - paddingY && y <= cat[1] + cat[3] + paddingY) {
      action();
    } else if (prop?.[2] > 0 && Math.abs(x - prop[0]) <= prop[2] + paddingX
      && Math.abs(y - prop[1]) <= prop[3] + paddingY) {
      state.propActionStart = state.elapsed;
      state.environmentCount += 1;
      action();
      addEffect(scene.ambient?.x ?? prop[0], scene.ambient?.y ?? prop[1], propKinds[scene.propType] || 7, 1.15);
    } else if (scene.environment === "water" && scene.waterPolygon
      && !insidePolygon(x, y, scene.waterPolygon)) {
      action();
    } else {
      state.environmentCount += 1;
      addEffect(x, scene.environment === "line" ? scene.surface : y,
        propKinds[scene.propType] || environmentKinds[scene.environment] || 7);
    }
    host.dataset.environmentCount = String(state.environmentCount);
    calculatePose(state);
    render();
  }

  function fail(error) {
    ready = false;
    stop();
    host.dataset.status = "unavailable";
    host.dataset.hasFrame = "false";
    host.dataset.motion = "paused";
    host.dataset.error = error?.message || "Theme renderer unavailable";
    delete host.dataset.renderedTheme;
    // The underlying preview is already cleaned by the same shader. Never expose the source PNG.
  }

  function handleContextLost(event) {
    event.preventDefault();
    contextLost = true;
    stop();
    host.dataset.hasFrame = "false";
    host.dataset.status = "unavailable";
    host.dataset.motion = "paused";
  }

  function handleContextRestored() {
    if (disposed) return;
    contextLost = false;
    renderer?.dispose();
    try {
      renderer = new ArtRenderer(canvas);
      if (state && currentImage) {
        renderer.setScene(state.scene, currentImage);
        ready = true;
        render();
        host.dataset.hasFrame = "true";
        host.dataset.status = "ready";
        host.dataset.renderedTheme = `scene-${state.scene.id}`;
        delete host.dataset.error;
      }
      syncPlayback();
    } catch (error) { fail(error); }
  }

  const observer = new ResizeObserver(resize);
  const pointerSurface = host.closest(".home") || canvas;
  pointerSurface.addEventListener("pointerdown", handlePointer, { passive: true });
  canvas.addEventListener("webglcontextlost", handleContextLost);
  canvas.addEventListener("webglcontextrestored", handleContextRestored);
  reducedMotion.addEventListener("change", syncPlayback);
  document.addEventListener("visibilitychange", syncPlayback);
  window.addEventListener("resize", resize);
  observer.observe(host);
  try { renderer = new ArtRenderer(canvas); } catch (error) { fail(error); }

  function cancelPending() {
    if (!pendingImage) return;
    pendingImage.onload = null;
    pendingImage.onerror = null;
    pendingImage.src = "";
    pendingImage = null;
  }

  return {
    setActive(active) { inactive = !active; syncPlayback(); },
    load(scene) {
      const token = ++generation;
      cancelPending();
      cancelPendingPreview();
      previewImage = null;
      previewKey = "";
      if (previewCanvas) previewCanvas.width = previewCanvas.height = 0;
      requestedScene = scene;
      resize();
      if (disposed || !renderer) {
        host.dataset.status = "fallback";
        return () => {};
      }
      host.dataset.status = "loading";
      delete host.dataset.error;
      const image = new Image();
      pendingImage = image;
      image.decoding = "async";
      image.onload = () => {
        if (disposed || token !== generation) return;
        pendingImage = null;
        image.onload = null;
        image.onerror = null;
        try {
          stop();
          state = makeState(scene);
          currentImage = image;
          calculatePose(state);
          if (contextLost) return;
          renderer.setScene(scene, image);
          ready = true;
          render();
          host.dataset.renderedTheme = `scene-${scene.id}`;
          host.dataset.status = "ready";
          host.dataset.hasFrame = "true";
          host.dataset.actionCount = "0";
          host.dataset.environmentCount = "0";
          syncPlayback();
        } catch (error) { fail(error); }
      };
      image.onerror = () => {
        if (disposed || token !== generation) return;
        pendingImage = null;
        image.onload = null;
        image.onerror = null;
        fail(new Error("Theme artwork could not be loaded"));
      };
      image.src = scene.image;
      return () => {
        if (token === generation) {
          generation += 1;
          cancelPending();
          cancelPendingPreview();
        }
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation += 1;
      stop();
      cancelPending();
      cancelPendingPreview();
      observer.disconnect();
      pointerSurface.removeEventListener("pointerdown", handlePointer);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      reducedMotion.removeEventListener("change", syncPlayback);
      document.removeEventListener("visibilitychange", syncPlayback);
      window.removeEventListener("resize", resize);
      renderer?.dispose();
      renderer = null;
      currentImage = null;
      requestedScene = null;
      previewImage = null;
      if (previewCanvas) previewCanvas.width = previewCanvas.height = 0;
      previewCanvas = null;
      preview.style.backgroundImage = "";
      state = null;
    },
  };
}

function ThemeCanvas({ theme, active }) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const previewRef = useRef(null);
  const backgroundRef = useRef(null);

  useLayoutEffect(() => {
    const background = createBackground(canvasRef.current, hostRef.current, previewRef.current);
    backgroundRef.current = background;
    return () => {
      background.dispose();
      backgroundRef.current = null;
    };
  }, []);

  useEffect(() => backgroundRef.current?.load(theme.scene), [theme.scene]);
  useEffect(() => backgroundRef.current?.setActive(active), [active]);

  return (
    <div
      ref={hostRef}
      className="illustrated-theme-background"
      data-theme-id={theme.id}
      data-has-frame="false"
      style={{ backgroundColor: theme.scene.bg }}
      aria-hidden="true"
    >
      <div
        ref={previewRef}
        className="illustrated-theme-preview"
        style={{ backgroundImage: `url("/personalized-home-2-0/asset/themes/previews/${theme.scene.id}.webp")` }}
      />
      <canvas ref={canvasRef} className="illustrated-theme-canvas" />
    </div>
  );
}

export default function ThemeBackground({ theme, active = true }) {
  return theme?.scene ? <ThemeCanvas theme={theme} active={active} /> : null;
}
