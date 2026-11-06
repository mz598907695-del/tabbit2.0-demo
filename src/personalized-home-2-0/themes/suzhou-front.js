import { mulberry32 } from './canvas-kit.js';
import { clamp, lerp, smoothstep } from './gl-utils.js';
import { makeCanvas } from './suzhou-kit.js';
import { MONTHS, PENTADS, SEASON_CHARS, TERMS, rgba, termWeights } from './suzhou-season.js';

// Everything that belongs to the room rather than the garden: the whitewashed wall, the
// octagonal lattice window with its timber frame, reveal and stone sill, the calligraphy
// column on the wall and the light that falls in through the opening. All of it is drawn
// once into offscreen canvases (or cheaply tinted per frame); only the text cross-fades.
export const FONT = '"LXGW WenKai Lite", "Kaiti SC", "STKaiti", "KaiTi", "Songti SC", serif';

// ---- Geometry ----------------------------------------------------------------------
const octagon = (cx, cy, hw, hh, cut) => [
  [cx - hw + cut, cy - hh], [cx + hw - cut, cy - hh], [cx + hw, cy - hh + cut], [cx + hw, cy + hh - cut],
  [cx + hw - cut, cy + hh], [cx - hw + cut, cy + hh], [cx - hw, cy + hh - cut], [cx - hw, cy - hh + cut],
];

export function pathOf(points) {
  const path = new Path2D();
  points.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y));
  path.closePath();
  return path;
}

/** Offset a convex clockwise (screen) polygon inwards by d (negative grows it). */
export function inset(points, d) {
  const n = points.length;
  const lines = points.map((a, i) => {
    const b = points[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    return { px: a[0] - dy / l * d, py: a[1] + dx / l * d, dx: dx / l, dy: dy / l };
  });
  return points.map((_, i) => {
    const a = lines[(i + n - 1) % n], b = lines[i];
    const cross = a.dx * b.dy - a.dy * b.dx;
    const t = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / cross;
    return [a.px + a.dx * t, a.py + a.dy * t];
  });
}

const polyArea = poly => Math.abs(poly.reduce((a, [x, y], i) => { const [x2, y2] = poly[(i + 1) % poly.length]; return a + x * y2 - x2 * y; }, 0)) / 2;

/**
 * Ice-crack (冰裂纹) lattice: split a convex cell again and again with a chord across its
 * narrow side, so every new bar ends on an older one. The result has long straight runs, T
 * junctions and uneven four-to-six-sided panes, like cracks spreading in ice.
 */
function crackle(bounds, count, rand) {
  const cells = [bounds], cuts = [];
  for (let n = 0; n < count; n++) {
    const weights = cells.map(c => Math.pow(polyArea(c), 2));
    let pick = rand() * weights.reduce((a, b) => a + b, 0), idx = 0;
    while (idx < cells.length - 1 && (pick -= weights[idx]) > 0) idx++;
    const cell = cells[idx], m = cell.length, area = polyArea(cell);
    let cx = 0, cy = 0;
    cell.forEach(([x, y]) => { cx += x / m; cy += y / m; });
    let best = 0, ax = 1, ay = 0;
    for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) {
      const dx = cell[j][0] - cell[i][0], dy = cell[j][1] - cell[i][1], d = dx * dx + dy * dy;
      if (d > best) { best = d; ax = dx; ay = dy; }
    }
    const len = Math.sqrt(best) || 1;
    for (let attempt = 0; attempt < 18; attempt++) {
      const turn = Math.PI / 2 + (rand() - 0.5) * 0.7, c = Math.cos(turn), s = Math.sin(turn);
      const dx = (ax * c - ay * s) / len, dy = (ax * s + ay * c) / len, off = (rand() - 0.5) * 0.34 * len;
      const qx = cx + ax / len * off, qy = cy + ay / len * off, hits = [];
      for (let i = 0; i < m; i++) {
        const a = cell[i], b = cell[(i + 1) % m], ex = b[0] - a[0], ey = b[1] - a[1], den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((a[0] - qx) * ey - (a[1] - qy) * ex) / den, u = ((a[0] - qx) * dy - (a[1] - qy) * dx) / den;
        if (u >= 0.1 && u <= 0.9) hits.push({ i, u, x: qx + dx * t, y: qy + dy * t, t, sin: Math.abs(den) / Math.hypot(ex, ey) });
      }
      if (hits.length < 2) continue;
      hits.sort((p, q) => p.t - q.t);
      const h0 = hits[0], h1 = hits[hits.length - 1];
      if (h0.i === h1.i || h0.sin < 0.62 || h1.sin < 0.62) continue;
      const [lo, hi] = h0.i < h1.i ? [h0, h1] : [h1, h0];
      const first = [[lo.x, lo.y]], second = [[hi.x, hi.y]];
      for (let i = lo.i + 1; i <= hi.i; i++) first.push(cell[i]);
      first.push([hi.x, hi.y]);
      for (let i = hi.i + 1; i <= lo.i + m; i++) second.push(cell[i % m]);
      second.push([lo.x, lo.y]);
      if (Math.min(polyArea(first), polyArea(second)) < area * 0.3) continue;
      cells.splice(idx, 1, first, second);
      cuts.push([[lo.x, lo.y], [hi.x, hi.y]]);
      break;
    }
  }
  return cuts;
}

