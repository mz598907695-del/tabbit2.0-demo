import { clamp, hexToRgb, lerp, mixRgb, smoothstep } from './gl-utils.js';
import { mod, mulberry32 } from './canvas-kit.js';

// 纵身入海 — Dave-the-Diver pixel art. Everything is drawn on a small "logical" canvas
// (one logical pixel = `ps` screen pixels) and stretched with nearest-neighbour scaling.
// The diver stays pinned on screen; scroll progress moves the world: the boat drops
// away, the camera follows the dive through bright water, a pitch-black band lit only
// by anglerfish, and on to the sea floor where SpongeBob and Patrick live.
// Units below are logical pixels; depths are measured from the water surface.
const PI = Math.PI;
const rgb = hexToRgb;
const OUTLINE = rgb('#0b1535');
const hash2 = (x, y) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

// ---- Timeline (scroll progress) --------------------------------------------------
const T_CROUCH = 0.012, T_JUMP0 = 0.066, T_ENTRY = 0.15;
const DECK = 13;          // bow platform above the waterline
const ENTRY_TIP = 23;     // hip → hands (arms overhead)
const PEAK_RISE = 18;
const D_END = 560;        // hip depth at the last frame
const FLOOR = D_END + 66; // top of the sand

// ---- Water palette by depth --------------------------------------------------------
const WATER = [
  [0, '#4fe0e4'], [45, '#35c8e6'], [110, '#2b9fe6'], [190, '#2667d0'], [260, '#1f43aa'], [320, '#162a84'],
  [360, '#0c1658'], [400, '#050a2e'], [440, '#02040f'], [480, '#04071c'], [520, '#0b2461'], [570, '#143f86'], [660, '#1b5ea6'],
].map(([z, hex]) => [z, rgb(hex)]);
function waterAt(z) {
  if (z <= 0) return WATER[0][1];
  for (let i = 1; i < WATER.length; i++) {
    if (z <= WATER[i][0]) return mixRgb(WATER[i - 1][1], WATER[i][1], (z - WATER[i - 1][0]) / (WATER[i][0] - WATER[i - 1][0]));
  }
  return WATER[WATER.length - 1][1];
}
const SKY = [[0, rgb('#5fbcff')], [0.55, rgb('#95d9ff')], [1, rgb('#d8f6ff')]];
const SAND = rgb('#f2dcae');
/** 0 in bright water, 1 inside the black band, fading out towards the sea floor. */
const darkness = z => smoothstep(330, 400, z) * (1 - smoothstep(470, 530, z));

// ---- Pose (angles from straight down, forward positive) -----------------------------
const B = { torso: 11, neck: 1.2, head: 4.7, upperArm: 5.4, foreArm: 5, thigh: 6.6, shin: 6.6 };
const POSES = [
  [0.0, 0.0, [0.03, 0, 0.12, 0.28, 0.02, 0.18, 0.06, 0.02, -0.05, -0.04]],
  [T_CROUCH, 0.0, [0.03, 0, 0.12, 0.28, 0.02, 0.18, 0.06, 0.02, -0.05, -0.04]],
  [0.05, 0.04, [0.62, -0.35, -0.95, -0.55, -1.05, -0.7, 1.05, -0.45, 0.95, -0.5]],
  [T_JUMP0, 0.2, [0.1, 0.05, 2.5, 2.8, 2.4, 2.7, 0.05, 0.12, -0.1, -0.05]],
  [0.098, 1.4, [0.35, 0.1, 2.9, 3.0, 2.8, 3.0, 0.5, -0.3, 0.4, -0.35]],
  [0.14, PI - 0.42, [0, 0, 3.05, 3.1, 3.0, 3.08, -0.02, 0, 0, 0.03]],
  [0.3, PI - 0.3, [0, 0, 3.0, 3.05, 2.95, 3.0, 0, 0.02, -0.02, 0]],
  [1.0, PI - 0.3, [0, 0, 3.0, 3.05, 2.95, 3.0, 0, 0.02, -0.02, 0]],
];
function poseAt(p) {
  let i = 0;
  while (i < POSES.length - 2 && p > POSES[i + 1][0]) i++;
  const [p0, f0, a] = POSES[i], [p1, f1, b] = POSES[i + 1];
  const t = smoothstep(p0, p1, p);
  return { phi: lerp(f0, f1, t), joints: a.map((value, index) => lerp(value, b[index], t)) };
}
const footDrop = j => Math.max(
  B.thigh * Math.cos(j[6]) + B.shin * Math.cos(j[7]),
  B.thigh * Math.cos(j[8]) + B.shin * Math.cos(j[9]),
) + 2;
const HEAD_DOWN = PI - 0.3, HEAD_UP = 0.28, LEVEL = 1.95;

const Y0 = -(DECK + footDrop(poseAt(T_JUMP0).joints));
const DELTA = -ENTRY_TIP - Y0;
const A_COEF = 2 * PEAK_RISE + DELTA;
const GRAV = 2 * (A_COEF + Math.sqrt(A_COEF * A_COEF - DELTA * DELTA));
const TAU_PEAK = 0.5 - DELTA / GRAV;
const V0 = -GRAV * TAU_PEAK;

function hipDepth(p, joints, time) {
  if (p <= T_JUMP0) {
    const bob = Math.sin(time * 1.25) * 0.7 * (1 - smoothstep(T_CROUCH, T_JUMP0, p));
    return -(DECK + footDrop(joints)) + bob;
  }
  if (p < T_ENTRY) {
    const tau = (p - T_JUMP0) / (T_ENTRY - T_JUMP0);
    return Y0 + V0 * tau + 0.5 * GRAV * tau * tau;
  }
  const s = (p - T_ENTRY) / (1 - T_ENTRY);
  return -ENTRY_TIP + (D_END + ENTRY_TIP) * (1.45 * s - 0.45 * s * s);
}
const leapShift = p => 45 * (1 - (1 - clamp((p - T_JUMP0) / (T_ENTRY - T_JUMP0))) ** 2) + 20 * smoothstep(T_ENTRY, 0.45, p);

// ---- Pixel sprite toolkit ------------------------------------------------------------
/** Threshold antialiased vector art into hard pixels and add a one-pixel outline. */
function finishSprite(canvas, outline = OUTLINE, threshold = 100) {
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const { width: w, height: h } = canvas;
  const image = g.getImageData(0, 0, w, h), d = image.data;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (d[i * 4 + 3] >= threshold) { d[i * 4 + 3] = 255; solid[i] = 1; } else d[i * 4 + 3] = 0;
  }
  if (outline) {
    const edge = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (solid[i]) continue;
        if ((x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w])) edge.push(i);
      }
    }
    for (const i of edge) { d[i * 4] = outline[0] * 255; d[i * 4 + 1] = outline[1] * 255; d[i * 4 + 2] = outline[2] * 255; d[i * 4 + 3] = 255; }
  }
  g.putImageData(image, 0, 0);
}
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function sprite(w, h, draw, outline = OUTLINE, threshold = 100) {
  const c = makeCanvas(w, h);
  draw(c.getContext('2d', { willReadFrequently: true }));
  finishSprite(c, outline, threshold);
  return c;
}
function redraw(c, draw, outline = OUTLINE, threshold = 100) {
  const g = c.getContext('2d', { willReadFrequently: true });
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
  draw(g); finishSprite(c, outline, threshold);
}
const fillCircle = (g, x, y, r, color) => { g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, PI * 2); g.fill(); };
function strokeLine(g, color, width, points) {
  g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) g.lineTo(points[i], points[i + 1]);
  g.stroke();
}
const seg = (x, y, angle, length) => [x + Math.sin(angle) * length, y + Math.cos(angle) * length];

