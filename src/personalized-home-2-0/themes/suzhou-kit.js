import { lerp } from './gl-utils.js';

// Small drawing helpers shared by the Suzhou wallpaper modules (sprites, splines, brush strokes).
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}

/** Pre-render a scene-space rectangle at k pixels per scene unit. */
export function bake(k, x0, y0, w, h, draw) {
  const c = makeCanvas(w * k, h * k), g = c.getContext('2d');
  g.setTransform(c.width / w, 0, 0, c.height / h, -x0 * c.width / w, -y0 * c.height / h);
  draw(g);
  return { c, x0, y0, w, h };
}

export function put(g, sprite, alpha = 1) {
  if (alpha <= 0.003) return;
  g.globalAlpha = alpha > 1 ? 1 : alpha;
  g.drawImage(sprite.c, sprite.x0, sprite.y0, sprite.w, sprite.h);
  g.globalAlpha = 1;
}

/** Catmull-Rom through the points, `seg` samples per span. */
export function spline(pts, seg = 8) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(d => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** A tapering brush-stroke outline along a dense polyline. */
export function ribbon(dense, w0, w1, wobble = 0.12, phase = 0) {
  const n = dense.length, left = [], right = [], cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = cum[n - 1] || 1;
  for (let i = 0; i < n; i++) {
    const a = dense[Math.max(0, i - 1)], b = dense[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = lerp(w0, w1, Math.pow(cum[i] / total, 0.85)) * (1 + wobble * Math.sin(i * 1.9 + phase)) / 2;
    left.push([dense[i][0] - dy * w, dense[i][1] + dx * w]);
    right.push([dense[i][0] + dy * w, dense[i][1] - dx * w]);
  }
  const path = new Path2D();
  left.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y));
  for (let i = n - 1; i >= 0; i--) path.lineTo(right[i][0], right[i][1]);
  path.closePath();
  return { path, left, right, total };
}

/** Smooth 2D value noise in 0..1 (hash lattice), cheap enough for placement-time use. */
export function noise2(x, y, seed = 0) {
  const h = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return lerp(lerp(h(x0, y0), h(x0 + 1, y0), u), lerp(h(x0, y0 + 1), h(x0 + 1, y0 + 1), u), v);
}
