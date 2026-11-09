import { mulberry32 } from './canvas-kit.js';
import { clamp, lerp, smoothstep } from './gl-utils.js';
import { TAU, mix3, rgba, shade } from './suzhou-season.js';
import { bake, put } from './suzhou-kit.js';

// The view through the window, authored on a 1000 x 1200 sheet: sky, ink mountains, the far
// bank (whitewashed wall, horse-head gables, moon gate, pavilion), the pond with its
// reflections, ice and lotus. Near trees and rocks live in suzhou-flora.js.
export const WATER_Y = 664;

function makeRidge(rand, base, amp, wl) {
  const ph = [rand() * TAU, rand() * TAU, rand() * TAU], pts = [];
  for (let x = -140; x <= 1140; x += 8) {
    const v = (Math.sin(x / wl * TAU + ph[0]) + 0.5 * Math.sin(x / (wl * 0.46) * TAU + ph[1]) + 0.2 * Math.sin(x / (wl * 0.21) * TAU + ph[2]) + 1.7) / 3.4;
    pts.push([x, base - amp * Math.pow(v, 1.5)]);
  }
  return pts;
}

const ridgeAt = (ridge, x) => { const i = clamp(Math.round((x + 140) / 8), 0, ridge.length - 1); return ridge[i][1]; };

function ridgePath(ridge, bottom) {
  const path = new Path2D();
  path.moveTo(ridge[0][0], bottom); path.lineTo(ridge[0][0], ridge[0][1]);
  for (let i = 1; i < ridge.length - 1; i++) path.quadraticCurveTo(ridge[i][0], ridge[i][1], (ridge[i][0] + ridge[i + 1][0]) / 2, (ridge[i][1] + ridge[i + 1][1]) / 2);
  path.lineTo(ridge[ridge.length - 1][0], ridge[ridge.length - 1][1]); path.lineTo(ridge[ridge.length - 1][0], bottom);
  path.closePath();
  return path;
}

function makeMountains(k, rand) {
  const r1 = makeRidge(rand, 566, 210, 600), r2 = makeRidge(rand, 590, 128, 390);
  const p1 = ridgePath(r1, 640), p2 = ridgePath(r2, 660);
  const top1 = Math.min(...r1.map(p => p[1])), top2 = Math.min(...r2.map(p => p[1]));
  const strokes = bake(k, -140, 360, 1280, 300, g => {
    // brush texture on the near range: slanted texture strokes hanging from the ridge
    g.save(); g.clip(p2); g.lineCap = 'round';
    for (let i = 0; i < 150; i++) {
      const x = -120 + rand() * 1260, y = ridgeAt(r2, x) + 4 + rand() * 46, len = 14 + rand() * 38;
      g.strokeStyle = `rgba(30,48,52,${0.05 + rand() * 0.09})`; g.lineWidth = 1 + rand() * 2.4;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 2, y + len * 0.5, x - 5 - rand() * 5, y + len); g.stroke();
    }
    g.restore();
    g.save(); g.clip(p1); g.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const x = -120 + rand() * 1260, y = ridgeAt(r1, x) + 6 + rand() * 60, len = 18 + rand() * 40;
      g.strokeStyle = `rgba(40,60,70,${0.04 + rand() * 0.06})`; g.lineWidth = 1.5 + rand() * 3;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 3, y + len * 0.5, x - 6, y + len); g.stroke();
    }
    g.restore();
  });
  const snow = ridge => bake(k, -140, 340, 1280, 300, g => {
    g.save(); g.clip(ridgePath(ridge, 640));
    const gr = g.createLinearGradient(0, Math.min(...ridge.map(p => p[1])), 0, 600);
    gr.addColorStop(0, 'rgba(252,254,255,.96)'); gr.addColorStop(0.34, 'rgba(250,252,255,.6)'); gr.addColorStop(0.62, 'rgba(250,252,255,0)');
    g.fillStyle = gr; g.fillRect(-140, 340, 1280, 300); g.restore();
  });
  const dots = Array.from({ length: 170 }, () => { const x = -100 + rand() * 1240; return { x, y: ridgeAt(r2, x) + 1 + rand() * 30, w: 4 + rand() * 9, g: Math.floor(rand() * 3), j: rand() }; });
  return { r1, r2, p1, p2, top1, top2, strokes, snow1: snow(r1), snow2: snow(r2), dots };
}