// ---- Characters ------------------------------------------------------------------------
const SUIT = '#3b6be0', SUIT_FAR = '#274fb8', STRIPE = '#ffb13b', SKIN = '#f0b890', BEARD = '#5b3a22', TANK = '#f0932b', TANK_LIGHT = '#ffc45e';

function daveLimb(g, x0, y0, a1, l1, a2, l2, w1, w2, color, stripe) {
  const [x1, y1] = seg(x0, y0, a1, l1);
  const [x2, y2] = seg(x1, y1, a2, l2);
  strokeLine(g, color, w1, [x0, y0, x1, y1]);
  strokeLine(g, color, w2, [x1, y1, x2, y2]);
  if (stripe) strokeLine(g, stripe, w2 * 0.55, [x1 + (x2 - x1) * 0.45, y1 + (y2 - y1) * 0.45, x1 + (x2 - x1) * 0.7, y1 + (y2 - y1) * 0.7]);
  return [x2, y2];
}

/** Dave faces +x around the hip at the origin: wetsuit, orange tank, beard and mask. */
function drawDave(g, joints, under) {
  const [lean, tilt, aNu, aNl, aFu, aFl, lNu, lNl, lFu, lFl] = joints;
  const shX = Math.sin(lean) * (B.torso - 1), shY = -Math.cos(lean) * (B.torso - 1);
  const headDist = B.torso + B.neck + B.head - 1;
  const headX = Math.sin(lean) * headDist, headY = -Math.cos(lean) * headDist;
  const fin = 7 * under;

  const leg = (hipX, a1, a2, far) => {
    const [fx, fy] = daveLimb(g, hipX, 0, a1, B.thigh, a2, B.shin, 4.2, 3.8, far ? SUIT_FAR : SUIT, null);
    const toe = lerp(PI / 2, a2 + 0.3, under);
    const [tx, ty] = seg(fx, fy, toe, 2.2 + fin);
    strokeLine(g, far ? '#c4651a' : '#f27d2a', lerp(3.2, 3.8, under), [fx, fy, tx, ty]);
  };
  const arm = (sx, a1, a2, far) => {
    const [hx, hy] = daveLimb(g, sx, shY, a1, B.upperArm, a2, B.foreArm, 3.2, 3, far ? SUIT_FAR : SUIT, '#5aa0e0');
    fillCircle(g, hx, hy, 1.7, far ? '#c99a78' : SKIN);
  };
  // far side
  arm(shX - 0.5, aFu, aFl, true);
  leg(-0.8, lFu, lFl, true);
  // oxygen tank strapped to the back
  const nbx = -Math.cos(lean), nby = -Math.sin(lean);
  const t0 = [nbx * 6 + Math.sin(lean) * 1.5, nby * 6 - Math.cos(lean) * 1.5], t1 = [nbx * 6 + Math.sin(lean) * 10.5, nby * 6 - Math.cos(lean) * 10.5];
  strokeLine(g, TANK, 5.4, [t0[0], t0[1], t1[0], t1[1]]);
  strokeLine(g, TANK_LIGHT, 1.4, [t0[0] - nbx * 1.2, t0[1] - nby * 1.2, t1[0] - nbx * 1.2, t1[1] - nby * 1.2]);
  for (const k of [0.3, 0.7]) {
    const bx = t0[0] + (t1[0] - t0[0]) * k, by = t0[1] + (t1[1] - t0[1]) * k;
    strokeLine(g, '#8a4a10', 1.1, [bx - Math.cos(lean) * 2.6, by - Math.sin(lean) * 2.6, bx + Math.cos(lean) * 2.6, by + Math.sin(lean) * 2.6]);
  }
  strokeLine(g, '#c9ced8', 2, [t1[0], t1[1], t1[0] + Math.sin(lean) * 1.6, t1[1] - Math.cos(lean) * 1.6]);
  // torso
  strokeLine(g, SUIT, 10.5, [0, 0, shX, shY]);
  strokeLine(g, STRIPE, 1.4, [Math.cos(lean) * 3.4, Math.sin(lean) * 3.4, shX + Math.cos(lean) * 3.4, shY + Math.sin(lean) * 3.4]);
  strokeLine(g, SKIN, 3, [shX, shY, headX, headY]);
  // near side
  leg(0.8, lNu, lNl, false);
  // head: hair, beard, mask
  g.save(); g.translate(headX, headY); g.rotate(lean + tilt);
  fillCircle(g, 0, 0, B.head, SKIN);
  g.fillStyle = BEARD; g.beginPath(); g.arc(0.4, 0.4, B.head + 0.2, 0.15, PI - 0.15); g.fill();
  fillCircle(g, 2.6, 1.9, 2.2, BEARD);
  g.fillStyle = '#2e1d12'; g.beginPath(); g.arc(-0.4, -0.4, B.head + 0.4, 3.5, 5.9); g.closePath(); g.fill();
  strokeLine(g, '#16244f', 1.5, [1, -1.8, -B.head, -1.8]);
  fillCircle(g, 3.6, -1.6, 2.8, '#16244f');
  fillCircle(g, 3.8, -1.6, 1.9, '#9ee9ff');
  fillCircle(g, 4.4, -2.2, 0.7, '#ffffff');
  g.restore();
  arm(shX + 0.5, aNu, aNl, false);
}

function drawBoat(g, roll, time) {
  g.save(); g.translate(46, 40); g.rotate(roll); g.scale(0.3, 0.3);
  const hull = new Path2D();
  hull.moveTo(-112, -52); hull.bezierCurveTo(-104, -26, -92, -2, -66, 8);
  hull.bezierCurveTo(-30, 20, 50, 20, 86, 6); hull.lineTo(102, -42); hull.bezierCurveTo(60, -33, -40, -36, -112, -52); hull.closePath();
  g.fillStyle = '#b98a5e'; g.beginPath(); g.moveTo(-108, -52); g.bezierCurveTo(-40, -36, 60, -33, 100, -42); g.lineTo(100, -52); g.bezierCurveTo(60, -44, -40, -46, -108, -62); g.closePath(); g.fill();
  g.save(); g.clip(hull);
  g.fillStyle = '#fff4e0'; g.fillRect(-130, -60, 260, 90);
  g.fillStyle = '#f2604b'; g.fillRect(-130, -26, 260, 17);
  g.fillStyle = '#d6bf9a'; g.fillRect(-130, 4, 260, 30);
  g.restore();
  g.strokeStyle = '#7a4a2a'; g.lineWidth = 9; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-112, -52); g.bezierCurveTo(-40, -36, 60, -33, 102, -42); g.stroke();
  g.fillStyle = '#c68b59'; g.fillRect(-114, -60, 58, 12);
  g.strokeStyle = '#f2604b'; g.lineWidth = 11; g.beginPath(); g.arc(18, -22, 10, 0, PI * 2); g.stroke();
  g.strokeStyle = '#ffffff'; g.lineWidth = 11; for (const a of [0.2, PI / 2 + 0.2, PI + 0.2, PI * 1.5 + 0.2]) { g.beginPath(); g.arc(18, -22, 10, a, a + 0.7); g.stroke(); }
  strokeLine(g, '#5b3b27', 7, [92, -42, 92, -112]);
  const flutter = Math.sin(time * 4) * 7;
  g.fillStyle = '#f2604b'; g.beginPath(); g.moveTo(92, -112); g.lineTo(128, -102 + flutter); g.lineTo(92, -88); g.closePath(); g.fill();
  g.restore();
}

