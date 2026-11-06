import { NOISE_GLSL } from './glsl-common.js';
import { cloudSprite, css, mod, mulberry32 } from './canvas-kit.js';
import { clamp, createFullscreenProgram, createFullscreenTriangle, hexToRgb, lerp, mixRgb, smoothstep } from './gl-utils.js';

// 火箭升空: a Falcon 9 stays pinned to one screen position while the world falls
// away. The launch pad drops off the bottom, the sea level sinks out of frame as
// the sky darkens to black, then the curved Earth rises back into view at the
// bottom with a sunrise on its limb. A WebGL shader paints sky, stars and Earth;
// Canvas 2D paints the pad, clouds, smoke, plumes and the rocket on top.
const PI = Math.PI;
const rgb = hexToRgb;

// ---- Timeline (scroll progress) ---------------------------------------------------
const P_IGNITE = 0.03, P_LIFT = 0.075, P_SEP = 0.5;
const altitudeKm = p => 0.02 + 160 * p * p;
const spaceAmount = p => smoothstep(14, 86, altitudeKm(p));
const GROUND_FALL = 14;     // pad drop, in viewport heights per progress², once the rocket lifts off
const CLOUD_KM = 130;       // cloud layers slide past at this many u per kilometre

/** Sea level / limb apex height (uv, y-up). Sinks out of frame while climbing, rises back in orbit. */
function horizonApex(p) {
  const climb = smoothstep(P_LIFT, P_SEP, p);
  const orbit = smoothstep(P_SEP, 1, p);
  return lerp(0.283, -0.22, climb) + (0.2 + 0.22) * orbit;
}
/** Earth radius in viewport heights: dead flat on the ground, strongly curved from orbit. */
function earthRadius(p) {
  return Math.exp(lerp(Math.log(60), Math.log(2.15), smoothstep(P_SEP - 0.05, 1, p) ** 0.8));
}

// ---- Backdrop shader -------------------------------------------------------------
const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform float uSpace;   // 0 on the ground → 1 in vacuum
uniform float uAltK;    // 0..1 altitude, sets how coarse the surface looks
uniform float uYA;      // horizon apex (uv, y-up)
uniform float uR;       // Earth radius, in viewport heights
uniform vec2 uSun;      // uv
uniform float uSunAlt;  // sun height above the horizon, viewport heights
uniform float uDrift;   // surface drift, tied to scroll

#define ASPECT (uRes.x / uRes.y)
${NOISE_GLSL}

float horizonY(float x) {
  float dx = x - ASPECT * .5;
  return uYA - dx * dx / (uR + sqrt(max(uR * uR - dx * dx, 1e-4)));
}

vec3 dayPalette(float t) {
  vec3 c0 = vec3(.82, .86, .93), c1 = vec3(.46, .64, .90), c2 = vec3(.16, .34, .72), c3 = vec3(.03, .09, .30);
  vec3 c = mix(c0, c1, smoothstep(0., .22, t));
  c = mix(c, c2, smoothstep(.14, .55, t));
  return mix(c, c3, smoothstep(.45, 1.15, t));
}
float stars(vec2 px, float t) {
  return starLayer(px, 14., 0., .06, .5, t) * .4 + starLayer(px, 34., 1., .09, .62, t)
       + starLayer(px, 60., 2., .12, .8, t) * 1.1 + starLayer(px, 130., 3., .16, 1., t) * 1.5;
}
vec3 milkyWay(vec2 P, vec2 px) {
  vec2 q = (P - vec2(ASPECT * .45, .62));
  float a = .55;
  vec2 r = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
  float band = exp(-r.y * r.y / .03);
  float cloud = fbm(vec2(r.x * 2.6, r.y * 8.) + 2.7);
  float dust = pow(hash21(floor(px * .8)), 38.) * band * 2.;
  vec3 tint = mix(vec3(.3, .4, .88), vec3(.82, .58, .86), cloud);
  return tint * band * (.25 + cloud * cloud) * .15 + vec3(.8, .86, 1.) * dust * .35;
}