function makeClouds(k, rand) {
  const make = (tint, seed) => bake(k, 0, 0, 440, 110, g => {
    const r = mulberry32(seed);
    g.scale(1, 0.46); g.translate(0, 0);
    for (let i = 0; i < 16; i++) {
      const x = 50 + r() * 340, y = (62 + (r() - 0.5) * 40) / 0.46, rad = 34 + r() * 52;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, rgba(tint, 0.5)); gr.addColorStop(0.55, rgba(tint, 0.22)); gr.addColorStop(1, rgba(tint, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    }
  });
  const sets = [[255, 255, 255], [255, 205, 150], [214, 220, 226]].map(t => [31, 32, 33].map(s => make(t, s)));
  const items = Array.from({ length: 7 }, (_, i) => ({ x: rand() * 1400, y: 40 + rand() * 330, s: 0.7 + rand() * 0.9, v: i % 3, sp: 2.5 + rand() * 4, a: 0.55 + rand() * 0.45 }));
  return { sets, items };
}

function drawSky(g, S, time, clouds) {
  const gr = g.createLinearGradient(0, -100, 0, 600);
  gr.addColorStop(0, rgba(S.skyTop)); gr.addColorStop(0.5, rgba(S.skyMid)); gr.addColorStop(1, rgba(S.skyHor));
  g.fillStyle = gr; g.fillRect(-160, -160, 1320, 820);
  const { sunX: sx, sunY: sy, sunVis: vis } = S;
  // overcast sheet for winter
  if (S.sw[3] > 0.02) {
    const sheet = g.createLinearGradient(0, -100, 0, 500);
    sheet.addColorStop(0, `rgba(150,158,170,${0.62 * S.sw[3]})`); sheet.addColorStop(1, 'rgba(190,196,204,0)');
    g.fillStyle = sheet; g.fillRect(-160, -160, 1320, 700);
  }
  for (const c of clouds.items) {
    const x = ((c.x + time * c.sp) % 1500) - 240, a = S.cloud * c.a;
    const warm = S.warm * (c.y > 140 ? 1 : 0.5), grey = S.sw[3] * 0.8;
    const w = 440 * c.s, h = 110 * c.s;
    put0(g, clouds.sets[0][c.v % 3], x, c.y, w, h, a * (1 - warm * 0.8) * (1 - grey * 0.7));
    if (warm > 0.02) put0(g, clouds.sets[1][c.v % 3], x, c.y, w, h, a * warm * 0.95);
    if (grey > 0.02) put0(g, clouds.sets[2][c.v % 3], x, c.y, w, h, a * grey);
  }
  const glow = g.createRadialGradient(sx, sy, 0, sx, sy, 340);
  glow.addColorStop(0, rgba(S.sunColor, 0.6 * vis)); glow.addColorStop(0.16, rgba(S.sunColor, 0.26 * vis)); glow.addColorStop(0.5, rgba(S.sunColor, 0.07 * vis)); glow.addColorStop(1, rgba(S.sunColor, 0));
  g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = glow; g.fillRect(sx - 340, sy - 340, 680, 680); g.restore();
  const disc = g.createRadialGradient(sx, sy, 0, sx, sy, S.sunR * 1.5);
  disc.addColorStop(0, rgba([255, 255, 250], 0.98 * vis)); disc.addColorStop(0.62, rgba(S.sunColor, 0.92 * vis)); disc.addColorStop(1, rgba(S.sunColor, 0));
  g.fillStyle = disc; g.beginPath(); g.arc(sx, sy, S.sunR * 1.5, 0, TAU); g.fill();
}

function put0(g, sprite, x, y, w, h, alpha) {
  if (alpha < 0.004) return;
  g.globalAlpha = alpha; g.drawImage(sprite.c, x, y, w, h); g.globalAlpha = 1;
}

function drawMountains(g, S, m, par, time) {
  const mist = (y0, y1, a) => {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, rgba(S.mistColor, 0)); gr.addColorStop(0.55, rgba(S.mistColor, a)); gr.addColorStop(1, rgba(S.mistColor, a * 0.85));
    g.fillStyle = gr; g.fillRect(-160, y0, 1320, y1 - y0);
  };
  g.save(); g.translate(par * 0.5, 0);
  const f1 = g.createLinearGradient(0, m.top1, 0, 600);
  f1.addColorStop(0, rgba(S.mountFar, 0.9)); f1.addColorStop(1, rgba(mix3(S.mountFar, S.mistColor, 0.7), 0.55));
  g.fillStyle = f1; g.fill(m.p1);
  g.restore();
  g.save(); g.translate(par * 0.5, 0); put(g, m.snow1, S.snow * 0.9); g.restore();
  // a pagoda on the far hill, nearly lost in the haze
  g.save(); g.translate(par * 0.5, 0);
  const px = 262, py = ridgeAt(m.r1, 262) + 4;
  g.fillStyle = rgba(shade(S.mountFar, 0.74), 0.8);
  for (let i = 0; i < 5; i++) {
    const w = 15 - i * 1.7, y = py - 8 - i * 11;
    g.beginPath(); g.moveTo(px - w - 4, y); g.lineTo(px + w + 4, y); g.lineTo(px + w, y - 4); g.lineTo(px - w, y - 4); g.closePath(); g.fill();
    g.fillRect(px - w + 2, y - 11, w * 2 - 4, 8);
  }
  g.fillRect(px - 0.8, py - 70, 1.6, 12);
  g.restore();
  mist(430 - 20 * S.mist, 600, S.mist * 0.55);
  g.save(); g.translate(par * 0.9, 0);
  const f2 = g.createLinearGradient(0, m.top2, 0, 640);
  f2.addColorStop(0, rgba(S.mountNear, 0.96)); f2.addColorStop(1, rgba(mix3(S.mountNear, S.mistColor, 0.62), 0.7));
  g.fillStyle = f2; g.fill(m.p2);
  put(g, m.strokes, 0.9);
  // tree dots along the near ridge: tender green, deep green, maple red, bare grey
  const spring = [158, 190, 140], summer = [70, 124, 86], autumn = [200, 118, 54], winter = [150, 158, 162];
  const base = mix3(mix3(mix3(spring, summer, S.sw[1]), autumn, S.sw[2]), winter, S.sw[3]);
  for (let gi = 0; gi < 3; gi++) {
    g.fillStyle = rgba(shade(base, 0.82 + gi * 0.16), 0.62); g.beginPath();
    for (const d of m.dots) if (d.g === gi) { g.moveTo(d.x + d.w, d.y); g.ellipse(d.x, d.y, d.w, d.w * 0.5, 0, 0, TAU); }
    g.fill();
  }
  put(g, m.snow2, S.snow * 0.85);
  g.restore();
  mist(500 - 30 * S.mist, 650, S.mist * 0.7);
  // drifting banks of mist
  const drift = (time * 3) % 1400;
  g.save();
  for (let i = 0; i < 3; i++) {
    const x = ((i * 520 + drift) % 1560) - 260, y = 520 + i * 28;
    const gr = g.createRadialGradient(x, y, 0, x, y, 300);
    gr.addColorStop(0, rgba(S.mistColor, 0.5 * S.mist)); gr.addColorStop(1, rgba(S.mistColor, 0));
    g.fillStyle = gr; g.save(); g.translate(x, y); g.scale(1, 0.18); g.translate(-x, -y); g.fillRect(x - 300, y - 300, 600, 600); g.restore();
  }
  g.restore();
}

// ---- Far bank ---------------------------------------------------------------------------------
const WALL_STEPS = [[-150, 72, 456], [72, 192, 478], [192, 316, 500], [316, 1150, 522]];
const PAVILION = { cx: 700, tipL: [560, 442], tipR: [840, 442], ridgeY: 388, ridgeL: 632, ridgeR: 768 };

function pavilionRoof() {
  const { tipL, tipR, ridgeY, ridgeL, ridgeR } = PAVILION;
  const roof = new Path2D();
  roof.moveTo(tipL[0] - 8, tipL[1] - 8);
  roof.quadraticCurveTo(tipL[0] + 4, tipL[1] + 4, tipL[0] + 20, tipL[1] + 8);
  roof.quadraticCurveTo(700, 494, tipR[0] - 20, tipR[1] + 8);
  roof.quadraticCurveTo(tipR[0] - 4, tipR[1] + 4, tipR[0] + 8, tipR[1] - 8);
  roof.quadraticCurveTo(tipR[0] - 30, tipR[1] - 14, ridgeR + 4, ridgeY);
  roof.lineTo(ridgeL - 4, ridgeY);
  roof.quadraticCurveTo(tipL[0] + 30, tipL[1] - 14, tipL[0] - 8, tipL[1] - 8);
  roof.closePath();
  return roof;
}

