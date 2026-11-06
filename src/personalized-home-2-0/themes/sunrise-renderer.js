import { createConstellationLayer } from './constellations.js';
import { NOISE_GLSL } from './glsl-common.js';
import { clamp, createFullscreenProgram, createFullscreenTriangle, hexToRgb, lerp, mixRgb, smoothstep } from './gl-utils.js';

// 海平线日出: the sea level is fixed at two thirds of the height. Scroll progress
// raises the sun (right of the widgets) from far below the horizon to the morning
// sky; palette, stars, cloud light, reflection and glitter all follow it.
const HORIZON = 1 / 3; // uv-y of the sea level, i.e. two thirds down from the top
const ALT_MIN = -0.34;
const ALT_MAX = 0.4;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform vec2 uSun;
uniform float uSunR;
uniform float uHorizon;
uniform vec3 uSky[5];
uniform vec3 uSea0;
uniform vec3 uSea1;
uniform vec3 uGlow;
uniform vec3 uSunCol;
uniform vec4 uMix; // x glow strength, y stars, z clouds, w sun altitude above the sea level

#define ASPECT (uRes.x / uRes.y)

${NOISE_GLSL}
// Catmull-Rom through five stops so the sky has no visible banding between them.
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

float stars(vec2 px, float t) {
  return starLayer(px, 14., 0., .06, .5, t) * .4
       + starLayer(px, 34., 1., .09, .62, t)
       + starLayer(px, 60., 2., .12, .8, t) * 1.1
       + starLayer(px, 130., 3., .16, 1., t) * 1.5;
}
vec3 milkyWay(vec2 uv, vec2 px) {
  vec2 p = (uv - vec2(.52, .64)) * vec2(ASPECT, 1.);
  float a = -.5;
  vec2 q = vec2(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a));
  float band = exp(-q.y * q.y / .026);
  float cloud = fbm(vec2(q.x * 2.6, q.y * 8.) + 2.7);
  float core = band * (.25 + 1. * cloud * cloud);
  float dust = pow(hash21(floor(px * .8)), 38.) * band * 2.;
  vec3 tint = mix(vec3(.3, .4, .88), vec3(.82, .58, .86), cloud);
  return tint * core * .16 + vec3(.8, .86, 1.) * dust * .4;
}
float shootingStar(vec2 uv, float t) {
  const float period = 12.;
  float cycle = floor(t / period + .35);
  float k = (fract(t / period + .35)) * period;
  const float dur = .85;
  if (k > dur) return 0.;
  float u = k / dur;
  vec2 h = vec2(hash21(vec2(cycle, 1.3)), hash21(vec2(cycle, 7.1)));
  vec2 start = vec2(.1 + h.x * .6, .8 + h.y * .14) * vec2(ASPECT, 1.);
  vec2 dir = normalize(vec2(1., -.5 - h.y * .3));
  vec2 head = start + dir * u * .42;
  float tail = .13 * sin(u * 3.14159);
  vec2 p = uv * vec2(ASPECT, 1.) - head;
  float along = clamp(dot(p, -dir), 0., max(tail, .0001));
  float d = length(p + dir * along);
  // The division is only approximately 1 at the tail end on some GPUs; pow() of a tiny
  // negative number is NaN and would blank every pixel past the tail, so clamp it first.
  float tailK = clamp(1. - along / max(tail, .0001), 0., 1.);
  float fade = tailK * sqrt(tailK) * sin(u * 3.14159);
  return (exp(-d * d / 1.2e-6) + exp(-d * d / 1.2e-5) * .35) * fade;
}

// Thin stretched cloud streaks that catch the first light from below.
float cloudDensity(vec2 uv, float s, float t) {
  vec2 p = vec2(uv.x * ASPECT * .9 - t * .006, uv.y);
  float n1 = fbm(vec2(p.x * 1.1, p.y * 8.5) + vec2(3.1, 1.7));
  float n2 = fbm(vec2(p.x * 3.4 + 4., p.y * 18.) + vec2(8., -t * .012));
  float n = n1 * .6 + n2 * .4;
  float env = smoothstep(.0, .1, s) * (1. - smoothstep(.38, .8, s));
  return smoothstep(.48, .74, n) * env;
}

// The disc is blinding at its core and only warms slightly towards the limb.
vec3 sunFace(float k) {
  return mix(vec3(1., .97, .86) * 2.1, uSunCol * 1.3 + vec3(.1), smoothstep(.62, 1.04, k));
}

