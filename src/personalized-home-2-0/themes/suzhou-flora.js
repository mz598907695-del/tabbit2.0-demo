import { mulberry32 } from './canvas-kit.js';
import { clamp, lerp, smoothstep } from './gl-utils.js';
import { TAU, mix3, rgba, shade } from './suzhou-season.js';
import { bake, makeCanvas, noise2, put, ribbon, spline } from './suzhou-kit.js';

// Plants of the garden. Foliage is drawn as sprites of leaf clumps pre-painted at nine stops of
// a colour ramp (tender green → deep green → gold → crimson); every clump on a tree carries
// fixed random thresholds, so blossom, leaf-out, colour and leaf-fall are plain functions of p.
const RAMP = [[182, 214, 142], [128, 184, 96], [92, 156, 86], [62, 128, 78], [138, 160, 66], [228, 184, 52], [230, 134, 42], [206, 72, 38], [152, 42, 36]];
const BLOSSOM = [[255, 241, 243], [252, 216, 226], [246, 178, 200], [234, 138, 170]];
const BARK = [56, 42, 36];

function leafSprite(px, base, tone, seed) {
  const c = makeCanvas(px, px), g = c.getContext('2d'), rand = mulberry32(seed);
  g.scale(px, px);
  const vol = g.createRadialGradient(0.5, 0.56, 0.02, 0.5, 0.56, 0.4);
  vol.addColorStop(0, rgba(shade(base, 0.7 * tone), 0.82)); vol.addColorStop(0.75, rgba(shade(base, 0.78 * tone), 0.5)); vol.addColorStop(1, rgba(shade(base, 0.8 * tone), 0));
  g.fillStyle = vol; g.fillRect(0, 0, 1, 1);
  const dabs = [];
  for (let i = 0; i < 130; i++) {
    const a = rand() * TAU, r = 0.35 * Math.sqrt(rand());
    dabs.push({ x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r * 0.9, s: 0.032 + rand() * 0.045, rot: rand() * Math.PI, e: 0.38 + rand() * 0.3, j: rand() });
  }
  dabs.sort((a, b) => b.y - a.y);
  for (const d of dabs) {
    const t = clamp((d.y - 0.15) / 0.7), k = (1.2 - 0.58 * t + (d.j - 0.5) * 0.3) * tone;
    g.fillStyle = rgba(shade(mix3(base, [base[0] * 1.08, base[1] * 1.05, base[2] * 0.85], d.j), k), 0.93);
    g.beginPath(); g.ellipse(d.x, d.y, d.s, d.s * d.e, d.rot, 0, TAU); g.fill();
  }
  return c;
}

function blossomSprite(px, seed) {
  const c = makeCanvas(px, px), g = c.getContext('2d'), rand = mulberry32(seed);
  g.scale(px, px);
  const haze = g.createRadialGradient(0.5, 0.52, 0.02, 0.5, 0.52, 0.38);
  haze.addColorStop(0, 'rgba(240,150,176,.42)'); haze.addColorStop(1, 'rgba(240,150,176,0)');
  g.fillStyle = haze; g.fillRect(0, 0, 1, 1);
  const dabs = [];
  for (let i = 0; i < 64; i++) {
    const a = rand() * TAU, r = 0.35 * Math.pow(rand(), 0.6);
    dabs.push({ x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r * 0.9, s: 0.03 + rand() * 0.032, j: rand() });
  }
  dabs.sort((a, b) => b.y - a.y);
  for (const d of dabs) {
    const t = clamp((d.y - 0.15) / 0.7), idx = Math.min(3, Math.floor(clamp(t * 0.8 + (d.j - 0.4) * 0.9) * 4));
    g.fillStyle = rgba(BLOSSOM[idx], 0.96);
    g.beginPath(); g.arc(d.x, d.y, d.s, 0, TAU); g.fill();
    if (d.j > 0.7) { g.fillStyle = 'rgba(214,92,128,.55)'; g.beginPath(); g.arc(d.x, d.y, d.s * 0.32, 0, TAU); g.fill(); }
  }
  return c;
}

function plumSprite(px, tone, seed) {
  const c = makeCanvas(px, px), g = c.getContext('2d'), rand = mulberry32(seed);
  g.translate(px / 2, px / 2); g.scale(px, px); g.rotate(rand() * TAU);
  const petal = tone ? ['rgb(168,30,48)', 'rgb(226,84,100)'] : ['rgb(232,168,176)', 'rgb(252,226,228)'];
  for (let i = 0; i < 5; i++) {
    g.save(); g.rotate(i * TAU / 5);
    const grad = g.createRadialGradient(0, -0.2, 0.02, 0, -0.2, 0.22);
    grad.addColorStop(0, petal[1]); grad.addColorStop(1, petal[0]);
    g.fillStyle = grad; g.beginPath(); g.arc(0, -0.2, 0.19, 0, TAU); g.fill();
    g.restore();
  }
  g.fillStyle = 'rgb(246,214,96)'; g.beginPath(); g.arc(0, 0, 0.07, 0, TAU); g.fill();
  g.fillStyle = 'rgba(150,40,40,.8)';
  for (let i = 0; i < 6; i++) { const a = i * TAU / 6; g.beginPath(); g.arc(Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0.022, 0, TAU); g.fill(); }
  return c;
}

function makeFoliage(k, rand) {
  const px = clamp(Math.round(62 * k * 1.15), 28, 100);
  const leaf = RAMP.map((base, i) => [1.1, 0.96, 0.8].map((tone, v) => leafSprite(px, base, tone, 11 + i * 7 + v * 3)));
  const bloom = [0, 1, 2].map(i => blossomSprite(px, 70 + i * 5));
  const plum = [plumSprite(Math.max(12, Math.round(22 * k * 1.3)), true, 3), plumSprite(Math.max(12, Math.round(22 * k * 1.3)), true, 8), plumSprite(Math.max(12, Math.round(22 * k * 1.3)), false, 5)];
  rand();
  return { leaf, bloom, plum };
}