function drawBank(g, rand) {
  const wallTop = [244, 241, 232], wallBot = [226, 224, 214];
  for (const [x0, x1, top] of WALL_STEPS) {
    const gr = g.createLinearGradient(0, top, 0, 650);
    gr.addColorStop(0, rgba(wallTop)); gr.addColorStop(1, rgba(wallBot));
    g.fillStyle = gr; g.fillRect(x0, top, x1 - x0 + 1, 650 - top);
    const under = g.createLinearGradient(0, top + 6, 0, top + 34);
    under.addColorStop(0, 'rgba(90,84,76,.3)'); under.addColorStop(1, 'rgba(90,84,76,0)');
    g.fillStyle = under; g.fillRect(x0, top + 6, x1 - x0 + 1, 28);
  }
  // rain streaks and plaster stains on the far wall
  for (let i = 0; i < 40; i++) {
    const x = -100 + rand() * 1240, top = WALL_STEPS.find(s => x >= s[0] && x < s[1])?.[2] ?? 522, len = 20 + rand() * 80;
    const gr = g.createLinearGradient(0, top + 8, 0, top + 8 + len);
    gr.addColorStop(0, 'rgba(110,100,86,.16)'); gr.addColorStop(1, 'rgba(110,100,86,0)');
    g.fillStyle = gr; g.fillRect(x, top + 8, 2 + rand() * 5, len);
  }
  // dark tile caps with dripping tile ends, and the little horns of the horse-head gables
  WALL_STEPS.forEach(([x0, x1, top], i) => {
    const cap = g.createLinearGradient(0, top - 10, 0, top + 7);
    cap.addColorStop(0, '#6d7479'); cap.addColorStop(0.35, '#434a4f'); cap.addColorStop(1, '#2d3236');
    g.fillStyle = cap; g.fillRect(x0 - 3, top - 8, x1 - x0 + 6, 15);
    g.fillStyle = 'rgba(190,200,205,.4)'; g.fillRect(x0 - 3, top - 8, x1 - x0 + 6, 1.8);
    g.strokeStyle = 'rgba(120,128,134,.35)'; g.lineWidth = 1; g.beginPath();
    for (let x = x0; x < x1; x += 6) { g.moveTo(x, top - 7); g.lineTo(x, top + 4); }
    g.stroke();
    g.fillStyle = '#2d3236'; g.beginPath();
    for (let x = x0 - 1; x < x1 + 2; x += 6) { g.moveTo(x + 3, top + 7); g.arc(x, top + 7, 3, 0, Math.PI); }
    g.fill();
    if (i < 3) {
      g.fillStyle = '#383e42'; g.beginPath();
      g.moveTo(x1 - 14, top - 8); g.quadraticCurveTo(x1 - 4, top - 10, x1 + 4, top - 26); g.quadraticCurveTo(x1 + 3, top - 11, x1 + 7, top + 6); g.lineTo(x1 - 14, top + 6); g.fill();
    }
  });
  // moon gate
  const gx = 394, gy = 590;
  g.fillStyle = '#c9c7bd'; g.beginPath(); g.arc(gx, gy, 49, 0, TAU); g.fill();
  const inner = g.createLinearGradient(0, gy - 42, 0, gy + 42);
  inner.addColorStop(0, '#46604f'); inner.addColorStop(0.6, '#2d4339'); inner.addColorStop(1, '#6f8a6e');
  g.fillStyle = inner; g.beginPath(); g.arc(gx, gy, 41, 0, TAU); g.fill();
  g.save(); g.beginPath(); g.arc(gx, gy, 41, 0, TAU); g.clip();
  g.fillStyle = 'rgba(200,222,190,.5)'; g.beginPath(); g.ellipse(gx + 8, gy + 22, 30, 14, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(20,36,28,.85)'; g.lineWidth = 2;
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(gx - 30 + i * 12, gy + 42); g.quadraticCurveTo(gx - 28 + i * 12, gy, gx - 20 + i * 12, gy - 38); g.stroke(); }
  g.restore();
  g.strokeStyle = 'rgba(70,64,56,.5)'; g.lineWidth = 1.5; g.beginPath(); g.arc(gx, gy, 49, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(255,255,250,.6)'; g.beginPath(); g.arc(gx, gy, 41.5, 0.2, 2.6); g.stroke();
  // small lattice windows in the wall
  for (const wx of [492, 982, 112]) {
    const wy = wx === 112 ? 548 : 570, s = wx === 112 ? 26 : 34;
    g.fillStyle = '#c7c4ba'; g.fillRect(wx - s / 2 - 4, wy - s / 2 - 4, s + 8, s + 8);
    g.fillStyle = '#566a60'; g.fillRect(wx - s / 2, wy - s / 2, s, s);
    g.strokeStyle = '#2f3a36'; g.lineWidth = 1.6;
    g.beginPath(); for (let i = 1; i < 4; i++) { g.moveTo(wx - s / 2 + i * s / 4, wy - s / 2); g.lineTo(wx - s / 2 + i * s / 4, wy + s / 2); g.moveTo(wx - s / 2, wy - s / 2 + i * s / 4); g.lineTo(wx + s / 2, wy - s / 2 + i * s / 4); } g.stroke();
  }
  // stone footing
  const foot = g.createLinearGradient(0, 628, 0, 652);
  foot.addColorStop(0, '#a6aca8'); foot.addColorStop(1, '#79817e');
  g.fillStyle = foot; g.fillRect(-150, 628, 1300, 24);
  g.strokeStyle = 'rgba(40,50,50,.35)'; g.lineWidth = 1; g.beginPath();
  for (let x = -140; x < 1140; x += 22 + rand() * 24) { g.moveTo(x, 628); g.lineTo(x, 652); }
  g.moveTo(-150, 640); g.lineTo(1150, 640); g.stroke();
  drawPavilion(g);
}

function drawPavilion(g) {
  const { tipL, tipR, ridgeY, ridgeL, ridgeR } = PAVILION;
  // stone platform
  const plat = g.createLinearGradient(0, 614, 0, 648);
  plat.addColorStop(0, '#d9d7cd'); plat.addColorStop(1, '#9ea49f');
  g.fillStyle = plat; g.fillRect(584, 614, 232, 36);
  g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(584, 614, 232, 2);
  // dark interior
  const room = g.createLinearGradient(0, 478, 0, 616);
  room.addColorStop(0, '#2c2420'); room.addColorStop(1, '#58493f');
  g.fillStyle = room; g.fillRect(600, 478, 200, 138);
  g.fillStyle = 'rgba(240,226,200,.28)'; g.fillRect(660, 540, 80, 76);
  // columns, rail, hanging fascia
  for (const x of [606, 666, 734, 794]) {
    const col = g.createLinearGradient(x - 4, 0, x + 4, 0);
    col.addColorStop(0, '#9c5a46'); col.addColorStop(0.5, '#6e2f26'); col.addColorStop(1, '#3f1913');
    g.fillStyle = col; g.fillRect(x - 4, 478, 8, 138);
  }
  g.fillStyle = '#5b2a22'; g.fillRect(596, 574, 208, 5); g.fillRect(596, 604, 208, 4);
  g.strokeStyle = '#6e3a2c'; g.lineWidth = 2; g.beginPath();
  for (let x = 604; x < 800; x += 9) { g.moveTo(x, 579); g.lineTo(x, 604); }
  g.stroke();
  const beam = g.createLinearGradient(0, 476, 0, 494);
  beam.addColorStop(0, '#7a3a2c'); beam.addColorStop(1, '#4e2119');
  g.fillStyle = beam; g.fillRect(590, 476, 220, 14);
  g.strokeStyle = '#8c4e38'; g.lineWidth = 1.6; g.beginPath();
  for (let x = 604; x < 798; x += 8) { g.moveTo(x, 490); g.lineTo(x + 3, 502); g.lineTo(x + 6, 490); }
  g.stroke();
  // roof: charcoal tiles fanning from the ridge, rafters under the eave
  const roof = pavilionRoof();
  const tile = g.createLinearGradient(0, ridgeY - 8, 0, 480);
  tile.addColorStop(0, '#59616a'); tile.addColorStop(0.3, '#3a4147'); tile.addColorStop(1, '#262b30');
  g.fillStyle = tile; g.fill(roof);
  g.save(); g.clip(roof);
  g.strokeStyle = 'rgba(150,160,168,.28)'; g.lineWidth = 1; g.beginPath();
  for (let i = 0; i <= 26; i++) {
    const t = i / 26, tx = lerp(ridgeL - 4, ridgeR + 4, t), bx = lerp(tipL[0] - 6, tipR[0] + 6, t);
    g.moveTo(tx, ridgeY); g.lineTo(bx, 500);
  }
  g.stroke();
  g.fillStyle = 'rgba(210,218,224,.2)'; g.fillRect(ridgeL - 6, ridgeY - 1, ridgeR - ridgeL + 12, 3);
  g.restore();
  g.fillStyle = '#2b2f33'; g.fillRect(ridgeL - 12, ridgeY - 8, ridgeR - ridgeL + 24, 9);
  g.fillStyle = '#3b4146'; g.beginPath(); g.moveTo(ridgeL - 14, ridgeY - 8); g.quadraticCurveTo(ridgeL - 22, ridgeY - 16, ridgeL - 18, ridgeY - 26); g.quadraticCurveTo(ridgeL - 8, ridgeY - 14, ridgeL, ridgeY - 8); g.fill();
  g.beginPath(); g.moveTo(ridgeR + 14, ridgeY - 8); g.quadraticCurveTo(ridgeR + 22, ridgeY - 16, ridgeR + 18, ridgeY - 26); g.quadraticCurveTo(ridgeR + 8, ridgeY - 14, ridgeR, ridgeY - 8); g.fill();
  g.strokeStyle = '#2a1d19'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(tipL[0] + 18, tipL[1] + 10); g.quadraticCurveTo(700, 497, tipR[0] - 18, tipR[1] + 10); g.stroke();
}

function bankSnow(g) {
  g.fillStyle = 'rgba(252,254,255,.97)';
  for (const [x0, x1, top] of WALL_STEPS) {
    g.beginPath(); g.roundRect(x0 - 3, top - 15, x1 - x0 + 6, 9, 4); g.fill();
  }
  const roof = pavilionRoof();
  g.save(); g.clip(roof);
  const { ridgeY } = PAVILION;
  g.beginPath(); g.moveTo(540, ridgeY - 14); g.lineTo(860, ridgeY - 14); g.lineTo(870, 452);
  for (let x = 860; x > 540; x -= 12) g.lineTo(x, 456 + Math.sin(x * 0.21) * 4 - Math.abs(x - 700) * 0.04);
  g.lineTo(540, 452); g.closePath(); g.fill();
  g.restore();
  g.beginPath(); g.roundRect(PAVILION.ridgeL - 14, ridgeY - 14, PAVILION.ridgeR - PAVILION.ridgeL + 28, 8, 4); g.fill();
}

function makeStones(rand) {
  const stones = [];
  for (let x = -130; x < 1150; x += 34 + rand() * 30) stones.push({ x, y: 654 + rand() * 6, rx: 26 + rand() * 18, ry: 11 + rand() * 7, tone: 0.86 + rand() * 0.3 });
  return stones;
}

function drawStones(g, stones) {
  for (const s of stones) {
    const gr = g.createLinearGradient(0, s.y - s.ry, 0, s.y + s.ry);
    gr.addColorStop(0, rgba(shade([204, 206, 198], s.tone))); gr.addColorStop(1, rgba(shade([96, 106, 104], s.tone)));
    g.fillStyle = gr; g.beginPath(); g.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(40,50,50,.4)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(s.x - s.rx * 0.2, s.y - s.ry * 0.45, s.rx * 0.5, s.ry * 0.28, 0, 0, TAU); g.fill();
  }
}

function stonesSnow(g, stones) {
  g.fillStyle = 'rgba(252,254,255,.97)';
  for (const s of stones) { g.beginPath(); g.ellipse(s.x, s.y - s.ry * 0.5, s.rx * 0.8, s.ry * 0.55, 0, Math.PI, TAU); g.fill(); }
}

function makeBank(k, rand) {
  const stones = makeStones(rand);
  const mk = draw => bake(k, -150, 360, 1300, 340, draw);
  const wall = mk(g => drawBank(g, rand));
  const wallSnow = mk(g => bankSnow(g));
  const stone = mk(g => drawStones(g, stones));
  const stoneSnow = mk(g => stonesSnow(g, stones));
  const shrubs = Array.from({ length: 22 }, (_, i) => ({ x: -90 + i * 52 + rand() * 30, y: 630 + rand() * 20, r: 11 + rand() * 11, hue: rand() - 0.5, tone: Math.floor(rand() * 3), ph: rand() * TAU, bt: rand(), v: Math.floor(rand() * 3) }));
  return { wall, wallSnow, stone, stoneSnow, shrubs };
}

// ---- Water ---------------------------------------------------------------------------------------
function makeWater(k, rand) {
  const ripples = Array.from({ length: 90 }, () => { const d = Math.pow(rand(), 1.4); return { x: rand() * 1200 - 100, d, len: 18 + d * 90 + rand() * 40, ph: rand() * TAU, w: 0.7 + d * 2, dark: rand() < 0.4 }; });
  const glints = Array.from({ length: 46 }, () => ({ d: Math.pow(rand(), 1.1), ph: rand() * TAU, len: 4 + rand() * 12, off: (rand() - 0.5) * 2 }));
  const ice = bake(k, -140, WATER_Y, 1280, 600, g => {
    const r = mulberry32(99);
    const sheet = g.createLinearGradient(0, WATER_Y, 0, 1200);
    sheet.addColorStop(0, 'rgba(214,228,238,.86)'); sheet.addColorStop(1, 'rgba(184,204,220,.8)');
    g.fillStyle = sheet; g.fillRect(-140, WATER_Y, 1280, 600);
    for (let i = 0; i < 34; i++) {
      const x = r() * 1200 - 100, y = WATER_Y + 20 + r() * 520, rad = 40 + r() * 120;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.save(); g.translate(x, y); g.scale(1, 0.4); g.translate(-x, -y); g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); g.restore();
    }
    g.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      let x = r() * 1200 - 100, y = WATER_Y + 12 + r() * 540;
      const dirx = r() < 0.5 ? 1 : -1, pts = [[x, y]];
      for (let s = 0; s < 5; s++) { x += dirx * (14 + r() * 40) * (1 + (y - WATER_Y) / 500); y += (r() - 0.5) * 20; pts.push([x, y]); }
      g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 1.4; g.beginPath(); pts.forEach(([px, py], j) => j ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke();
      g.strokeStyle = 'rgba(80,110,130,.2)'; g.lineWidth = 1; g.beginPath(); pts.forEach(([px, py], j) => j ? g.lineTo(px, py + 1.5) : g.moveTo(px, py + 1.5)); g.stroke();
    }
  });
  const petals = Array.from({ length: 70 }, () => ({ x: 300 + rand() * 740, y: WATER_Y + 30 + rand() * 480, a: rand() * Math.PI, s: 3.4 + rand() * 2, ph: rand() * TAU, v: rand() }));
  const leaves = Array.from({ length: 64 }, () => ({ x: 280 + rand() * 760, y: WATER_Y + 30 + rand() * 500, a: rand() * TAU, s: 6 + rand() * 4, ph: rand() * TAU, v: rand() }));
  return { ripples, glints, ice, petals, leaves };
}

