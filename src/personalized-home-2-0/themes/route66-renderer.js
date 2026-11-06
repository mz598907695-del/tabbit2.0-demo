import { NOISE_GLSL } from './glsl-common.js';
import { css, mod, mulberry32 } from './canvas-kit.js';
import { clamp, createFullscreenProgram, createFullscreenTriangle, hexToRgb, lerp, mixRgb, smoothstep } from './gl-utils.js';

// 66 号公路 — a drive down Route 66 seen from just behind the car. The car's size and
// position and the horizon never change; scroll progress is distance travelled, so the
// road bends, the roadside scrolls past and the light runs from desert sunset through
// mesa country and a neon town into a starry night. A shader paints sky, ridgelines and
// the receding ground (road, lines, scrub); Canvas 2D paints roadside objects and the car.
const PI = Math.PI;
const rgb = hexToRgb;

const TOTAL = 2600;          // units of road covered by a full scroll
const CAM_X = 1.85;          // camera / car sits in the right-hand lane
const LANE_EDGE = 3.45, SHOULDER = 4.7;
const D_NEAR = 4.5;          // ground distance at the bottom edge of the screen
const HORIZON = 0.55;        // horizon, as a fraction of the height from the top

// road curvature: two slow sines, shared by the shader and the object placement
const W1 = 2 * PI / 900, W2 = 2 * PI / 380, K1 = 0.0009, K2 = 0.0004, P1 = 0.7, P2 = 2.1;
function bendAt(d, travel) {
  const term = (k, w, ph) => k * (d * Math.cos(w * travel + ph) / w - (Math.sin(w * (travel + d) + ph) - Math.sin(w * travel + ph)) / (w * w));
  return term(K1, W1, P1) + term(K2, W2, P2);
}

// ---- Sky / light keyframes (progress → look) --------------------------------------
const KEYS = [
  { p: 0, sky: ['#ffd558', '#ffa534', '#f26c22', '#c9472e', '#7b3a5a'], glow: '#ffb84a', glowAmt: 1, clouds: 1, stars: 0, ambient: [1, 0.74, 0.52], night: 0 },
  { p: 0.25, sky: ['#ff8c3c', '#e8554c', '#a63d6f', '#5b2f7a', '#2a2358'], glow: '#ff7a50', glowAmt: 0.9, clouds: 1, stars: 0, ambient: [0.96, 0.6, 0.52], night: 0 },
  { p: 0.5, sky: ['#e35a5c', '#9b407c', '#533a88', '#2a3079', '#141b50'], glow: '#d8507a', glowAmt: 0.6, clouds: 0.9, stars: 0.12, ambient: [0.66, 0.5, 0.66], night: 0.25 },
  { p: 0.72, sky: ['#4c3c84', '#2c3074', '#171e5a', '#0b1138', '#050824'], glow: '#6a58b0', glowAmt: 0.22, clouds: 0.5, stars: 0.75, ambient: [0.32, 0.36, 0.6], night: 0.8 },
  { p: 1, sky: ['#242c68', '#131b52', '#0a1038', '#060a28', '#02041a'], glow: '#4a5aa0', glowAmt: 0.06, clouds: 0.25, stars: 1, ambient: [0.22, 0.28, 0.5], night: 1 },
].map(key => ({ ...key, sky: key.sky.map(rgb), glow: rgb(key.glow) }));
function lookAt(p) {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = smoothstep(a.p, b.p, p);
  return {
    sky: a.sky.map((c, k) => mixRgb(c, b.sky[k], t)), glow: mixRgb(a.glow, b.glow, t),
    glowAmt: lerp(a.glowAmt, b.glowAmt, t), clouds: lerp(a.clouds, b.clouds, t), stars: lerp(a.stars, b.stars, t),
    ambient: mixRgb(a.ambient, b.ambient, t), night: lerp(a.night, b.night, t),
  };
}
const mesaAmount = p => smoothstep(0.14, 0.34, p) * (1 - 0.65 * smoothstep(0.62, 0.8, p));

// ---- Backdrop shader ---------------------------------------------------------------
const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform vec2 uRes;
uniform float uDpr, uTime, uYH, uXV, uKx, uDNear, uTravel, uCamX, uNight, uMesa, uGlowAmt, uCloudAmt, uStars, uSunAlt, uScale;
uniform vec3 uSky[5];
uniform vec3 uGlow, uAmbient;
uniform vec2 uSun, uMoon;

${NOISE_GLSL}

const float W1 = ${W1.toFixed(9)}, W2 = ${W2.toFixed(9)};
const float K1 = ${K1}, K2 = ${K2}, P1 = ${P1}, P2 = ${P2};
float bend(float d) {
  float r = K1 * (d * cos(W1 * uTravel + P1) / W1 - (sin(W1 * (uTravel + d) + P1) - sin(W1 * uTravel + P1)) / (W1 * W1));
  return r + K2 * (d * cos(W2 * uTravel + P2) / W2 - (sin(W2 * (uTravel + d) + P2) - sin(W2 * uTravel + P2)) / (W2 * W2));
}