/** Draw clump of ramp colour t (0..1) with `alpha`; two neighbouring stops are cross-faded. */
function putLeaf(g, F, t, tone, x, y, w, h, alpha) {
  const x0 = clamp(t, 0, 0.9999) * 8, i = Math.floor(x0), f = x0 - i;
  g.globalAlpha = alpha; g.drawImage(F.leaf[i][tone], x - w / 2, y - h / 2, w, h);
  if (f > 0.03) { g.globalAlpha = alpha * f; g.drawImage(F.leaf[i + 1][tone], x - w / 2, y - h / 2, w, h); }
  g.globalAlpha = 1;
}

// ---- Tree growing ------------------------------------------------------------------------
function polyLen(dense) { let l = 0; for (let i = 1; i < dense.length; i++) l += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]); return l; }

/** Along a dense polyline, point and heading at fraction t. */
function along(dense, t) {
  const f = clamp(t, 0, 1) * (dense.length - 1), i = Math.min(dense.length - 2, Math.floor(f)), u = f - i;
  const a = dense[i], b = dense[i + 1];
  return { x: lerp(a[0], b[0], u), y: lerp(a[1], b[1], u), ang: Math.atan2(b[1] - a[1], b[0] - a[0]), i };
}

function grow(spec, rand) {
  const strokes = [], clusters = [];
  const push = (x, y, r, depth) => clusters.push({
    x, y, r, depth, sx: 0.92 + rand() * 0.5, sy: 0.82 + rand() * 0.24,
    th: rand(), bt: rand(), ph: rand() * TAU, tone: depth < 0.4 ? 2 : depth < 0.75 ? 1 : 0, v: Math.floor(rand() * 3),
    hue: (noise2(x * 0.011, y * 0.011, spec.seed) - 0.5) * 0.34 + (rand() - 0.5) * 0.08, fall: 260 + rand() * 260, drift: (rand() - 0.5) * 60,
  });
  spec.boughs.forEach(b => {
    const dense = spline(b.pts, 10), len = polyLen(dense);
    strokes.push({ dense, w0: b.w0, w1: b.w1, bough: true });
    const n = Math.max(2, Math.floor(len / spec.gap));
    for (let i = 0; i < n; i++) {
      const t = 0.5 + 0.5 * (i + rand() * 0.7) / n, a = along(dense, t), off = (i % 2 ? 1 : -1) * (0.35 + rand() * 0.9) * spec.gap;
      push(a.x - Math.sin(a.ang) * off, a.y + Math.cos(a.ang) * off + 4, spec.r[0] + rand() * (spec.r[1] - spec.r[0]), t);
    }
    const m = Math.max(2, Math.floor(len / spec.twigGap));
    for (let j = 0; j < m; j++) {
      const t = 0.12 + 0.84 * (j + rand() * 0.7) / m, a = along(dense, t), side = rand() < 0.5 ? -1 : 1;
      const ang = a.ang + side * (0.5 + rand() * 0.8), L = spec.twig[0] + rand() * (spec.twig[1] - spec.twig[0]);
      const droop = spec.droop * (0.4 + rand());
      const p1 = [a.x + Math.cos(ang) * L * 0.5, a.y + Math.sin(ang) * L * 0.5 + droop * 0.4];
      const p2 = [a.x + Math.cos(ang + side * 0.15) * L, a.y + Math.sin(ang + side * 0.15) * L + droop];
      const wb = lerp(b.w0, b.w1, t);
      strokes.push({ dense: spline([[a.x, a.y], p1, p2], 5), w0: Math.max(1.8, wb * 0.36), w1: 0.8 });
      push(p2[0], p2[1], spec.r[0] * 0.95 + rand() * (spec.r[1] - spec.r[0]) * 0.8, 0.5 + t * 0.5);
      if (rand() < 0.5) push(p1[0], p1[1], spec.r[0] * 0.8 + rand() * 6, 0.45 + t * 0.4);
    }
  });
  // extra clumps fill the gaps of the crown
  for (let i = 0; i < (spec.extra ?? 0); i++) {
    const s = strokes[Math.floor(rand() * strokes.length)], a = along(s.dense, 0.4 + rand() * 0.6);
    push(a.x + (rand() - 0.5) * 50, a.y + (rand() - 0.2) * 44, spec.r[0] + rand() * (spec.r[1] - spec.r[0]), rand());
  }
  clusters.sort((a, b) => a.depth - b.depth);
  return { strokes, clusters };
}

function bounds(strokes, pad) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const s of strokes) for (const [x, y] of s.dense) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2];
}

function paintBranches(g, strokes, color, seed) {
  const rand = mulberry32(seed);
  for (const s of strokes) {
    const r = ribbon(s.dense, s.w0, s.w1, 0.14, rand() * 6);
    g.fillStyle = rgba(color); g.fill(r.path);
    if (s.w0 > 5) {
      g.strokeStyle = rgba(shade(color, 1.9), 0.42); g.lineWidth = Math.max(1, s.w0 * 0.12); g.lineCap = 'round'; g.beginPath();
      r.left.forEach(([x, y], i) => { const t = i / r.left.length, o = 0.3 * (1 - t); const q = r.right[i]; const px = lerp(x, q[0], o + 0.12), py = lerp(y, q[1], o + 0.12); return i ? g.lineTo(px, py) : g.moveTo(px, py); });
      g.stroke();
      g.strokeStyle = 'rgba(236,228,214,.14)'; g.lineWidth = Math.max(0.8, s.w0 * 0.05);
      g.beginPath();
      for (let i = 4; i < r.left.length - 6; i += 3) { const q = r.right[i]; const x = lerp(r.left[i][0], q[0], 0.55), y = lerp(r.left[i][1], q[1], 0.55); g.moveTo(x, y); g.lineTo(x + 1.5, y + 7 + rand() * 5); }
      g.stroke();
    }
  }
}