/** Mirror the shore into the pond: 2-pixel strips of the half-resolution sheet, shifted by ripples. */
function drawReflection(g, S, time, view) {
  const D = 520, kk = view.k * 0.5, step = 2 / view.k, rows = Math.floor(D / step);
  g.save();
  g.translate(0, 2 * WATER_Y); g.scale(1, -1);
  for (let n = 0; n < rows; n++) {
    const d = n * step, ys = WATER_Y - d - step, sy = Math.floor((ys - view.y0) * kk);
    if (sy < 0) break;
    const amp = 0.25 + d * 0.012, ripple = Math.sin(d * 0.07 + time * 1.15) * amp + Math.sin(d * 0.19 - time * 0.8) * amp * 0.6;
    g.drawImage(view.refl, 0, sy, view.refl.width, 1, view.x0 + ripple, ys, view.w, step + 0.3);
  }
  g.restore();
  g.globalCompositeOperation = 'destination-in';
  const fade = g.createLinearGradient(0, WATER_Y, 0, WATER_Y + D);
  fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(0.45, 'rgba(0,0,0,.6)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fade; g.fillRect(view.x0 - 20, WATER_Y, view.w + 40, D);
  g.globalCompositeOperation = 'source-over';
  return 0.74 * (1 - 0.82 * S.ice);
}

function drawWaterBody(g, S) {
  const body = g.createLinearGradient(0, WATER_Y, 0, 1200);
  body.addColorStop(0, rgba(S.waterTop)); body.addColorStop(1, rgba(S.waterBot));
  g.fillStyle = body; g.fillRect(-160, WATER_Y - 6, 1320, 620);
}

function drawWaterSurface(g, S, time, Wt) {
  // a pale sheen where the sky lies on the water, deepening towards the viewer
  const sheen = g.createLinearGradient(0, WATER_Y, 0, WATER_Y + 190);
  sheen.addColorStop(0, rgba(mix3(S.skyHor, [255, 255, 255], 0.25), 0.26)); sheen.addColorStop(1, rgba(S.skyHor, 0));
  g.fillStyle = sheen; g.fillRect(-160, WATER_Y, 1320, 190);
  const deep = g.createLinearGradient(0, WATER_Y + 200, 0, 1200);
  deep.addColorStop(0, rgba(S.waterBot, 0)); deep.addColorStop(1, rgba(shade(S.waterBot, 0.72), 0.55));
  g.fillStyle = deep; g.fillRect(-160, WATER_Y + 200, 1320, 420);
  // glitter of the sun on the water
  const sunGlow = S.sunVis * (0.3 + 0.7 * (S.sw[1] + S.sw[2])) * (1 - S.ice);
  g.lineCap = 'round';
  if (sunGlow > 0.02) {
    for (const q of Wt.glints) {
      const y = WATER_Y + 14 + Math.pow(q.d, 1.3) * 420, spread = 6 + (y - WATER_Y) * 0.28, x = S.sunX - 40 + q.off * spread + Math.sin(time * 0.5 + q.ph) * 4;
      const tw = 0.5 + 0.5 * Math.sin(time * 2.2 + q.ph * 3);
      g.strokeStyle = rgba(mix3(S.sunColor, [255, 255, 255], 0.5), sunGlow * (0.15 + 0.5 * tw) * (1 - q.d * 0.5)); g.lineWidth = 1 + q.d * 1.6;
      g.beginPath(); g.moveTo(x - q.len * (1 + q.d), y); g.lineTo(x + q.len * (1 + q.d), y); g.stroke();
    }
  }
  for (const q of Wt.ripples) {
    const y = WATER_Y + 10 + Math.pow(q.d, 1.35) * 500;
    if (y > 1160) continue;
    const x = q.x + Math.sin(time * 0.35 + q.ph) * 8, al = (0.05 + 0.1 * (0.5 + 0.5 * Math.sin(time * 0.8 + q.ph))) * (1 - 0.8 * S.ice);
    g.strokeStyle = q.dark ? `rgba(24,60,60,${al * 1.1})` : `rgba(255,255,255,${al * 1.6})`; g.lineWidth = q.w;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + q.len * 0.5, y - 1.2 - q.d * 2, x + q.len, y); g.stroke();
  }
  if (S.ice > 0.01) {
    g.fillStyle = rgba([196, 212, 224], 0.4 * S.ice); g.fillRect(-160, WATER_Y, 1320, 560);
    put(g, Wt.ice, S.ice);
  }
}