/** Where everything sits for a given viewport; `avoidHalf` is half the width of the page content. */
export function computeLayout(W, H, avoidHalf) {
  const wh = H * 0.88, cy = H * 0.485;
  let ww = Math.min(W * 0.46, wh * 0.9);
  if (W < 760) ww = Math.min(W * 0.64, wh * 0.9);
  const share = clamp(0.62 + 0.06 * clamp(avoidHalf / (0.3 * W), 0, 1.2), 0.62, 0.68);
  const cx = Math.min(W * share, W - ww / 2 - W * 0.025);
  const poly = octagon(cx, cy, ww / 2, wh / 2, ww * 0.25);
  const vp = [W * 0.5, H * 0.52], s = 0.055;
  const poly1 = poly.map(([x, y]) => [vp[0] + (x - vp[0]) * (1 - s), vp[1] + (y - vp[1]) * (1 - s)]);
  // The scene is authored on a 1000 x 1200 sheet and cover-fitted into the pane.
  const sc = Math.max(ww / 860, wh / 1040), sceneY = 636;
  const sceneX = 500 + clamp((0.8 - ww / wh) * 280, 0, 80);
  const leftEdge = Math.min(W / 2 - avoidHalf, cx - ww / 2) - 18;
  const free = Math.max(leftEdge - 22, W * 0.09);
  const fs = clamp(Math.min(free * 0.42, H * 0.1), 28, 104);
  return { W, H, cx, cy, ww, wh, poly, poly1, vp, depth: s, sc, sceneX, sceneY, text: { free, fs } };
}