// ---- Sea life ------------------------------------------------------------------------------
const FISH = {
  tang: { L: 13, H: 8, body: '#ffd43b', tail: '#ffb703', accent: '#2a2a2a' },
  blue: { L: 16, H: 9, body: '#3d8bff', tail: '#ffd43b', accent: '#10204a' },
  clown: { L: 14, H: 8, body: '#ff8a2b', tail: '#ff8a2b', accent: '#ffffff' },
  silver: { L: 22, H: 9, body: '#d4e2f0', tail: '#9fb5cc', accent: '#7b93b0' },
  sardine: { L: 9, H: 5, body: '#e9f3fb', tail: '#bcd0e2', accent: '#9fb5cc' },
  bass: { L: 30, H: 17, body: '#8b6a4a', tail: '#6a4e36', accent: '#d9b48a' },
  glow: { L: 9, H: 6, body: '#7fe7ff', tail: '#3fb7d6', accent: '#e6fbff' },
};
function fishSprite(kind, frame) {
  const f = FISH[kind];
  return sprite(Math.ceil(f.L * 1.35) + 4, f.H + 8, g => {
    const cx = f.L * 0.78 + 2, cy = (f.H + 8) / 2, wag = frame ? 1.1 : -0.7;
    g.fillStyle = f.tail; g.beginPath(); g.moveTo(cx - f.L * 0.28, cy); g.lineTo(cx - f.L * 0.62, cy - f.H * 0.5 + wag); g.lineTo(cx - f.L * 0.62, cy + f.H * 0.5 + wag); g.closePath(); g.fill();
    g.fillStyle = f.body; g.beginPath(); g.ellipse(cx, cy, f.L * 0.42, f.H * 0.5, 0, 0, PI * 2); g.fill();
    g.fillStyle = f.accent;
    if (kind === 'clown') { g.fillRect(cx - f.L * 0.12, cy - f.H * 0.5, 1.6, f.H); g.fillRect(cx + f.L * 0.18, cy - f.H * 0.4, 1.4, f.H * 0.8); }
    else if (kind === 'blue') { g.fillRect(cx - f.L * 0.3, cy - 1, f.L * 0.55, 1.6); }
    else if (kind === 'bass' || kind === 'silver') { g.globalAlpha = 0.5; g.beginPath(); g.ellipse(cx, cy - f.H * 0.28, f.L * 0.36, f.H * 0.2, 0, 0, PI * 2); g.fill(); g.globalAlpha = 1; }
    else if (kind === 'tang') g.fillRect(cx - f.L * 0.1, cy - f.H * 0.55, f.L * 0.3, 1);
    fillCircle(g, cx + f.L * 0.22, cy - f.H * 0.1, Math.max(1, f.H * 0.14), '#ffffff');
    fillCircle(g, cx + f.L * 0.25, cy - f.H * 0.1, Math.max(0.5, f.H * 0.07), '#10152a');
  });
}
function exclaimSprite() {
  return sprite(5, 9, g => { g.fillStyle = '#fff04a'; g.fillRect(1, 0, 3, 5); g.fillRect(1, 6, 3, 3); }, OUTLINE, 60);
}
function jellySprite(phase) {
  return sprite(20, 28, g => {
    const open = 0.75 + 0.25 * phase;
    g.fillStyle = '#ff8cc0'; g.beginPath(); g.moveTo(3, 11); g.bezierCurveTo(3, 11 - 12 * open, 17, 11 - 12 * open, 17, 11); g.quadraticCurveTo(10, 14 - 3 * phase, 3, 11); g.fill();
    g.fillStyle = '#ffc4e0'; g.beginPath(); g.ellipse(7, 6, 2.6, 1.6, -0.4, 0, PI * 2); g.fill();
    for (let k = -1; k <= 1; k++) strokeLine(g, '#ff9fcb', 1.4, [10 + k * 4, 12, 10 + k * 4 + Math.sin(phase * 3 + k) * 1.5, 18, 10 + k * 4 - Math.sin(phase * 3 + k) * 1.5, 25]);
  }, rgb('#8a2a70'));
}
function anglerSprite() {
  return sprite(40, 30, g => {
    strokeLine(g, '#3a2a6a', 1.3, [26, 11, 31, 4, 36, 2]);
    g.fillStyle = '#34225c'; g.beginPath(); g.moveTo(8, 17); g.lineTo(1, 10); g.lineTo(2, 24); g.closePath(); g.fill();
    g.fillStyle = '#3a2766'; g.beginPath(); g.ellipse(18, 17, 12, 9, 0, 0, PI * 2); g.fill();
    g.fillStyle = '#5b3f94'; g.beginPath(); g.ellipse(17, 21, 9, 4, 0, 0, PI * 2); g.fill();
    g.fillStyle = '#7a1f3a'; g.beginPath(); g.moveTo(29, 15); g.lineTo(22, 15); g.lineTo(23, 24); g.lineTo(30, 22); g.closePath(); g.fill();
    g.fillStyle = '#ffffff';
    for (const [x, y] of [[29, 15.5], [27, 15.5], [25, 15.5], [29, 21.5], [27, 22.5], [25, 23]]) g.fillRect(x, y, 1.2, 2);
    fillCircle(g, 24, 11, 2.6, '#f4f0ff'); fillCircle(g, 24.8, 11, 1.2, '#10152a');
    g.fillStyle = '#4c3585'; g.beginPath(); g.moveTo(14, 12); g.lineTo(11, 5); g.lineTo(19, 9); g.closePath(); g.fill();
    fillCircle(g, 36, 2.2, 2.4, '#fff7a8');
  }, rgb('#100a26'));
}
function spongeBobSprite(wave) {
  return sprite(32, 42, g => {
    for (const x of [11.5, 19.5]) {
      strokeLine(g, '#ffe14a', 1.8, [x, 30, x, 36]);
      g.fillStyle = '#ffffff'; g.fillRect(x - 1, 33, 2, 2.2);
      g.fillStyle = '#3a2a1a'; g.beginPath(); g.ellipse(x + 0.6, 38.2, 2.6, 1.6, 0, 0, PI * 2); g.fill();
    }
    g.fillStyle = '#8d5a2b'; g.fillRect(6.5, 24, 18, 6.5);
    g.fillStyle = '#6a3f1b'; g.fillRect(6.5, 24, 18, 1.2);
    g.fillStyle = '#ffffff'; g.fillRect(6.5, 21.5, 18, 2.6);
    g.fillStyle = '#e03a3a'; g.beginPath(); g.moveTo(14.5, 22); g.lineTo(17.5, 22); g.lineTo(16, 26); g.closePath(); g.fill();
    g.fillStyle = '#ffe14a'; g.beginPath(); g.roundRect(5.5, 2.5, 20, 19.5, 2.5); g.fill();
    g.fillStyle = '#e9b82a';
    for (const [x, y, r] of [[8.5, 5, 1.2], [22.5, 17, 1.4], [8, 18, 1], [22, 6, 1.1], [15.5, 3.6, 0.9]]) { g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, PI * 2); g.fill(); }
    strokeLine(g, '#ffe14a', 1.8, [5.5, 14, 2.5, 22]);
    if (wave) strokeLine(g, '#ffe14a', 1.8, [25.5, 13, 29.5, 6]);
    else strokeLine(g, '#ffe14a', 1.8, [25.5, 14, 28.5, 22]);
    for (const x of [12, 19]) { fillCircle(g, x, 9.4, 3.5, '#ffffff'); fillCircle(g, x + 0.6, 9.8, 1.7, '#38a2ff'); fillCircle(g, x + 0.7, 9.8, 0.8, '#10152a'); }
    for (const [a, b, c, d] of [[9.4, 6.6, 8.4, 5.6], [12, 5.8, 12, 4.8], [21.4, 6.6, 22.4, 5.6], [19, 5.8, 19, 4.8]]) strokeLine(g, '#10152a', 0.8, [a, b, c, d]);
    g.fillStyle = '#e9b82a'; g.beginPath(); g.ellipse(15.5, 13.2, 1.6, 1.1, 0, 0, PI * 2); g.fill();
    g.strokeStyle = '#7a3a1a'; g.lineWidth = 0.9; g.beginPath(); g.arc(15.5, 14.2, 4.6, 0.35, PI - 0.35); g.stroke();
    g.fillStyle = '#ffffff'; g.fillRect(14.2, 18.2, 1.5, 2); g.fillRect(16.1, 18.2, 1.5, 2);
    fillCircle(g, 9.2, 14.8, 0.8, '#e9a02a'); fillCircle(g, 21.8, 14.8, 0.8, '#e9a02a');
  });
}
function patrickSprite() {
  return sprite(34, 36, g => {
    const star = [];
    for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, r = i % 2 ? 6.6 : 15.5; star.push([17 + Math.cos(a) * r, 15.5 + Math.sin(a) * r]); }
    g.fillStyle = '#ff9bb8'; g.beginPath(); star.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
    g.fillStyle = '#f06a92'; for (const [x, y] of [[10, 10], [24, 12], [14, 21], [22, 22], [17, 6]]) { g.beginPath(); g.arc(x, y, 0.9, 0, PI * 2); g.fill(); }
    fillCircle(g, 13.4, 12, 2, '#ffffff'); fillCircle(g, 20.6, 12, 2, '#ffffff'); fillCircle(g, 13.8, 12.2, 0.9, '#10152a'); fillCircle(g, 20.2, 12.2, 0.9, '#10152a');
    strokeLine(g, '#10152a', 0.9, [11, 9.2, 15.4, 9.6]); strokeLine(g, '#10152a', 0.9, [22.8, 9.2, 18.6, 9.6]);
    g.strokeStyle = '#a33a5a'; g.lineWidth = 0.9; g.beginPath(); g.arc(17, 15.2, 3.3, 0.3, PI - 0.3); g.stroke();
    g.fillStyle = '#6cc04a'; g.beginPath(); g.moveTo(8.5, 21.5); g.lineTo(25.5, 21.5); g.lineTo(26.5, 30); g.lineTo(7.5, 30); g.closePath(); g.fill();
    g.fillStyle = '#8e4fc0'; for (const [x, y] of [[11, 25], [17, 27], [22, 24.5], [14, 28.5], [21, 28.6]]) { g.beginPath(); g.arc(x, y, 1.1, 0, PI * 2); g.fill(); }
    g.fillStyle = '#ff9bb8'; g.fillRect(10, 30, 4.4, 4); g.fillRect(19.6, 30, 4.4, 4);
  });
}
function pineappleSprite() {
  return sprite(30, 50, g => {
    for (const [x, y, k] of [[15, 5, 0], [10, 8, -1], [20, 8, 1], [6, 13, -1.5], [24, 13, 1.5]]) {
      g.fillStyle = k ? '#2f9a46' : '#3fb458'; g.beginPath(); g.moveTo(x - 2.6, 17); g.lineTo(x + k * 1.4, y - 4); g.lineTo(x + 2.6, 17); g.closePath(); g.fill();
    }
    g.fillStyle = '#ff9d2a'; g.beginPath(); g.ellipse(15, 33, 11.5, 16, 0, 0, PI * 2); g.fill();
    g.strokeStyle = '#d9700f'; g.lineWidth = 0.8;
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(15 + i * 4 - 8, 19); g.lineTo(15 + i * 4 + 8, 47); g.moveTo(15 + i * 4 + 8, 19); g.lineTo(15 + i * 4 - 8, 47); g.stroke(); }
    for (const y of [27, 36]) { fillCircle(g, 15, y, 3.3, '#7fd0ff'); g.strokeStyle = '#8a4a10'; g.lineWidth = 1; g.beginPath(); g.arc(15, y, 3.3, 0, PI * 2); g.stroke(); }
    g.fillStyle = '#7a4a1a'; g.beginPath(); g.ellipse(15, 45, 3.6, 4, 0, PI, 0); g.fill(); g.fillRect(11.4, 45, 7.2, 2.5);
  });
}
function kelpSprite(height, phase) {
  return sprite(16, height + 4, g => {
    for (let blade = 0; blade < 2; blade++) {
      g.strokeStyle = blade ? '#58d27c' : '#2fb866'; g.lineWidth = 2.8; g.lineCap = 'round'; g.beginPath();
      for (let n = 0; n <= 9; n++) {
        const t = n / 9, x = 8 + blade * 3 - 1.5 + Math.sin(phase + t * 3.4 + blade) * (1 + t * 3.2) * t, y = height + 2 - t * height * (blade ? 0.72 : 1);
        n ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
  }, rgb('#0b3a2a'));
}
function coralSprite(kind) {
  return sprite(34, 30, g => {
    if (kind === 0) {
      const branch = (x, y, a, l, d, w) => {
        if (d <= 0) return;
        const nx = x + Math.cos(a) * l, ny = y + Math.sin(a) * l;
        strokeLine(g, '#ff6f9c', w, [x, y, nx, ny]);
        if (d === 1) fillCircle(g, nx, ny, w * 0.9, '#ffc2d6');
        branch(nx, ny, a - 0.5, l * 0.72, d - 1, w * 0.75); branch(nx, ny, a + 0.5, l * 0.72, d - 1, w * 0.75);
      };
      branch(17, 28, -PI / 2, 8, 3, 3.2);
    } else if (kind === 1) {
      g.fillStyle = '#ffa45c'; g.beginPath(); g.ellipse(17, 26, 13, 12, 0, PI, PI * 2); g.fill();
      g.fillStyle = '#ffd09a'; for (const [x, y] of [[10, 22], [17, 17], [24, 22], [13, 25], [21, 25]]) { g.beginPath(); g.arc(x, y, 1.2, 0, PI * 2); g.fill(); }
    } else {
      for (let i = -3; i <= 3; i++) { strokeLine(g, '#b57cff', 2.2, [17 + i * 3, 28, 17 + i * 4.6, 12 + Math.abs(i) * 2]); fillCircle(g, 17 + i * 4.6, 12 + Math.abs(i) * 2, 1.7, '#e6d2ff'); }
    }
  });
}
function rockSprite(seed) {
  const rand = mulberry32(seed);
  return sprite(36, 22, g => {
    g.fillStyle = '#7a8aa6'; g.beginPath(); g.moveTo(2, 20);
    const pts = 6; for (let i = 0; i <= pts; i++) g.lineTo(2 + (i / pts) * 32, 6 + rand() * 6 + Math.sin(i / pts * PI) * -3);
    g.lineTo(34, 20); g.closePath(); g.fill();
    g.fillStyle = '#9bacc6'; g.beginPath(); g.ellipse(14, 9, 7, 2.6, -0.2, 0, PI * 2); g.fill();
  });
}
function cloudSpritePx(seed, w, h) {
  const rand = mulberry32(seed);
  const puffs = Array.from({ length: 8 }, (_, i) => ({ x: w * (0.15 + 0.7 * i / 7), r: h * (0.2 + 0.2 * Math.sin(PI * i / 7)) * (0.8 + rand() * 0.4) }));
  return sprite(w, h, g => {
    for (const [dy, color] of [[2.4, '#bfe4fb'], [0, '#ffffff']]) {
      g.fillStyle = color;
      for (const p of puffs) { g.beginPath(); g.arc(p.x, h * 0.62 - p.r * 0.3 + dy, p.r, 0, PI * 2); g.fill(); }
      g.fillRect(w * 0.12, h * 0.6 + dy * 0.2, w * 0.76, h * 0.2);
    }
  }, null, 120);
}

// ---- Renderer ----------------------------------------------------------------------------
export function createDiveRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.imageSmoothingEnabled = false;
  const rand = mulberry32(20261022);

  // sprites that never change
  const fishSprites = Object.fromEntries(Object.keys(FISH).map(kind => [kind, [fishSprite(kind, 0), fishSprite(kind, 1)]]));
  const jelly = [jellySprite(0), jellySprite(0.5), jellySprite(1), jellySprite(0.5)];
  const angler = anglerSprite(), exclaim = exclaimSprite();
  const bob = [spongeBobSprite(false), spongeBobSprite(true)], patrick = patrickSprite(), pineapple = pineappleSprite();
  const kelp = [0, 1, 2].map(v => [0, 1, 2].map(ph => kelpSprite(26 + v * 9, ph * 2.1 + v)));
  const corals = [0, 1, 2].map(coralSprite);
  const rocks = [11, 12, 13].map(rockSprite);
  const clouds = [cloudSpritePx(5, 56, 22), cloudSpritePx(6, 72, 26), cloudSpritePx(7, 44, 18)];
  const daveSprite = makeCanvas(72, 72), boatSprite = makeCanvas(96, 64);

  // world layout (fractions of the logical width so it survives resizing)
  const SCHOOLS = [
    { z: 18, n: 6, dir: -1, speed: 9, kind: 'tang', spread: 36 },
    { z: 70, n: 16, dir: 1, speed: 17, kind: 'sardine', spread: 50 },
    { z: 128, n: 5, dir: -1, speed: 7, kind: 'clown', spread: 28 },
    { z: 196, n: 6, dir: 1, speed: 10, kind: 'blue', spread: 38 },
    { z: 250, n: 3, dir: -1, speed: 20, kind: 'silver', spread: 30 },
    { z: 318, n: 2, dir: 1, speed: 12, kind: 'bass', spread: 34 },
    { z: 560, n: 9, dir: 1, speed: 8, kind: 'glow', spread: 46 },
    { z: 604, n: 5, dir: -1, speed: 7, kind: 'clown', spread: 30 },
  ].map(school => ({
    ...school, fx: rand(),
    members: Array.from({ length: school.n }, () => ({
      ox: (rand() - 0.5) * school.spread * 1.6, oy: (rand() - 0.5) * school.spread * 0.5, ph: rand() * PI * 2,
      off: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, scared: 0, exclaim: 0, face: school.dir,
    })),
  }));
  const JELLIES = [[0.16, 150], [0.5, 240], [0.1, 300], [0.62, 566]].map(([fx, z]) => ({ fx, z, ph: rand() * PI * 2 }));
  const ANGLERS = [{ z: 408, fx: 0.2, dir: 1, speed: 5, ph: 0 }, { z: 438, fx: 0.7, dir: -1, speed: 4, ph: 2.1 }, { z: 462, fx: 0.4, dir: 1, speed: 6, ph: 4.2 }];
  const PLANKTON = Array.from({ length: 110 }, () => ({ fx: rand(), fy: rand(), par: 0.5 + rand() * 0.9, ph: rand() * PI * 2, big: rand() > 0.8 }));
  const KELP_AT = Array.from({ length: 11 }, (_, i) => ({ fx: (i + 0.2 + rand() * 0.6) / 11, v: Math.floor(rand() * 3), ph: rand() * 6 }));
  const CORAL_AT = Array.from({ length: 8 }, (_, i) => ({ fx: (i + 0.3 + rand() * 0.5) / 8, k: Math.floor(rand() * 3) }));
  const ROCK_AT = Array.from({ length: 5 }, (_, i) => ({ fx: (i + rand()) / 5, k: Math.floor(rand() * 3) }));

  let W = 1, H = 1, ps = 4, lw = 1, lh = 1, bg = null, disposed = false;
  const sim = { last: null, lastHip: null, lastTip: null, lastP: null, heading: 1, bubbles: [], drops: [], ripples: [], carry: 0, seeded: false, orient: 1, fishHits: [] };

  function resize(w, h) {
    W = w; H = h;
    ps = clamp(Math.round(h / 210), 3, 6);
    lw = Math.max(96, Math.round(w / ps)); lh = Math.max(72, Math.round(h / ps));
    canvas.width = lw; canvas.height = lh;
    ctx.imageSmoothingEnabled = false;
    bg = ctx.createImageData(lw, lh);
  }

  function splash(x, strength) {
    const n = Math.round(26 * strength);
    for (let i = 0; i < n; i++) {
      const spread = (rand() - 0.5) * 2;
      sim.drops.push({ x: x + spread * 4, z: -1, vx: spread * 34 * strength + (rand() - 0.5) * 10, vz: -(50 + rand() * 90) * (0.5 + 0.5 * strength), life: 1.5 });
    }
    for (let i = 0; i < n; i++) sim.bubbles.push({ x: x + (rand() - 0.5) * 12, z: 2 + rand() * 10, vz: -(5 + rand() * 12), r: 1 + Math.floor(rand() * 3), ph: rand() * PI * 2, age: 0 });
    sim.ripples.push({ x, t0: null, amp: 2.2 * strength });
  }

  function scare(lx, ly) {
    let best = null, bestD = 26;
    for (const hit of sim.fishHits) { const d = Math.hypot(hit.x - lx, hit.y - ly); if (d < bestD) { best = hit; bestD = d; } }
    if (!best) return;
    for (const hit of sim.fishHits) {
      if (Math.hypot(hit.x - best.x, hit.y - best.y) > 48) continue;
      const m = hit.member, away = Math.atan2(hit.y - ly, hit.x - lx + 0.001) + (rand() - 0.5) * 0.7, speed = 70 + rand() * 40;
      m.scared = 2.4; m.exclaim = 0.9; m.vel.x = Math.cos(away) * speed; m.vel.y = Math.sin(away) * speed * 0.7;
    }
  }

  function step(dt, time, p, hip, mouth, speed) {
    // The splash fires when the hands cross the surface, in either direction.
    const tip = hip + ENTRY_TIP * (p < T_ENTRY ? 1 : Math.max(0.2, 1 - (p - T_ENTRY) * 6));
    if (sim.lastTip != null) {
      if (sim.lastTip < 0 && tip >= 0) splash(mouth.entryX, 1);
      else if (sim.lastTip >= 0 && tip < 0) splash(mouth.entryX, 0.5);
    }
    sim.lastTip = tip;
    sim.ripples.forEach(r => { if (r.t0 == null) r.t0 = time; });
    sim.ripples = sim.ripples.filter(r => time - r.t0 < 3);
    // Dave breathes out little bubbles, more when he is moving.
    if (hip > 2) {
      sim.carry += dt * (2.6 + Math.min(9, speed / 40));
      while (sim.carry >= 1) {
        sim.carry -= 1;
        sim.bubbles.push({ x: mouth.x + (rand() - 0.5) * 2, z: mouth.z + (rand() - 0.5) * 2, vz: -(11 + rand() * 11), r: rand() < 0.5 ? 1 : rand() < 0.7 ? 2 : 3, ph: rand() * PI * 2, age: 0 });
      }
    }
    for (const b of sim.bubbles) { b.age += dt; b.z += b.vz * dt; b.x += Math.sin(time * 3 + b.ph) * 4 * dt; }
    sim.bubbles = sim.bubbles.filter(b => b.z > 0 && b.age < 16).slice(-240);
    for (const d of sim.drops) { d.life -= dt; d.vz += 240 * dt; d.z += d.vz * dt; d.x += d.vx * dt; }
    sim.drops = sim.drops.filter(d => d.life > 0 && d.z < 3);
    // startled fish dart away, then drift back to their school
    for (const school of SCHOOLS) {
      for (const m of school.members) {
        if (m.scared > 0) {
          m.scared -= dt; m.off.x += m.vel.x * dt; m.off.y += m.vel.y * dt;
          m.vel.x *= 1 - 0.35 * dt; m.vel.y *= 1 - 0.35 * dt; m.face = m.vel.x >= 0 ? 1 : -1;
        } else if (m.off.x || m.off.y) {
          const k = 1 - Math.min(1, 0.6 * dt);
          m.off.x *= k; m.off.y *= k; m.face = school.dir;
          if (Math.abs(m.off.x) + Math.abs(m.off.y) < 0.4) m.off.x = m.off.y = 0;
        }
        if (m.exclaim > 0) m.exclaim -= dt;
      }
    }
  }

  function render({ p, time, layout, still }) {
    if (disposed) return;
    const g = ctx;
    const avoid = (layout?.avoidHalf ?? 350) / ps;
    const dy = Math.round(lh * 0.46);
    const dx = Math.round(clamp(lw / 2 + avoid + 26, lw * 0.72, lw - 40));
    const { phi: basePhi, joints } = poseAt(p);
    const underAmt = smoothstep(T_JUMP0, T_ENTRY, p);
    const swim = smoothstep(T_ENTRY, T_ENTRY + 0.04, p);

    // heading: head-down while scrolling down, head-up while scrolling up
    const dtRaw = sim.last == null ? 0 : clamp(time - sim.last, 0, 0.1);
    if (sim.lastP != null && Math.abs(p - sim.lastP) > 2e-5) sim.heading = p > sim.lastP ? 1 : -1;
    sim.lastP = p;
    sim.orient += ((sim.heading === -1 ? 0 : 1) - sim.orient) * (dtRaw ? 1 - Math.exp(-dtRaw / 0.3) : 0);
    if (still) sim.orient = 1;
    const settle = smoothstep(T_ENTRY + 0.01, T_ENTRY + 0.09, p);
    // near the sea floor a descending Dave levels out into a horizontal glide
    const swimPhi = lerp(HEAD_UP, lerp(HEAD_DOWN, LEVEL, smoothstep(0.78, 1, p)), sim.orient);
    const phi0 = lerp(basePhi, swimPhi, settle) + Math.sin(time * 1.1) * 0.04 * swim;

    const j = joints.slice();
    j[6] += Math.sin(time * 9) * 0.34 * swim; j[7] += Math.sin(time * 9 - 0.9) * 0.5 * swim;
    j[8] -= Math.sin(time * 9) * 0.34 * swim; j[9] -= Math.sin(time * 9 - 0.9) * 0.5 * swim;
    j[2] += Math.sin(time * 1.7) * 0.08 * swim; j[4] += Math.sin(time * 1.7 + 1) * 0.08 * swim;

    const hip = hipDepth(p, joints, time);
    const shift = leapShift(p);
    const sy = z => dy + (z - hip);
    const zAt = y => hip + (y - dy);
    const surfBase = Math.round(sy(0));
    const rise = dy - hipDepth(0, poseAt(0).joints, 0) - surfBase;

    // ---- sim ----
    const speed = sim.lastHip == null || dtRaw <= 0 ? 0 : Math.abs(hip - sim.lastHip) / dtRaw;
    const cosP = Math.cos(phi0), sinP = Math.sin(phi0);
    const headDist = B.torso + B.neck + B.head - 1;
    const mlx = Math.sin(joints[0]) * headDist + 4, mly = -Math.cos(joints[0]) * headDist + 2;
    const mouth = { x: dx - (mlx * cosP - mly * sinP) - shift, z: hip + (mlx * sinP + mly * cosP) };
    mouth.entryX = dx - (Math.sin(joints[0]) * ENTRY_TIP * cosP + Math.cos(joints[0]) * ENTRY_TIP * sinP) - shift;
    if (still && !sim.seeded) {
      sim.seeded = true; splash(mouth.entryX, 1);
      for (let i = 0; i < 24; i++) step(0.04, time + i * 0.04, T_ENTRY + 0.02, 40, mouth, 300);
      time += 0.96;
    } else if (dtRaw > 0) step(dtRaw, time, p, hip, mouth, speed);
    sim.last = time; sim.lastHip = hip;

    // ---- surface heights, one per column ----
    const surf = new Int16Array(lw);
    for (let x = 0; x < lw; x++) {
      let y = surfBase + Math.sin(x * 0.11 + time * 1.3) * 1.1 + Math.sin(x * 0.045 - time * 0.9 + 1.3) * 0.9;
      for (const r of sim.ripples) {
        const age = time - (r.t0 ?? time), d = Math.abs(x - shift - r.x);
        y += r.amp * Math.exp(-age * 1.1) * Math.exp(-d / 26) * Math.cos(d / 4 - age * 6);
      }
      surf[x] = Math.round(y);
    }

    // ---- background: sky and water, ordered-dither posterised ----
    // Each row has one base colour, so only four distinct pixels (the Bayer columns) exist per
    // row: build them once and stamp them across, with a mask for light shafts.
    const pixels = new Uint32Array(bg.data.buffer);
    const Q = 14, QM = Q - 1;
    const quant = (v, b) => Math.min(255, Math.floor((v < 0 ? 0 : v > 1 ? 1 : v) * QM + b * 0.9 + 0.05) / QM * 255);
    const pack = (r, g2, b2, phase, rowB) => { const b = BAYER[rowB + phase]; return ((255 << 24) | (quant(b2, b) << 16) | (quant(g2, b) << 8) | quant(r, b)) >>> 0; };
    const shaftDefs = [[0.1, 11], [0.31, 7], [0.55, 13], [0.78, 8], [0.93, 9]].map(([f, w], i) => ({ x0: f * (lw + 60) - 20 + Math.sin(time * 0.3 + i * 1.7) * 3, w, k: 0.9 - (i % 3) * 0.2 }));
    const floorTop = sy(FLOOR);
    const dune = (x, k) => Math.round(Math.sin(x * 0.045 + k) * 3 + Math.sin(x * 0.11 + k * 2) * 1.6);
    const sandTops = new Float32Array(lw);
    for (let x = 0; x < lw; x++) sandTops[x] = floorTop - dune(x, 1.3) - 9;
    const mask = new Uint8Array(lw);
    const skyPal = new Uint32Array(4), waterPal = new Uint32Array(4), highPal = new Uint32Array(4), shaftPal = [new Uint32Array(4), new Uint32Array(4), new Uint32Array(4)];
    for (let y = 0; y < lh; y++) {
      const z = zAt(y), c = waterAt(z), light = Math.exp(-Math.max(0, z) / 120), rowB = (y & 3) * 4;
      const t = clamp(y / Math.max(1, surfBase)), lowHalf = t >= SKY[1][0];
      const sa = lowHalf ? SKY[1][1] : SKY[0][1], sb = lowHalf ? SKY[2][1] : SKY[1][1], sk = lowHalf ? (t - SKY[1][0]) / (1 - SKY[1][0]) : t / SKY[1][0];
      const useShafts = light > 0.12;
      for (let ph = 0; ph < 4; ph++) {
        const bayer = BAYER[rowB + ph];
        skyPal[ph] = pack(lerp(sa[0], sb[0], sk), lerp(sa[1], sb[1], sk), lerp(sa[2], sb[2], sk), ph, rowB);
        waterPal[ph] = pack(c[0], c[1], c[2], ph, rowB);
        highPal[ph] = pack(0.82, 0.97, 0.98, ph, rowB);
        for (let k = 0; k < 3; k++) shaftPal[k][ph] = light * (0.9 - k * 0.2) > bayer ? pack(c[0] + 0.1, c[1] + 0.15, c[2] + 0.12, ph, rowB) : waterPal[ph];
      }
      if (useShafts) {
        mask.fill(0);
        const dyS = y - surfBase;
        for (let i = 4; i >= 0; i--) {
          const sh = shaftDefs[i], centre = sh.x0 + dyS * 0.36 + sh.w * 0.5, half = sh.w * 0.5 + dyS * 0.07;
          const from = Math.max(0, Math.floor(centre - half) + 1), to = Math.min(lw - 1, Math.ceil(centre + half) - 1);
          for (let x = from; x <= to; x++) mask[x] = (i % 3) + 1;
        }
      }
      const row = y * lw;
      for (let x = 0; x < lw; x++) {
        const ph = x & 3, sx = surf[x];
        if (y < sx) { pixels[row + x] = skyPal[ph]; continue; }
        const below = y - sandTops[x];
        if (below >= 0) {
          // sea floor: pale sand tinted by the water, with world-anchored speckles
          const m = 0.18 + 0.12 * Math.min(1, below / 40);
          const hsh = hash2(x, Math.round(z)), grain = hsh < 0.07 ? 0.82 : hsh > 0.94 ? 1.1 : 1;
          const sh = (below < 2 ? 1.1 : 0.92 - Math.min(0.2, below * 0.006)) * grain;
          pixels[row + x] = pack((SAND[0] * (1 - m) + c[0] * m) * sh, (SAND[1] * (1 - m) + c[1] * m) * sh, (SAND[2] * (1 - m) + c[2] * m) * sh, ph, rowB);
          continue;
        }
        pixels[row + x] = y - sx < 2 ? highPal[ph] : useShafts && mask[x] ? shaftPal[mask[x] - 1][ph] : waterPal[ph];
      }
    }
    g.putImageData(bg, 0, 0);

    // ---- sun, clouds, boat ----
    if (surfBase > -30) {
      const sunX = Math.round(lw * 0.17), sunY = Math.round(surfBase - 78 - rise * 0.2);
      for (let yy = -9; yy <= 9; yy++) { const w = Math.floor(Math.sqrt(81 - yy * yy)); g.fillStyle = Math.abs(yy) > 6 ? '#ffe98a' : '#fff6b8'; g.fillRect(sunX - w, sunY + yy, w * 2 + 1, 1); }
      clouds.forEach((cloud, i) => {
        const cx = Math.round(mod((i * 0.31 + 0.1) * (lw + 120) + time * (1.4 + i * 0.5), lw + 120) - 60);
        const cy = Math.round(surfBase - 52 - (i % 3) * 22 - rise * 0.4);
        if (cy + cloud.height > 0 && cy < lh) g.drawImage(cloud, cx, cy);
      });
    }
    const boatX = Math.round(dx + 28 + 14 * smoothstep(T_ENTRY, 0.4, p) + shift);
    if (boatX - 50 < lw && surfBase > -40) {
      const recoil = p > T_JUMP0 ? Math.exp(-(p - T_JUMP0) * 38) * Math.sin((p - T_JUMP0) * 120) * 0.07 : 0;
      const roll = Math.sin(time * 1.15) * 0.022 + recoil;
      redraw(boatSprite, bs => drawBoat(bs, roll, time));
      const waterline = surf[clamp(boatX, 0, lw - 1)];
      g.drawImage(boatSprite, boatX - 46, waterline - 38);
      g.fillStyle = 'rgba(79,224,228,.5)'; g.fillRect(boatX - 40, waterline + 1, 80, 12);
    }

    // ---- underwater life ----
    // marine snow and, in the dark, glowing motes
    for (const m of PLANKTON) {
      const y = Math.round(mod(m.fy * (lh + 20) - hip * m.par * 0.9, lh + 20) - 10);
      if (y < surf[Math.round(m.fx * (lw - 1))] + 3) continue;
      const x = Math.round(m.fx * lw + Math.sin(time * 0.5 + m.ph) * 2);
      const dk = darkness(zAt(y));
      if (dk > 0.2 && m.big) { g.fillStyle = `rgba(120,236,255,${(0.3 + 0.7 * Math.max(0, Math.sin(time * 1.5 + m.ph))) * dk})`; g.fillRect(x, y, 2, 2); }
      else { g.fillStyle = `rgba(225,246,255,${0.22 + (m.par - 0.5) * 0.3})`; g.fillRect(x, y, 1, 1); }
    }
    // sea-floor scenery: the pineapple house, rocks, kelp, coral, and the two locals
    const groundAt = x => Math.round(floorTop - dune(x, 1.3) - 9) + 6;
    if (floorTop < lh + 30) {
      const house = Math.round(lw * 0.2);
      g.drawImage(pineapple, house - 15, groundAt(house) - 46);
      for (const r of ROCK_AT) { const x = Math.round(r.fx * lw); g.drawImage(rocks[r.k], x - 18, groundAt(x) - 17); }
      for (const k of KELP_AT) { const x = Math.round(k.fx * lw), art = kelp[k.v][Math.floor(mod(time * 1.3 + k.ph, 3))]; g.drawImage(art, x - 8, groundAt(x) - art.height + 3); }
      for (const c of CORAL_AT) { const x = Math.round(c.fx * lw); g.drawImage(corals[c.k], x - 17, groundAt(x) - 27); }
      const bobX = Math.round(lw * 0.38), patX = Math.round(lw * 0.5);
      g.drawImage(bob[Math.floor(time * 1.6) % 2], bobX - 16, groundAt(bobX) - 40 + Math.round(Math.sin(time * 2) * 0.8));
      g.drawImage(patrick, patX - 17, groundAt(patX) - 34 + Math.round(Math.sin(time * 1.4 + 1)));
    }
    // jellyfish pulse in the blue
    for (const jf of JELLIES) {
      const y = Math.round(sy(jf.z) + Math.sin(time * 0.7 + jf.ph) * 4), x = Math.round(jf.fx * lw + Math.sin(time * 0.3 + jf.ph) * 8);
      if (y < -30 || y > lh + 30) continue;
      g.globalAlpha = 0.9; g.drawImage(jelly[Math.floor(time * 2 + jf.ph) % 4], x - 10, y - 14); g.globalAlpha = 1;
    }
    // schools: the whole point of clicking
    sim.fishHits = [];
    for (const s of SCHOOLS) {
      const y0 = sy(s.z);
      if (y0 < -40 || y0 > lh + 40) continue;
      const travel = lw + 100, base = mod(s.fx * travel + s.dir * s.speed * time, travel) - 50;
      for (const m of s.members) {
        const fx = Math.round(base + m.ox + m.off.x + Math.sin(time * 0.8 + m.ph) * 2), fy = Math.round(y0 + m.oy + m.off.y + Math.sin(time * 1.3 + m.ph) * 1.5);
        if (fx < -30 || fx > lw + 30 || fy < surf[clamp(fx, 0, lw - 1)] + 2) continue;
        const art = fishSprites[s.kind][Math.floor(time * 5 + m.ph) % 2];
        if (m.face < 0) { g.save(); g.translate(fx + art.width / 2, 0); g.scale(-1, 1); g.drawImage(art, 0, fy - art.height / 2); g.restore(); }
        else g.drawImage(art, fx - art.width / 2, fy - art.height / 2);
        sim.fishHits.push({ x: fx, y: fy, member: m });
        if (m.exclaim > 0) g.drawImage(exclaim, fx - 2, fy - art.height / 2 - 11);
      }
    }
    // anglerfish drift in and out of the black band, each trailing a lantern
    for (const a of ANGLERS) {
      const presence = smoothstep(-0.1, 0.55, Math.sin(time * 0.17 + a.ph));
      const y = Math.round(sy(a.z) + Math.sin(time * 0.6 + a.ph) * 3);
      if (presence < 0.05 || y < -20 || y > lh + 20) continue;
      const x = Math.round(mod(a.fx * (lw + 80) + a.dir * a.speed * time, lw + 80) - 40);
      const lx = a.dir > 0 ? x + 16 : x - 16, ly = y - 13;
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [r, al] of [[34, 0.05], [24, 0.07], [15, 0.1], [8, 0.16]]) {
        g.fillStyle = `rgba(255,240,150,${al * presence * (0.85 + 0.15 * Math.sin(time * 5 + a.ph))})`;
        for (let yy = -r; yy <= r; yy++) { const w = Math.floor(Math.sqrt(r * r - yy * yy)); g.fillRect(lx - w, ly + yy, w * 2 + 1, 1); }
      }
      g.restore();
      g.save(); g.globalAlpha = presence;
      if (a.dir < 0) { g.translate(x + 20, 0); g.scale(-1, 1); g.drawImage(angler, 0, y - 15); } else g.drawImage(angler, x - 20, y - 15);
      g.restore();
    }
    // bubbles drift in world space, so scrolling leaves them behind
    for (const bub of sim.bubbles) {
      const y = Math.round(sy(bub.z)), x = Math.round(bub.x + shift);
      if (y < surf[clamp(x, 0, lw - 1)] || y > lh + 4) continue;
      g.fillStyle = 'rgba(224,250,255,.92)';
      if (bub.r === 1) g.fillRect(x, y, 1, 1);
      else if (bub.r === 2) { g.fillRect(x, y - 1, 1, 1); g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y + 1, 1, 1); }
      else { g.fillRect(x - 1, y - 2, 3, 1); g.fillRect(x - 1, y + 2, 3, 1); g.fillRect(x - 2, y - 1, 1, 3); g.fillRect(x + 2, y - 1, 1, 3); g.fillStyle = '#ffffff'; g.fillRect(x - 1, y - 1, 1, 1); }
    }

    // ---- Dave: a pixel sprite, tinted by the water around him, lit by his own lamp in the dark ----
    const dk = darkness(hip);
    if (dk > 0.05) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [r, al] of [[36, 0.05], [26, 0.07], [17, 0.1]]) {
        g.fillStyle = `rgba(255,236,190,${al * dk})`;
        for (let yy = -r; yy <= r; yy++) { const w = Math.floor(Math.sqrt(r * r - yy * yy)); g.fillRect(dx - w, dy + yy, w * 2 + 1, 1); }
      }
      g.restore();
    }
    redraw(daveSprite, d2 => { d2.translate(36, 36); d2.scale(-1, 1); d2.rotate(phi0); drawDave(d2, j, underAmt); });
    const dg = daveSprite.getContext('2d', { willReadFrequently: true });
    const left = dx - 36, top = dy - 36;
    dg.save(); dg.globalCompositeOperation = 'source-atop';
    dg.beginPath(); dg.moveTo(0, 72);
    for (let x = 0; x <= 72; x += 2) dg.lineTo(x, surf[clamp(left + x, 0, lw - 1)] - top);
    dg.lineTo(72, 72); dg.closePath();
    const wc = waterAt(Math.max(0, hip));
    dg.fillStyle = `rgba(${Math.round(wc[0] * 255)},${Math.round(wc[1] * 255)},${Math.round(wc[2] * 255)},${0.2 + 0.3 * smoothstep(80, 400, hip)})`; dg.fill();
    dg.restore();
    g.drawImage(daveSprite, left, top);

    // ---- surface effects drawn in front ----
    for (const r of sim.ripples) {
      const age = time - (r.t0 ?? time), cx = Math.round(r.x + shift), cy = surf[clamp(cx, 0, lw - 1)];
      for (let k = 0; k < 2; k++) {
        const a = age - k * 0.22; if (a < 0) continue;
        const rx = Math.round(4 + a * 30), alpha = Math.max(0, 1 - a / 2.4);
        g.fillStyle = `rgba(255,255,255,${0.7 * alpha})`;
        g.fillRect(cx - rx, cy, 3, 1); g.fillRect(cx + rx - 3, cy, 3, 1);
      }
      const foam = Math.max(0, 1 - age / 1.4);
      if (foam > 0) { g.fillStyle = `rgba(255,255,255,${foam * 0.85})`; g.fillRect(cx - 12, cy - 1, 24, 2); g.fillRect(cx - 7, cy - 3, 14, 2); }
    }
    for (const d of sim.drops) {
      const y = Math.round(sy(d.z));
      if (y > surfBase + 1) continue;
      g.fillStyle = `rgba(255,255,255,${clamp(d.life / 1.1, 0, 1)})`;
      g.fillRect(Math.round(d.x + shift), y, 1, Math.abs(d.vz) > 60 ? 2 : 1);
    }
  }

  return {
    resize, render,
    /** Clicking a fish startles it and the fish around it. */
    pointer({ x, y }) { scare(x * lw / W, y * lh / H); },
    dispose() { disposed = true; },
  };
}