// ---- Lotus -----------------------------------------------------------------------------------
const LOTUS_LEAVES = [
  [440, 740, 22], [520, 724, 24], [600, 738, 22], [686, 722, 24], [770, 740, 22], [850, 726, 22], [930, 760, 26], [480, 770, 20], [650, 760, 20], [820, 774, 22],
  [470, 832, 38], [562, 806, 38], [640, 850, 42], [706, 794, 36], [800, 826, 34], [884, 884, 40], [560, 880, 40], [740, 868, 38], [930, 846, 34], [420, 880, 34],
  [520, 1010, 76], [706, 992, 70], [612, 932, 60], [808, 944, 56], [420, 962, 52], [858, 1040, 60], [610, 1070, 70], [760, 1088, 64], [480, 1090, 56], [930, 1000, 54],
].sort((p, q) => p[1] - q[1]);
const LOTUS_FLOWERS = [[575, 906, 98], [742, 884, 84], [466, 878, 72], [846, 842, 64]];
const DEAD_LOTUS = [[560, 962, 120, -18], [690, 902, 104, 14], [468, 884, 96, -12], [780, 950, 126, 20], [610, 822, 82, 8], [850, 880, 92, -10]];

function makeLotus(k, rand) {
  const leaves = LOTUS_LEAVES.map(([x, y, r]) => ({ x, y, r, ph: rand() * TAU, edge: Array.from({ length: 28 }, () => rand()), tone: 0.88 + rand() * 0.22, rot: (rand() - 0.5) * 0.12 }));
  const petalFlower = bake(k * 1.2, -34, -52, 68, 70, g => {
    const draw = (rot, len, w, col0, col1) => {
      g.save(); g.rotate(rot);
      const gr = g.createLinearGradient(0, 0, 0, -len);
      gr.addColorStop(0, col0); gr.addColorStop(1, col1);
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(w, -len * 0.5, 0, -len); g.quadraticCurveTo(-w, -len * 0.5, 0, 0); g.fill();
      g.strokeStyle = 'rgba(190,90,120,.25)'; g.lineWidth = 0.7; g.stroke();
      g.restore();
    };
    for (const [rot, len] of [[-1.25, 22], [1.25, 22], [-0.85, 28], [0.85, 28]]) draw(rot, len, 8, '#fde9ee', '#f2a3bb');
    for (const [rot, len] of [[-0.45, 32], [0.45, 32], [0, 36]]) draw(rot, len, 9.5, '#fff6f4', '#f08fb0');
    g.fillStyle = '#f2d368'; g.beginPath(); g.ellipse(0, -4, 6, 3.2, 0, 0, TAU); g.fill();
  });
  const bud = bake(k * 1.2, -12, -34, 24, 36, g => {
    const gr = g.createLinearGradient(0, 0, 0, -30);
    gr.addColorStop(0, '#fff2f0'); gr.addColorStop(1, '#ee7fa4');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -14, 0, -30); g.quadraticCurveTo(-10, -14, 0, 0); g.fill();
  });
  return { leaves, petalFlower, bud };
}