// ---- Textures --------------------------------------------------------------------------
/** Tileable grey noise for multiply blending: plaster grain (coarse) or paper fibre (fine). */
export function noiseTile(size, seed, strength, fibres) {
  const rand = mulberry32(seed), c = makeCanvas(size, size), g = c.getContext('2d');
  const image = g.createImageData(size, size), d = image.data;
  const low = Array.from({ length: 16 * 16 }, () => rand());
  const sample = (x, y) => {
    const fx = x / size * 16, fy = y / size * 16, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const a = low[(y0 % 16) * 16 + x0 % 16], b = low[(y0 % 16) * 16 + (x0 + 1) % 16];
    const c2 = low[((y0 + 1) % 16) * 16 + x0 % 16], e = low[((y0 + 1) % 16) * 16 + (x0 + 1) % 16];
    return lerp(lerp(a, b, tx * tx * (3 - 2 * tx)), lerp(c2, e, tx * tx * (3 - 2 * tx)), ty * ty * (3 - 2 * ty));
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = 255 - strength * (0.45 * rand() + 0.55 * sample(x, y));
    const i = (y * size + x) * 4;
    d[i] = v; d[i + 1] = v - strength * 0.03; d[i + 2] = v - strength * 0.09; d[i + 3] = 255;
  }
  g.putImageData(image, 0, 0);
  if (fibres) {
    g.strokeStyle = 'rgba(120,100,70,.06)'; g.lineWidth = 0.6;
    for (let i = 0; i < size * 0.9; i++) {
      const x = rand() * size, y = rand() * size, a = rand() * 6.283, l = 4 + rand() * 12;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  }
  return c;
}

// ---- The wall ---------------------------------------------------------------------------
function drawWall(g, V, plaster) {
  const { W, H, cx, cy, ww, wh } = V, rand = mulberry32(2024);
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#f1ece1'); base.addColorStop(0.5, '#f4efe5'); base.addColorStop(1, '#ebe4d5');
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  // plaster is never evenly lit: big soft blotches of warm shadow and bright lime wash
  for (let i = 0; i < 70; i++) {
    const x = rand() * W, y = rand() * H, r = 60 + rand() * 260, warm = rand() < 0.55;
    const blob = g.createRadialGradient(x, y, 0, x, y, r);
    blob.addColorStop(0, warm ? `rgba(150,128,96,${0.04 + rand() * 0.05})` : `rgba(255,252,242,${0.08 + rand() * 0.1})`);
    blob.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = blob; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // rain stains running down from the lintel corners and the sill ends
  const stain = (x, y0, len, width, alpha) => {
    const grad = g.createLinearGradient(0, y0, 0, y0 + len);
    grad.addColorStop(0, `rgba(118,104,84,${alpha})`); grad.addColorStop(0.5, `rgba(118,104,84,${alpha * 0.55})`); grad.addColorStop(1, 'rgba(118,104,84,0)');
    g.fillStyle = grad;
    for (const [k, a] of [[1, 0.3], [0.6, 0.5], [0.3, 0.8]]) {
      g.globalAlpha = a; g.beginPath(); g.roundRect(x - width * k / 2, y0, width * k, len, width * k / 2); g.fill();
    }
    g.globalAlpha = 1;
  };
  const left = cx - ww / 2, right = cx + ww / 2, top = cy - wh / 2;
  for (let i = 0; i < 9; i++) stain(left - ww * 0.03 + rand() * ww * 1.06, top + wh * (0.1 + rand() * 0.3), 50 + rand() * H * 0.16, 3 + rand() * 9, 0.05 + rand() * 0.05);
  for (let i = 0; i < 5; i++) stain(rand() * W, rand() * H * 0.12, 40 + rand() * H * 0.18, 3 + rand() * 8, 0.035 + rand() * 0.035);
  stain(right + ww * 0.03, top + wh * 0.35, wh * 0.4, 12, 0.07);
  // rising damp above the plinth, jagged where the moisture stopped
  const plH = Math.max(24, H * 0.06), plY = H - plH;
  const damp = g.createLinearGradient(0, plY - H * 0.13, 0, plY);
  damp.addColorStop(0, 'rgba(120,128,108,0)'); damp.addColorStop(1, 'rgba(110,116,98,.2)');
  g.fillStyle = damp;
  g.beginPath(); g.moveTo(0, plY);
  for (let x = 0; x <= W + 20; x += 18) g.lineTo(x, plY - H * 0.05 - rand() * H * 0.08 - Math.sin(x * 0.011) * H * 0.02);
  g.lineTo(W, plY); g.fill();
  // plaster grain
  g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.8; g.fillStyle = g.createPattern(plaster, 'repeat'); g.fillRect(0, 0, W, H); g.restore();
  // hairline cracks
  g.strokeStyle = 'rgba(96,82,64,.13)'; g.lineWidth = 0.8; g.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    let x = rand() * W, y = rand() * H * 0.7;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 6; s++) { x += (rand() - 0.5) * 18; y += 6 + rand() * 14; g.lineTo(x, y); }
    g.stroke();
  }
  // blue-grey brick plinth
  const rh = plH / 3;
  g.fillStyle = '#7d8584'; g.fillRect(0, plY, W, plH);
  for (let row = 0; row < 3; row++) {
    const y = plY + row * rh;
    for (let x = -((row % 2) * 28 + rand() * 10); x < W; ) {
      const bw = 44 + rand() * 22, tone = 108 + rand() * 38;
      g.fillStyle = `rgb(${tone * 0.93 | 0},${tone | 0},${tone * 0.99 | 0})`;
      g.fillRect(x + 1, y + 1, bw - 2, rh - 2);
      g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x + 1, y + 1, bw - 2, 1.5);
      x += bw;
    }
  }
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, plY, W, 2);
  const lip = g.createLinearGradient(0, plY - 18, 0, plY);
  lip.addColorStop(0, 'rgba(90,76,58,0)'); lip.addColorStop(1, 'rgba(90,76,58,.2)');
  g.fillStyle = lip; g.fillRect(0, plY - 18, W, 18);
  // the wall darkens towards its edges; the opening spills warm light back onto it
  const vignette = g.createRadialGradient(W * 0.56, H * 0.46, Math.min(W, H) * 0.38, W * 0.56, H * 0.5, Math.max(W, H) * 0.82);
  vignette.addColorStop(0, 'rgba(110,88,60,0)'); vignette.addColorStop(1, 'rgba(110,88,60,.17)');
  g.fillStyle = vignette; g.fillRect(0, 0, W, H);
  const spill = g.createRadialGradient(cx, cy, wh * 0.1, cx, cy, wh * 0.95);
  spill.addColorStop(0, 'rgba(255,248,226,.34)'); spill.addColorStop(1, 'rgba(255,248,226,0)');
  g.fillStyle = spill; g.fillRect(0, 0, W, H);
}