function paintSnow(g, strokes) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const s of strokes) {
    const w = (s.w0 + s.w1) / 2, d = s.dense;
    g.strokeStyle = 'rgba(252,253,255,.96)'; g.lineWidth = Math.max(1.5, w * 0.55);
    g.beginPath();
    d.forEach(([x, y], i) => { const t = i / d.length, ww = lerp(s.w0, s.w1, t) * 0.34; return i ? g.lineTo(x, y - ww) : g.moveTo(x, y - ww); });
    g.stroke();
    if (s.bough) {
      g.fillStyle = 'rgba(252,253,255,.95)';
      for (let i = 2; i < d.length - 1; i += 5) { const t = i / d.length, ww = lerp(s.w0, s.w1, t); g.beginPath(); g.ellipse(d[i][0], d[i][1] - ww * 0.4, ww * 0.85, ww * 0.42, 0, 0, TAU); g.fill(); }
    }
  }
}

function makeTree(k, spec, F, rand) {
  const { strokes, clusters } = grow(spec, rand);
  const [bx, by, bw, bh] = bounds(strokes, spec.pad ?? 40);
  const wood = bake(k, bx, by, bw, bh, g => paintBranches(g, strokes, spec.bark ?? BARK, spec.seed));
  const snow = spec.snow === false ? null : bake(k, bx, by, bw, bh, g => paintSnow(g, strokes));
  return { wood, snow, clusters, strokes, F };
}

/** Colour-ramp position of a clump on a tree whose leaves follow `S.col`. */
function rampPos(S, c, kind) {
  if (kind === 'ginkgo') { const base = S.col < 0.4 ? S.col : Math.min(0.66, 0.4 + (S.col - 0.4) * 0.62); return clamp(base + c.hue * 0.18, 0, 1); }
  if (kind === 'evergreen') return clamp(0.34 + S.col * 0.1 + c.hue * 0.1, 0, 1);
  return clamp(S.col + c.hue * (S.col > 0.45 ? 1 : 0.8), 0, 1);
}

function drawCanopy(g, tree, S, time, o = {}) {
  const F = tree.F, wind = o.wind ?? 1, scaleK = o.size ?? 2.5;
  const autumn = S.p > 0.3 && S.p < 0.8, blossomFall = S.p < 0.5;
  const kind = o.kind ?? 'mixed';
  const blossoming = o.blossom !== false && S.bloom > 0.003;
  for (const c of tree.clusters) {
    const sway = Math.sin(time * 0.7 + c.ph) * 1.1 * wind, sy = Math.cos(time * 0.9 + c.ph * 1.3) * 0.7 * wind;
    const a = clamp((S.leaf - c.th * 0.85) / 0.15, 0, 1);
    const b = blossoming ? clamp((S.bloom - c.bt * 0.82) / 0.18, 0, 1) : 0;
    if (a > 0.004) {
      const w = 1 - a;
      const x = c.x + sway;
      let size = c.r * scaleK, y = c.y + sy;
      if (autumn && w > 0) { size *= 1 - 0.3 * w; y += w * w * 12; } else size *= 0.5 + 0.5 * a;
      const t = rampPos(S, c, kind);
      putLeaf(g, F, t, c.tone, x, y, size * c.sx, size * c.sy, autumn ? a : Math.min(1, a * 1.3));
    }
    if (b > 0.004) {
      const size = c.r * scaleK * (0.78 + 0.28 * b) * (o.bloomSize ?? 1);
      g.globalAlpha = b; g.drawImage(F.bloom[c.v], c.x + sway - size * c.sx / 2, c.y + sy - size * c.sy / 2, size * c.sx, size * c.sy); g.globalAlpha = 1;
    }
  }
  // clumps that are letting go: a few loose leaves or petals ride the wind down
  if (o.fall === false) return;
  const dir = o.fallDir ?? -1;
  if (autumn) {
    for (const c of tree.clusters) {
      const a = clamp((S.leaf - c.th * 0.85) / 0.15, 0, 1), w = 1 - a;
      if (w <= 0.02 || w >= 0.999 || S.leaf <= 0.01) continue;
      const t = rampPos(S, c, kind), col = shade(mix3(RAMP[Math.floor(t * 8)], RAMP[Math.min(8, Math.floor(t * 8) + 1)], t * 8 % 1), 1 + (c.hue > 0 ? 0 : 0.1));
      for (let n = 0; n < 2; n++) {
        const u = clamp(w * 1.3 - n * 0.22, 0, 1);
        if (u <= 0 || u >= 1) continue;
        const e = Math.pow(u, 1.25), x = c.x + Math.sin(u * 6 + c.ph + n * 2) * 26 * Math.sqrt(u) + dir * (c.drift + 70) * e + Math.sin(time * 1.6 + c.ph + n) * 3;
        const y = c.y + e * c.fall + Math.cos(u * 8 + c.ph) * 5;
        const al = smoothstep(0, 0.1, u) * (1 - smoothstep(0.86, 1, u));
        g.save(); g.translate(x, y); g.rotate(u * 9 + c.ph + n * 1.7 + Math.sin(time * 2 + c.ph) * 0.2);
        g.fillStyle = rgba(col, al * 0.95); g.beginPath(); g.ellipse(0, 0, 6.5 * (1 - 0.3 * u), 3.1, 0, 0, TAU); g.fill();
        g.restore();
      }
    }
  } else if (blossomFall && S.bloom < 0.999) {
    for (const c of tree.clusters) {
      const b = clamp((S.bloom - c.bt * 0.82) / 0.18, 0, 1), w = 1 - b;
      if (w <= 0.02 || w >= 0.999 || c.v === 2) continue;
      const u = clamp(w * 1.2, 0, 1);
      if (u >= 1) continue;
      const e = Math.pow(u, 1.2), x = c.x + Math.sin(u * 7 + c.ph) * 22 * Math.sqrt(u) + dir * (c.drift + 60) * e + Math.sin(time * 1.4 + c.ph) * 2.5, y = c.y + e * c.fall * 0.9;
      const al = smoothstep(0, 0.1, u) * (1 - smoothstep(0.85, 1, u));
      g.save(); g.translate(x, y); g.rotate(u * 8 + c.ph);
      g.fillStyle = rgba(BLOSSOM[1 + (c.v & 1)], al); g.beginPath(); g.ellipse(0, 0, 4.2, 2.3, 0, 0, TAU); g.fill();
      g.restore();
    }
  }
}