function drawLotusLeaf(g, L, S, time) {
  const sc = S.lotus, r = L.r * (0.18 + 0.82 * sc) * (L.y < 800 ? 1 : 1);
  if (r < 3) return;
  const flat = 0.34 + 0.12 * (L.y - 700) / 400, bob = Math.sin(time * 0.7 + L.ph) * 0.8;
  const wither = S.wither;
  const green = mix3(shade([70, 128, 72], L.tone), [128, 156, 78], 0.5 * (1 - S.lotus) + 0);
  const brown = shade([138, 112, 62], L.tone), edgeC = mix3(shade([138, 176, 100], L.tone), [164, 134, 76], wither);
  const mainC = mix3(green, brown, wither);
  g.save(); g.translate(L.x, L.y + bob); g.rotate(L.rot);
  g.fillStyle = 'rgba(14,44,44,.28)'; g.beginPath(); g.ellipse(2, 5, r * 1.04, r * flat * 1.06, 0, 0, TAU); g.fill();
  // outline, ragged once the leaf is old
  g.beginPath();
  const n = L.edge.length;
  for (let i = 0; i <= n; i++) {
    const a = i / n * TAU, rough = 1 - wither * 0.2 * L.edge[i % n] - (i % 2) * wither * 0.05;
    const x = Math.cos(a) * r * rough, y = Math.sin(a) * r * flat * rough;
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
  const gr = g.createRadialGradient(-r * 0.2, -r * flat * 0.3, 0, 0, 0, r);
  gr.addColorStop(0, rgba(shade(mainC, 1.22))); gr.addColorStop(0.7, rgba(mainC)); gr.addColorStop(1, rgba(shade(mainC, 0.74)));
  g.fillStyle = gr; g.fill();
  g.strokeStyle = rgba(edgeC, 0.7); g.lineWidth = 1.1; g.stroke();
  g.strokeStyle = rgba(shade(mainC, 1.5), 0.3); g.lineWidth = 0.8; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + 0.2; g.moveTo(0, 0); g.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * flat * 0.92); }
  g.stroke();
  // the notch: a wedge of water
  g.fillStyle = rgba(S.waterTop, 0.7); g.beginPath(); g.moveTo(0, 0); g.lineTo(r * 1.01, -r * flat * 0.06); g.lineTo(r * 1.01, r * flat * 0.1); g.closePath(); g.fill();
  g.restore();
}