// ---- The window ------------------------------------------------------------------------------
const WOOD = [58, 34, 24];

function drawLattice(g, V, bounds, bw) {
  const cuts = crackle(bounds, Math.round(clamp(V.ww / 10, 32, 66)), mulberry32(1368)), bars = new Path2D(), d = V.dpr;
  for (const [a, b] of cuts) { bars.moveTo(a[0], a[1]); bars.lineTo(b[0], b[1]); }
  const stroke = (style, width, dx = 0, dy = 0) => {
    g.save(); g.translate(dx, dy); g.strokeStyle = style; g.lineWidth = width; g.stroke(bars); g.restore();
  };
  g.lineJoin = 'round'; g.lineCap = 'round';
  // the bars throw a soft shadow into the garden behind them
  g.save();
  g.shadowColor = 'rgba(28,18,10,.5)'; g.shadowBlur = bw * 3.2 * d; g.shadowOffsetX = bw * 0.7 * d; g.shadowOffsetY = bw * 1.1 * d;
  g.strokeStyle = rgba(WOOD); g.lineWidth = bw; g.stroke(bars);
  g.restore();
  stroke(rgba(WOOD), bw);
  stroke('rgba(20,10,6,.55)', bw * 0.3, -bw * 0.26, bw * 0.28);
  stroke('rgba(170,118,82,.5)', bw * 0.24, bw * 0.2, -bw * 0.25);
  return cuts;
}

