import { clamp, lerp } from './gl-utils.js';
import { PI, rgba, shape } from './airplane-kit.js';

// Everything that lives on the acrylic pane itself: faint cabin reflections, scratches, fingerprints,
// frost creeping in from the edges, sun glare and the tiny breather hole. Static layers are painted once
// (in glass-local CSS pixels) and blended per frame with an alpha that follows the light outside.

function softBlob(g, x, y, rx, ry, rot, color, alpha) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(rx, ry);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  grad.addColorStop(0, `rgba(${color},${alpha})`); grad.addColorStop(.55, `rgba(${color},${alpha * .35})`); grad.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = grad; g.beginPath(); g.arc(0, 0, 1, 0, PI * 2); g.fill();
  g.restore();
}

// Branching ice needles grow inward from a point on the rim.
function crystal(g, rand, x, y, angle, len, depth) {
  const ex = x + Math.cos(angle) * len, ey = y + Math.sin(angle) * len;
  g.moveTo(x, y); g.lineTo(ex, ey);
  if (depth <= 0) return;
  for (let k = 0; k < 3; k++) {
    const t = .3 + .27 * k, side = k % 2 ? 1 : -1;
    crystal(g, rand, lerp(x, ex, t), lerp(y, ey, t), angle + side * (.75 + rand() * .35), len * (.46 - k * .07), depth - 1);
  }
}