const float STOP[5] = float[5](0., .1, .3, .6, 1.);
vec3 skyTangent(int i) {
  if (i == 0) return (uSky[1] - uSky[0]) / (STOP[1] - STOP[0]);
  if (i == 4) return (uSky[4] - uSky[3]) / (STOP[4] - STOP[3]);
  return (uSky[i + 1] - uSky[i - 1]) / (STOP[i + 1] - STOP[i - 1]);
}
vec3 skyGradient(float s) {
  s = clamp(s, 0., 1.);
  int i = s < .1 ? 0 : s < .3 ? 1 : s < .6 ? 2 : 3;
  float dx = STOP[i + 1] - STOP[i];
  float u = (s - STOP[i]) / dx, u2 = u * u, u3 = u2 * u;
  return (2. * u3 - 3. * u2 + 1.) * uSky[i] + (u3 - 2. * u2 + u) * dx * skyTangent(i) * .8
       + (-2. * u3 + 3. * u2) * uSky[i + 1] + (u3 - u2) * dx * skyTangent(i + 1) * .8;
}
float stars(vec2 px) {
  return starLayer(px, 14., 0., .06, .5, uTime) * .4 + starLayer(px, 34., 1., .09, .62, uTime)
       + starLayer(px, 60., 2., .12, .8, uTime) * 1.1 + starLayer(px, 130., 3., .16, 1., uTime) * 1.5;
}
vec3 milkyWay(vec2 px) {
  vec2 q = (px / uRes.y * uDpr - vec2(.62, .22)) * vec2(1., -1.);
  float a = .62;
  vec2 r = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
  float band = exp(-r.y * r.y / .03);
  float cloud = fbm(vec2(r.x * 2.6, r.y * 8.) + 2.7);
  float dust = pow(hash21(floor(px * .8)), 38.) * band * 2.;
  vec3 tint = mix(vec3(.3, .4, .88), vec3(.82, .58, .86), cloud);
  return tint * band * (.25 + cloud * cloud) * .15 + vec3(.8, .86, 1.) * dust * .35;
}

// Mesa and mountain silhouettes on the horizon; flat, terraced tops as the desert turns to canyon country.
float ridgeH(float x, float seed, float scale) {
  float n = fbm(vec2(x / scale + uTravel * .0004 * (seed * .35 + .4), seed));
  float terrace = floor(n * 5.) / 5. + smoothstep(.0, .22, fract(n * 5.)) * .2;
  return mix(n * .55, terrace, uMesa);
}

vec3 skyColor(vec2 px) {
  float t = clamp((uYH - px.y) / uYH, 0., 1.);
  vec3 horizon = uSky[0];
  vec3 col = skyGradient(t);
  vec2 dS = (px - uSun) / uScale;
  float r = length(dS);

  float starAmt = uStars * smoothstep(.04, .3, t);
  if (starAmt > .003) col += (milkyWay(px) * uStars + vec3(.82, .88, 1.) * stars(px)) * starAmt;

  // Dark streaked clouds with their undersides lit by the low sun, as in a desert sunset.
  vec2 cp = vec2(px.x / uRes.y * uDpr * 1.6 - uTime * .004, pow(t, .55) * 5.2);
  float n = fbm(cp * vec2(1.1, 1.8) + vec2(3., 1.));
  float n2 = fbm(cp * vec2(3.2, 4.4) + vec2(9., 4.));
  float dens = smoothstep(.5, .74, n * .7 + n2 * .3) * smoothstep(.01, .12, t) * (1. - smoothstep(.55, .95, t) * .5);
  float lit = clamp(exp(-r / 420.) * 1.2 + exp(-t / .12) * .5, 0., 1.);
  vec3 body = mix(vec3(.2, .09, .17), vec3(.09, .06, .18), uNight) * (.7 + .3 * (1. - lit));
  vec3 rim = uGlow * (.5 + .9 * lit);
  float edge = smoothstep(.62, .44, n * .7 + n2 * .3);
  col = mix(col, mix(body, rim, edge * lit * uGlowAmt), dens * uCloudAmt * .88);

  // Sun and its bloom.
  float up = smoothstep(-.4, .1, uSunAlt / (40. * uScale));
  col += uGlow * (exp(-r / (90. * uScale)) * .75 + exp(-r / (330. * uScale)) * .32) * uGlowAmt;
  float edgeW = 1.5;
  col = mix(col, vec3(1., .9, .62) * 2., (1. - smoothstep(24. * uScale - edgeW, 24. * uScale + edgeW, r)) * up * (1. - dens * .8));
  // Glow along the horizon, centred on the sun.
  col += uGlow * exp(-t / .045) * exp(-abs(px.x - uSun.x) / (uRes.x / uDpr * .8)) * .55 * uGlowAmt;

  // Moon.
  vec2 mm = (px - uMoon) / uScale;
  float md = length(mm);
  float moon = 1. - smoothstep(18., 19.5, md);
  float craters = fbm(mm * .22 + 4.) * .35;
  col += vec3(.7, .75, 1.) * exp(-md / 70.) * .22 * uNight * uNight;
  col = mix(col, vec3(.94, .93, .84) * (.88 - craters * .5), moon * smoothstep(.45, .85, uNight));

  // Ridgelines.
  float ridgeAmp = (16. + 88. * uMesa) * uScale;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float h = ridgeH(px.x * (1. + fi * .35), 1. + fi * 7.3, 260. + fi * 120.) * ridgeAmp * (1. - fi * .28);
    if (uYH - px.y < h && px.y < uYH) {
      vec3 rock = mix(vec3(.62, .3, .3), vec3(.16, .1, .2), fi * .5);
      rock = mix(rock, horizon * .8, 1. - fi * .42);
      rock *= mix(1., .22, uNight);
      col = mix(rock, col, .0);
    }
  }
  // A far-off town on the horizon late in the drive.
  float lights = step(.965, hash21(floor(vec2(px.x / 5., px.y / 3.)))) * smoothstep(7. * uScale, 1., uYH - px.y) * step(px.y, uYH) * smoothstep(.55, .9, uNight);
  col += vec3(1., .8, .45) * lights * .7;
  col += vec3(1., .55, .25) * exp(-(uYH - px.y) / (9. * uScale)) * exp(-abs(px.x - uXV - 160. * uScale) / (200. * uScale)) * .22 * uNight * step(px.y, uYH);
  return col;
}