// ---- The big blossom tree, the plum, the far trees -------------------------------------
const TREE_A = {
  seed: 5, gap: 28, twigGap: 26, r: [23, 34], twig: [44, 100], droop: 30, extra: 46, pad: 60,
  boughs: [
    { pts: [[1040, 404], [940, 378], [846, 326], [764, 262], [690, 206], [620, 172], [548, 160], [470, 170], [400, 196], [340, 232]], w0: 48, w1: 7 },
    { pts: [[884, 348], [806, 346], [730, 340], [656, 334], [590, 350], [540, 380]], w0: 20, w1: 5 },
    { pts: [[772, 262], [724, 296], [664, 310], [604, 304], [548, 322]], w0: 15, w1: 4 },
    { pts: [[620, 172], [600, 226], [560, 256], [520, 262]], w0: 10, w1: 3 },
    { pts: [[846, 326], [884, 256], [862, 192], [804, 142]], w0: 15, w1: 4 },
    { pts: [[972, 392], [996, 458], [958, 524], [936, 566]], w0: 13, w1: 3.5 },
  ],
};

const PLUM = {
  seed: 21, gap: 40, twigGap: 17, r: [9, 13], twig: [28, 70], droop: -6, extra: 0, pad: 50, bark: [44, 34, 30],
  boughs: [
    { pts: [[1040, 872], [960, 900], [886, 882], [812, 906], [752, 884], [676, 902]], w0: 26, w1: 5 },
    { pts: [[968, 896], [956, 836], [982, 774], [950, 716]], w0: 11, w1: 3 },
    { pts: [[880, 886], [888, 828], [846, 778], [800, 762]], w0: 10, w1: 3 },
    { pts: [[812, 902], [800, 960], [750, 996]], w0: 8, w1: 3 },
    { pts: [[752, 884], [734, 838], [690, 816]], w0: 7, w1: 2.5 },
    { pts: [[930, 892], [1000, 840], [1030, 790]], w0: 9, w1: 3 },
  ],
};

const GINKGO = {
  seed: 31, gap: 18, twigGap: 20, r: [12, 18], twig: [24, 52], droop: 8, extra: 36, pad: 30, bark: [76, 64, 56],
  boughs: [
    { pts: [[906, 648], [904, 590], [898, 540], [884, 482]], w0: 14, w1: 6 },
    { pts: [[900, 560], [930, 520], [956, 478], [962, 436]], w0: 8, w1: 3 },
    { pts: [[896, 536], [860, 500], [846, 452], [850, 412]], w0: 8, w1: 3 },
    { pts: [[890, 500], [902, 450], [900, 400]], w0: 7, w1: 3 },
  ],
};

const WILLOW = {
  seed: 41, trunk: [[214, 656], [206, 604], [190, 560]],
  boughs: [
    [[196, 566], [160, 520], [112, 504], [60, 520]],
    [[196, 566], [214, 516], [252, 490], [298, 492]],
    [[194, 560], [190, 500], [176, 452], [150, 430]],
  ],
};

function buildWillow(k, rand) {
  const strands = [];
  WILLOW.boughs.forEach((b, bi) => {
    const dense = spline(b, 10);
    const n = bi === 2 ? 20 : 30;
    for (let i = 0; i < n; i++) {
      const a = along(dense, 0.15 + 0.85 * (i + rand() * 0.8) / n);
      strands.push({ x: a.x, y: a.y, len: 80 + rand() * 100 + (bi === 2 ? -20 : 0), ph: rand() * TAU, amp: 2 + rand() * 4, w: 1.1 + rand() * 0.9, lean: (rand() - 0.5) * 12 });
    }
  });
  const woodStrokes = [{ dense: spline(WILLOW.trunk, 8), w0: 16, w1: 9 }, ...WILLOW.boughs.map(b => ({ dense: spline(b, 10), w0: 9, w1: 2.5 }))];
  const [bx, by, bw, bh] = bounds(woodStrokes, 30);
  const wood = bake(k, bx, by, bw, bh, g => paintBranches(g, woodStrokes, [66, 56, 48], 3));
  return { strands, wood };
}