// HDR sky: values above 1 near the sun are rolled off later without losing their hue.
vec3 skyColor(vec2 uv, vec2 px, float t, float reflected) {
  float s = clamp((uv.y - uHorizon) / (1. - uHorizon), 0., 1.);
  vec2 d = (uv - uSun) * vec2(ASPECT, 1.);
  float r = length(d);
  float glowAmt = uMix.x, starAmt = uMix.y, cloudAmt = uMix.z, alt = uMix.w;

  // Colour crowds towards the horizon away from the sun, so the glow pools beside it.
  float near = exp(-abs(d.x) / .85);
  float sEff = s * (1. + 1.1 * (1. - near) * glowAmt * (1. - smoothstep(.1, .35, alt)));
  vec3 col = skyGradient(sEff);

  if (starAmt > .002) {
    float fade = smoothstep(.0, .24, s) * starAmt;
    col += (milkyWay(uv, px) + vec3(.82, .88, 1.) * (stars(px, t) + shootingStar(uv, t) * 2.2)) * fade;
  }

  float highSun = smoothstep(.12, .42, alt);
  float halo = exp(-max(r - uSunR, 0.) / (uSunR * 1.1));
  float bloom = exp(-r / .17);
  float wash = exp(-r * r / .46) * (1. - .55 * highSun);
  float lowBand = exp(-abs(uv.y - uHorizon) / .07) * exp(-abs(d.x) / .6) * (1. - smoothstep(.0, .3, alt - .04));
  vec3 light = uGlow * (wash * .2 + bloom * .42 + lowBand * .5) + uSunCol * (halo * .8 + exp(-r / (uSunR * 6.)) * .32);

  float ang = atan(d.y, d.x);
  float rays = pow(vnoise(vec2(ang * 7. + t * .03, 1.7)) * .7 + vnoise(vec2(ang * 16. - t * .02, 4.1)) * .3, 2.4);
  light += uGlow * rays * exp(-r / .6) * .13 * (1. - highSun);

  float cd = cloudDensity(uv, s, t) * cloudAmt;
  if (cd > .001) {
    float lit = clamp(exp(-r / .45) * 1.3 + lowBand * .5 + .12, 0., 1.);
    vec3 shade = col * .66;
    vec3 warm = uGlow * (.34 + .6 * lit) + col * .34;
    col = mix(col, mix(shade, warm, lit * glowAmt + .08), cd * .78);
  }

  col += light * glowAmt;

  if (reflected < .5) {
    float edge = max(1.4 / uRes.y, uSunR * .07);
    float disc = 1. - smoothstep(uSunR - edge, uSunR + edge * .6, r);
    vec3 face = sunFace(r / uSunR);
    col = mix(col, face, disc);
  }
  return col;
}

float waveHeight(vec2 q, float t) {
  return fbm(q + vec2(t * .05, t * .2)) * .68 + vnoise(q * 2.9 - vec2(t * .12, t * .5)) * .32;
}

vec3 seaColor(vec2 uv, vec2 px, float t) {
  float h = uHorizon;
  float depth = clamp((h - uv.y) / h, 0., 1.);
  float persp = 1. / (depth * 1.25 + .05);
  float dx = (uv.x - uSun.x) * ASPECT;
  vec2 q = vec2(dx * (persp * .6 + 5.), persp * 2.7);
  float e = .04;
  float hc = waveHeight(q, t);
  float hx = waveHeight(q + vec2(e, 0.), t);
  float hy = waveHeight(q + vec2(0., e), t);
  vec2 slope = vec2(hx - hc, hy - hc) / e;

  float amp = (.1 + depth) * .014;
  vec2 ruv = vec2(uv.x + slope.x * amp * .6, h + (h - uv.y) * 1.12 + slope.y * amp * .3);
  vec3 refl = skyColor(ruv, px, t, 1.);

  // The disc's reflection, torn into horizontal slivers by the ripples.
  float tear = vnoise(vec2(uv.y * 170., t * .8 + 3.)) - .5;
  vec2 mirrored = vec2((uv.x + tear * .016 * (.25 + depth * 2.) + slope.x * amp * .6 - uSun.x) * ASPECT,
                       h + (h - uv.y) * 1.12 - uSun.y);
  float mr = length(mirrored);
  float reflectedDisc = (1. - smoothstep(uSunR * .88, uSunR * 1.2, mr)) * smoothstep(.0, .012, depth);

  vec3 body = mix(uSea0, uSea1, pow(depth, .55));
  body *= .9 + (hc - .5) * .6;
  float fresnel = .3 + .64 * pow(1. - depth, 3.);
  vec3 col = mix(body, refl, fresnel);
  col = mix(col, sunFace(mr / uSunR) * .8, reflectedDisc * .85);

  float alt = uMix.w, glowAmt = uMix.x;
  float sunUp = smoothstep(-.06, .04, alt);
  float sliver = smoothstep(.46, .82, hc + (vnoise(q * 3.3 + t * .7) - .5) * .25);

  // A continuous column of light, broken into horizontal slivers by the facets.
  float colW = uSunR * 1.15 + depth * .13 + (1. - sunUp) * .04;
  float column = exp(-dx * dx / (colW * colW));
  float reach = .12 + .88 * pow(1. - depth, 1.3);
  col += uSunCol * column * (.22 + 1.9 * sliver) * reach * 1.5 * sunUp;
  // Cooler highlights where facets mirror the glowing sky elsewhere.
  col += uGlow * pow(sliver, 3.) * pow(1. - depth, 2.) * .22 * glowAmt * exp(-abs(dx) / .9);
  float soft = exp(-dx * dx / (colW * colW * 6.)) * pow(1. - depth, 1.5);
  col += uGlow * soft * .3 * glowAmt;
  return col;
}