vec3 groundColor(vec2 px) {
  float H = uRes.y / uDpr;
  float dy = px.y - uYH;
  float x = px.x + sin(px.y * .35 + uTime * 2.1) * .8 * exp(-dy / (45. * uScale)) * uScale; // heat shimmer
  float d = uDNear * (H - uYH) / max(dy, .5);
  float X = (x - uXV) * d / uKx + uCamX;
  float xr = X - bend(d);
  float s = uTravel + d;
  float fp = d / uKx;                       // world units per pixel across the road
  float lod = smoothstep(.12, 1.1, fp);     // fade fine detail with distance

  // Desert: sand, red rock in canyon country, scrub clumps.
  float n = fbm(vec2(xr * .22, s * .12) + vec2(3., 7.));
  vec3 sand = mix(vec3(.76, .57, .36), vec3(.6, .43, .27), n);
  sand = mix(sand, vec3(.66, .3, .2), uMesa * smoothstep(.45, .75, fbm(vec2(xr * .05, s * .05) + 9.)) * .8);
  float scrub = smoothstep(.5, .68, fbm(vec2(xr * 1.2, s * .7) + vec2(11., 2.)));
  sand = mix(sand, vec3(.36, .38, .24), scrub * .75 * (1. - lod * .5));
  sand *= mix(.88 + .24 * hash21(floor(vec2(xr, s) * 7.)), 1., lod);

  float ar = abs(xr);
  // Shoulder gravel and asphalt.
  vec3 gravel = mix(vec3(.58, .5, .4), vec3(.46, .4, .32), hash21(floor(vec2(xr, s) * 12.)));
  vec3 asphalt = vec3(.31, .31, .34) + (fbm(vec2(xr * 1.6, s * .5)) - .5) * .09;
  float crack = smoothstep(.015, .0, abs(fbm(vec2(xr * .8, s * .35) + 20.) - .5) - .004);
  asphalt *= 1. - crack * .35 * (1. - lod);
  asphalt = mix(asphalt, asphalt * .78, smoothstep(.5, 1.5, abs(ar - 1.85)) * .0); // keep lanes even

  float aa = max(fp * 1.4, .004);
  float onRoad = 1. - smoothstep(${LANE_EDGE.toFixed(2)} + .4 - aa, ${LANE_EDGE.toFixed(2)} + .4 + aa, ar);
  float onShoulder = 1. - smoothstep(${SHOULDER.toFixed(2)} - aa, ${SHOULDER.toFixed(2)} + aa, ar);
  vec3 col = mix(sand, gravel, onShoulder);
  col = mix(col, asphalt, onRoad);

  // Painted lines: double yellow centre, white edge lines; the inner pair dashes in passing zones.
  float yellow = (1. - smoothstep(.07 - aa, .07 + aa, abs(ar - .17))) ;
  float zone = step(mod(s, 420.), 120.);
  float dash = step(mod(s, 12.), 6.);
  float inner = xr < 0. ? 1. : mix(1., dash, zone);
  float lineFade = clamp(.1 / max(aa, .01), 0., 1.);
  col = mix(col, vec3(.96, .74, .16), yellow * inner * lineFade * onRoad);
  float white = 1. - smoothstep(.09 - aa, .09 + aa, abs(ar - ${LANE_EDGE.toFixed(2)}));
  col = mix(col, vec3(.93, .93, .9), white * lineFade * onRoad);

  col *= uAmbient;

  // Headlights sweep the road ahead of the car at night.
  float beam = exp(-d / 30.) * smoothstep(1.5 + d * .13, .1, abs(X - uCamX)) * uNight;
  col += vec3(1., .88, .62) * beam * .9 * (onRoad * .8 + .35);

  // Atmospheric fog towards the horizon colour.
  vec3 horizonCol = uSky[0] * mix(vec3(1.), uAmbient, .5);
  col = mix(col, horizonCol, 1. - exp(-d / mix(900., 420., uNight)));
  return col;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec3 col = px.y < uYH ? skyColor(px) : groundColor(px);

  // Soft seam where the ground meets the sky.
  col += uGlow * exp(-pow((px.y - uYH) / 1.6, 2.)) * .06 * uGlowAmt;
  vec2 vq = (px / vec2(uRes.x, uRes.y) * uDpr - .5);
  col *= 1. - .34 * smoothstep(.45, 1.05, length(vq * vec2(1., 1.1)));

  float m = max(col.r, max(col.g, col.b));
  if (m > .85) {
    float k = (.85 + .15 * (1. - exp(-(m - .85) / .15))) / m;
    col *= k;
    col = mix(col, vec3(1.), smoothstep(1.2, 2.4, m) * .7);
  }
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 91.7) - .5) * (1.6 / 255.);
  outColor = vec4(clamp(col, 0., 1.), 1.);
}`;

// ---- Roadside objects ---------------------------------------------------------------
function buildRoadside() {
  const rand = mulberry32(66);
  const objs = [];
  const add = (type, s, xo, extra = {}) => objs.push({ type, s, xo, ...extra });
  const end = TOTAL + 1700;
  for (let s = 20; s < end; s += 46) add('pole', s, -6);
  for (let s = 10; s < end; s += 30) add('post', s, 4.95);
  for (let s = 260; s < end; s += 640) add('shield', s, 6.2);
  for (let s = 8; s < end; s += 9) {
    const f = s / TOTAL;
    for (const side of [-1, 1]) {
      if (rand() < 0.5) add('sage', s + rand() * 8, side * (6 + rand() * 30), { size: 0.5 + rand() * 0.9 });
      if (f < 0.3 && rand() < 0.1) add('joshua', s + rand() * 8, side * (8 + rand() * 34), { size: 0.8 + rand() * 0.7 });
      if (((f > 0.14 && f < 0.52) || f > 0.7) && rand() < 0.085) add('saguaro', s + rand() * 8, side * (7.5 + rand() * 30), { size: 0.8 + rand() * 0.8, arms: Math.floor(rand() * 3) });
      if (f > 0.16 && f < 0.6 && rand() < 0.14) add('rock', s + rand() * 8, side * (7 + rand() * 26), { size: 0.6 + rand() * 1.8 });
    }
  }
  // far mesas and buttes that grow as the drive approaches them
  for (let s = 520; s < end; s += 70 + rand() * 90) {
    const f = s / TOTAL;
    if (f < 0.2 || f > 1.25) continue;
    const side = rand() < 0.5 ? -1 : 1;
    add(rand() < 0.45 ? 'butte' : 'mesa', s, side * (80 + rand() * 260), { w: 60 + rand() * 120, h: 26 + rand() * 50, hue: rand() });
  }
  // a neon town
  for (let s = TOTAL * 0.52; s < TOTAL * 0.72; s += 26) {
    const side = rand() < 0.5 ? -1 : 1;
    add(['diner', 'motel', 'gas', 'house', 'house'][Math.floor(rand() * 5)], s + rand() * 10, side * (9 + rand() * 4), { hue: rand(), side });
  }
  for (let s = TOTAL * 0.5; s < TOTAL * 0.74; s += 95) add('neon', s, (rand() < 0.5 ? -1 : 1) * 8.6, { text: ['MOTEL', 'DINER', 'EAT', 'GAS', 'CAFE', 'OPEN', '66'][Math.floor(rand() * 7)], hue: rand() });
  add('tower', TOTAL * 0.56, -16); add('tower', TOTAL * 0.93, 22);
  for (let k = 0; k < 3; k++) add('weed', TOTAL * (0.1 + k * 0.17) + 20, 0, { dir: k % 2 ? 1 : -1, speed: 3 + k });
  objs.sort((a, b) => a.s - b.s);
  let following = -1;
  for (let i = objs.length - 1; i >= 0; i--) if (objs[i].type === 'pole') { objs[i].nextPole = following; following = i; }
  return objs;
}

const tone = (hex, amb, haze, mixK, bright = 0) => {
  const c = rgb(hex);
  const lit = [clamp(c[0] * amb[0] + bright), clamp(c[1] * amb[1] + bright), clamp(c[2] * amb[2] + bright)];
  const m = mixRgb(lit, haze, mixK);
  return css(m);
};

export function createRoute66Renderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D unavailable');
  const rand = mulberry32(6666);
  const glCanvas = document.createElement('canvas');
  let gl = glCanvas.getContext('webgl2', { alpha: false, depth: false, stencil: false, antialias: false });
  let program, geometry, uniforms;
  if (gl) {
    try {
      program = createFullscreenProgram(gl, FRAGMENT);
      geometry = createFullscreenTriangle(gl);
      const names = ['uRes', 'uDpr', 'uTime', 'uYH', 'uXV', 'uKx', 'uDNear', 'uTravel', 'uCamX', 'uNight', 'uMesa', 'uGlowAmt', 'uCloudAmt', 'uStars', 'uSunAlt', 'uScale', 'uSky[0]', 'uGlow', 'uAmbient', 'uSun', 'uMoon'];
      uniforms = Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, name)]));
    } catch { gl = null; }
  }
  const skyData = new Float32Array(15);
  const roadside = buildRoadside();
  const birds = Array.from({ length: 5 }, (_, i) => ({ x: rand(), y: 0.1 + rand() * 0.22, speed: 0.012 + rand() * 0.01, ph: rand() * 6, s: 0.8 + rand() * 0.5, i }));
  const noise = (() => {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 128;
    const g = tile.getContext('2d');
    const image = g.createImageData(128, 128);
    for (let i = 0; i < image.data.length; i += 4) { const v = rand() > 0.5 ? 255 : 0; image.data[i] = image.data[i + 1] = image.data[i + 2] = v; image.data[i + 3] = 255; }
    g.putImageData(image, 0, 0);
    return tile;
  })();
  const noisePattern = ctx.createPattern(noise, 'repeat');

  let W = 1, H = 1, scale = 1, S = 1, disposed = false;

  function resize(w, h, dpr = 1) {
    W = w; H = h;
    scale = Math.min(1.5, dpr, Math.sqrt(2000000 / (w * h)));
    canvas.width = Math.max(1, Math.round(w * scale)); canvas.height = Math.max(1, Math.round(h * scale));
    glCanvas.width = canvas.width; glCanvas.height = canvas.height;
    S = clamp(h / 900, 0.6, 1.5);
  }

  function render({ p, time, layout }) {
    if (disposed) return;
    const g = ctx;
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;

    const avoid = layout?.avoidHalf ?? 350;
    const yh = H * HORIZON;
    // vanishing point and car sit right of the centred widgets
    const xv = clamp(W / 2 + avoid + 70 * S, W * 0.7, W * 0.8);
    const Kx = 800 * S;
    const travel = p * TOTAL;
    const look = lookAt(p);
    const mesa = mesaAmount(p);
    const sunX = xv - W * 0.06, sunAlt = lerp(40, -90, smoothstep(0, 0.32, p)) * S;

    // ---- backdrop ----
    if (gl && !gl.isContextLost()) {
      look.sky.forEach((c, i) => skyData.set(c, i * 3));
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
      gl.useProgram(program); gl.bindVertexArray(geometry.vao);
      const u = uniforms;
      gl.uniform2f(u.uRes, glCanvas.width, glCanvas.height); gl.uniform1f(u.uDpr, scale); gl.uniform1f(u.uTime, time);
      gl.uniform1f(u.uYH, yh); gl.uniform1f(u.uXV, xv); gl.uniform1f(u.uKx, Kx); gl.uniform1f(u.uDNear, D_NEAR);
      gl.uniform1f(u.uTravel, travel); gl.uniform1f(u.uCamX, CAM_X); gl.uniform1f(u.uNight, look.night); gl.uniform1f(u.uMesa, mesa);
      gl.uniform1f(u.uGlowAmt, look.glowAmt); gl.uniform1f(u.uCloudAmt, look.clouds); gl.uniform1f(u.uStars, look.stars);
      gl.uniform1f(u.uSunAlt, sunAlt); gl.uniform1f(u.uScale, S);
      gl.uniform3fv(u['uSky[0]'], skyData); gl.uniform3fv(u.uGlow, look.glow); gl.uniform3fv(u.uAmbient, look.ambient);
      gl.uniform2f(u.uSun, sunX, yh - sunAlt); gl.uniform2f(u.uMoon, W * 0.3, yh * 0.34);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      g.drawImage(glCanvas, 0, 0, W, H);
    } else {
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, css(look.sky[4])); sky.addColorStop(HORIZON, css(look.sky[0])); sky.addColorStop(1, '#3a3a40');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
    }

    // ---- roadside, far to near ----
    const amb = look.ambient, haze = mixRgb(look.sky[0], [0, 0, 0], 0.05);
    const night = look.night;
    const project = (s, xo) => {
      const d = s - travel;
      if (d < D_NEAR * 0.72) return null;
      const k = Kx / d;
      return { d, k, x: xv + (xo + bendAt(d, travel) - CAM_X) * k, y: yh + (H - yh) * D_NEAR / d };
    };
    const poleTops = new Map();
    const first = roadside.findIndex(o => o.s - travel >= D_NEAR * 0.72);
    for (let i = roadside.length - 1; i >= Math.max(0, first); i--) {
      const o = roadside[i];
      const d0 = o.s - travel;
      if (d0 > 1500) continue;
      let xo = o.xo;
      if (o.type === 'weed') xo = ((time * o.speed * o.dir + 40) % 80) - 40;
      const pr = project(o.s, xo);
      if (!pr) continue;
      const { x, y, k, d } = pr;
      if (x < -k * 20 - 60 || x > W + k * 20 + 60) continue;
      const hz = clamp(1 - Math.exp(-d / 800), 0, 0.92);
      const T = (hex, bright = 0) => tone(hex, amb, haze, hz, bright);
      switch (o.type) {
        case 'pole': {
          const w = Math.max(1.2, 0.3 * k), top = y - 9 * k;
          g.fillStyle = T('#2e2318'); g.fillRect(x - w / 2, top, w, 9 * k);
          g.fillRect(x - 1.5 * k, top + 0.5 * k, 3 * k, Math.max(1, 0.22 * k));
          g.fillRect(x - 1.1 * k, top + 1.9 * k, 2.2 * k, Math.max(1, 0.18 * k));
          poleTops.set(i, { x, top: top + 0.5 * k, k });
          // wires sag to the next pole down the road
          const next = poleTops.get(o.nextPole);
          if (next) {
            g.strokeStyle = T('#1f1810'); g.lineWidth = clamp(0.035 * k, 0.6, 2.6);
            for (const off of [-1.4, 0, 1.4]) {
              g.beginPath(); g.moveTo(x + off * k, top + 0.55 * k); g.quadraticCurveTo((x + next.x) / 2 + off * (k + next.k) / 2, (top + next.top) / 2 + 0.9 * k, next.x + off * next.k, next.top + 0.05 * next.k); g.stroke();
            }
          }
          break;
        }
        case 'post': {
          g.fillStyle = T('#e9e6dc', 0.02); g.fillRect(x - 0.08 * k, y - 1.05 * k, Math.max(1, 0.16 * k), 1.05 * k);
          g.fillStyle = T('#d63a2a', night * 0.15); g.fillRect(x - 0.08 * k, y - 1.0 * k, Math.max(1, 0.16 * k), 0.18 * k);
          break;
        }
        case 'shield': {
          g.fillStyle = T('#8a8a8a'); g.fillRect(x - 0.06 * k, y - 2.9 * k, Math.max(1, 0.12 * k), 2.9 * k);
          const sx = x, sy = y - 2.9 * k, sw = 0.95 * k;
          g.fillStyle = T('#1b1b1b'); g.beginPath(); g.moveTo(sx - sw / 2, sy - sw * 0.9); g.lineTo(sx + sw / 2, sy - sw * 0.9); g.lineTo(sx + sw / 2, sy - sw * 0.25); g.quadraticCurveTo(sx + sw / 2, sy, sx, sy + sw * 0.15); g.quadraticCurveTo(sx - sw / 2, sy, sx - sw / 2, sy - sw * 0.25); g.closePath(); g.fill();
          g.fillStyle = T('#f4f1e8', night * 0.12); const inset = sw * 0.07; g.beginPath(); g.moveTo(sx - sw / 2 + inset, sy - sw * 0.82); g.lineTo(sx + sw / 2 - inset, sy - sw * 0.82); g.lineTo(sx + sw / 2 - inset, sy - sw * 0.27); g.quadraticCurveTo(sx + sw / 2 - inset, sy - 0.02 * sw, sx, sy + sw * 0.07); g.quadraticCurveTo(sx - sw / 2 + inset, sy - 0.02 * sw, sx - sw / 2 + inset, sy - sw * 0.27); g.closePath(); g.fill();
          if (sw > 14) { g.fillStyle = T('#111'); g.font = `800 ${sw * 0.46}px "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('66', sx, sy - sw * 0.42); g.font = `700 ${sw * 0.13}px Arial, sans-serif`; g.fillText('ROUTE', sx, sy - sw * 0.72); }
          break;
        }
        case 'sage': {
          g.fillStyle = T('#6c7050'); g.beginPath(); g.ellipse(x, y - 0.2 * k * o.size, 0.8 * k * o.size, 0.42 * k * o.size, 0, 0, PI * 2); g.fill();
          g.fillStyle = T('#8a8c68', 0.02); g.beginPath(); g.ellipse(x + 0.12 * k * o.size, y - 0.32 * k * o.size, 0.45 * k * o.size, 0.22 * k * o.size, 0, 0, PI * 2); g.fill();
          break;
        }
        case 'saguaro': {
          const h = 3.6 * k * o.size, w = 0.5 * k * o.size;
          g.fillStyle = T('#3d6a44'); g.beginPath(); g.roundRect(x - w / 2, y - h, w, h, w / 2); g.fill();
          g.fillStyle = T('#5f9a5e', 0.03); g.fillRect(x + w * 0.1, y - h * 0.92, w * 0.18, h * 0.85);
          for (let a = 0; a <= o.arms; a++) {
            if (a === 0 && o.arms === 0) break;
            const side = a % 2 ? 1 : -1, ay = y - h * (0.42 + a * 0.12), len = 0.95 * k * o.size, rise = (0.8 + a * 0.3) * k * o.size;
            g.strokeStyle = T('#3d6a44'); g.lineWidth = w * 0.75; g.lineCap = 'round'; g.lineJoin = 'round';
            g.beginPath(); g.moveTo(x, ay); g.lineTo(x + side * len, ay); g.lineTo(x + side * len, ay - rise); g.stroke();
          }
          break;
        }
        case 'joshua': {
          const h = 2.6 * k * o.size;
          g.strokeStyle = T('#5b4630'); g.lineWidth = Math.max(1, 0.34 * k * o.size); g.lineCap = 'round';
          g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h * 0.55); g.stroke();
          for (const [dx, dy] of [[-0.9, 0.95], [0.1, 1], [0.9, 0.85]]) {
            const bx = x + dx * 0.5 * k * o.size, by = y - h * 0.55 - dy * h * 0.25;
            g.lineWidth = Math.max(0.8, 0.2 * k * o.size); g.beginPath(); g.moveTo(x, y - h * 0.5); g.lineTo(bx, by); g.stroke();
            g.strokeStyle = T('#6f7a45'); g.lineWidth = Math.max(0.6, 0.06 * k * o.size);
            for (let r = 0; r < 9; r++) { const a = r / 9 * PI * 2; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a) * 0.45 * k * o.size, by + Math.sin(a) * 0.35 * k * o.size); g.stroke(); }
            g.strokeStyle = T('#5b4630');
          }
          break;
        }
        case 'rock': {
          const w = 1.5 * k * o.size, h = 0.9 * k * o.size;
          g.fillStyle = T('#7a4a38'); g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x - w * 0.38, y - h * 0.7); g.lineTo(x - w * 0.05, y - h); g.lineTo(x + w * 0.35, y - h * 0.8); g.lineTo(x + w / 2, y); g.closePath(); g.fill();
          g.fillStyle = T('#a0654a', 0.04); g.beginPath(); g.moveTo(x - w * 0.05, y - h); g.lineTo(x + w * 0.35, y - h * 0.8); g.lineTo(x + w / 2, y); g.lineTo(x + w * 0.1, y); g.closePath(); g.fill();
          break;
        }
        case 'mesa': case 'butte': {
          const w = o.w * k, h = o.h * k * (o.type === 'butte' ? 1.5 : 1);
          const top = o.type === 'butte' ? 0.36 : 0.78;
          const color = mixRgb(rgb('#b0502f'), rgb('#7a3a4a'), o.hue * 0.6);
          g.fillStyle = css(mixRgb([color[0] * amb[0], color[1] * amb[1], color[2] * amb[2]], haze, hz));
          g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x - w * 0.5 * top - w * 0.06, y - h * 0.8); g.lineTo(x - w * 0.5 * top, y - h); g.lineTo(x + w * 0.5 * top, y - h); g.lineTo(x + w * 0.5 * top + w * 0.06, y - h * 0.8); g.lineTo(x + w / 2, y); g.closePath(); g.fill();
          g.fillStyle = css(mixRgb([color[0] * amb[0] * 0.55, color[1] * amb[1] * 0.55, color[2] * amb[2] * 0.55], haze, hz));
          for (let b = 0; b < 4; b++) { const bx = x - w * 0.5 * top + (b + 0.5) / 4 * w * top; g.fillRect(bx, y - h * 0.97, Math.max(1, w * 0.012), h * 0.97); }
          break;
        }
        case 'diner': case 'motel': case 'gas': case 'house': {
          const bw = (o.type === 'motel' ? 9 : 6) * k, bh = (o.type === 'house' ? 2.6 : 3.2) * k;
          const color = o.type === 'diner' ? '#c0472f' : o.type === 'motel' ? '#d6b98c' : o.type === 'gas' ? '#e8e2d0' : '#b99a78';
          const bx = o.side < 0 ? x - bw : x;
          g.fillStyle = T(color); g.fillRect(bx, y - bh, bw, bh);
          g.fillStyle = T('#3a2a22'); g.fillRect(bx - 0.2 * k, y - bh - 0.3 * k, bw + 0.4 * k, 0.35 * k);
          const glow = night > 0.25 ? 1 : 0;
          g.fillStyle = glow ? `rgba(255,214,120,${0.55 + 0.4 * night})` : T('#2a3a4a');
          for (let w = 0; w < (o.type === 'motel' ? 5 : 2); w++) g.fillRect(bx + (0.5 + w * 1.6) * k, y - bh * 0.7, 0.9 * k, bh * 0.4);
          if (o.type === 'gas') { g.fillStyle = T('#c9302c'); g.fillRect(bx - 1 * k, y - bh - 0.5 * k, bw + 2 * k, 0.6 * k); }
          break;
        }
        case 'neon': {
          const h = 7.5 * k, sw = 3.8 * k, sh = 1.5 * k;
          g.fillStyle = T('#2a2a30'); g.fillRect(x - 0.1 * k, y - h, Math.max(1, 0.2 * k), h);
          g.fillStyle = T('#16161c'); g.beginPath(); g.roundRect(x - sw / 2, y - h - sh, sw, sh, 0.15 * k); g.fill();
          const hue = [350, 190, 45, 300][Math.floor(o.hue * 4)];
          const on = 0.35 + 0.65 * night;
          const flicker = Math.sin(time * 18 + o.s) > 0.97 ? 0.5 : 1;
          g.save();
          g.shadowColor = `hsl(${hue} 100% 60%)`; g.shadowBlur = k * 1.4 * on;
          g.fillStyle = `hsl(${hue} 100% ${62 + on * 10}% / ${on * flicker})`;
          g.font = `800 ${sh * 0.62}px "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
          if (sh > 6) g.fillText(o.text, x, y - h - sh / 2); else g.fillRect(x - sw * 0.35, y - h - sh * 0.6, sw * 0.7, sh * 0.2);
          g.restore();
          break;
        }
        case 'tower': {
          const h = 11 * k;
          g.fillStyle = T('#5a4a3a');
          for (const lx of [-1.3, 1.3]) { g.fillRect(x + lx * k - 0.07 * k, y - h * 0.62, Math.max(1, 0.14 * k), h * 0.62); }
          g.fillStyle = T('#8a6a4a'); g.beginPath(); g.ellipse(x, y - h * 0.8, 2.2 * k, 1.6 * k, 0, 0, PI * 2); g.fill();
          g.fillRect(x - 2.2 * k, y - h * 0.8, 4.4 * k, 1.3 * k);
          break;
        }
        case 'weed': {
          const r = 0.55 * k; g.strokeStyle = T('#8a6b3e'); g.lineWidth = Math.max(0.6, 0.05 * k);
          g.save(); g.translate(x, y - r); g.rotate(time * o.speed * o.dir * 1.3);
          for (let b = 0; b < 12; b++) { const a = b / 12 * PI * 2; g.beginPath(); g.arc(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, r * (0.6 + 0.3 * Math.sin(b * 2.3)), a, a + 2.2); g.stroke(); }
          g.restore();
          break;
        }
        default: break;
      }
    }
    // birds against the sunset
    g.save();
    if (look.stars < 0.4) {
      g.strokeStyle = `rgba(40,20,30,${0.8 * (1 - look.stars * 2)})`; g.lineWidth = 1.6 * S; g.lineCap = 'round';
      for (const b of birds) {
        const bx = mod(b.x * W + time * b.speed * W, W + 80) - 40, by = (b.y + Math.sin(time * 0.4 + b.ph) * 0.01) * H - p * 80;
        const flap = Math.sin(time * 6 + b.ph) * 4 * S * b.s;
        g.beginPath(); g.moveTo(bx - 7 * S * b.s, by + flap * 0.6); g.quadraticCurveTo(bx - 3 * S * b.s, by - flap, bx, by); g.quadraticCurveTo(bx + 3 * S * b.s, by - flap, bx + 7 * S * b.s, by + flap * 0.6); g.stroke();
      }
    }
    g.restore();

    drawCar(g, { H, xv, S, time, amb, night, travel });

    // film grain and a gentle vignette on top of everything
    g.save(); g.globalAlpha = 0.014; g.fillStyle = noisePattern; g.fillRect(0, 0, W, H); g.restore();
  }

  return {
    resize, render,
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

// ---- The car: a tail-finned convertible seen from behind --------------------------------
function drawCar(g, { H, xv, S, time, amb, night, travel }) {
  const sc = S * 1.18;
  // the road leans the car a little through bends, and the engine hums
  const lean = (bendAt(160, travel) - bendAt(60, travel)) * 0.0018;
  const bump = Math.sin(time * 41) * 0.5 + Math.sin(time * 11.3) * 0.7;
  const baseY = H * 0.935 + bump * S;
  g.save(); g.translate(xv + lean * 220, baseY); g.rotate(lean * 0.5); g.scale(sc, sc);
  const A = (hex, k = 1) => { const c = rgb(hex); const a = [Math.pow(amb[0], 0.55), Math.pow(amb[1], 0.55), Math.pow(amb[2], 0.55)]; return css([clamp(c[0] * a[0] * k), clamp(c[1] * a[1] * k), clamp(c[2] * a[2] * k)]); };

  // shadow and tyres
  g.fillStyle = 'rgba(8,6,14,.5)'; g.beginPath(); g.ellipse(0, 2, 168, 14, 0, 0, PI * 2); g.fill();
  g.fillStyle = A('#15151a'); for (const sx of [-1, 1]) { g.beginPath(); g.roundRect(sx * 125 - 17, -38, 34, 40, 6); g.fill(); }
  g.fillStyle = A('#2b2b33'); for (const sx of [-1, 1]) g.fillRect(sx * 125 - 12, -34, 3, 28);

  // exhaust shimmer
  g.fillStyle = A('#101014'); for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 62, -14, 8, 5, 0, 0, PI * 2); g.fill(); }
  g.fillStyle = `rgba(255,255,255,${0.05 + 0.04 * Math.sin(time * 9)})`; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 62, -26 - (time * 40 % 22), 6, 9, 0, 0, PI * 2); g.fill(); }

  // body
  const paint = g.createLinearGradient(0, -122, 0, -16);
  paint.addColorStop(0, A('#58e0d4')); paint.addColorStop(0.5, A('#27b7ae')); paint.addColorStop(1, A('#158a86'));
  g.fillStyle = paint;
  g.beginPath(); g.moveTo(-146, -30); g.lineTo(-146, -76); g.quadraticCurveTo(-146, -98, -128, -102); g.lineTo(-100, -108); g.quadraticCurveTo(0, -122, 100, -108); g.lineTo(128, -102); g.quadraticCurveTo(146, -98, 146, -76); g.lineTo(146, -30); g.quadraticCurveTo(146, -18, 132, -16); g.lineTo(-132, -16); g.quadraticCurveTo(-146, -18, -146, -30); g.closePath(); g.fill();
  g.fillStyle = A('#8af2e8', 1); g.globalAlpha = 0.35; g.beginPath(); g.ellipse(-20, -96, 90, 8, 0, 0, PI * 2); g.fill(); g.globalAlpha = 1;
  // tail fins with chrome edges
  for (const sx of [-1, 1]) {
    g.fillStyle = paint;
    g.beginPath(); g.moveTo(sx * 146, -76); g.lineTo(sx * 142, -128); g.quadraticCurveTo(sx * 132, -140, sx * 118, -134); g.lineTo(sx * 96, -102); g.closePath(); g.fill();
    g.strokeStyle = A('#e8eef2'); g.lineWidth = 3; g.beginPath(); g.moveTo(sx * 144, -80); g.lineTo(sx * 140, -126); g.quadraticCurveTo(sx * 132, -136, sx * 120, -131); g.stroke();
    // tail lights glow brighter as the light fades
    const glow = 0.45 + 0.55 * night;
    g.save(); g.globalCompositeOperation = 'lighter';
    const lg = g.createRadialGradient(sx * 126, -104, 0, sx * 126, -104, 46); lg.addColorStop(0, `rgba(255,70,50,${0.6 * glow})`); lg.addColorStop(1, 'rgba(255,40,30,0)');
    g.fillStyle = lg; g.fillRect(sx * 126 - 46, -150, 92, 92);
    g.restore();
    g.fillStyle = '#ff3a2e'; g.beginPath(); g.ellipse(sx * 126, -104, 9, 11, 0, 0, PI * 2); g.fill();
    g.fillStyle = '#ffb4a0'; g.beginPath(); g.ellipse(sx * 123, -108, 3, 4, 0, 0, PI * 2); g.fill();
    g.fillStyle = '#d02a22'; g.fillRect(sx > 0 ? 112 : -140, -78, 28, 9);
  }
  // chrome trim and bumper
  g.strokeStyle = A('#e8eef2'); g.lineWidth = 2.5; g.beginPath(); g.moveTo(-96, -108); g.quadraticCurveTo(0, -122, 96, -108); g.stroke();
  const chrome = g.createLinearGradient(0, -34, 0, -18); chrome.addColorStop(0, A('#ffffff')); chrome.addColorStop(0.5, A('#aeb8c0')); chrome.addColorStop(1, A('#e4eaee'));
  g.fillStyle = chrome; g.beginPath(); g.roundRect(-138, -34, 276, 15, 7); g.fill();
  for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 78, -26, 10, 11, 0, 0, PI * 2); g.fillStyle = chrome; g.fill(); }
  // licence plate
  g.fillStyle = A('#f6f3e6', 1.05); g.beginPath(); g.roundRect(-27, -66, 54, 26, 3); g.fill();
  g.strokeStyle = A('#1d3b8a'); g.lineWidth = 1.6; g.strokeRect(-25, -64, 50, 22);
  g.fillStyle = A('#1d3b8a'); g.font = '800 17px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('66', 0, -52);
  g.fillStyle = A('#c9302c'); g.font = '700 6px Arial, sans-serif'; g.fillText('ROUTE', 0, -62);

  // low windscreen beyond the seats: chrome frame and pale glass
  g.fillStyle = 'rgba(190,225,240,.22)'; g.beginPath(); g.moveTo(-96, -108); g.quadraticCurveTo(-96, -150, 0, -154); g.quadraticCurveTo(96, -150, 96, -108); g.closePath(); g.fill();
  g.strokeStyle = A('#e8eef2'); g.lineWidth = 3.2; g.beginPath(); g.moveTo(-98, -108); g.quadraticCurveTo(-98, -152, 0, -156); g.quadraticCurveTo(98, -152, 98, -108); g.stroke();

  // cabin: seat backs, the two passengers and a flapping scarf
  g.fillStyle = A('#f0e4c8'); g.beginPath(); g.roundRect(-82, -138, 76, 34, 10); g.fill(); g.beginPath(); g.roundRect(6, -138, 76, 34, 10); g.fill();
  g.fillStyle = A('#d9c9a6'); g.fillRect(-82, -112, 76, 4); g.fillRect(6, -112, 76, 4);
  // driver
  g.fillStyle = A('#4a6fa5'); g.beginPath(); g.roundRect(-76, -150, 64, 26, 12); g.fill();
  g.fillStyle = A('#e9b996'); g.beginPath(); g.arc(-44, -166, 18, 0, PI * 2); g.fill();
  g.fillStyle = A('#4a2f1e'); g.beginPath(); g.arc(-44, -168, 19, PI, PI * 2); g.fill(); g.fillRect(-63, -168, 38, 7);
  g.fillStyle = A('#e9b996'); g.beginPath(); g.ellipse(-63, -164, 3.5, 5, 0, 0, PI * 2); g.fill(); g.beginPath(); g.ellipse(-25, -164, 3.5, 5, 0, 0, PI * 2); g.fill();
  // passenger with a long scarf blowing back toward the camera
  g.fillStyle = A('#f6efe6'); g.beginPath(); g.roundRect(12, -148, 64, 26, 12); g.fill();
  g.fillStyle = A('#e9b996'); g.beginPath(); g.arc(44, -164, 17, 0, PI * 2); g.fill();
  g.fillStyle = A('#d8a24a'); g.beginPath(); g.arc(44, -166, 18.5, PI, PI * 2); g.fill(); g.fillRect(25, -166, 38, 9);
  g.beginPath(); g.moveTo(26, -166); g.quadraticCurveTo(14, -150, 22, -128); g.lineTo(30, -130); g.quadraticCurveTo(24, -148, 34, -160); g.closePath(); g.fill();
  g.strokeStyle = A('#e8453c'); g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(40, -146);
  for (let i = 1; i <= 8; i++) { const t = i / 8; g.lineTo(40 + t * 54 + Math.sin(time * 9 + t * 7) * 3, -146 - t * 38 + Math.sin(time * 11 + t * 9) * 8 * t); }
  g.stroke();
  // brake glow on the road behind the lights, strongest at night
  g.save(); g.globalCompositeOperation = 'lighter';
  const wash = g.createRadialGradient(0, -10, 0, 0, -10, 200);
  wash.addColorStop(0, `rgba(255,60,40,${0.1 + 0.28 * night})`); wash.addColorStop(1, 'rgba(255,40,30,0)');
  g.fillStyle = wash; g.fillRect(-200, -210, 400, 220);
  g.restore();
  g.restore();
}