vec3 skyColor(vec2 P, vec2 px, float t) {
  vec2 dS = P - vec2(uSun.x * ASPECT, uSun.y);
  float r = length(dS);
  float pixelSpace = smoothstep(0., 1., clamp(uSpace * (1. + 1.3 * t), 0., 1.));

  // Dawn sky: pale at the horizon, deep blue overhead, peach pooled beside the sun.
  vec3 day = dayPalette(t);
  float dawn = 1. - smoothstep(0., .6, uSpace);
  day += vec3(1., .6, .34) * (exp(-r / .4) * .5 + exp(-t / .1) * exp(-abs(dS.x) / .8) * .45) * dawn;

  // Vacuum: black, with the atmosphere as a thin glowing skin on the limb.
  vec3 space = vec3(.003, .005, .015);
  space += vec3(.34, .6, 1.) * exp(-t / .011) * 1.15 + vec3(.1, .3, .85) * exp(-t / .075) * .5 + vec3(.03, .1, .35) * exp(-t / .4) * .28;
  space += vec3(1., .55, .2) * exp(-t / .016) * exp(-abs(dS.x) / .32) * 1.3 * smoothstep(-.08, .02, uSunAlt);

  vec3 col = mix(day, space, pixelSpace);
  float starAmt = smoothstep(.2, .8, pixelSpace) * smoothstep(.0, .14, t + .06);
  if (starAmt > .003) col += (milkyWay(P, px) + vec3(.82, .88, 1.) * stars(px, uTime)) * starAmt;

  // Sun: a blinding disc and bloom once it clears the limb.
  float glowK = smoothstep(-.14, .0, uSunAlt);
  col += vec3(1., .82, .56) * (exp(-r / .07) * .9 + exp(-r / .22) * .38 + exp(-r / .8) * .09) * glowK * (.4 + .6 * pixelSpace);
  float edge = 1.4 / uRes.y;
  col = mix(col, vec3(1., .97, .88) * 2.2, (1. - smoothstep(.026 - edge, .026 + edge, r)) * smoothstep(-.03, .0, uSunAlt));
  return col;
}

vec3 earthColor(vec2 P, float dv, vec2 px) {
  float c = mix(.5, 2.4, uAltK);
  float inv = 1. / (dv + .004);
  float dxs = (P.x - ASPECT * .5) / (ASPECT * .5);
  vec2 S = vec2(dxs * inv * c * .9, inv * c) + vec2(0., uDrift);

  float cl = smoothstep(.5, .74, fbm(S * .75 + 3.1));
  float land = fbm(S * .16 + 9.);
  float isLand = smoothstep(.54, .58, land);
  vec3 ocean = mix(vec3(.015, .07, .2), vec3(.05, .24, .5), fbm(S * 2.4) * .8 + .15);
  vec3 ground = mix(vec3(.1, .27, .1), vec3(.5, .4, .24), fbm(S * .8));
  vec3 surf = mix(ocean, ground, isLand);

  // Day on the sun's side, dusk with city lights opposite it.
  float day = mix(1., smoothstep(-.55, .65, dxs), smoothstep(0., .5, uSpace));
  float night = 1. - day;
  surf *= mix(.1, 1., day);
  float glint = exp(-pow((dxs - uSun.x * 2. + 1.) / .3, 2.)) * pow(fbm(S * 6.), 3.) * (1. - isLand) * 1.4;
  surf += vec3(1., .86, .62) * glint * (1. - cl) * day;
  float city = step(.987, hash21(floor(S * 22.))) * isLand * night * (1. - cl * .8);
  surf += vec3(1., .72, .32) * city * .9;
  vec3 cloudCol = mix(vec3(.07, .09, .15), vec3(.97, .97, 1.), day);
  cloudCol = mix(cloudCol, vec3(1., .78, .62), (1. - smoothstep(.1, .45, abs(dxs - .55))) * .35);
  surf = mix(surf, cloudCol, cl * .88);

  // Limb: haze hugging the horizon and a bright blue atmospheric rim.
  float haze = exp(-dv / mix(.14, .05, uSpace));
  vec3 hazeCol = mix(dayPalette(0.), vec3(.22, .45, .95), uSpace);
  surf = mix(surf, hazeCol * mix(1., .55 + .6 * day, uSpace), haze * .9);
  surf += vec3(.35, .62, 1.) * exp(-dv / .008) * .9 * uSpace;
  return surf;
}