function drawWillow(g, wl, S, time) {
  put(g, wl.wood, 1);
  // strands: spring tender yellow-green, summer green, autumn gold, winter bare
  const col = mix3(mix3(mix3([150, 192, 82], [66, 128, 68], S.sw[1]), [206, 166, 54], S.sw[2]), [136, 122, 100], S.sw[3]);
  const live = clamp(S.leaf * 1.2 + 0.18, 0, 1), swing = 1 + S.snowfall * 0.4;
  g.lineCap = 'round';
  for (const s of wl.strands) {
    const pts = [];
    for (let j = 0; j <= 7; j++) {
      const t = j / 7, sw = Math.sin(time * 0.9 + s.ph + t * 2.2) * s.amp * t * t * swing + s.lean * t * 0.4 + S.sway * 3 * t;
      pts.push([s.x + sw, s.y + s.len * t]);
    }
    g.strokeStyle = rgba(shade(col, 0.9 + 0.2 * Math.sin(s.ph * 3)), (0.6 + 0.3 * live)); g.lineWidth = s.w;
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    if (live > 0.05) {
      g.fillStyle = rgba(shade(col, 1.05 + 0.1 * Math.sin(s.ph)), 0.85 * live);
      for (let j = 2; j <= 7; j++) { const [x, y] = pts[j]; g.beginPath(); g.ellipse(x + 1.4, y, 5.2, 1.9, 1.1 + Math.sin(time + s.ph + j) * 0.2, 0, TAU); g.fill(); }
    }
    if (S.snow > 0.05) { g.fillStyle = `rgba(255,255,255,${0.8 * S.snow})`; for (let j = 0; j <= 7; j += 3) { g.beginPath(); g.arc(pts[j][0], pts[j][1] - 0.6, 1.8, 0, TAU); g.fill(); } }
  }
}

// ---- Bamboo and rock ----------------------------------------------------------------------
function buildBamboo(k, rand) {
  const stalks = Array.from({ length: 8 }, (_, i) => {
    const x = 262 + i * 19 + (rand() - 0.5) * 16, top = 500 + rand() * 210, lean = (rand() - 0.55) * 70;
    return { x, base: 1130, top, lean, w: 7.4 + rand() * 2.6, ph: rand() * TAU, tone: 0.9 + rand() * 0.25 };
  });
  const dense = s => spline([[s.x, s.base], [s.x + s.lean * 0.15, lerp(s.base, s.top, 0.4)], [s.x + s.lean * 0.55, lerp(s.base, s.top, 0.75)], [s.x + s.lean, s.top]], 12);
  const sprite = bake(k, 190, 400, 340, 780, g => {
    for (const s of stalks) {
      const d = dense(s), r = ribbon(d, s.w, s.w * 0.62, 0.02, s.ph);
      const grad = g.createLinearGradient(s.x - s.w, 0, s.x + s.w, 0);
      grad.addColorStop(0, rgba(shade([118, 158, 102], s.tone * 1.08))); grad.addColorStop(0.55, rgba(shade([92, 134, 84], s.tone))); grad.addColorStop(1, rgba(shade([58, 92, 62], s.tone)));
      g.fillStyle = grad; g.fill(r.path);
      // nodes
      for (let y = s.base - 70; y > s.top + 10; y -= 52 + rand() * 12) {
        const t = (s.base - y) / (s.base - s.top), a = along(d, t), w = lerp(s.w, s.w * 0.62, t);
        g.strokeStyle = 'rgba(40,60,40,.75)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(a.x - w * 0.62, a.y + 0.6); g.lineTo(a.x + w * 0.62, a.y - 0.6); g.stroke();
        g.strokeStyle = 'rgba(220,236,190,.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(a.x - w * 0.5, a.y - 1.4); g.lineTo(a.x + w * 0.5, a.y - 2.2); g.stroke();
      }
    }
  });
  const sprays = [];
  stalks.forEach(s => {
    const d = dense(s);
    for (let n = 0; n < 4; n++) {
      const t = 0.62 + n * 0.1 + rand() * 0.04, a = along(d, t);
      for (const side of [-1, 1]) {
        const base = side < 0 ? Math.PI + 0.55 : -0.55;
        sprays.push({ x: a.x, y: a.y, ang: base + (rand() - 0.5) * 0.3, count: 4 + Math.floor(rand() * 3), len: 36 + rand() * 18, ph: rand() * TAU, side });
      }
    }
    sprays.push({ x: s.x + s.lean, y: s.top, ang: -Math.PI / 2 + (rand() - 0.5) * 0.6, count: 5, len: 40, ph: s.ph, side: 1 });
  });
  return { sprite, sprays };
}

function drawBamboo(g, bam, S, time) {
  put(g, bam.sprite, 1);
  const sway = Math.sin(time * 0.8) * 0.5 + S.snowfall * 0.15;
  const dark = shade(mix3([54, 104, 66], [96, 124, 66], S.sw[2]), 1 - S.sw[3] * 0.12), light = shade(dark, 1.3);
  const polys = (offset, scaleL) => {
    g.beginPath();
    for (const sp of bam.sprays) {
      for (let j = 0; j < sp.count; j++) {
        const f = j / (sp.count - 1) - 0.5, a = sp.ang + f * 1.0 + Math.sin(time * 1.1 + sp.ph + j * 0.6) * 0.07 * (1 + sway) + 0.5 * (sp.ang > 0 ? 0 : 0);
        const droop = sp.side * f * 0.2, L = sp.len * scaleL * (0.85 + 0.25 * Math.cos(f * 2.4)), ca = Math.cos(a + droop * 0.4), sa = Math.sin(a + droop * 0.4) + 0.38;
        const nx = -sa, ny = ca, w = L * 0.075, bx = sp.x + offset, by = sp.y + offset * 0.5;
        g.moveTo(bx, by);
        g.lineTo(bx + ca * L * 0.42 + nx * w, by + sa * L * 0.42 + ny * w);
        g.lineTo(bx + ca * L, by + sa * L + L * 0.1);
        g.lineTo(bx + ca * L * 0.42 - nx * w, by + sa * L * 0.42 - ny * w);
        g.closePath();
      }
    }
  };
  g.fillStyle = rgba(dark, 0.95); polys(0, 1); g.fill();
  g.fillStyle = rgba(light, 0.6); polys(-1.2, 0.8); g.fill();
  if (S.snow > 0.05) { g.fillStyle = `rgba(255,255,255,${0.82 * S.snow})`; polys(-0.5, 0.45); g.fill(); }
}