function drawLotus(g, S, Lt, time) {
  const vis = clamp(S.lotus * 4, 0, 1) * (1 - S.ice * 0.9);
  if (vis > 0.01) {
    g.globalAlpha = vis;
    for (const L of Lt.leaves) drawLotusLeaf(g, L, S, time);
    g.globalAlpha = 1;
  }
  if (S.lotusFlower > 0.02) {
    const open = smoothstep(0.1, 0.85, S.lotusFlower);
    LOTUS_FLOWERS.forEach(([x, y, h], i) => {
      const sway = Math.sin(time * 0.6 + i * 2) * 2.2, tx = x + sway, ty = y - h;
      g.strokeStyle = 'rgb(86,128,76)'; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + sway * 0.4 - 4, y - h * 0.5, tx, ty); g.stroke();
      const f = clamp(open * 1.3 - i * 0.06, 0, 1), a = S.lotusFlower > 0.5 ? 1 : S.lotusFlower * 2;
      g.globalAlpha = a;
      if (f > 0.5) { const s = 0.7 + 0.3 * f; g.drawImage(Lt.petalFlower.c, tx - 34 * s, ty - 52 * s + 4, 68 * s, 70 * s); } else g.drawImage(Lt.bud.c, tx - 12, ty - 30, 24, 36);
      g.globalAlpha = 1;
    });
  }
  if (S.deadLotus > 0.02) {
    const a = S.deadLotus;
    DEAD_LOTUS.forEach(([x, y, h, lean], i) => {
      const sway = Math.sin(time * 0.5 + i) * 1.2, tx = x + lean + sway, ty = y - h;
      g.globalAlpha = a; g.strokeStyle = 'rgb(88,70,52)'; g.lineWidth = 2.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * 0.2, y - h * 0.7, tx, ty); g.quadraticCurveTo(tx + lean * 0.5, ty + 8, tx + lean * 0.6, ty + 22); g.stroke();
      g.fillStyle = 'rgb(112,88,60)'; g.beginPath(); g.ellipse(tx + lean * 0.4, ty + 6, 18, 8, lean * 0.03, 0, TAU); g.fill();
      g.fillStyle = 'rgb(78,60,44)'; g.beginPath(); g.ellipse(tx + lean * 0.4 + 2, ty + 9, 15, 4.5, lean * 0.03, 0, Math.PI); g.fill();
      if (S.snow > 0.05) { g.globalAlpha = a * S.snow; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(tx + lean * 0.4, ty + 1.5, 15, 3.8, lean * 0.03, Math.PI, TAU); g.fill(); }
      g.globalAlpha = 1;
    });
  }
}

function drawFloaters(g, S, Wt) {
  if (S.petalsOnWater > 0.02) {
    const n = Math.round(Wt.petals.length * S.petalsOnWater);
    g.fillStyle = 'rgba(250,206,218,.92)'; g.beginPath();
    for (let i = 0; i < n; i++) { const q = Wt.petals[i], sh = Math.pow((q.y - WATER_Y) / 500, 1.6); g.moveTo(q.x + q.s * (1 + sh), q.y); g.ellipse(q.x, q.y, q.s * (1 + sh), q.s * 0.5 * (1 + sh), q.a, 0, TAU); }
    g.fill();
  }
  if (S.leavesOnWater > 0.02) {
    const n = Math.round(Wt.leaves.length * S.leavesOnWater);
    for (let c = 0; c < 3; c++) {
      g.fillStyle = rgba([[222, 168, 56], [214, 108, 44], [176, 66, 40]][c], 0.92); g.beginPath();
      for (let i = c; i < n; i += 3) { const q = Wt.leaves[i], sh = 1 + Math.pow((q.y - WATER_Y) / 500, 1.5); g.moveTo(q.x + q.s * sh, q.y); g.ellipse(q.x, q.y, q.s * sh, q.s * 0.42 * sh, q.a, 0, TAU); }
      g.fill();
    }
  }
}


// ---- Koi and sunbeams ---------------------------------------------------------------------------
const KOI = [
  { cx: 640, cy: 800, ax: 130, ay: 38, sp: 0.16, ph: 0.4, size: 1, body: [238, 112, 58], spot: [255, 246, 236] },
  { cx: 700, cy: 960, ax: 150, ay: 46, sp: 0.12, ph: 2.6, size: 1.12, body: [250, 248, 244], spot: [226, 70, 50] },
  { cx: 560, cy: 880, ax: 90, ay: 30, sp: 0.2, ph: 4.4, size: 0.9, body: [232, 150, 70], spot: [60, 56, 56] },
];

