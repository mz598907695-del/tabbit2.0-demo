import { css, mulberry32 } from './canvas-kit.js';
import { clamp, createFullscreenProgram, createFullscreenTriangle, hexToRgb, lerp, mixRgb, smoothstep } from './gl-utils.js';
import { WORLD_FRAGMENT } from './airplane-world.js';
import { D2R, PI, curve, rgba, shape } from './airplane-kit.js';
import { drawWing, wingPath } from './airplane-wing.js';
import { buildGlass, drawGlass, drawShade } from './airplane-glass.js';

// 飞机舷窗: a whole flight seen through one cabin window. The cream wall, the window reveal and the
// acrylic pane are painted once and cached; the world outside is a WebGL2 shader (airplane-world.js);
// the wing (airplane-wing.js), glass reflections, scratches, frost and sun glare (airplane-glass.js)
// and the cabin light are Canvas 2D on top.
// Scroll progress p is the flight: boarding light at the runway end, take-off roll, rotation, climb
// through cloud, the edge of space, descent, a dusk approach over the city, touchdown and taxi.
// Every frame is a pure function of (p, time) — no state besides the optional window shade.
const rgb = hexToRgb;

// ---- Timeline ---------------------------------------------------------------------------
const P_TOUCH = 0.935;
const ALT = curve([[0, .0042], [.22, .0042], [.25, .012], [.275, .1], [.3, .35], [.34, 1.4], [.38, 3.7], [.42, 7], [.46, 12], [.5, 24], [.54, 52], [.575, 84], [.61, 80],
  [.64, 52], [.68, 24], [.71, 9], [.74, 4.6], [.77, 3], [.8, 1.6], [.84, .8], [.88, .3], [.905, .11], [.925, .016], [.935, .0042], [1, .0042]]);
const GROUND_SPEED = curve([[0, 0], [.07, 0], [.12, .8], [.18, 3.5], [.245, 7.5], [.3, 9], [.4, 12], [.5, 14], [.7, 14], [.8, 11], [.87, 9], [.92, 7.5], [.96, 2.2], [.985, .35], [1, 0]]);
const PITCH = curve([[0, 0], [.22, 0], [.26, 9], [.3, 13], [.36, 9], [.42, 5], [.47, 2], [.58, 1], [.64, -1], [.7, -4], [.76, -4], [.84, -3], [.9, -2.4], [.925, 3], [.945, 1.5], [.965, -.2], [1, 0]]);
const ROLL = curve([[0, 4], [.22, 4], [.3, 6], [.4, 5], [.5, 5], [.58, 8], [.64, 8], [.7, 9], [.8, 12], [.86, 11], [.91, 7], [.94, 3], [1, 5]]);
const SUN_EL = curve([[0, 3.4], [.07, 4.6], [.22, 8], [.3, 11], [.45, 20], [.56, 23], [.65, 17], [.72, 8], [.78, 1.4], [.83, -2.6], [.9, -7.5], [1, -9]]);
const FLAP = curve([[0, .38], [.34, .38], [.42, 0], [.72, 0], [.78, .35], [.84, .7], [.88, 1], [.96, 1], [.99, .3], [1, .3]]);
const SPOILER = curve([[0, 0], [.934, 0], [.945, 1], [.985, 1], [1, 0]]);
const VIBRATION = curve([[0, .22], [.07, .3], [.15, .75], [.22, 1], [.27, .55], [.31, .35], [.34, .9], [.4, .9], [.43, .15], [.6, .08], [.68, .12], [.73, .35], [.77, .85], [.82, .3], [.9, .35], [.93, .5], [.945, .9], [.98, .3], [1, .15]]);
const COVER = curve([[0, .48], [.5, .62], [1, .5]]);
const HAZE = curve([[0, .9], [.12, .8], [.3, .4], [.42, .1], [.6, 0], [.7, .1], [.8, .3], [.9, .4], [1, .5]]);

// Ground distance flown (km). Visual speed grows with altitude so the scenery keeps pace with the scroll.
const DIST_STEPS = 1024;
const distTable = new Float32Array(DIST_STEPS + 1);
for (let i = 1, total = 0; i <= DIST_STEPS; i++) {
  const speed = p => GROUND_SPEED(p) + 3.4 * ALT(p);
  total += (speed((i - 1) / DIST_STEPS) + speed(i / DIST_STEPS)) / 2 / DIST_STEPS;
  distTable[i] = total;
}
const distance = p => {
  const x = clamp(p) * DIST_STEPS, i = Math.min(DIST_STEPS - 1, Math.floor(x));
  return lerp(distTable[i], distTable[i + 1], x - i);
};
const LAND_KM = distance(P_TOUCH) - 0.5;