function drawWindow(g, V, plaster) {
  const { ww, wh, cx, cy, poly, poly1 } = V, rand = mulberry32(99);
  const p0 = pathOf(poly), p1 = pathOf(poly1);
  // soft depth shadow and a slim stone moulding around the opening
  g.save(); g.shadowColor = 'rgba(70,52,34,.5)'; g.shadowBlur = ww * 0.05 * V.dpr; g.shadowOffsetY = ww * 0.014 * V.dpr; g.fillStyle = '#000'; g.fill(p0); g.restore();
  const mw = ww * 0.016, outer = inset(poly, -mw);
  const stone = g.createLinearGradient(cx - ww / 2, cy - wh / 2, cx + ww / 2, cy + wh / 2);
  stone.addColorStop(0, '#d9d4c8'); stone.addColorStop(1, '#b9b5aa');
  g.fillStyle = stone; g.fill(pathOf(outer));
  g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,250,.7)'; g.stroke(pathOf(inset(outer, 1)));
  g.strokeStyle = 'rgba(80,70,56,.45)'; g.stroke(pathOf(outer));
  // cut the opening
  g.globalCompositeOperation = 'destination-out'; g.fill(p0); g.globalCompositeOperation = 'source-over';
  // reveal: the thickness of the wall, lit by the outside
  g.save(); g.clip(p0);
  g.fillStyle = '#d9d0bc'; g.fill(p0);
  const light = Math.hypot(0.35, 0.9);
  poly.forEach((a, i) => {
    const j = (i + 1) % poly.length, b = poly[j], a1 = poly1[i], b1 = poly1[j];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    const dot = (-dy / l * 0.35 + dx / l * -0.9) / light;
    const tone = 0.76 + 0.3 * dot;
    const grad = g.createLinearGradient((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2);
    grad.addColorStop(0, rgba([230 * tone * 0.84, 218 * tone * 0.82, 194 * tone * 0.78]));
    grad.addColorStop(1, rgba([244 * tone, 234 * tone, 212 * tone]));
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(b1[0], b1[1]); g.lineTo(a1[0], a1[1]); g.closePath(); g.fill();
  });
  g.globalCompositeOperation = 'multiply'; g.fillStyle = g.createPattern(plaster, 'repeat'); g.fillRect(cx - ww, cy - wh, ww * 2, wh * 2);
  g.globalCompositeOperation = 'destination-out'; g.fill(p1);
  g.restore();

  // timber frame and lattice live on the far plane, clipped by the wall in front
  const fw = ww * 0.04, innerPoly = inset(poly1, fw);
  g.save(); g.clip(p0); g.clip(p1);
  const wood = g.createLinearGradient(cx - ww / 2, cy - wh / 2, cx + ww / 2, cy + wh / 2);
  wood.addColorStop(0, '#5a3626'); wood.addColorStop(0.5, '#3f241a'); wood.addColorStop(1, '#2f1a12');
  g.fillStyle = wood; g.fill(p1);
  g.lineJoin = 'round';
  for (let k = 0; k < 9; k++) {
    const grain = inset(poly1, fw * (0.08 + rand() * 0.82));
    g.setLineDash([20 + rand() * 120, 8 + rand() * 90]); g.lineDashOffset = rand() * 200;
    g.strokeStyle = k % 3 ? 'rgba(15,8,4,.34)' : 'rgba(176,124,88,.2)'; g.lineWidth = 0.7 + rand() * 0.9;
    g.stroke(pathOf(grain));
  }
  g.setLineDash([]);
  g.strokeStyle = 'rgba(190,138,98,.5)'; g.lineWidth = 1.3; g.stroke(pathOf(inset(poly1, 1.5)));
  g.strokeStyle = 'rgba(190,138,98,.3)'; g.lineWidth = 1; g.stroke(pathOf(inset(poly1, fw * 0.58)));
  g.strokeStyle = 'rgba(10,5,2,.7)'; g.lineWidth = 1.6; g.stroke(pathOf(inset(poly1, fw - 0.5)));
  // the opening inside the timber: a pane hole, then crazed lattice
  g.globalCompositeOperation = 'destination-out'; g.fill(pathOf(innerPoly)); g.globalCompositeOperation = 'source-over';
  g.save(); g.clip(pathOf(innerPoly));
  const bw = Math.max(2, ww * 0.0082);
  const cuts = drawLattice(g, V, inset(poly1, fw * 0.4), bw);
  g.restore();
  g.restore();

  // stone sill: top face on the far side of the wall plane, lip towards the room
  const bottom = poly[4][1], xr = poly[4][0], xl = poly[5][0], back = poly1[4][1];
  const e = ww * 0.07, front = bottom + Math.max(7, wh * 0.01), lipH = Math.max(10, wh * 0.017);
  const top = g.createLinearGradient(0, back, 0, front);
  top.addColorStop(0, '#f0eee6'); top.addColorStop(1, '#d4d1c6');
  g.fillStyle = top;
  g.beginPath(); g.moveTo(poly1[5][0], back); g.lineTo(poly1[4][0], back); g.lineTo(xr + e, front); g.lineTo(xl - e, front); g.closePath(); g.fill();
  g.save(); g.beginPath(); g.moveTo(poly1[5][0], back); g.lineTo(poly1[4][0], back); g.lineTo(xr + e, front); g.lineTo(xl - e, front); g.closePath(); g.clip();
  for (let i = 0; i < 160; i++) {
    const sx = xl - e + rand() * (xr - xl + e * 2), sy = back + rand() * (front - back);
    g.fillStyle = rand() < 0.6 ? `rgba(120,116,104,${0.05 + rand() * 0.08})` : `rgba(255,255,252,${0.2 + rand() * 0.25})`;
    g.beginPath(); g.ellipse(sx, sy, 0.8 + rand() * 3.4, 0.5 + rand() * 1.1, 0, 0, 6.2832); g.fill();
  }
  g.strokeStyle = 'rgba(130,126,114,.14)'; g.lineWidth = 0.9;
  for (let i = 0; i < 5; i++) { const sx = xl + rand() * (xr - xl); g.beginPath(); g.moveTo(sx, back); g.quadraticCurveTo(sx + (rand() - 0.5) * 40, (back + front) / 2, sx + (rand() - 0.5) * 60, front); g.stroke(); }
  g.restore();
  g.strokeStyle = 'rgba(255,255,250,.9)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(xl - e, front + 0.6); g.lineTo(xr + e, front + 0.6); g.stroke();
  const lip = g.createLinearGradient(0, front, 0, front + lipH);
  lip.addColorStop(0, '#bdbab0'); lip.addColorStop(1, '#8f8c83');
  g.fillStyle = lip; g.fillRect(xl - e, front, xr - xl + e * 2, lipH);
  g.fillStyle = 'rgba(70,56,40,.35)'; g.fillRect(xl - e, front + lipH - 1.5, xr - xl + e * 2, 1.5);
  const cast = g.createLinearGradient(0, front + lipH, 0, front + lipH + wh * 0.04);
  cast.addColorStop(0, 'rgba(70,52,34,.34)'); cast.addColorStop(1, 'rgba(70,52,34,0)');
  g.fillStyle = cast; g.fillRect(xl - e - 6, front + lipH, xr - xl + e * 2 + 12, wh * 0.04);
  return cuts;
}