function drawKoi(g, S, time) {
  const vis = (1 - S.ice) * (1 - 0.5 * S.sw[3]) * smoothstep(0.02, 0.1, 1 - S.sw[3] * 0.9 - 0.1 * S.ice);
  if (vis < 0.03) return;
  for (const f of KOI) {
    const t = time * f.sp + f.ph, x = f.cx + Math.sin(t) * f.ax, y = f.cy + Math.sin(t * 2) * f.ay;
    const vx = Math.cos(t) * f.ax * f.sp, vy = Math.cos(t * 2) * 2 * f.ay * f.sp, ang = Math.atan2(vy, vx), wag = Math.sin(time * 3.2 + f.ph) * 0.35;
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(f.size, f.size * 0.7);
    g.globalAlpha = vis * 0.28; g.fillStyle = '#0c3a3c'; g.beginPath(); g.ellipse(2, 7, 20, 6.5, 0, 0, TAU); g.fill();
    g.globalAlpha = vis * 0.88;
    g.fillStyle = rgba(f.body); g.beginPath(); g.moveTo(22, 0); g.quadraticCurveTo(14, -8, -4, -6); g.quadraticCurveTo(-14, -3, -16, 0); g.quadraticCurveTo(-14, 3, -4, 6); g.quadraticCurveTo(14, 8, 22, 0); g.fill();
    g.fillStyle = rgba(f.spot); g.beginPath(); g.ellipse(4, -1.5, 6.5, 3.4, 0.2, 0, TAU); g.fill(); g.beginPath(); g.ellipse(-8, 1.5, 4, 2.4, 0, 0, TAU); g.fill();
    g.save(); g.translate(-15, 0); g.rotate(wag);
    g.fillStyle = rgba(f.body, 0.8); g.beginPath(); g.moveTo(2, 0); g.quadraticCurveTo(-8, -9, -18, -7); g.quadraticCurveTo(-12, 0, -18, 7); g.quadraticCurveTo(-8, 9, 2, 0); g.fill();
    g.restore();
    g.fillStyle = rgba(f.body, 0.7); g.beginPath(); g.moveTo(6, -5); g.lineTo(0, -14 + wag * 8); g.lineTo(-4, -5); g.fill(); g.beginPath(); g.moveTo(6, 5); g.lineTo(0, 14 + wag * 8); g.lineTo(-4, 5); g.fill();
    g.restore();
  }
  g.globalAlpha = 1;
}

/** Sunbeams slanting through the pane, strongest in summer and at the autumn sunset. */
function drawRays(g, S, time) {
  const power = (0.1 * S.sw[0] + 0.85 * S.sw[1] + 0.6 * S.sw[2] + 0.12 * S.sw[3]) * S.sunVis;
  if (power < 0.02) return;
  const { sunX: sx, sunY: sy } = S, rand = mulberry32(17);
  g.save(); g.globalCompositeOperation = 'screen';
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.56 + 0.2 * (i / 6)) + (rand() - 0.5) * 0.06, width = 0.035 + rand() * 0.06, len = 1500;
    const flick = 0.75 + 0.25 * Math.sin(time * 0.4 + i * 1.7);
    const x1 = sx + Math.cos(a - width) * len, y1 = sy + Math.sin(a - width) * len, x2 = sx + Math.cos(a + width) * len, y2 = sy + Math.sin(a + width) * len;
    const gr = g.createLinearGradient(sx, sy, sx + Math.cos(a) * 1100, sy + Math.sin(a) * 1100);
    gr.addColorStop(0, rgba(S.sunColor, 0.5 * power * flick)); gr.addColorStop(0.5, rgba(S.sunColor, 0.2 * power * flick)); gr.addColorStop(1, rgba(S.sunColor, 0));
    g.fillStyle = gr; g.beginPath(); g.moveTo(sx, sy); g.lineTo(x1, y1); g.lineTo(x2, y2); g.closePath(); g.fill();
  }
  g.restore();
}

// ---- Near bank ---------------------------------------------------------------------------------------
function makeGround(rand) {
  const path = new Path2D();
  path.moveTo(-160, 1030); path.bezierCurveTo(60, 1050, 280, 1070, 420, 1104); path.bezierCurveTo(500, 1124, 560, 1160, 600, 1230);
  path.lineTo(-160, 1260); path.closePath();
  const blades = Array.from({ length: 70 }, () => { const x = -60 + rand() * 600; return { x, y: 1090 + (x < 300 ? -10 : (x - 300) * 0.3) + rand() * 40, h: 12 + rand() * 20, ph: rand() * TAU, lean: (rand() - 0.5) * 8 }; });
  return { path, blades };
}

function drawGround(g, S, Gd, time) {
  const col = S.grass, base = mix3(shade(col, 0.7), [236, 240, 244], S.snow * 0.9);
  const gr = g.createLinearGradient(0, 1000, 0, 1200);
  gr.addColorStop(0, rgba(shade(base, 1.1))); gr.addColorStop(1, rgba(shade(base, 0.78)));
  g.fillStyle = gr; g.fill(Gd.path);
  g.strokeStyle = rgba(shade(base, 1.25), 0.6); g.lineWidth = 2; g.stroke(Gd.path);
  g.lineCap = 'round';
  const blade = mix3(col, [250, 252, 255], S.snow * 0.85);
  g.strokeStyle = rgba(shade(blade, 0.95), 0.92); g.lineWidth = 1.6; g.beginPath();
  for (const b of Gd.blades) { const sw = Math.sin(time * 1.1 + b.ph) * 2.2; g.moveTo(b.x, b.y); g.quadraticCurveTo(b.x + b.lean * 0.4, b.y - b.h * 0.6, b.x + b.lean + sw, b.y - b.h); }
  g.stroke();
}

// ---- Assemble ---------------------------------------------------------------------------------------
export function createScene(k) {
  const rand = mulberry32(1311);
  const mountains = makeMountains(k, rand), clouds = makeClouds(k, rand), bank = makeBank(k, rand);
  const water = makeWater(k, rand), lotus = makeLotus(k, rand), ground = makeGround(rand);
  return {
    bank,
    /** Everything above the waterline (sky to shore). */
    drawBack(g, S, time, flora) {
      const par = S.sway * 8;
      drawSky(g, S, time, clouds);
      drawMountains(g, S, mountains, par, time);
      g.save(); g.translate(par * 1.4, 0);
      flora.drawFarTrees(g, S, time);
      put(g, bank.wall, 1); put(g, bank.wallSnow, S.snow);
      flora.drawWillow(g, S, time);
      g.restore();
      // haze between us and the far bank
      const veil = g.createLinearGradient(0, 380, 0, 660);
      veil.addColorStop(0, rgba(S.mistColor, 0.02)); veil.addColorStop(1, rgba(S.mistColor, 0.1 + 0.16 * S.mist));
      g.fillStyle = veil; g.fillRect(-160, 380, 1320, 290);
      g.save(); g.translate(par * 1.4, 0);
      put(g, bank.stone, 1); put(g, bank.stoneSnow, S.snow);
      flora.drawShrubs(g, S, time, bank.shrubs);
      g.restore();
    },
    drawWaterBody, drawReflection, drawWaterSurface(g, S, time) { drawWaterSurface(g, S, time, water); },
    drawFloating(g, S, time) { drawFloaters(g, S, water); drawKoi(g, S, time); drawLotus(g, S, lotus, time); },
    drawRays,
    drawGround(g, S, time) { drawGround(g, S, ground, time); },
  };
}