void main() {
  vec2 uv = vUv;
  vec2 P = vec2(uv.x * ASPECT, uv.y);
  vec2 px = uv * uRes / uDpr;
  float yh = horizonY(P.x);
  vec3 col;
  if (uv.y >= yh) col = skyColor(P, px, clamp((uv.y - yh) / .72, 0., 1.4));
  else col = earthColor(P, yh - uv.y, px);

  vec3 hl = max(col - .8, 0.);
  col = min(col, vec3(.8)) + .2 * (1. - exp(-hl / .2));
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 91.7) - .5) * (1.6 / 255.);
  outColor = vec4(clamp(col, 0., 1.), 1.);
}`;

// ---- Falcon 9 (units: 0 = nozzle plane … 100 = fairing tip) ---------------------------
const BOOSTER_TOP = 66, STAGE2_TOP = 85;

function drawBooster(g, s, w, warm, finsOut) {
  const x0 = -w / 2;
  const body = g.createLinearGradient(x0, 0, w / 2, 0);
  body.addColorStop(0, '#8f98aa'); body.addColorStop(.32, '#e6eaf0'); body.addColorStop(.72, '#ffffff'); body.addColorStop(1, css(mixRgb(rgb('#dbe7ff'), rgb('#ffd9b4'), warm)));
  // landing legs, stowed against the tank
  g.fillStyle = '#1c2027';
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(side * w / 2, -4 * s); g.lineTo(side * (w / 2 + w * .17), -3 * s); g.lineTo(side * (w / 2 + w * .06), -19 * s); g.lineTo(side * w / 2, -20 * s); g.closePath(); g.fill();
  }
  // engine bells
  for (const [ox, sc] of [[-.26, 1], [0, 1.1], [.26, 1]]) {
    g.fillStyle = '#2a2e36';
    g.beginPath(); g.moveTo(ox * w - w * .1 * sc, -1.5 * s); g.lineTo(ox * w + w * .1 * sc, -1.5 * s); g.lineTo(ox * w + w * .15 * sc, 2.2 * s); g.lineTo(ox * w - w * .15 * sc, 2.2 * s); g.closePath(); g.fill();
  }
  // tank
  g.fillStyle = body; g.fillRect(x0, -59.5 * s, w, 58.5 * s);
  const soot = g.createLinearGradient(0, -1 * s, 0, -17 * s);
  soot.addColorStop(0, 'rgba(18,20,24,.85)'); soot.addColorStop(1, 'rgba(18,20,24,0)');
  g.fillStyle = soot; g.fillRect(x0, -17 * s, w, 16 * s);
  g.fillStyle = 'rgba(30,40,60,.08)';
  for (let u = 9; u < 59; u += 7.5) g.fillRect(x0, -u * s, w, Math.max(1, s * .12));
  // black interstage
  const dark = g.createLinearGradient(x0, 0, w / 2, 0);
  dark.addColorStop(0, '#0a0c10'); dark.addColorStop(.7, '#262b34'); dark.addColorStop(1, '#3a3f4a');
  g.fillStyle = dark; g.fillRect(x0, -BOOSTER_TOP * s, w, (BOOSTER_TOP - 59.5) * s);
  // wordmark, set vertically like the real vehicle
  g.save();
  g.translate(w * .06, -31 * s); g.rotate(PI / 2);
  g.font = `800 ${w * .5}px "Helvetica Neue", Arial, sans-serif`;
  g.letterSpacing = `${w * .16}px`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#171a21'; g.fillText('SPACEX', 0, 0);
  g.restore();
  // grid fins
  g.fillStyle = '#5b606b';
  for (const side of [-1, 1]) {
    if (finsOut) {
      g.save(); g.translate(side * w / 2, -63 * s); g.rotate(side * .35);
      g.fillRect(side > 0 ? 0 : -w * .9, -s * 1.3, w * .9, s * 2.6);
      g.restore();
    } else g.fillRect(side > 0 ? w / 2 - 1 : -w / 2 - w * .2 + 1, -64.6 * s, w * .2, s * 3.2);
  }
}

function drawUpper(g, s, w, warm, bellOut) {
  const x0 = -w / 2;
  const body = g.createLinearGradient(x0, 0, w / 2, 0);
  body.addColorStop(0, '#8f98aa'); body.addColorStop(.32, '#e8ecf2'); body.addColorStop(.72, '#ffffff'); body.addColorStop(1, css(mixRgb(rgb('#dbe7ff'), rgb('#ffd9b4'), warm)));
  // vacuum engine bell under the stage
  const bell = g.createLinearGradient(x0, 0, w / 2, 0);
  bell.addColorStop(0, '#3a3322'); bell.addColorStop(.5, '#a58a45'); bell.addColorStop(1, '#4a3f26');
  if (bellOut) {
    g.fillStyle = bell;
    g.beginPath(); g.moveTo(-w * .16, -BOOSTER_TOP * s); g.lineTo(w * .16, -BOOSTER_TOP * s); g.lineTo(w * .3, -(BOOSTER_TOP - 7) * s); g.lineTo(-w * .3, -(BOOSTER_TOP - 7) * s); g.closePath(); g.fill();
  }
  g.fillStyle = body; g.fillRect(x0, -STAGE2_TOP * s, w, (STAGE2_TOP - BOOSTER_TOP) * s);
  g.fillStyle = 'rgba(30,40,60,.08)';
  g.fillRect(x0, -76 * s, w, Math.max(1, s * .12));
  // payload fairing
  g.fillStyle = body;
  g.beginPath(); g.moveTo(x0, -STAGE2_TOP * s);
  g.lineTo(x0, -90 * s); g.quadraticCurveTo(x0, -97 * s, -w * .08, -99.4 * s);
  g.quadraticCurveTo(0, -100.6 * s, w * .08, -99.4 * s); g.quadraticCurveTo(w / 2, -97 * s, w / 2, -90 * s);
  g.lineTo(w / 2, -STAGE2_TOP * s); g.closePath(); g.fill();
  g.fillStyle = 'rgba(30,40,60,.18)'; g.fillRect(x0, -(STAGE2_TOP + .5) * s, w, s * .5);
}

function drawPlume(g, x, y, halfWidth, length, spread, power, time, vacuum, additive) {
  if (power < .01) return;
  const flicker = 1 + .05 * Math.sin(time * 37) + .035 * Math.sin(time * 61 + 1.3);
  const L = length * flicker * power;
  g.save(); g.globalCompositeOperation = 'lighter';
  const glow = g.createRadialGradient(x, y + L * .12, 0, x, y + L * .12, halfWidth * (vacuum ? 9 : 6.5) * power + 8);
  glow.addColorStop(0, vacuum ? 'rgba(150,190,255,.3)' : 'rgba(255,170,80,.4)'); glow.addColorStop(1, vacuum ? 'rgba(150,190,255,0)' : 'rgba(255,150,60,0)');
  g.fillStyle = glow; g.fillRect(x - L, y - L * .4, L * 2, L * 1.8);
  const layers = vacuum
    ? [[1, [120, 160, 255], .2], [.62, [180, 208, 255], .34], [.3, [236, 246, 255], .72]]
    : [[1, [255, 100, 36], .34], [.64, [255, 172, 66], .58], [.32, [255, 234, 160], .9], [.13, [255, 255, 246], 1]];
  // Against a bright sky the flame must keep its colour, so only the glow and white core add light.
  for (const [k, c, a] of layers) {
    g.globalCompositeOperation = additive || k < .2 ? 'lighter' : 'source-over';
    const half = halfWidth * spread * k;
    const gradient = g.createLinearGradient(0, y, 0, y + L);
    gradient.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a})`); gradient.addColorStop(.55, `rgba(${c[0]},${c[1]},${c[2]},${a * .45})`); gradient.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    g.fillStyle = gradient;
    g.beginPath(); g.moveTo(x - halfWidth * k, y);
    g.bezierCurveTo(x - half, y + L * .22, x - half * .7, y + L * .68, x, y + L);
    g.bezierCurveTo(x + half * .7, y + L * .68, x + half, y + L * .22, x + halfWidth * k, y); g.closePath(); g.fill();
  }
  if (!vacuum) {
    for (let i = 0; i < 5; i++) {
      g.fillStyle = `rgba(255,246,215,${.55 * (1 - i * .18) * power})`;
      g.beginPath(); g.ellipse(x, y + L * (.1 + i * .115), halfWidth * (.5 - i * .06), L * .04, 0, 0, PI * 2); g.fill();
    }
  }
  g.restore();
}