/** Builds the cached layers. makeCanvas(w, h) → [canvas, context] in CSS-pixel space. */
export function buildGlass(makeCanvas, L, rand) {
  const { gw, gh, rg } = L;
  const cx = gw / 2, cy = gh / 2;

  // cabin reflections: a ghost of the ceiling light strip, seat shoulders and the pane's own frame
  const [reflect, r] = makeCanvas(gw, gh);
  const sheen = r.createLinearGradient(0, 0, gw, gh);
  sheen.addColorStop(0, 'rgba(255,255,255,.34)'); sheen.addColorStop(.32, 'rgba(255,255,255,.06)'); sheen.addColorStop(.5, 'rgba(255,255,255,0)');
  sheen.addColorStop(.68, 'rgba(255,255,255,.05)'); sheen.addColorStop(1, 'rgba(255,255,255,.15)');
  r.fillStyle = sheen; r.fillRect(0, 0, gw, gh);
  softBlob(r, gw * .4, gh * .075, gw * .5, gh * .028, -.06, '255,238,206', .6);
  softBlob(r, gw * .78, gh * .07, gw * .22, gh * .02, -.06, '255,238,206', .35);
  r.save(); shape(r, cx, cy, gw - 16, gh - 16, rg - 8); r.lineWidth = 7; r.strokeStyle = 'rgba(255,248,232,.13)'; r.shadowColor = 'rgba(255,248,232,.5)'; r.shadowBlur = 6 * (r.getTransform().a); r.stroke(); r.restore();

  const [ghost, q] = makeCanvas(gw, gh);
  softBlob(q, gw * .08, gh * .96, gw * .5, gh * .24, .2, '8,9,12', .5);
  softBlob(q, gw * .98, gh * 1.02, gw * .38, gh * .2, -.2, '8,9,12', .4);

  // scratches, wiping swirls, dust and a couple of fingerprints
  const [scratch, s] = makeCanvas(gw, gh);
  s.lineCap = 'round';
  for (let i = 0; i < 34; i++) {
    const x = rand() * gw, y = rand() * gh, a = rand() * PI, len = 14 + rand() * gw * .38;
    s.strokeStyle = `rgba(255,255,255,${.1 + rand() * .3})`; s.lineWidth = .4 + rand() * .5;
    s.beginPath(); s.moveTo(x, y);
    s.quadraticCurveTo(x + Math.cos(a) * len * .5 + (rand() - .5) * 12, y + Math.sin(a) * len * .5 + (rand() - .5) * 12, x + Math.cos(a) * len, y + Math.sin(a) * len);
    s.stroke();
  }
  for (let k = 0; k < 3; k++) {
    const ox = rand() * gw, oy = rand() * gh * .9 + gh * .1, rr0 = gw * (.25 + rand() * .5), a0 = rand() * PI * 2;
    for (let i = 0; i < 14; i++) {
      s.strokeStyle = `rgba(255,255,255,${.04 + rand() * .07})`; s.lineWidth = .5;
      s.beginPath(); s.arc(ox, oy, rr0 + i * 2.1, a0, a0 + .5 + rand() * .6); s.stroke();
    }
  }
  for (let i = 0; i < 90; i++) {
    s.fillStyle = `rgba(255,255,255,${.12 + rand() * .45})`;
    const rr = .35 + rand() * rand() * 1.6;
    s.beginPath(); s.arc(rand() * gw, rand() * gh, rr, 0, PI * 2); s.fill();
  }
  for (const [fx, fy, ang] of [[.28, .62, .5], [.7, .3, -.7]]) {
    s.save(); s.translate(gw * fx, gh * fy); s.rotate(ang);
    for (let i = 3; i < 22; i++) {
      s.strokeStyle = `rgba(255,252,240,${.16 - i * .005})`; s.lineWidth = 1.2;
      s.beginPath(); s.ellipse(0, 0, i * 1.25, i * 1.7, 0, rand() * 6, rand() * 6 + 2.4); s.stroke();
    }
    s.restore();
  }

  // frost: three growth stages, each a layer of needles plus a patchy white rim
  const frost = [];
  const speck = makeCanvas(96, 96);
  {
    const img = speck[1].createImageData(speck[0].width, speck[0].height);
    for (let i = 0; i < img.data.length; i += 4) { img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = rand() * 255; }
    speck[1].putImageData(img, 0, 0);
  }
  for (let stage = 0; stage < 3; stage++) {
    const [c, f] = makeCanvas(gw, gh);
    const reach = [.1, .17, .27][stage], count = [46, 56, 66][stage];
    f.lineCap = 'round';
    f.strokeStyle = `rgba(236,246,255,${[.34, .28, .24][stage]})`; f.lineWidth = [.8, .8, .9][stage];
    f.beginPath();
    for (let i = 0; i < count; i++) {
      const t = rand() * PI * 2;
      const x = cx + Math.sign(Math.cos(t)) * Math.pow(Math.abs(Math.cos(t)), .5) * gw * .52, y = cy + Math.sign(Math.sin(t)) * Math.pow(Math.abs(Math.sin(t)), .5) * gh * .52;
      const inward = Math.atan2(cy - y, cx - x) + (rand() - .5) * .9;
      crystal(f, rand, x, y, inward, gw * reach * (.5 + rand() * .7), 2);
    }
    f.stroke();
    // misted rim
    f.save();
    f.beginPath(); f.rect(-gw, -gh, gw * 3, gh * 3); shape(f, cx, cy, gw - [2, 8, 16][stage], gh - [2, 8, 16][stage], rg, true);
    f.shadowColor = `rgba(232,244,255,${[.4, .42, .45][stage]})`; f.shadowBlur = [8, 16, 28][stage] * f.getTransform().a;
    f.fillStyle = '#fff'; f.fill('evenodd');
    f.restore();
    // break the rim into patches
    f.globalCompositeOperation = 'destination-in';
    const pat = f.createPattern(speck[0], 'repeat');
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.fillStyle = pat; f.globalAlpha = .4; f.fillRect(0, 0, c.width, c.height);
    f.globalAlpha = 1; f.globalCompositeOperation = 'source-over';
    frost.push(c);
  }

  // streaky fog tile for flying through cloud
  const [streak, k] = makeCanvas(512, 160);
  for (let i = 0; i < 160; i++) {
    const y = rand() * 160, len = 60 + rand() * 360, x = rand() * 512, hh = 1 + rand() * 5;
    const grad = k.createLinearGradient(x, 0, x + len, 0);
    const a = .05 + rand() * .3;
    grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(.3, `rgba(255,255,255,${a})`); grad.addColorStop(.7, `rgba(255,255,255,${a})`); grad.addColorStop(1, 'rgba(255,255,255,0)');
    k.fillStyle = grad; k.fillRect(x, y, len, hh); k.fillRect(x - 512, y, len, hh);
  }
  return { reflect, ghost, scratch, frost, streak };
}

/**
 * v: { cx, cy (glass centre), alpha: reflection strength, glare: 0..1, sun: [x, y] canvas px, sunColor, frost: 0..1, fog: 0..1,
 *      fogColor, dist, flash: strobe/beacon fog flash 0..1, time }
 */