/** The full-viewport front layer: wall with a window hole (transparent pane), at device resolution. */
export function buildFront(V, scale, plaster) {
  const c = makeCanvas(V.W * scale, V.H * scale), g = c.getContext('2d');
  g.setTransform(scale, 0, 0, scale, 0, 0);
  V.dpr = scale;
  drawWall(g, V, plaster);
  const cuts = drawWindow(g, V, plaster);
  return { canvas: c, cuts };
}

// ---- Light falling through the window -------------------------------------------------------
/** White alpha mask (quarter resolution): slanting shafts plus the lattice shadow thrown on the wall. */
export function buildLightMask(V, cuts, quarter) {
  const { W, H, cx, cy, ww, wh, poly1 } = V;
  const c = makeCanvas(W * quarter, H * quarter), g = c.getContext('2d');
  g.setTransform(quarter, 0, 0, quarter, 0, 0);
  // shafts: soft wedges leaving the upper right of the opening and fanning down-left over the wall
  const origin = [cx + ww * 0.3, cy - wh * 0.42], dir = Math.atan2(0.62, -1);
  const rand = mulberry32(31), shafts = [];
  for (let i = 0; i < 7; i++) {
    const a = dir + (i - 3) * 0.085 + (rand() - 0.5) * 0.04, len = H * (0.85 + rand() * 0.55), spread = 0.025 + rand() * 0.05;
    shafts.push({ a, len, spread, alpha: 0.2 + rand() * 0.2 });
    const gr = g.createLinearGradient(origin[0], origin[1], origin[0] + Math.cos(a) * len, origin[1] + Math.sin(a) * len);
    gr.addColorStop(0, `rgba(255,255,255,${shafts[i].alpha})`); gr.addColorStop(0.6, `rgba(255,255,255,${shafts[i].alpha * 0.5})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(origin[0] - 10, origin[1]);
    g.lineTo(origin[0] + Math.cos(a - spread) * len, origin[1] + Math.sin(a - spread) * len);
    g.lineTo(origin[0] + Math.cos(a + spread) * len, origin[1] + Math.sin(a + spread) * len);
    g.closePath(); g.fill();
  }
  // the shafts belong to the room: keep most of them off the pane itself
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,.94)'; g.fill(pathOf(V.poly)); g.globalCompositeOperation = 'source-over';
  // the window's own shape and crazing, sheared and thrown onto the wall to the lower left
  g.save();
  g.translate(cx - ww * 0.95, cy + wh * 0.36);
  g.transform(0.5, 0, -0.26, 0.46, 0, 0);
  g.translate(-cx, -cy);
  g.fillStyle = 'rgba(255,255,255,.6)'; g.fill(pathOf(poly1));
  g.globalCompositeOperation = 'destination-out';
  g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = Math.max(2, ww * 0.0082) * 2;
  g.beginPath();
  for (const [a, b] of cuts) { g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
  g.stroke();
  g.lineWidth = ww * 0.05; g.stroke(pathOf(poly1));
  g.restore();
  // fade everything with distance from the opening
  g.globalCompositeOperation = 'destination-in';
  const fade = g.createRadialGradient(cx - ww * 0.5, cy + wh * 0.2, wh * 0.2, cx - ww * 0.5, cy + wh * 0.2, Math.max(W, H) * 0.7);
  fade.addColorStop(0, 'rgba(255,255,255,1)'); fade.addColorStop(0.6, 'rgba(255,255,255,.8)'); fade.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = fade; g.fillRect(0, 0, W, H);
  return { canvas: c, origin, dir };
}

// ---- Calligraphy ------------------------------------------------------------------------------
const INK = [38, 32, 28];

function drawColumn(g, text, x, y, size, step, alpha, style) {
  g.font = `${size}px ${FONT}`;
  g.fillStyle = style; g.strokeStyle = style; g.lineWidth = size * 0.022;
  const chars = [...text];
  chars.forEach((ch, i) => {
    const jitter = Math.sin(i * 12.9898 + x) * 0.5;
    g.save(); g.translate(x + jitter * size * 0.02, y + i * step); g.rotate(jitter * 0.03);
    g.globalAlpha = alpha * 0.4; g.strokeText(ch, 0, 0);
    g.globalAlpha = alpha; g.fillText(ch, 0, 0);
    g.restore();
  });
}

/** Vertical solar-term calligraphy with a vermilion seal; adjacent terms cross-fade. */
export function drawCalligraphy(g, V, p) {
  const { H, cy, wh, text } = V, { free, fs } = text;
  const small = fs * 0.27, gap = fs * 0.2;
  const blockW = fs + gap + small;
  const mainX = 22 + free * 0.5 + blockW / 2 - fs / 2, sideX = mainX - fs / 2 - gap - small / 2;
  const y0 = cy - wh * 0.37 + fs * 0.62;
  g.save();
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  for (const { index, w } of termWeights(p)) {
    const term = TERMS[index], season = SEASON_CHARS[Math.floor(index / 6)];
    // a faint giant season character stands behind the column like a watermark
    g.font = `${fs * 3}px ${FONT}`; g.fillStyle = rgba(INK); g.globalAlpha = w * 0.045;
    g.fillText(season, (mainX + sideX) / 2, y0 + fs * 2.7);
    drawColumn(g, term, mainX, y0, fs, fs * 1.1, w * 0.9, rgba(INK));
    drawColumn(g, `${MONTHS[index]}·${PENTADS[index]}`, sideX, y0 - fs * 0.2, small, small * 1.2, w * 0.7, rgba([88, 78, 68]));
    // seal: four characters in reserve on vermilion
    const sz = fs * 0.62, sx = mainX + fs / 2 - sz, sy = y0 + fs * 1.1 + fs * 0.44;
    g.save(); g.translate(sx + sz / 2, sy + sz / 2); g.rotate(-0.03);
    g.globalAlpha = w * 0.9; g.fillStyle = 'rgb(188,52,40)';
    g.beginPath(); g.roundRect(-sz / 2, -sz / 2, sz, sz, sz * 0.06); g.fill();
    g.globalAlpha = w * 0.35; g.strokeStyle = 'rgb(120,28,20)'; g.lineWidth = 1; g.stroke();
    g.globalAlpha = w * 0.94; g.fillStyle = '#f4ebdc'; g.font = `${sz * 0.4}px ${FONT}`;
    const seal = [...`${term}时节`];
    [[0.5, -0.5], [0.5, 0.5], [-0.5, -0.5], [-0.5, 0.5]].forEach(([u, v], i) => g.fillText(seal[i], u * sz * 0.5, v * sz * 0.5 + sz * 0.14));
    g.restore();
  }
  g.restore();
  return { y0, H };
}

/** Float the dust motes caught in the shafts of light. */
export function drawDust(g, V, mask, time, color, amount) {
  const { origin, dir } = mask, { H } = V, rand = mulberry32(8);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) {
    const along = (0.12 + rand() * 0.8) * H * 1.1, across = (rand() - 0.5) * along * 0.4, ph = rand() * 6.283, sp = 0.15 + rand() * 0.3;
    const x = origin[0] + Math.cos(dir) * along - Math.sin(dir) * across + Math.sin(time * sp + ph) * 14;
    const y = origin[1] + Math.sin(dir) * along + Math.cos(dir) * across + Math.cos(time * sp * 0.8 + ph) * 10;
    const r = 0.7 + rand() * 1.5, twinkle = 0.5 + 0.5 * Math.sin(time * (0.6 + rand()) + ph);
    g.fillStyle = rgba(color, amount * (0.12 + 0.42 * twinkle) * smoothstep(0, 0.2, 1 - Math.abs(across) / (along * 0.3 + 1)));
    g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  }
  g.restore();
}