function puff(g, x, y, r, alpha, warmth) {
  // soft billow: lit from the upper right, cooler underneath, feathered edge
  const gradient = g.createRadialGradient(x + r * .1, y - r * .12, 0, x, y, r);
  const lit = mixRgb([.98, .97, .96], [1, .84, .66], warmth);
  const shade = mixRgb([.64, .68, .78], [.76, .64, .62], warmth);
  gradient.addColorStop(0, css(lit, alpha)); gradient.addColorStop(.45, css(mixRgb(lit, shade, .4), alpha * .8));
  gradient.addColorStop(.78, css(shade, alpha * .3)); gradient.addColorStop(1, css(shade, 0));
  g.fillStyle = gradient; g.beginPath(); g.arc(x, y, r, 0, PI * 2); g.fill();
}

export function createRocketRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D unavailable');
  const rand = mulberry32(19690720);

  // Backdrop on its own WebGL canvas; falls back to flat gradients without WebGL2.
  const glCanvas = document.createElement('canvas');
  let gl = glCanvas.getContext('webgl2', { alpha: false, depth: false, stencil: false, antialias: false });
  let program, geometry, uniforms;
  if (gl) {
    try {
      program = createFullscreenProgram(gl, FRAGMENT);
      geometry = createFullscreenTriangle(gl);
      uniforms = Object.fromEntries(['uRes', 'uDpr', 'uTime', 'uSpace', 'uAltK', 'uYA', 'uR', 'uSun', 'uSunAlt', 'uDrift'].map(name => [name, gl.getUniformLocation(program, name)]));
    } catch { gl = null; }
  }

  const puffs = Array.from({ length: 64 }, () => ({ side: rand() < .5 ? -1 : 1, speed: .35 + rand() * 1.15, r: 22 + rand() * 40, lift: rand(), ph: rand() * PI * 2 }));
  const farClouds = Array.from({ length: 20 }, () => ({ fx: rand(), alt: 1 + rand() * 13, scale: .6 + rand() * .9, speed: 3 + rand() * 6, variant: Math.floor(rand() * 3) }));
  const nearClouds = Array.from({ length: 7 }, () => ({ fx: rand(), alt: 2 + rand() * 9, scale: 1.5 + rand() * 1, speed: 6 + rand() * 8, variant: Math.floor(rand() * 3) }));
  const sprites = [0, 1, 2].map(i => ({ warm: cloudSprite(mulberry32(300 + i), 340, 118, [1, .72, .55], true), cool: cloudSprite(mulberry32(300 + i), 340, 118, null, true) }));
  const noise = (() => {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 128;
    const g = tile.getContext('2d');
    const image = g.createImageData(128, 128);
    for (let i = 0; i < image.data.length; i += 4) { const v = rand() > .5 ? 255 : 0; image.data[i] = image.data[i + 1] = image.data[i + 2] = v; image.data[i + 3] = 255; }
    g.putImageData(image, 0, 0);
    return tile;
  })();
  const noisePattern = ctx.createPattern(noise, 'repeat');

  let W = 1, H = 1, scale = 1, u = 1, disposed = false;

  function resize(w, h, dpr = 1) {
    W = w; H = h;
    scale = Math.min(1.5, dpr, Math.sqrt(2000000 / (w * h)));
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    glCanvas.width = canvas.width; glCanvas.height = canvas.height;
    u = clamp(h / 900 * 1.2, .85, 1.5);
  }

  function backdrop(g, p, time, sun, yApex, radius) {
    if (gl && !gl.isContextLost()) {
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
      gl.useProgram(program); gl.bindVertexArray(geometry.vao);
      gl.uniform2f(uniforms.uRes, glCanvas.width, glCanvas.height);
      gl.uniform1f(uniforms.uDpr, scale);
      gl.uniform1f(uniforms.uTime, time);
      gl.uniform1f(uniforms.uSpace, spaceAmount(p));
      gl.uniform1f(uniforms.uAltK, smoothstep(0.5, 120, altitudeKm(p)));
      gl.uniform1f(uniforms.uYA, yApex);
      gl.uniform1f(uniforms.uR, radius);
      gl.uniform2f(uniforms.uSun, sun.x, sun.y);
      gl.uniform1f(uniforms.uSunAlt, sun.alt);
      gl.uniform1f(uniforms.uDrift, p * 40);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      g.drawImage(glCanvas, 0, 0, W, H);
      return;
    }
    const space = spaceAmount(p);
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, css(mixRgb([.04, .12, .34], [0, 0, .02], space))); sky.addColorStop(1, css(mixRgb([.82, .86, .93], [.05, .1, .3], space)));
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
  }

  function render({ p, time, layout }) {
    if (disposed) return;
    const g = ctx;
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;

    const avoid = layout?.avoidHalf ?? 350;
    const dx = clamp(W / 2 + avoid + 105 * u, W * .72, W - 120 * u);
    const hKm = altitudeKm(p);
    const space = spaceAmount(p);
    // rocket: pinned. Units: 0 at the nozzle plane, 100 at the fairing tip.
    const Hr = H * .62, s = Hr / 100, w = 7.6 * s;
    const yTop = H * .14, yBase = yTop + Hr;
    const unitY = unit => yBase - unit * s;
    // ground line: rises with the rocket's weight off the pad, falls away after lift-off
    const groundY = yBase + 20 * u + GROUND_FALL * H * Math.max(0, p - P_LIFT) ** 2;

    // ---- backdrop ----
    const yApex = horizonApex(p), radius = earthRadius(p);
    const limbDrop = x => { const d = (x - W / 2) / H; return d * d / (radius + Math.sqrt(Math.max(radius * radius - d * d, 1e-4))); };
    const sunX = clamp(dx + 160 * u, W * .8, W * .95);
    const sunAlt = lerp(-.06, .02, smoothstep(0, .95, p));
    backdrop(g, p, time, { x: sunX / W, y: yApex - limbDrop(sunX) + sunAlt, alt: sunAlt }, yApex, radius);

    // ---- far clouds slide past ----
    const camY = unitY(50);
    const warmth = 1 - smoothstep(0, .5, space + p * .6);
    const drawCloud = (c, parallax, alpha) => {
      const sprite = sprites[c.variant];
      const cw = 340 * c.scale * u, ch = 118 * c.scale * u;
      const y = camY + (hKm - c.alt) * CLOUD_KM * u * parallax - ch / 2;
      if (y > H || y + ch < 0) return;
      const x = mod(c.fx * (W + cw * 2) + time * c.speed * u, W + cw * 2) - cw;
      const fade = alpha * (1 - smoothstep(.7, 1, (y + ch / 2) / H) * .2);
      g.globalAlpha = fade * warmth;
      g.drawImage(sprite.warm, x, y, cw, ch);
      g.globalAlpha = fade * (1 - warmth);
      g.drawImage(sprite.cool, x, y, cw, ch);
    };
    if (hKm < 22) for (const c of farClouds) drawCloud(c, 1, .9);
    g.globalAlpha = 1;

    // ---- launch pad ----
    if (groundY < H + 40 * u) drawPad(g, { W, H, u, dx, groundY, p, time, puffs });

    // ---- smoke trail hanging below the nozzle ----
    const boosterThrust = smoothstep(P_IGNITE, P_LIFT + .012, p) * (1 - smoothstep(P_SEP - .03, P_SEP - .005, p));
    const trailAlpha = smoothstep(P_IGNITE + .012, P_LIFT + .03, p) * (1 - smoothstep(.16, .36, p));
    if (trailAlpha > .01) {
      const spacing = 20 * u, flow = mod(p * 3400 * u + time * 150 * u, spacing);
      const length = H * 1.25;
      for (let d = -flow; d < length; d += spacing) {
        const dist = d + flow;
        const y = yBase + 20 * u + dist;
        if (y > H + 60) break;
        const k = dist / length;
        const r = (9 + dist * .075) * u;
        puff(g, dx + Math.sin(dist * .021 + time * .7) * dist * .05, y, r, trailAlpha * (1 - k) ** 1.2 * .55 * smoothstep(40 * u, 220 * u, dist), warmth * .7);
      }
    }

    // ---- exhaust, behind the airframe ----
    const nozzleHalf = w * .46;
    const spreadBooster = lerp(1.5, 3.4, smoothstep(.12, .5, p));
    drawPlume(g, dx, yBase + 2.5 * s, nozzleHalf, lerp(250, 440, smoothstep(.1, .45, p)) * u, spreadBooster, boosterThrust, time, false, space > .3);
    const sepK = smoothstep(P_SEP, P_SEP + .1, p);
    const upperThrust = smoothstep(P_SEP + .012, P_SEP + .045, p);
    drawPlume(g, dx, unitY(BOOSTER_TOP - 7), w * .26, lerp(210, 360, smoothstep(P_SEP, .8, p)) * u, 4.6, upperThrust, time, true, true);

    // ---- airframe ----
    const warmLight = warmth;
    // Falling first stage: tumbles away down and to the left, grid fins out.
    const fall = sepK ** 1.7;
    g.save();
    g.translate(dx - 70 * u * fall, unitY(0) + (H * 1.15) * fall);
    g.rotate(-.42 * fall);
    drawBooster(g, s, w, warmLight, p > P_SEP);
    g.restore();
    g.save();
    g.translate(dx, unitY(0));
    drawUpper(g, s, w, warmLight, p > P_SEP + .004);
    g.restore();
    // staging flash
    const flash = Math.max(0, 1 - Math.abs(p - (P_SEP + .006)) / .012);
    if (flash > 0) {
      g.save(); g.globalCompositeOperation = 'lighter';
      const fy = unitY(BOOSTER_TOP), r = 150 * u * flash;
      const gradient = g.createRadialGradient(dx, fy, 0, dx, fy, r);
      gradient.addColorStop(0, `rgba(255,248,230,${.9 * flash})`); gradient.addColorStop(.3, `rgba(255,190,110,${.4 * flash})`); gradient.addColorStop(1, 'rgba(255,160,80,0)');
      g.fillStyle = gradient; g.fillRect(dx - r, fy - r, r * 2, r * 2); g.restore();
    }

    // ---- foreground wisps (passing through cloud decks) ----
    if (hKm < 22) for (const c of nearClouds) drawCloud(c, 1.55, .5);
    g.globalAlpha = 1;

    // ---- atmosphere: soft vignette and dither ----
    const vignette = g.createRadialGradient(W * .5, H * .45, Math.min(W, H) * .3, W * .5, H * .5, Math.max(W, H) * .8);
    vignette.addColorStop(0, 'rgba(0,4,16,0)'); vignette.addColorStop(1, `rgba(0,4,16,${.22 + .2 * space})`);
    g.fillStyle = vignette; g.fillRect(0, 0, W, H);
    g.save(); g.globalAlpha = .014; g.fillStyle = noisePattern; g.fillRect(0, 0, W, H); g.restore();
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

// ---- Pad ---------------------------------------------------------------------------
function drawPad(g, { W, H, u, dx, groundY, p, time, puffs }) {
  const gy = groundY;
  // terrain, lit warmly from the right at dawn
  const land = g.createLinearGradient(0, gy, 0, H);
  land.addColorStop(0, '#41603f'); land.addColorStop(.25, '#2c4730'); land.addColorStop(1, '#14231a');
  g.fillStyle = land; g.fillRect(0, gy, W, H - gy + 2);
  const rim = g.createLinearGradient(0, gy - 2 * u, 0, gy + 8 * u);
  rim.addColorStop(0, 'rgba(255,196,140,.55)'); rim.addColorStop(1, 'rgba(255,196,140,0)');
  g.fillStyle = rim; g.fillRect(0, gy - 2 * u, W, 10 * u);

  // distant facilities in the dawn haze
  g.fillStyle = '#3d4c5e';
  g.fillRect(dx - 640 * u, gy - 30 * u, 150 * u, 30 * u);
  g.beginPath(); g.moveTo(dx - 645 * u, gy - 30 * u); g.lineTo(dx - 565 * u, gy - 42 * u); g.lineTo(dx - 485 * u, gy - 30 * u); g.closePath(); g.fill();
  g.beginPath(); g.arc(dx + 330 * u, gy - 20 * u, 20 * u, 0, PI * 2); g.arc(dx + 378 * u, gy - 14 * u, 14 * u, 0, PI * 2); g.fill();
  g.fillStyle = 'rgba(255,200,150,.25)'; g.fillRect(dx - 492 * u, gy - 30 * u, 3 * u, 30 * u);
  g.fillStyle = '#46556a'; g.fillRect(dx + 520 * u, gy - 52 * u, 4 * u, 52 * u); g.fillRect(dx - 330 * u, gy - 44 * u, 3 * u, 44 * u);

  // concrete apron and flame trench
  const apron = g.createLinearGradient(0, gy, 0, gy + 70 * u);
  apron.addColorStop(0, '#b3b8bf'); apron.addColorStop(1, '#6f757d');
  g.fillStyle = apron;
  g.beginPath(); g.moveTo(dx - 130 * u, gy + 2 * u); g.lineTo(dx + 130 * u, gy + 2 * u); g.lineTo(dx + 250 * u, gy + 70 * u); g.lineTo(dx - 250 * u, gy + 70 * u); g.closePath(); g.fill();
  g.fillStyle = '#17191e'; g.fillRect(dx - 46 * u, gy + 2 * u, 92 * u, 22 * u);
  // hold-down mount: stays on the pad when the vehicle lifts away
  const mount = g.createLinearGradient(dx - 50 * u, 0, dx + 50 * u, 0);
  mount.addColorStop(0, '#1d2026'); mount.addColorStop(1, '#3b414c');
  g.fillStyle = mount; g.beginPath(); g.moveTo(dx - 54 * u, gy + 3 * u); g.lineTo(dx - 36 * u, gy - 20 * u); g.lineTo(dx + 36 * u, gy - 20 * u); g.lineTo(dx + 54 * u, gy + 3 * u); g.closePath(); g.fill();
  g.fillStyle = '#4a505c'; g.fillRect(dx - 40 * u, gy - 22 * u, 80 * u, 3 * u);

  // service tower with a lightning mast
  const tx = dx - 175 * u, tw = 30 * u, th = H * .5, ty = gy - th + 6 * u;
  g.strokeStyle = '#262b34'; g.lineWidth = 2.4 * u; g.lineCap = 'round';
  g.beginPath(); g.moveTo(tx, gy + 6 * u); g.lineTo(tx, ty); g.moveTo(tx + tw, gy + 6 * u); g.lineTo(tx + tw, ty); g.stroke();
  g.lineWidth = 1.2 * u;
  g.beginPath();
  for (let y = gy + 6 * u, flip = 0; y - 34 * u > ty; y -= 34 * u, flip ^= 1) {
    g.moveTo(flip ? tx + tw : tx, y); g.lineTo(flip ? tx : tx + tw, y - 34 * u);
    g.moveTo(tx, y); g.lineTo(tx + tw, y);
  }
  g.stroke();
  g.lineWidth = 2 * u; g.beginPath(); g.moveTo(tx + tw / 2, ty); g.lineTo(tx + tw / 2, ty - 46 * u); g.stroke();
  g.fillStyle = `rgba(255,70,60,${.4 + .6 * Math.max(0, Math.sin(time * 3))})`; g.beginPath(); g.arc(tx + tw / 2, ty - 46 * u, 3.4 * u, 0, PI * 2); g.fill();

  // ignition glow on the pad, then billowing exhaust clouds that drop away with the ground
  const age = Math.max(0, p - P_IGNITE);
  const burn = smoothstep(P_IGNITE, P_LIFT, p) * (1 - smoothstep(P_LIFT + .08, P_LIFT + .17, p));
  if (burn > .01) {
    g.save(); g.globalCompositeOperation = 'lighter';
    const r = 380 * u * (.6 + .4 * burn);
    const glow = g.createRadialGradient(dx, gy + 6 * u, 0, dx, gy + 6 * u, r);
    glow.addColorStop(0, `rgba(255,190,100,${.75 * burn})`); glow.addColorStop(.35, `rgba(255,120,50,${.3 * burn})`); glow.addColorStop(1, 'rgba(255,100,40,0)');
    g.fillStyle = glow; g.fillRect(dx - r, gy - r * .6, r * 2, r * 1.2); g.restore();
  }
  const fadeOut = 1 - smoothstep(.16, .34, p);
  if (age > 0 && fadeOut > .01) {
    for (const c of puffs) {
      const travel = (40 + c.speed * age * H * 3.6) * u;
      const rr = c.r * u * (.6 + age * 9 * c.speed);
      const x = dx + c.side * Math.min(travel, W * .6) + Math.sin(time * .6 + c.ph) * 4 * u;
      const y = gy - rr * (.25 + c.lift * .45) - age * H * 1.4 * c.lift;
      puff(g, x, y, rr, Math.min(1, age * 26) * fadeOut * .9, clamp(.6 - age * 2.5, 0, 1));
    }
  }
}