export function drawGlass(g, L, fx, v) {
  const { gw, gh } = L;
  const x0 = v.cx - gw / 2, y0 = v.cy - gh / 2;

  // dirt and scratches light up in the glare
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = clamp(.035 + v.glare * .5 + v.fog * .08);
  g.drawImage(fx.scratch, x0, y0, gw, gh);

  // frost
  if (v.frost > .01) {
    for (let i = 0; i < 3; i++) {
      const a = clamp(v.frost * 3 - i);
      if (a <= 0) continue;
      g.globalAlpha = a * (.5 + .5 * v.frostLight);
      g.drawImage(fx.frost[i], x0, y0, gw, gh);
    }
  }
  // cabin reflection: obvious when it is dark outside
  g.globalAlpha = clamp(v.reflect);
  g.drawImage(fx.reflect, x0, y0, gw, gh);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = clamp(v.reflect * .5);
  g.drawImage(fx.ghost, x0, y0, gw, gh);

  // glare: a haze from the sun's direction, bloom and ghost discs along the optical axis
  if (v.glare > .01) {
    const [sx, sy] = v.sun, ga = v.glare, c = v.sunColor;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 1;
    const haze = g.createRadialGradient(sx, sy, 0, sx, sy, gh * .75);
    haze.addColorStop(0, `rgba(${c},${.4 * ga})`); haze.addColorStop(.25, `rgba(${c},${.13 * ga})`); haze.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = haze; g.fillRect(x0, y0, gw, gh);
    const dx = v.cx - sx, dy = v.cy - sy;
    for (const [t, rad, a] of [[.55, .07, .06], [1.3, .12, .05], [1.9, .05, .06]]) {
      const x = sx + dx * t, y = sy + dy * t, rr = gh * rad;
      const grad = g.createRadialGradient(x, y, rr * .55, x, y, rr);
      grad.addColorStop(0, `rgba(${c},0)`); grad.addColorStop(.75, `rgba(${c},${a * ga})`); grad.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = grad; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
  }

  // breather hole
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  const hx = v.cx - gw * .02, hy = v.cy + gh * .405, hr = Math.max(1.6, gw * .0085);
  const rim = g.createRadialGradient(hx, hy, hr * .4, hx, hy, hr * 2.4);
  rim.addColorStop(0, 'rgba(0,0,0,.55)'); rim.addColorStop(.45, 'rgba(0,0,0,.25)'); rim.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rim; g.beginPath(); g.arc(hx, hy, hr * 2.4, 0, PI * 2); g.fill();
  g.fillStyle = 'rgba(8,8,10,.8)'; g.beginPath(); g.arc(hx, hy, hr, 0, PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(hx - hr * .3, hy - hr * .35, hr * .35, 0, PI * 2); g.fill();
}

/** The sliding window shade. open: 0 raised (only its lip shows) .. 1 lowered. color: light through the plastic. */
export function drawShade(g, L, open, color, glow) {
  const { cx, cy, gw, gh } = L;
  const x0 = cx - gw / 2 - 3, y0 = cy - gh / 2 - 3, w = gw + 6;
  const h = gh * (.03 + .55 * open) + 3;
  const tone = [.84 + (color[0] - .84) * glow, .8 + (color[1] - .8) * glow, .72 + (color[2] - .72) * glow];
  const body = g.createLinearGradient(0, y0, 0, y0 + h);
  body.addColorStop(0, rgba(tone, 1, .78)); body.addColorStop(1, rgba(tone, 1, 1.02));
  g.fillStyle = body; g.fillRect(x0, y0, w, h);
  // moulded ribs
  if (h > gh * .1) {
    g.fillStyle = 'rgba(60,48,32,.16)';
    for (let y = y0 + gh * .075; y < y0 + h - gh * .05; y += gh * .052) g.fillRect(x0, y, w, 1.4);
    g.fillStyle = 'rgba(255,255,250,.28)';
    for (let y = y0 + gh * .075; y < y0 + h - gh * .05; y += gh * .052) g.fillRect(x0, y + 1.4, w, 1);
  }
  // shadow on the view below the lip
  const shadow = g.createLinearGradient(0, y0 + h, 0, y0 + h + 22);
  shadow.addColorStop(0, 'rgba(8,8,12,.4)'); shadow.addColorStop(1, 'rgba(8,8,12,0)');
  g.fillStyle = shadow; g.fillRect(x0, y0 + h, w, 22);
  // the lip with its finger notch
  const lip = g.createLinearGradient(0, y0 + h - 10, 0, y0 + h);
  lip.addColorStop(0, rgba(tone, 1, 1.06)); lip.addColorStop(1, rgba(tone, 1, .8));
  g.fillStyle = lip; g.fillRect(x0, y0 + h - 10, w, 10);
  g.fillStyle = 'rgba(255,255,250,.55)'; g.fillRect(x0, y0 + h - 10, w, 1.2);
  g.fillStyle = 'rgba(40,32,20,.45)'; g.fillRect(x0, y0 + h - 1.2, w, 1.2);
  const nw = gw * .16;
  g.fillStyle = 'rgba(50,40,26,.35)';
  g.beginPath(); g.roundRect ? g.roundRect(cx - nw / 2, y0 + h - 8, nw, 5, 2.5) : g.rect(cx - nw / 2, y0 + h - 8, nw, 5); g.fill();
}
