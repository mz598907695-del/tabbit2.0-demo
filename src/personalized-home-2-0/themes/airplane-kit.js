// Small helpers shared by the airplane window modules.
import { clamp, lerp } from './gl-utils.js';

export const PI = Math.PI;
export const D2R = PI / 180;

/** Monotone cubic through [p, value] keys: smooth without overshooting. */
export function curve(keys) {
  const n = keys.length, xs = keys.map(k => k[0]), ys = keys.map(k => k[1]);
  const d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : 2 * d[i - 1] * d[i] / (d[i - 1] + d[i]);
  return p => {
    if (p <= xs[0]) return ys[0];
    if (p >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (p > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (p - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (3 * t2 - 2 * t3) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

/** Rounded rectangle path with slightly squarer corners than a circular arc. */
export function shape(g, cx, cy, w, h, r, append = false) {
  const x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2;
  r = Math.min(r, w / 2, h / 2);
  const k = r * .34;
  if (!append) g.beginPath();
  g.moveTo(x0 + r, y0); g.lineTo(x1 - r, y0);
  g.bezierCurveTo(x1 - k, y0, x1, y0 + k, x1, y0 + r); g.lineTo(x1, y1 - r);
  g.bezierCurveTo(x1, y1 - k, x1 - k, y1, x1 - r, y1); g.lineTo(x0 + r, y1);
  g.bezierCurveTo(x0 + k, y1, x0, y1 - k, x0, y1 - r); g.lineTo(x0, y0 + r);
  g.bezierCurveTo(x0, y0 + k, x0 + k, y0, x0 + r, y0);
  g.closePath();
}

export const rgba = (c, a = 1, k = 1) => `rgba(${Math.round(clamp(c[0] * k) * 255)},${Math.round(clamp(c[1] * k) * 255)},${Math.round(clamp(c[2] * k) * 255)},${a})`;
export { lerp };