// Sky and light palettes by sun elevation (degrees): zenith, horizon, horizon glow, sun, ambient.
const LOOKS = [
  { se: -12, zen: '#030518', hor: '#122044', glow: '#000000', sun: '#000000', amb: '#0b1124' },
  { se: -7, zen: '#0a1236', hor: '#46508a', glow: '#3a1f33', sun: '#000000', amb: '#1c2650' },
  { se: -3, zen: '#17275f', hor: '#d98a7a', glow: '#e0582a', sun: '#331a10', amb: '#46507a' },
  { se: 1.5, zen: '#29478a', hor: '#ffae78', glow: '#ff8a2e', sun: '#ff9a50', amb: '#6a6f92' },
  { se: 6, zen: '#3a68b4', hor: '#ffd6a2', glow: '#ffa24a', sun: '#ffd08c', amb: '#8590b0' },
  { se: 14, zen: '#3470c4', hor: '#cfdff2', glow: '#4a3a24', sun: '#ffe6bc', amb: '#92a8cc' },
  { se: 30, zen: '#2a68c8', hor: '#b4d2f2', glow: '#000000', sun: '#fff2d6', amb: '#98b0d6' },
].map(look => ({ ...look, zen: rgb(look.zen), hor: rgb(look.hor), glow: rgb(look.glow), sun: rgb(look.sun), amb: rgb(look.amb) }));
function look(se, out) {
  let i = 0;
  while (i < LOOKS.length - 2 && se > LOOKS[i + 1].se) i++;
  const a = LOOKS[i], b = LOOKS[i + 1], t = clamp((se - a.se) / (b.se - a.se));
  for (const key of ['zen', 'hor', 'glow', 'sun', 'amb']) out[key] = mixRgb(a[key], b[key], t);
}

// Everything the frame needs, recomputed in place each render.
const FLEX = curve([[0, -.12], [.24, -.1], [.3, .5], [.5, .78], [.7, .7], [.9, .5], [.935, .15], [.95, -.12], [1, -.12]]);
const S = { zen: null, hor: null, glow: null, sun: null, amb: null };
function story(p) {
  S.p = p;
  S.alt = ALT(p); S.dist = distance(p); S.altM = S.alt * 1000;
  S.pitch = PITCH(p) * D2R; S.roll = ROLL(p) * D2R;
  S.side = -Math.min(1700 * S.alt, 2200) * smoothstep(.68, .76, p) * (1 - smoothstep(P_TOUCH, P_TOUCH + .02, p));
  S.se = SUN_EL(p);
  look(S.se, S);
  S.flap = FLAP(p); S.spoiler = SPOILER(p); S.vib = VIBRATION(p); S.flex = FLEX(p);
  S.cover = COVER(p); S.haze = HAZE(p);
  S.space = smoothstep(14, 58, S.alt);
  S.lights = 1 - smoothstep(3, 13, S.se);
  S.fog = smoothstep(1.4, 2.1, S.alt) * (1 - smoothstep(3.1, 3.9, S.alt));      // inside the cloud deck
  S.stars = Math.max(S.space, smoothstep(-2, -9, S.se) * .9);
  S.sunVis = smoothstep(-7, -2, S.se);
  S.frost = smoothstep(8, 30, S.alt);
  // how bright it is outside (drives cabin reflections and spill light)
  S.day = smoothstep(-6, 8, S.se);
  S.lum = clamp((.2 + .8 * S.day) * (1 - .4 * S.space) + S.fog * .6);
}

// ---- Layout ----------------------------------------------------------------------------
function layoutWindow(W, H) {
  const margin = Math.max(W * .05, 56);
  const OW = Math.min(H * .9 * .72, W - margin * 1.6);
  const OH = Math.min(H * .9, OW / .5);
  const cx = Math.max(W - margin - OW / 2, OW / 2 + margin * .5), cy = H / 2;
  const t = OW * .1;                       // reveal thickness
  const ro = OW * .45;
  return { cx, cy, OW, OH, ro, t, gw: OW - 2 * t, gh: OH - 2 * t, rg: Math.max(ro - t * .8, 8), F: (OH - 2 * t) * .866 };
}

