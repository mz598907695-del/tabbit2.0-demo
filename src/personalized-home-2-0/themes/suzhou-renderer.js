import { TERM_CHARS, rgba, seasonState } from './suzhou-season.js';
import { buildFront, buildLightMask, computeLayout, drawCalligraphy, drawDust, noiseTile } from './suzhou-front.js';
import { makeCanvas } from './suzhou-kit.js';
import { createScene } from './suzhou-scene.js';
import { createFlora } from './suzhou-flora.js';

// 园林四时 — a lattice window in a whitewashed Suzhou garden wall. Scrolling is a year
// passing outside: p = 0 is the spring equinox (peach blossom, willow, mist), 0.25 midsummer
// (lotus), 0.5 the autumn equinox (maple and ginkgo, falling leaves), 0.75 midwinter (snow, ice,
// red plum) and p = 1 closes the loop at the equinox again. The picture is a pure function of
// (p, time): leaf, blossom and snow states come from fixed per-object thresholds, not from
// accumulated simulation, so scrolling back plays the year in reverse.
export function createSuzhouRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D unavailable');
  let W = 1, H = 1, scale = 1, disposed = false;
  let V = null, layoutKey = '', spriteKey = '', front = null, lightMask = null, plaster = null, paperPattern = null;
  let scene = null, flora = null, back = null, refl = null, reflOut = null, wash = null, view = null;
  const light = makeCanvas(2, 2), lightCtx = light.getContext('2d');
  const QUARTER = 0.5;

  const fontsReady = (typeof document !== 'undefined' && document.fonts)
    ? document.fonts.load('32px "LXGW WenKai Lite"', TERM_CHARS).then(() => {}).catch(() => {})
    : Promise.resolve();

  function resize(w, h, dpr = 1) {
    W = w; H = h;
    scale = Math.min(2, dpr, Math.sqrt(3200000 / (w * h)));
    canvas.width = Math.max(1, Math.round(w * scale)); canvas.height = Math.max(1, Math.round(h * scale));
    layoutKey = ''; spriteKey = '';
  }

  function ensure(avoidHalf) {
    const key = `${W}|${H}|${scale}|${Math.round(avoidHalf / 12)}`;
    if (key === layoutKey) return;
    layoutKey = key;
    V = computeLayout(W, H, avoidHalf);
    plaster ??= noiseTile(192, 5, 30, false);
    paperPattern ??= ctx.createPattern(noiseTile(256, 9, 22, true), 'repeat');
    front = buildFront(V, scale, plaster);
    lightMask = buildLightMask(V, front.cuts, QUARTER);
    light.width = lightMask.canvas.width; light.height = lightMask.canvas.height;
    const k = V.sc * scale, sk = `${W}|${H}|${scale}|${V.ww.toFixed(1)}`;
    if (sk !== spriteKey) {
      spriteKey = sk;
      scene = createScene(k); flora = createFlora(k);
    }
    back = makeCanvas(V.ww * scale, V.wh * scale);
    refl = makeCanvas(back.width / 2, back.height / 2);
    reflOut = makeCanvas(back.width, back.height);
    wash = makeCanvas(back.width / 4, back.height / 4);
    // the scene rectangle that the pane shows (scene units)
    view = { k, x0: V.sceneX - V.ww / (2 * V.sc), y0: V.sceneY - V.wh / (2 * V.sc), w: V.ww / V.sc, h: V.wh / V.sc, refl };
  }

  function render({ p, time, layout }) {
    if (disposed) return;
    ensure(layout?.avoidHalf ?? 350);
    p = Math.min(1, Math.max(0, p));
    const g = ctx, S = seasonState(p), k = view.k, rect = [view.x0, view.y0, view.x0 + view.w, view.y0 + view.h];
    // 1. everything above the waterline, into the offscreen sheet (also the mirror source)
    const b = back.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, back.width, back.height);
    b.setTransform(k, 0, 0, k, -view.x0 * k, -view.y0 * k);
    scene.drawBack(b, S, time, flora);
    const rc = refl.getContext('2d');
    rc.imageSmoothingQuality = 'medium';
    rc.clearRect(0, 0, refl.width, refl.height); rc.drawImage(back, 0, 0, refl.width, refl.height);
    // 2. the pane: pond, then the sheet over it, then lotus and near plants
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.setTransform(k, 0, 0, k, (V.cx - V.sceneX * V.sc) * scale, (V.cy - V.sceneY * V.sc) * scale);
    scene.drawWaterBody(g, S);
    const ro = reflOut.getContext('2d');
    ro.setTransform(1, 0, 0, 1, 0, 0); ro.clearRect(0, 0, reflOut.width, reflOut.height);
    ro.setTransform(k, 0, 0, k, -view.x0 * k, -view.y0 * k);
    g.globalAlpha = scene.drawReflection(ro, S, time, view);
    g.drawImage(reflOut, view.x0, view.y0, view.w, view.h);
    g.globalAlpha = 1;
    scene.drawWaterSurface(g, S, time);
    g.drawImage(back, view.x0, view.y0, view.w, view.h);
    scene.drawFloating(g, S, time);
    scene.drawGround(g, S, time);
    flora.drawNear(g, S, time);
    flora.drawDragonflies(g, S, time);
    scene.drawRays(g, S, time);
    flora.drawAmbient(g, S, time, rect);
    // season grade over the whole pane
    g.globalCompositeOperation = 'multiply'; g.fillStyle = rgba(S.grade); g.fillRect(view.x0, view.y0, view.w, view.h);
    g.globalCompositeOperation = 'source-over';
    // watercolour: a soft copy of the pane laid over itself blurs hard edges like wet paint, and the
    // pane darkens a little towards the frame where the pigment pools
    const wc = wash.getContext('2d');
    wc.imageSmoothingQuality = 'medium';
    wc.drawImage(canvas, (V.cx - V.ww / 2) * scale, (V.cy - V.wh / 2) * scale, V.ww * scale, V.wh * scale, 0, 0, wash.width, wash.height);
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.globalAlpha = 0.24; g.drawImage(wash, V.cx - V.ww / 2, V.cy - V.wh / 2, V.ww, V.wh); g.globalAlpha = 1;
    const pool = g.createRadialGradient(V.cx, V.cy, V.wh * 0.3, V.cx, V.cy, V.wh * 0.72);
    pool.addColorStop(0, 'rgb(255,255,255)'); pool.addColorStop(1, 'rgb(206,204,196)');
    g.globalCompositeOperation = 'multiply'; g.fillStyle = pool; g.fillRect(V.cx - V.ww / 2, V.cy - V.wh / 2, V.ww, V.wh);
    g.globalCompositeOperation = 'source-over';
    // 3. the room: wall, frame, lattice, calligraphy, light
    g.drawImage(front.canvas, 0, 0, W, H);
    drawCalligraphy(g, V, p);
    lightCtx.globalCompositeOperation = 'copy'; lightCtx.drawImage(lightMask.canvas, 0, 0);
    lightCtx.globalCompositeOperation = 'source-in'; lightCtx.fillStyle = rgba(S.light); lightCtx.fillRect(0, 0, light.width, light.height);
    g.save(); g.globalAlpha = 0.42 * S.beam; g.drawImage(light, 0, 0, W, H); g.restore();
    drawDust(g, V, lightMask, time, S.light, S.beam);
    g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.45; g.fillStyle = paperPattern; g.fillRect(0, 0, W, H); g.restore();
  }

  return {
    resize, render,
    /** Resolves once the calligraphy font is available, so thumbnails are not drawn in a fallback face. */
    ready: fontsReady,
    dispose() { disposed = true; front = lightMask = scene = flora = back = refl = reflOut = wash = null; },
  };
}