function craggy(points, rand, amp, step) {
  // resample a closed outline and push it in and out along its normals for a weathered edge
  const n = points.length, dense = [];
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.round(len / step));
    for (let j = 0; j < m; j++) dense.push([lerp(a[0], b[0], j / m), lerp(a[1], b[1], j / m)]);
  }
  const ph = rand() * 100;
  return dense.map(([x, y], i) => {
    const p = dense[(i + dense.length - 1) % dense.length], q = dense[(i + 1) % dense.length];
    let nx = q[1] - p[1], ny = p[0] - q[0];
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const d = (noise2(i * 0.34, ph, 3) - 0.5) * 2 * amp + (noise2(i * 0.11, ph, 7) - 0.5) * 2 * amp * 1.4;
    return [x + nx * d, y + ny * d];
  });
}

function smoothPath(points) {
  const path = new Path2D(), n = points.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(points[n - 1], points[0]);
  path.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const m = mid(points[i], points[(i + 1) % n]); path.quadraticCurveTo(points[i][0], points[i][1], m[0], m[1]); }
  path.closePath();
  return path;
}

function buildRock(k, rand) {
  const x0 = 70, y0 = 790, w = 360, h = 380;
  const unit = [[0.18, 1], [0.04, 0.93], [0.1, 0.84], [0.02, 0.74], [0.07, 0.62], [0.16, 0.54], [0.13, 0.44], [0.2, 0.34], [0.17, 0.24], [0.27, 0.14], [0.3, 0.06], [0.36, 0], [0.42, 0.06], [0.4, 0.15], [0.47, 0.19], [0.53, 0.1], [0.6, 0.03], [0.66, 0.1], [0.62, 0.22], [0.7, 0.28], [0.68, 0.38], [0.78, 0.45], [0.74, 0.55], [0.84, 0.62], [0.82, 0.72], [0.94, 0.8], [0.92, 0.9], [0.84, 1]];
  const outline = craggy(unit.map(([u, v]) => [x0 + u * w, y0 + v * h]), rand, 3.2, 9);
  const shape = smoothPath(outline);
  const holeSpec = [[0.33, 0.36, 0.075, 0.12, 0.3], [0.58, 0.58, 0.09, 0.06, -0.25], [0.25, 0.7, 0.05, 0.09, 0.15], [0.62, 0.84, 0.05, 0.04, 0], [0.5, 0.2, 0.025, 0.045, 0.2], [0.14, 0.5, 0.03, 0.05, 0.1]];
  const holes = holeSpec.map(([u, v, rx, ry, rot]) => {
    const pts = Array.from({ length: 14 }, (_, i) => { const a = i / 14 * TAU, r = 1 + (noise2(i * 0.9, u * 9, 5) - 0.5) * 0.5; return [x0 + u * w + (Math.cos(a) * rx * w * r) * Math.cos(rot) - (Math.sin(a) * ry * h * r) * Math.sin(rot), y0 + v * h + (Math.cos(a) * rx * w * r) * Math.sin(rot) + (Math.sin(a) * ry * h * r) * Math.cos(rot)]; });
    return { path: smoothPath(pts), cx: x0 + u * w, cy: y0 + v * h, rx: rx * w, ry: ry * h };
  });
  const sprite = bake(k, x0 - 24, y0 - 24, w + 48, h + 48, g => {
    g.save(); g.clip(shape);
    // lit from the upper right, deep shade down the left and under the overhangs
    const body = g.createLinearGradient(x0 + w, y0, x0, y0 + h);
    body.addColorStop(0, '#f1f2ec'); body.addColorStop(0.42, '#c3c9c4'); body.addColorStop(1, '#6f7c7b');
    g.fillStyle = body; g.fillRect(x0 - 10, y0 - 10, w + 20, h + 20);
    // flowing strata
    g.lineCap = 'round';
    for (let i = 0; i < 60; i++) {
      const sx = x0 + rand() * w, sy = y0 + rand() * h, len = 30 + rand() * 90;
      g.strokeStyle = rand() < 0.6 ? `rgba(60,74,76,${0.06 + rand() * 0.1})` : `rgba(255,255,252,${0.16 + rand() * 0.2})`; g.lineWidth = 2 + rand() * 5;
      g.beginPath(); g.moveTo(sx, sy); g.bezierCurveTo(sx - len * 0.2, sy + len * 0.3, sx + len * 0.2, sy + len * 0.6, sx, sy + len); g.stroke();
    }
    // weathered dimples: a shaded pit with a bright lip on its sunward side
    for (let i = 0; i < 70; i++) {
      const dx = x0 + rand() * w, dy = y0 + rand() * h, r = 5 + rand() * 16, sq = 0.55 + rand() * 0.6;
      g.save(); g.translate(dx, dy); g.rotate(rand() * 0.6 - 0.3); g.scale(1, sq);
      const pit = g.createRadialGradient(-r * 0.15, r * 0.15, 0, 0, 0, r);
      pit.addColorStop(0, 'rgba(34,46,50,.34)'); pit.addColorStop(0.7, 'rgba(50,62,66,.14)'); pit.addColorStop(1, 'rgba(50,62,66,0)');
      g.fillStyle = pit; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,250,.5)'; g.lineWidth = Math.max(1, r * 0.2); g.beginPath(); g.arc(r * 0.08, -r * 0.08, r * 0.95, -0.2, 1.2); g.stroke();
      g.restore();
    }
    const side = g.createLinearGradient(x0 + w * 0.5, 0, x0, 0);
    side.addColorStop(0, 'rgba(36,50,56,0)'); side.addColorStop(1, 'rgba(36,50,56,.42)');
    g.fillStyle = side; g.fillRect(x0 - 10, y0 - 10, w + 20, h + 20);
    const foot = g.createLinearGradient(0, y0 + h * 0.78, 0, y0 + h);
    foot.addColorStop(0, 'rgba(78,106,74,0)'); foot.addColorStop(1, 'rgba(66,96,68,.62)');
    g.fillStyle = foot; g.fillRect(x0 - 10, y0 + h * 0.78, w + 20, h * 0.22 + 10);
    for (const hole of holes) { g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.fill(hole.path); }
    g.globalCompositeOperation = 'source-over';
    g.restore();
    for (const hole of holes) {
      g.strokeStyle = 'rgba(40,52,56,.7)'; g.lineWidth = 3.4; g.stroke(hole.path);
      g.save(); g.translate(hole.cx, hole.cy);
      g.strokeStyle = 'rgba(244,246,240,.65)'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(0, 0, hole.rx + 2.5, hole.ry + 2.5, 0, -0.9, 0.9); g.stroke();
      g.restore();
    }
    g.strokeStyle = 'rgba(46,58,60,.6)'; g.lineWidth = 2.2; g.stroke(shape);
  });
  const snow = bake(k, x0 - 24, y0 - 24, w + 48, h + 48, g => {
    g.save(); g.clip(shape);
    const cap = g.createLinearGradient(0, y0, 0, y0 + h * 0.46);
    cap.addColorStop(0, 'rgba(252,254,255,.97)'); cap.addColorStop(0.55, 'rgba(250,252,255,.88)'); cap.addColorStop(1, 'rgba(250,252,255,0)');
    g.fillStyle = cap; g.fillRect(x0, y0, w, h * 0.46);
    g.fillStyle = 'rgba(252,254,255,.95)';
    for (let i = 0; i < 30; i++) { const px = x0 + rand() * w, py = y0 + h * (0.1 + rand() * 0.72); g.beginPath(); g.ellipse(px, py, 7 + rand() * 18, 3 + rand() * 6, 0, 0, TAU); g.fill(); }
    // keep the see-through holes clear
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    for (const hole of holes) g.fill(hole.path);
    g.restore();
  });
  return { sprite, snow, shadowAt: [x0 + w * 0.5, y0 + h] };
}