// ---- Renderer --------------------------------------------------------------------------
export function createAirplaneRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D unavailable');
  const rand = mulberry32(737);

  const glCanvas = document.createElement('canvas');
  let gl = glCanvas.getContext('webgl2', { alpha: false, depth: false, stencil: false, antialias: false });
  let program, geometry, uniforms;
  if (gl) {
    try {
      program = createFullscreenProgram(gl, WORLD_FRAGMENT);
      geometry = createFullscreenTriangle(gl);
      const names = ['uRes', 'uF', 'uC', 'uTime', 'uAlt', 'uDist', 'uSide', 'uAtt', 'uSun', 'uZen', 'uHor', 'uGlowC', 'uSunC', 'uAmb', 'uLimb',
        'uBlur', 'uBlurN', 'uCover', 'uLights', 'uFog', 'uLand', 'uHaze', 'uStars', 'uSunVis'];
      uniforms = Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, name)]));
    } catch { gl = null; }
  }

  let W = 1, H = 1, scale = 1, L = layoutWindow(1, 1), disposed = false;
  let frame = null, glass = null;      // cached wall + window frame, cached pane layers
  let bloom = null;                    // three shrinking copies of the world for the highlight glow
  let shade = 0, shadeTarget = 0, lastTime = null;   // the sliding shade is the only state: a click toggles it

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
    const g = c.getContext('2d');
    g.setTransform(scale, 0, 0, scale, 0, 0);
    return [c, g];
  }
  const grain = (() => {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 128;
    const g = tile.getContext('2d');
    const image = g.createImageData(128, 128);
    for (let i = 0; i < image.data.length; i += 4) { const v = rand() > .5 ? 255 : 0; image.data[i] = image.data[i + 1] = image.data[i + 2] = v; image.data[i + 3] = 255; }
    g.putImageData(image, 0, 0);
    return ctx.createPattern(tile, 'repeat');
  })();

  function resize(w, h, dpr = 1) {
    W = w; H = h;
    scale = Math.min(1.5, dpr, Math.sqrt(2000000 / (w * h)));
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    L = layoutWindow(w, h);
    glCanvas.width = Math.max(1, Math.round(L.gw * scale));
    glCanvas.height = Math.max(1, Math.round(L.gh * scale));
    frame = buildFrame();
    glass = buildGlass(makeCanvas, L, mulberry32(4242));
    bloom = [2, 4, 8].map(k => {
      const c = document.createElement('canvas');
      c.width = Math.max(2, Math.round(glCanvas.width / k)); c.height = Math.max(2, Math.round(glCanvas.height / k));
      return [c, c.getContext('2d')];
    });
  }

  // ---- cabin wall and window frame (cached) ----
  function buildFrame() {
    const [c, g] = makeCanvas(W, H);
    const { cx, cy, OW, OH, ro, t, gw, gh, rg } = L;
    // wall: soft plastic, lit from the overhead cove
    const wall = g.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, '#e6e0d2'); wall.addColorStop(.4, '#d2cbbb'); wall.addColorStop(1, '#a9a291');
    g.fillStyle = wall; g.fillRect(0, 0, W, H);
    const key = g.createRadialGradient(cx - OW * 1.3, -H * .1, 0, cx - OW * 1.3, -H * .1, Math.max(W, H) * .95);
    key.addColorStop(0, 'rgba(255,238,208,.5)'); key.addColorStop(1, 'rgba(255,238,208,0)');
    g.fillStyle = key; g.fillRect(0, 0, W, H);
    // panel seams: a recessed groove with a bevelled lip
    const groove = (pos, vertical) => {
      const len = vertical ? H : W;
      g.save();
      if (vertical) g.translate(pos, 0); else { g.translate(0, pos); g.rotate(-PI / 2); g.scale(-1, 1); g.translate(0, 0); }
      let grad = g.createLinearGradient(-9, 0, 0, 0);
      grad.addColorStop(0, 'rgba(30,24,16,0)'); grad.addColorStop(1, 'rgba(30,24,16,.16)');
      g.fillStyle = grad; g.fillRect(-9, 0, 9, len);
      g.fillStyle = 'rgba(30,24,16,.42)'; g.fillRect(-.4, 0, 1.4, len);
      g.fillStyle = 'rgba(255,252,242,.7)'; g.fillRect(1, 0, 1, len);
      grad = g.createLinearGradient(2, 0, 9, 0);
      grad.addColorStop(0, 'rgba(255,252,242,.12)'); grad.addColorStop(1, 'rgba(255,252,242,0)');
      g.fillStyle = grad; g.fillRect(2, 0, 7, len);
      g.restore();
    };
    const sx0 = cx - OW / 2 - OW * .26, sx1 = cx + OW / 2 + OW * .2;
    groove(sx0, true); if (sx1 < W - 8) groove(sx1, true);
    g.save(); g.fillStyle = 'rgba(30,24,16,.4)'; g.fillRect(0, H * .06, W, 1.4); g.fillStyle = 'rgba(255,252,242,.65)'; g.fillRect(0, H * .06 + 1.4, W, 1); g.restore();
    g.save(); g.fillStyle = 'rgba(30,24,16,.4)'; g.fillRect(0, H * .945, W, 1.4); g.fillStyle = 'rgba(255,252,242,.55)'; g.fillRect(0, H * .945 + 1.4, W, 1); g.restore();
    const floor = g.createLinearGradient(0, H * .945, 0, H);
    floor.addColorStop(0, 'rgba(30,26,20,.22)'); floor.addColorStop(1, 'rgba(30,26,20,.5)');
    g.fillStyle = floor; g.fillRect(0, H * .945 + 2.4, W, H * .055);

    // bezel: contact shadow, convex lip, flat ring
    g.save();
    g.shadowColor = 'rgba(40,30,18,.5)'; g.shadowBlur = OW * .1 * scale; g.shadowOffsetY = OW * .02 * scale;
    shape(g, cx, cy, OW, OH, ro); g.fillStyle = '#cfc8b8'; g.fill();
    g.restore();
    const lip = g.createLinearGradient(cx - OW / 2, cy - OH / 2, cx + OW / 2, cy + OH / 2);
    lip.addColorStop(0, '#f6f2e8'); lip.addColorStop(.45, '#e2dccd'); lip.addColorStop(1, '#a9a290');
    shape(g, cx, cy, OW, OH, ro); g.fillStyle = lip; g.fill();
    const edge = g.createLinearGradient(cx - OW / 2, cy - OH / 2, cx + OW / 2, cy + OH / 2);
    edge.addColorStop(0, 'rgba(255,255,250,.9)'); edge.addColorStop(.5, 'rgba(255,255,250,0)'); edge.addColorStop(.52, 'rgba(60,50,36,0)'); edge.addColorStop(1, 'rgba(60,50,36,.45)');
    g.lineWidth = 3; g.strokeStyle = edge; shape(g, cx, cy, OW - 3, OH - 3, ro - 1.5); g.stroke();
    const a0 = OW * .016;
    const ring = g.createLinearGradient(cx - OW / 2, cy - OH / 2, cx + OW / 2, cy + OH / 2);
    ring.addColorStop(0, '#ebe6d9'); ring.addColorStop(1, '#bdb6a4');
    shape(g, cx, cy, OW - a0 * 2, OH - a0 * 2, ro - a0); g.fillStyle = ring; g.fill();

    // recessed reveal: many thin rings fade from lit rim to dark throat, then directional light
    const a1 = OW * .04, steps = 16;
    for (let i = 0; i < steps; i++) {
      const k = i / (steps - 1), inset = lerp(a1, t, k), next = lerp(a1, t, (i + 1) / (steps - 1));
      g.lineWidth = Math.max(1, next - inset + 1.2);
      const tone = 214 - 78 * Math.pow(k, .8);
      g.strokeStyle = `rgb(${tone},${tone - 5},${tone - 16})`;
      shape(g, cx, cy, OW - inset * 2 - g.lineWidth, OH - inset * 2 - g.lineWidth, Math.max(ro - inset - g.lineWidth / 2, 4)); g.stroke();
    }
    g.save();
    shape(g, cx, cy, OW - a1 * 2, OH - a1 * 2, ro - a1); g.clip();
    const top = g.createLinearGradient(0, cy - OH / 2, 0, cy - OH / 2 + t * 2.6);
    top.addColorStop(0, 'rgba(36,28,18,.62)'); top.addColorStop(1, 'rgba(36,28,18,0)');
    g.fillStyle = top; g.fillRect(cx - OW / 2, cy - OH / 2, OW, t * 2.6);
    const bottom = g.createLinearGradient(0, cy + OH / 2 - t * 2.4, 0, cy + OH / 2);
    bottom.addColorStop(0, 'rgba(255,248,230,0)'); bottom.addColorStop(1, 'rgba(255,248,230,.5)');
    g.fillStyle = bottom; g.fillRect(cx - OW / 2, cy + OH / 2 - t * 2.4, OW, t * 2.4);
    const left = g.createLinearGradient(cx - OW / 2, 0, cx - OW / 2 + t * 2.2, 0);
    left.addColorStop(0, 'rgba(36,28,18,.4)'); left.addColorStop(1, 'rgba(36,28,18,0)');
    g.fillStyle = left; g.fillRect(cx - OW / 2, cy - OH / 2, t * 2.2, OH);
    const right = g.createLinearGradient(cx + OW / 2, 0, cx + OW / 2 - t * 2.2, 0);
    right.addColorStop(0, 'rgba(255,248,230,.3)'); right.addColorStop(1, 'rgba(255,248,230,0)');
    g.fillStyle = right; g.fillRect(cx + OW / 2 - t * 2.2, cy - OH / 2, t * 2.2, OH);
    g.restore();
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(40,32,20,.5)';
    shape(g, cx, cy, OW - a1 * 2, OH - a1 * 2, ro - a1); g.stroke();
    g.lineWidth = 1; g.strokeStyle = 'rgba(255,252,242,.55)';
    shape(g, cx, cy, OW - a1 * 2 - 3, OH - a1 * 2 - 3, ro - a1 - 1.5); g.stroke();
    // pane retainer ring, a thin satin-metal lip around the acrylic
    const rt = OW * .02;
    const metal = g.createLinearGradient(cx - gw / 2, cy - gh / 2, cx + gw / 2, cy + gh / 2);
    metal.addColorStop(0, '#f2eee3'); metal.addColorStop(.5, '#b9b2a2'); metal.addColorStop(1, '#6f695b');
    g.lineWidth = rt; g.strokeStyle = metal;
    shape(g, cx, cy, gw + rt, gh + rt, rg + rt / 2); g.stroke();
    g.lineWidth = 1; g.strokeStyle = 'rgba(20,16,10,.7)';
    shape(g, cx, cy, gw + rt * 2, gh + rt * 2, rg + rt); g.stroke();
    // moulded plastic grain
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = .03; g.fillStyle = grain; g.fillRect(0, 0, c.width, c.height);
    g.restore();

    // hole
    g.globalCompositeOperation = 'destination-out';
    shape(g, cx, cy, gw, gh, rg); g.fillStyle = '#000'; g.fill();
    g.globalCompositeOperation = 'source-over';
    // inner shadow cast onto the glass by the reveal
    g.save();
    shape(g, cx, cy, gw, gh, rg); g.clip();
    g.beginPath(); g.rect(cx - gw, cy - gh, gw * 2, gh * 2);
    shape(g, cx, cy, gw, gh, rg, true);
    g.shadowColor = 'rgba(4,6,12,.75)'; g.shadowBlur = gw * .08 * scale; g.shadowOffsetY = gh * .018 * scale;
    g.fillStyle = '#000'; g.fill('evenodd');
    g.restore();
    return c;
  }

  // ---- per frame ----
  const limbRgb = [.35, .62, 1];
  const wing = { paint: null, flex: 0, slat: 0 };
  const sunDir = [0, 0, 1], sunC = [0, 0, 0], ambC = [0, 0, 0], limbC = [0, 0, 0];
  const wingLight = [1, 1, 1];
  wing.paint = (k, a = 1) => rgba([.88 * wingLight[0], .9 * wingLight[1], .92 * wingLight[2]], a, k);

  function render({ p, time, still }) {
    if (disposed) return;
    const g = ctx;
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    story(p);
    const { cx, cy, gw, gh, rg, F } = L;
    const t = time;

    // ---- light ----
    const sunAz = 16 * D2R, sunEl = S.se * D2R;
    sunDir[0] = Math.sin(sunAz) * Math.cos(sunEl); sunDir[1] = Math.sin(sunEl); sunDir[2] = Math.cos(sunAz) * Math.cos(sunEl);
    const sunLevel = smoothstep(-.06, .3, sunDir[1]);
    for (let i = 0; i < 3; i++) {
      sunC[i] = S.sun[i] * (1.2 + .3 * (1 - S.space));
      ambC[i] = S.amb[i] * lerp(1, .55, S.space);
      limbC[i] = limbRgb[i] * lerp(.4, 1, sunLevel);
    }
    // the sun in the aircraft frame (inverse of the world rotation used by the shader)
    const cp = Math.cos(S.pitch), sp = Math.sin(S.pitch), cr = Math.cos(S.roll), sr = Math.sin(S.roll);
    const a1 = sunDir[0] * cp + sunDir[1] * sp, b1 = -sunDir[0] * sp + sunDir[1] * cp;
    const sunB = b1 * cr + sunDir[2] * sr, sunCz = -b1 * sr + sunDir[2] * cr;
    const sunX = sunCz > .05 ? cx + F * -a1 / sunCz : -9999, sunY = sunCz > .05 ? cy - F * sunB / sunCz : -9999;
    const ndl = Math.max(sunB, 0) * S.sunVis;

    // ---- shake: engine idle, rolling over joints, turbulence, the touchdown thump ----
    const tr = still ? 0 : S.vib;
    const dp = p - P_TOUCH;
    const bump = dp > 0 ? Math.exp(-dp / .006) * Math.sin(dp * 2600) : 0;
    const jx = tr * (Math.sin(t * 61.3 + 1.1) * .5 + Math.sin(t * 37.7 + 4.2) * .35 + Math.sin(t * 23.1) * .15) * .8;
    const jy = tr * (Math.sin(t * 71.9 + 2.3) * .5 + Math.sin(t * 43.3 + .7) * .35 + Math.sin(t * 19.7 + 5) * .15) * 1.3 + bump * 9;

    // ---- the world ----
    const blurM = GROUND_SPEED(p) * .45;
    g.save();
    shape(g, cx, cy, gw + 3, gh + 3, rg + 1.5); g.clip();
    if (gl && !gl.isContextLost()) {
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
      gl.useProgram(program); gl.bindVertexArray(geometry.vao);
      gl.uniform2f(uniforms.uRes, glCanvas.width, glCanvas.height);
      gl.uniform1f(uniforms.uF, F * scale);
      gl.uniform2f(uniforms.uC, (gw / 2 + jx) * scale, (gh / 2 - jy) * scale);
      gl.uniform1f(uniforms.uTime, time);
      gl.uniform1f(uniforms.uAlt, S.alt);
      gl.uniform1f(uniforms.uDist, S.dist);
      gl.uniform1f(uniforms.uSide, S.side);
      gl.uniform2f(uniforms.uAtt, S.pitch, S.roll);
      gl.uniform3f(uniforms.uSun, sunDir[0], sunDir[1], sunDir[2]);
      gl.uniform3fv(uniforms.uZen, S.zen); gl.uniform3fv(uniforms.uHor, S.hor); gl.uniform3fv(uniforms.uGlowC, S.glow);
      gl.uniform3fv(uniforms.uSunC, sunC); gl.uniform3fv(uniforms.uAmb, ambC); gl.uniform3fv(uniforms.uLimb, limbC);
      gl.uniform1f(uniforms.uBlur, blurM);
      gl.uniform1f(uniforms.uBlurN, clamp(Math.ceil(blurM * F / Math.max(S.altM, 22) / 5), 1, 12));
      gl.uniform1f(uniforms.uCover, S.cover);
      gl.uniform1f(uniforms.uLights, S.lights);
      gl.uniform1f(uniforms.uFog, S.fog);
      gl.uniform1f(uniforms.uLand, LAND_KM);
      gl.uniform1f(uniforms.uHaze, S.haze);
      gl.uniform1f(uniforms.uStars, S.stars);
      gl.uniform1f(uniforms.uSunVis, S.sunVis);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      g.drawImage(glCanvas, cx - gw / 2, cy - gh / 2, gw, gh);
      // highlight glow: shrink, square (keeps only the bright parts), add back softly
      let src = glCanvas;
      for (const [c, b] of bloom) { b.globalCompositeOperation = 'copy'; b.drawImage(src, 0, 0, c.width, c.height); src = c; }
      const [small, sg] = bloom[2];
      sg.globalCompositeOperation = 'multiply';
      sg.drawImage(small, 0, 0); sg.drawImage(small, 0, 0);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = .15;
      g.drawImage(small, cx - gw / 2, cy - gh / 2, gw, gh);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    } else {
      const sky = g.createLinearGradient(0, cy - gh / 2, 0, cy + gh / 2);
      sky.addColorStop(0, css(S.zen)); sky.addColorStop(.5, css(S.hor)); sky.addColorStop(1, css(mixRgb(S.hor, [.2, .25, .15], .6)));
      g.fillStyle = sky; g.fillRect(cx - gw / 2, cy - gh / 2, gw, gh);
    }

    // ---- the wing ----
    for (let i = 0; i < 3; i++) wingLight[i] = clamp(ambC[i] * .85 + sunC[i] * ndl * .75, 0, 1.08);
    wing.flex = S.flex + (still ? 0 : S.vib * .09 * (Math.sin(t * 3.1) * .6 + Math.sin(t * 8.3 + 1) * .4)) - bump * .4;
    wing.slat = smoothstep(.04, .2, S.flap);
    const lights = drawWing(g, {
      cx, cy: cy + jy * .25, F, flex: wing.flex, flap: S.flap, spoiler: S.spoiler, slat: wing.slat, paint: wing.paint,
      sheen: Math.max(ndl * 1.1, .4 * S.sunVis * (1 - S.space)), sheenColor: sunC, hazeColor: S.hor,
    });

    // strobe, navigation light, beacon wash
    const dark = clamp(.25 + .75 * (1 - S.lum * .85) + S.lights * .35);
    const ph = (t % 1.1) / 1.1;
    const strobe = still ? 0 : (ph < .045 ? 1 : 0) + (ph > .105 && ph < .15 ? 1 : 0);
    const beacon = still ? 0 : Math.max(0, 1 - Math.abs(((t % 1.6) / 1.6) - .5) * 14);   // slow red pulse on the fuselage
    g.save();
    wingPath(g); g.clip();
    g.globalCompositeOperation = 'lighter';
    if (strobe) {
      const wr = F * .55;
      const wash = g.createRadialGradient(lights.strobe[0], lights.strobe[1], 0, lights.strobe[0], lights.strobe[1], wr);
      wash.addColorStop(0, `rgba(235,244,255,${.5 * dark})`); wash.addColorStop(1, 'rgba(235,244,255,0)');
      g.fillStyle = wash; g.fillRect(lights.strobe[0] - wr, lights.strobe[1] - wr, wr * 2, wr * 2);
    }
    if (beacon > .02) {
      const br = F * .8, bx = cx - gw * .3, by = cy + gh * .55;
      const wash = g.createRadialGradient(bx, by, 0, bx, by, br);
      wash.addColorStop(0, `rgba(255,40,30,${.13 * beacon * dark})`); wash.addColorStop(1, 'rgba(255,40,30,0)');
      g.fillStyle = wash; g.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    g.restore();
    g.globalCompositeOperation = 'lighter';
    const nr = Math.max(3.5, lights.px * .3);
    let glow = g.createRadialGradient(lights.nav[0], lights.nav[1], 0, lights.nav[0], lights.nav[1], nr * 4);
    glow.addColorStop(0, `rgba(190,255,215,${dark})`); glow.addColorStop(.12, `rgba(60,255,120,${.75 * dark})`); glow.addColorStop(.4, `rgba(30,255,90,${.18 * dark})`); glow.addColorStop(1, 'rgba(20,255,80,0)');
    g.fillStyle = glow; g.fillRect(lights.nav[0] - nr * 4, lights.nav[1] - nr * 4, nr * 8, nr * 8);
    if (strobe) {
      const sr2 = Math.max(10, lights.px * 1.6);
      glow = g.createRadialGradient(lights.strobe[0], lights.strobe[1], 0, lights.strobe[0], lights.strobe[1], sr2 * 3);
      glow.addColorStop(0, `rgba(255,255,255,${dark})`); glow.addColorStop(.12, `rgba(235,244,255,${.6 * dark})`); glow.addColorStop(1, 'rgba(200,225,255,0)');
      g.fillStyle = glow; g.fillRect(lights.strobe[0] - sr2 * 3, lights.strobe[1] - sr2 * 3, sr2 * 6, sr2 * 6);
      // diffraction cross
      g.strokeStyle = `rgba(235,244,255,${.45 * dark})`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(lights.strobe[0] - sr2 * 2.2, lights.strobe[1]); g.lineTo(lights.strobe[0] + sr2 * 2.2, lights.strobe[1]);
      g.moveTo(lights.strobe[0], lights.strobe[1] - sr2 * 1.6); g.lineTo(lights.strobe[0], lights.strobe[1] + sr2 * 1.6); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';

    // fog veil over the wing while inside the cloud
    if (S.fog > .02) {
      const fc = mixRgb([.9, .93, .98], mixRgb(S.hor, [1, 1, 1], .5), .4);
      g.globalAlpha = Math.min(1, S.fog * 1.15) * .8;
      g.fillStyle = css(fc); g.fillRect(cx - gw / 2, cy - gh / 2, gw, gh);
      const off = -(S.dist * 900) % 512;
      g.globalAlpha = S.fog * .5;
      for (let x = off - 512; x < gw + 512; x += 512) g.drawImage(glass.streak, cx - gw / 2 + x, cy - gh / 2, 512, gh);
      g.globalAlpha = 1;
    }

    // ---- the shade ----
    const dtime = lastTime === null ? 0 : time - lastTime;
    lastTime = time;
    shade = dtime > 0 && dtime < .5 ? shade + (shadeTarget - shade) * (1 - Math.exp(-dtime * 6)) : shadeTarget;
    if (Math.abs(shade - shadeTarget) < .002) shade = shadeTarget;
    drawShade(g, L, shade, mixRgb(S.hor, [1, 1, 1], .35), .12 + .5 * S.lum * (1 - S.space * .6));

    // ---- the pane ----
    const sunDist = Math.hypot(sunX - cx, sunY - cy);
    const glare = S.sunVis * smoothstep(gh * 1.2, gh * .1, sunDist) * (.3 + .7 * smoothstep(0, 18, S.se)) * (1 - S.fog * .35);
    drawGlass(g, L, glass, {
      cx, cy, glare, sun: [sunX, sunY], sunColor: `${Math.round(clamp(S.sun[0] * 1.2) * 255)},${Math.round(clamp(S.sun[1] * 1.1 + .1) * 255)},${Math.round(clamp(S.sun[2] + .2) * 255)}`,
      frost: S.frost, frostLight: S.lum, reflect: (.16 + .55 * (1 - S.lum)) * (1 - S.fog * .7), fog: S.fog,
    });
    g.restore();

    // ---- the frame and cabin light ----
    g.drawImage(frame, 0, 0, W, H);
    g.save();
    g.beginPath(); g.rect(0, 0, W, H); shape(g, cx, cy, gw, gh, rg, true); g.clip('evenodd');
    g.globalCompositeOperation = 'lighter';
    const spill = g.createRadialGradient(cx, cy, L.OW * .35, cx, cy, L.OW * 1.5);
    const sc = mixRgb(S.hor, S.amb, .35);
    spill.addColorStop(0, rgba(sc, .22 * S.lum)); spill.addColorStop(1, rgba(sc, 0));
    g.fillStyle = spill; g.fillRect(0, 0, W, H);
    g.restore();
    g.save();
    // sunlight on the reveal: the lower and far side catch the beam
    g.beginPath(); shape(g, cx, cy, L.OW - L.OW * .07, L.OH - L.OW * .07, L.ro - L.OW * .035); shape(g, cx, cy, gw, gh, rg, true); g.clip('evenodd');
    g.globalCompositeOperation = 'lighter';
    const beam = clamp(ndl * 1.2 + S.fog * .3);
    const rb = g.createLinearGradient(0, cy + gh / 2 + L.t, 0, cy + gh / 2 - L.t * .6);
    rb.addColorStop(0, rgba(sunC, .6 * beam)); rb.addColorStop(1, rgba(sunC, 0));
    g.fillStyle = rb; g.fillRect(cx - L.OW / 2, cy + gh / 2 - L.t, L.OW, L.OH);
    const rr = g.createLinearGradient(cx + gw / 2 + L.t, 0, cx + gw / 2 - L.t * .6, 0);
    rr.addColorStop(0, rgba(sunC, .45 * beam)); rr.addColorStop(1, rgba(sunC, 0));
    g.fillStyle = rr; g.fillRect(cx + gw / 2 - L.t, cy - L.OH / 2, L.OW, L.OH);
    g.restore();

    // cabin light dims with the day outside; soft vignette; film grain
    g.save();
    g.beginPath(); g.rect(0, 0, W, H); shape(g, cx, cy, gw, gh, rg, true); g.clip('evenodd');
    g.fillStyle = `rgba(6,8,16,${.03 + .24 * (1 - S.lum)})`; g.fillRect(0, 0, W, H);
    g.restore();
    const vignette = g.createRadialGradient(W * .55, H * .5, Math.min(W, H) * .35, W * .55, H * .5, Math.max(W, H) * .8);
    vignette.addColorStop(0, 'rgba(6,8,16,0)'); vignette.addColorStop(1, 'rgba(6,8,16,.4)');
    g.fillStyle = vignette; g.fillRect(0, 0, W, H);
    g.save(); g.globalAlpha = .012; g.fillStyle = grain; g.fillRect(0, 0, W, H); g.restore();
  }

  // A click on the window lowers or raises the shade.
  function pointer({ x, y }) {
    if (Math.abs(x - L.cx) < L.OW / 2 && Math.abs(y - L.cy) < L.OH / 2) shadeTarget = shadeTarget > .5 ? 0 : 1;
  }

  return {
    resize, render, pointer,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (gl) {
        try { gl.deleteBuffer(geometry.buffer); gl.deleteVertexArray(geometry.vao); gl.deleteProgram(program); } catch { /* context already gone */ }
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    },
  };
}