void main() {
  vec2 uv = vUv;
  vec2 px = uv * uRes / uDpr;
  float t = uTime;
  vec3 col = uv.y >= uHorizon ? skyColor(uv, px, t, 0.) : seaColor(uv, px, t);

  // A faint seam where air meets water, brightest beside the sun.
  float seam = exp(-pow((uv.y - uHorizon) / (1.4 / uRes.y), 2.));
  col += uGlow * seam * .1 * uMix.x * exp(-abs((uv.x - uSun.x) * ASPECT) / .5);

  vec2 vq = (uv - vec2(.5, .52)) * vec2(1., 1.05);
  col *= 1. - .3 * smoothstep(.42, 1.05, length(vq));
  col *= .88 + .12 * smoothstep(0., .22, uv.y);

  // Hue-preserving highlight roll-off: hot cores turn white, their surroundings stay coloured.
  float m = max(col.r, max(col.g, col.b));
  if (m > .82) {
    float k = (.82 + .18 * (1. - exp(-(m - .82) / .18))) / m;
    col *= k;
    col = mix(col, vec3(1.), smoothstep(1.1, 2.4, m) * .75);
  }
  col += (hash21(gl_FragCoord.xy + fract(t) * 91.7) - .5) * (1.6 / 255.);
  outColor = vec4(clamp(col, 0., 1.), 1.);
}`;

const rgb = hex => hexToRgb(hex);
// Keyframes along scroll progress. sky stops run horizon → zenith.
const KEYS = [
  { p: 0, sky: ['#1a2352', '#131b45', '#0c1236', '#070b25', '#03061a'], sea: ['#101a3d', '#03060f'], glow: '#3a3a88', glowAmt: 0, stars: 1, clouds: 0.05 },
  { p: 0.18, sky: ['#34317c', '#25286a', '#151c50', '#0a1136', '#040820'], sea: ['#1a1f55', '#040712'], glow: '#6a4ab0', glowAmt: 0.4, stars: 0.95, clouds: 0.18 },
  { p: 0.32, sky: ['#7a4097', '#55378b', '#2b2c70', '#141d52', '#070d2e'], sea: ['#3a2b72', '#060914'], glow: '#c05a9c', glowAmt: 0.62, stars: 0.5, clouds: 0.5 },
  { p: 0.42, sky: ['#f08a74', '#c9588a', '#7a4b9a', '#34397a', '#0d1a48'], sea: ['#463c82', '#0a0d22'], glow: '#ff8a64', glowAmt: 0.85, stars: 0.16, clouds: 0.85 },
  { p: 0.5, sky: ['#ffbe7a', '#f58f86', '#b56ca0', '#4a5496', '#142a68'], sea: ['#40427f', '#0d1230'], glow: '#ffb066', glowAmt: 1, stars: 0, clouds: 1 },
  { p: 0.62, sky: ['#ffd9a0', '#fbb096', '#c78ab0', '#6a80c0', '#1f4088'], sea: ['#36508e', '#0c1a40'], glow: '#ffc784', glowAmt: 0.95, stars: 0, clouds: 0.95 },
  { p: 0.8, sky: ['#ffe8c0', '#f5cdb4', '#b9b4d2', '#7fa4d6', '#2c5cac'], sea: ['#3f7ab0', '#0c2a58'], glow: '#ffd9a0', glowAmt: 0.8, stars: 0, clouds: 0.8 },
  { p: 1, sky: ['#ffeccb', '#cfe2f2', '#8cbfeb', '#4d8ed6', '#2459ad'], sea: ['#4a90c0', '#0d3a6a'], glow: '#ffe2b0', glowAmt: 0.7, stars: 0, clouds: 0.7 },
].map(key => ({ ...key, sky: key.sky.map(rgb), sea: key.sea.map(rgb), glow: rgb(key.glow) }));

function samplePalette(p) {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = smoothstep(a.p, b.p, p);
  return {
    sky: a.sky.map((color, index) => mixRgb(color, b.sky[index], t)),
    sea: a.sea.map((color, index) => mixRgb(color, b.sea[index], t)),
    glow: mixRgb(a.glow, b.glow, t),
    glowAmt: lerp(a.glowAmt, b.glowAmt, t),
    stars: lerp(a.stars, b.stars, t),
    clouds: lerp(a.clouds, b.clouds, t),
  };
}

const SUN_LOW = rgb('#ff7d34');
const SUN_HIGH = rgb('#fff4d6');

export function createSunriseRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: false, depth: false, stencil: false, antialias: false });
  if (!gl) throw new Error('WebGL2 unavailable');
  let program, geometry;
  try {
    program = createFullscreenProgram(gl, FRAGMENT);
    geometry = createFullscreenTriangle(gl);
  } catch (error) {
    if (program) gl.deleteProgram(program);
    if (geometry) { gl.deleteBuffer(geometry.buffer); gl.deleteVertexArray(geometry.vao); }
    throw error;
  }
  const names = ['uRes', 'uDpr', 'uTime', 'uSun', 'uSunR', 'uHorizon', 'uSky[0]', 'uSea0', 'uSea1', 'uGlow', 'uSunCol', 'uMix'];
  const u = Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, name)]));
  const skyData = new Float32Array(15);
  let width = 1, cssHeight = 1, scale = 1, disposed = false, lastP = 0, lastTime = 0, wasActive = false;
  // Constellation overlay: only when mounted in the page (previews render on a detached canvas).
  let overlay = null, layer = null;
  if (canvas.parentElement) {
    overlay = document.createElement('canvas');
    overlay.className = 'scroll-theme-overlay';
    canvas.after(overlay);
    layer = createConstellationLayer(overlay);
  }

  return {
    resize(w, h, dpr = 1) {
      width = w; cssHeight = h;
      layer?.resize(w, h, dpr);
      scale = Math.min(1.5, dpr, Math.sqrt(2400000 / (w * h)));
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
    },
    render({ p, time, layout }) {
      if (disposed || gl.isContextLost()) return;
      lastP = p; lastTime = time;
      const palette = samplePalette(p);
      const alt = lerp(ALT_MIN, ALT_MAX, p);
      const sunX = clamp(((width / 2) + (layout?.avoidHalf ?? 350) + 110) / width, 0.7, 0.88) + (p - 0.5) * 0.03;
      const sunR = 0.036 + 0.032 * (1 - smoothstep(0, 0.26, alt));
      const sunColor = mixRgb(SUN_LOW, SUN_HIGH, smoothstep(-0.02, 0.32, alt));
      palette.sky.forEach((color, index) => skyData.set(color, index * 3));

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
      gl.useProgram(program); gl.bindVertexArray(geometry.vao);
      gl.uniform2f(u.uRes, canvas.width, canvas.height);
      gl.uniform1f(u.uDpr, scale);
      gl.uniform1f(u.uTime, time);
      gl.uniform2f(u.uSun, sunX, HORIZON + alt);
      gl.uniform1f(u.uSunR, sunR);
      gl.uniform1f(u.uHorizon, HORIZON);
      gl.uniform3fv(u['uSky[0]'], skyData);
      gl.uniform3fv(u.uSea0, palette.sea[0]);
      gl.uniform3fv(u.uSea1, palette.sea[1]);
      gl.uniform3fv(u.uGlow, palette.glow);
      gl.uniform3fv(u.uSunCol, sunColor);
      gl.uniform4f(u.uMix, palette.glowAmt, palette.stars, palette.clouds, alt);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // The overlay runs on the scene clock, so it pauses with the scene and honours reduced motion.
      if (layer && (layer.active || wasActive)) { layer.paint(time * 1000); wasActive = layer.active; }
    },
    /** A click on the wallpaper: at night it joins nearby stars into a constellation. */
    pointer({ x, y }) {
      if (!layer || samplePalette(lastP).stars < 0.4) return;
      if (layer.click(x, y, lastTime * 1000, cssHeight * (1 - HORIZON))) { layer.paint(lastTime * 1000); wasActive = true; }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      overlay?.remove();
      gl.deleteBuffer(geometry.buffer); gl.deleteVertexArray(geometry.vao); gl.deleteProgram(program);
      queueMicrotask(() => { if (!canvas.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext(); });
    },
  };
}