// ---- Ambient particles --------------------------------------------------------------------
function buildParticles(rand) {
  const make = n => Array.from({ length: n }, () => ({ x: rand(), y: rand(), dur: 0.5 + rand(), ph: rand() * TAU, s: rand(), v: rand() }));
  return { petals: make(64), leaves: make(26), flakes: make(150), motes: make(34) };
}

function drawAmbient(g, P, S, time, r) {
  const [x0, y0, x1, y1] = r, w = x1 - x0, h = y1 - y0;
  if (S.petalDrift > 0.01) {
    const n = Math.round(P.petals.length * S.petalDrift);
    for (let i = 0; i < n; i++) {
      const q = P.petals[i], u = (q.x * 3 + time / (22 * q.dur)) % 1;
      const x = x1 + 40 - u * (w * 0.95 + 120) + Math.sin(u * 14 + q.ph) * 24, y = y0 - 20 + (q.y * 0.3 + u * 0.95) * (h + 40) + Math.cos(u * 11 + q.ph) * 12;
      const al = Math.sin(Math.PI * u) ** 0.6 * (0.55 + 0.4 * q.s);
      g.save(); g.translate(x, y); g.rotate(u * 9 + q.ph);
      g.fillStyle = rgba(BLOSSOM[1 + (q.v > 0.5 ? 1 : 0)], al); g.beginPath(); g.ellipse(0, 0, 4.2 + q.s * 2, 2.4 + q.s, 0, 0, TAU); g.fill();
      g.restore();
    }
  }
  if (S.leafDrift > 0.01) {
    const n = Math.round(P.leaves.length * S.leafDrift), col = [mix3([226, 168, 60], [200, 70, 40], S.col)];
    for (let i = 0; i < n; i++) {
      const q = P.leaves[i], u = (q.x * 5 + time / (16 * q.dur)) % 1;
      const x = x0 + q.y * w * 1.2 - u * w * 0.5 + Math.sin(u * 9 + q.ph) * 30, y = y0 - 20 + u * (h + 60);
      const al = Math.sin(Math.PI * u) ** 0.5 * 0.9, shadeK = 0.85 + 0.3 * q.s;
      g.save(); g.translate(x, y); g.rotate(u * 12 + q.ph + Math.sin(time * 2 + q.ph) * 0.4);
      g.fillStyle = rgba(shade(col[0], shadeK), al); g.beginPath(); g.ellipse(0, 0, 7 + q.s * 3, 3.4, 0, 0, TAU); g.fill();
      g.restore();
    }
  }
  if (S.snowfall > 0.01) {
    const n = Math.round(P.flakes.length * S.snowfall);
    g.fillStyle = 'rgba(255,255,255,.88)'; g.beginPath();
    for (let i = 0; i < n; i++) {
      const q = P.flakes[i], speed = 1 / (6 + 7 * q.dur) * (0.7 + q.s), u = (q.y + time * speed) % 1;
      const x = x0 + ((q.x + u * 0.22 + Math.sin(time * 0.5 + q.ph) * 0.012) % 1) * w * 1.1 - w * 0.05, y = y0 - 10 + u * (h + 20);
      const r = 1 + q.s * 2.4;
      g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU);
    }
    g.fill();
  }
}

function drawMotes(g, P, S, time, r) {
  const a = S.sw[1];
  if (a < 0.02) return;
  const [x0, y0, x1, y1] = r, w = x1 - x0, h = y1 - y0;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const q of P.motes) {
    const u = (q.y + time / (60 * q.dur)) % 1, x = x0 + q.x * w + Math.sin(time * 0.3 + q.ph) * 30, y = y0 + (1 - u) * h * 0.9 + 40;
    const tw = 0.5 + 0.5 * Math.sin(time * (0.8 + q.s) + q.ph);
    g.fillStyle = `rgba(255,244,200,${a * (0.12 + 0.38 * tw) * Math.sin(Math.PI * u)})`;
    g.beginPath(); g.arc(x, y, 1.1 + q.s * 2, 0, TAU); g.fill();
  }
  g.restore();
}

function drawDragonflies(g, S, time) {
  const a = smoothstep(0.1, 0.3, S.sw[1]);
  if (a < 0.02) return;
  for (let i = 0; i < 2; i++) {
    const t = time * (0.22 + i * 0.07) + i * 3;
    const x = 560 + i * 130 + Math.sin(t) * 150 + Math.sin(t * 2.3) * 40, y = 880 + i * 60 + Math.sin(t * 1.3 + 1) * 40 + Math.cos(t * 2.1) * 12;
    const ang = Math.atan2(Math.cos(t * 1.3 + 1) * 52 + Math.cos(t * 2.1) * -25, Math.cos(t) * 150 + Math.cos(t * 2.3) * 92);
    g.save(); g.translate(x, y); g.rotate(ang); g.globalAlpha = a;
    g.strokeStyle = 'rgb(176,60,52)'; g.lineWidth = 1.8; g.lineCap = 'round'; g.beginPath(); g.moveTo(-10, 0); g.lineTo(9, 0); g.stroke();
    g.fillStyle = 'rgb(40,50,60)'; g.beginPath(); g.arc(10, 0, 1.9, 0, TAU); g.fill();
    const flap = 0.5 + 0.5 * Math.sin(time * 38 + i);
    g.fillStyle = `rgba(236,246,250,${0.5 + 0.3 * flap})`;
    for (const [dx, sy2] of [[5, 1], [1, 1.15], [5, -1], [1, -1.15]]) { g.beginPath(); g.ellipse(dx - 2, sy2 * (4.5 + flap * 1.5), 8, 1.8, sy2 * 0.1, 0, TAU); g.fill(); }
    g.restore();
  }
}

// ---- Assemble -----------------------------------------------------------------------------------
export function createFlora(k) {
  const rand = mulberry32(2718);
  const F = makeFoliage(k, rand);
  const treeA = makeTree(k, TREE_A, F, rand);
  const plum = makeTree(k, PLUM, F, rand);
  const ginkgo = makeTree(k, GINKGO, F, rand);
  const willow = buildWillow(k, rand);
  const bamboo = buildBamboo(k, rand);
  const rock = buildRock(k, rand);
  const particles = buildParticles(rand);
  const plumFlowers = plum.clusters.map((c, i) => ({ ...c, size: 21 + (i % 5) * 3, kind: i % 3, snowy: i % 2 }));
  return {
    /** Trees standing behind the far wall. */
    drawFarTrees(g, S, time) {
      put(g, ginkgo.wood, 1);
      drawCanopy(g, ginkgo, S, time, { kind: 'ginkgo', blossom: false, size: 2.5, wind: 0.6, fall: false });
      put(g, ginkgo.snow, S.snow * 0.5);
    },
    /** The willow stands in front of the far wall. */
    drawWillow(g, S, time) { drawWillow(g, willow, S, time); },
    drawNear(g, S, time) {
      drawBamboo(g, bamboo, S, time);
      put(g, rock.sprite, 1); put(g, rock.snow, S.snow);
      // plum branch over the water
      put(g, plum.wood, 1);
      drawCanopy(g, plum, S, time, { kind: 'mixed', blossom: false, size: 2.4, wind: 0.8, fall: false });
      const bl = S.plum;
      if (bl > 0.01) {
        for (const f of plumFlowers) {
          const a = clamp((bl - f.bt * 0.8) / 0.2, 0, 1);
          if (a < 0.01) continue;
          const sz = f.size * (0.4 + 0.6 * a);
          g.globalAlpha = a; g.drawImage(F.plum[f.kind], f.x - sz / 2, f.y - sz / 2 - 1, sz, sz); g.globalAlpha = 1;
          if (S.snow > 0.3 && f.snowy) { g.fillStyle = `rgba(255,255,255,${0.9 * S.snow * a})`; g.beginPath(); g.ellipse(f.x, f.y - sz * 0.5, sz * 0.32, sz * 0.14, 0, 0, TAU); g.fill(); }
        }
      }
      put(g, plum.snow, S.snow);
      // the big blossom tree, nearest to the viewer
      put(g, treeA.wood, 1);
      drawCanopy(g, treeA, S, time, { kind: 'mixed', size: 2.5, wind: 1.3 });
      put(g, treeA.snow, S.snow);
    },
    drawAmbient(g, S, time, rect) { drawMotes(g, particles, S, time, rect); drawAmbient(g, particles, S, time, rect); },
    drawDragonflies,
    drawShrubs(g, S, time, shrubs) {
      for (const s of shrubs) {
        const t = clamp(0.36 + S.col * 0.08 + s.hue * 0.1, 0, 1), sz = s.r * 2.6, sw = Math.sin(time * 0.6 + s.ph) * 0.6;
        putLeaf(g, F, t, s.tone, s.x + sw, s.y, sz * 1.1, sz * 0.9, 1);
        if (S.bloom > 0.02) { const al = clamp((S.bloom - s.bt * 0.6) / 0.3, 0, 0.9); g.globalAlpha = al; g.drawImage(F.bloom[s.v], s.x - sz * 0.5 + sw, s.y - sz * 0.52, sz, sz); g.globalAlpha = 1; }
        if (S.snow > 0.02) { g.fillStyle = `rgba(252,254,255,${0.92 * S.snow})`; g.beginPath(); g.ellipse(s.x + sw, s.y - sz * 0.18, sz * 0.38, sz * 0.16, 0, 0, TAU); g.fill(); }
      }
    },
  };
}
