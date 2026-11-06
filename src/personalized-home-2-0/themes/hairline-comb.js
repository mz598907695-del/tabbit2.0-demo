// 发际线 — click the wallpaper and the programmer combs what is left of his hair: a sleeved hand
// swings in from the lower left with a coral comb, drags it down the side of the head three times
// (laying the clumps it passes flat and shiny, then letting them spring back) and leaves again.
// Timing uses the scene clock handed in by the renderer, so everything here is a pure function of
// (time - start) and works the same with reduced motion or after the page was in the background.
import { clamp, lerp, smoothstep } from './gl-utils.js';
import { mulberry32 } from './canvas-kit.js';
import { SKIN } from './hairline-face.js';

const PI = Math.PI, TAU = PI * 2;
export const COMB_SECONDS = 2.0;
const END = 1.16; // fraction of the duration after which nothing is left (sigh included)

// head-space surface the comb rides on (an ellipse a little outside the skull)
const RX = 1.0, RY = 1.22, CY = -0.1, DEPTH = 0.96;
const surface = phi => {
  const c = Math.cos(phi), s = Math.sin(phi), nx = c / RX, ny = s / RY, nl = Math.hypot(nx, ny);
  return { x: DEPTH * RX * c, y: CY + DEPTH * RY * s, nx: nx / nl, ny: ny / nl };
};

// keyframes [u, phi, lift]: lift is how far the teeth hover above the hair (head units)
const KEYS = [
  [0.0, -2.5, 0.6], [0.17, -2.55, 0.4],
  [0.22, -2.5, 0], [0.32, -3.2, 0], [0.355, -3.25, 0.4],
  [0.39, -2.45, 0.42], [0.43, -2.4, 0], [0.53, -3.15, 0], [0.57, -3.2, 0.4],
  [0.6, -2.35, 0.42], [0.64, -2.3, 0], [0.74, -3.05, 0], [0.79, -3.1, 0.5],
  [1.0, -2.7, 0.6],
];
const STROKES = [[0.22, 0.32], [0.43, 0.53], [0.64, 0.74]];

function poseAt(u) {
  let i = 1;
  while (i < KEYS.length - 1 && u > KEYS[i][0]) i++;
  const a = KEYS[i - 1], b = KEYS[i], t = smoothstep(a[0], b[0], clamp(u, a[0], b[0]));
  return { phi: lerp(a[1], b[1], t), lift: lerp(a[2], b[2], t) };
}

const COMB_LEN = 0.9, TOOTH = 0.23;
const ARM = [1.75, 1.65]; // upper arm and forearm, in head units

export function createComb(clumps) {
  const rand = mulberry32(99);
  let anim = null;

  const bump = (u, a, b, c, d) => smoothstep(a, b, u) * (1 - smoothstep(c, d, u));

  /** Starts (or restarts) a combing at scene time `now`; `hairLeft` is the share of clumps still on the head. */
  function start(now, hairLeft) {
    const passes = clumps.map(() => [NaN, NaN, NaN]);
    const best = clumps.map(() => [9, 9, 9]);
    const tips = [];
    for (let s = 0; s < 3; s++) {
      const [u0, u1] = STROKES[s];
      for (let j = 0; j <= 28; j++) {
        const u = lerp(u0, u1, j / 28), { phi } = poseAt(u), t = surface(phi);
        tips.push({ u, s, x: t.x, y: t.y });
      }
    }
    clumps.forEach((c, i) => {
      const mx = c.x + Math.cos(c.ang) * c.len * 0.45, my = c.y + Math.sin(c.ang) * c.len * 0.45;
      for (const t of tips) {
        const d = Math.hypot(t.x - mx, t.y - my);
        if (d < 0.5 && d < best[i][t.s]) { best[i][t.s] = d; passes[i][t.s] = t.u; }
      }
    });
    // a second, softer ripple smooths the far side of the head as well
    const wave = clumps.map(c => 0.26 + 0.5 * clamp((c.x + 1) / 2) + (rand() - 0.5) * 0.06);
    // the hair that comes away in the teeth: plenty when there is plenty, a lonely strand or two when there is not
    const count = Math.round(1 + 13 * Math.pow(clamp(hairLeft), 1.4));
    const bits = [];
    for (let j = 0; j < count; j++) {
      const s = j % 3, u = lerp(STROKES[s][0] + 0.03, STROKES[s][1] - 0.01, rand());
      const t = surface(poseAt(u).phi);
      bits.push({ u, x: t.x + t.nx * 0.14, y: t.y + t.ny * 0.14, vx: (rand() - 0.5) * 0.5 - 0.1, vy: -0.1 + rand() * 0.2, rot: rand() * TAU, spin: (rand() - 0.5) * 6, len: 0.1 + rand() * 0.07 });
    }
    anim = { t0: now, passes, wave, bits, hair: clamp(hairLeft) };
  }

  const u = time => (anim ? (time - anim.t0) / COMB_SECONDS : -1);
  const active = time => anim && u(time) >= 0 && u(time) < END;

  const env = tau => {
    if (tau < 0) return 0;
    const attack = smoothstep(0, 0.12, tau);
    const decay = Math.exp(-Math.max(0, tau - 0.12) / 0.5);
    const spring = tau > 0.5 ? -0.12 * Math.sin((tau - 0.5) * 9) * Math.exp(-(tau - 0.5) * 2.6) : 0;
    return attack * decay + spring;
  };

  /** How strongly clump i is combed flat right now (can dip a little negative while it springs back). */
  function neat(i, time) {
    const uu = u(time);
    if (!anim || uu < 0 || uu > END + 0.6) return 0;
    let v = 0;
    const ps = anim.passes[i];
    for (let s = 0; s < 3; s++) if (ps[s] === ps[s]) v = Math.max(v, env((uu - ps[s]) * COMB_SECONDS));
    v = Math.max(v, 0.55 * env((uu - anim.wave[i]) * COMB_SECONDS));
    return v;
  }

  /** Face-affecting envelope: how deep into the combing we are, the sigh afterwards, and what to feel. */
  function mood(time) {
    const uu = u(time);
    if (!anim || uu < 0 || uu > END + 0.1) return { k: 0, enjoy: 0, careful: 0, sigh: 0, wry: 0, sighT: 0, plenty: 1 };
    const k = bump(uu, 0.05, 0.2, 0.84, 1.0);
    const plenty = smoothstep(0.2, 0.62, anim.hair);
    const sigh = bump(uu, 0.8, 0.92, 1.0, END);
    return { k, enjoy: k * plenty, careful: k * (1 - plenty), sigh, wry: sigh * (1 - plenty), sighT: clamp((uu - 0.8) / 0.36), plenty };
  }

  /** Comb, hand and arm for this frame; `ctx` supplies the head matrix and the body anchor. */
  function pose(time, c) {
    const uu = u(time);
    if (!anim || uu < 0 || uu >= END) return null;
    const { M, U, hx, hy, H, roll, shoulder } = c;
    const { phi, lift } = poseAt(Math.min(uu, 1));
    const s = surface(phi);
    const ox = s.x + s.nx * (lift + TOOTH + 0.03), oy = s.y + s.ny * (lift + TOOTH + 0.03);
    const toW = (x, y) => [M.a * x + M.c * y + M.e, M.b * x + M.d * y + M.f];
    let [cx, cy] = toW(ox, oy);
    const ap = smoothstep(0, 0.17, uu) * (1 - smoothstep(0.8, 0.98, uu));
    const restX = hx - 1.9 * U, restY = Math.max(hy + 4.5 * U, H + 0.9 * U);
    cx = lerp(restX, cx, ap); cy = lerp(restY, cy, ap);
    // never ask the arm for more than it can reach: pull the comb in toward the shoulder instead
    const reach = (ARM[0] + ARM[1]) * 0.97 * U;
    // world-space outward normal of the hair, and the comb's frame (+y toward the teeth)
    const nx = s.nx * Math.cos(roll) - s.ny * Math.sin(roll), ny = s.nx * Math.sin(roll) + s.ny * Math.cos(roll);
    const rot = Math.atan2(-ny, -nx) - PI / 2;
    const w = ap < 1 ? lerp(0.6, 0, ap) : 0;
    const wx = cx + nx * 0.46 * U - shoulder[0], wy = cy + ny * 0.46 * U - shoulder[1], wd = Math.hypot(wx, wy);
    if (wd > reach) { cx -= wx / wd * (wd - reach); cy -= wy / wd * (wd - reach); }
    return { cx, cy, rot: rot + w * 0.4, nx, ny, ap, uu, lift, shoulder, U };
  }

  function drawComb(g, S, q) {
    const { cx, cy, rot, U } = q;
    g.setTransform(S * U * Math.cos(rot), S * U * Math.sin(rot), -S * U * Math.sin(rot), S * U * Math.cos(rot), S * cx, S * cy);
    const teeth = 18, tw = COMB_LEN / teeth;
    g.fillStyle = '#e4584a';
    g.beginPath();
    for (let i = 0; i < teeth; i++) {
      const x = -COMB_LEN / 2 + i * tw, w = tw * (i === 0 || i === teeth - 1 ? 0.8 : 0.52), len = TOOTH * (i === 0 || i === teeth - 1 ? 0.95 : 1);
      g.moveTo(x, 0.02); g.lineTo(x + w, 0.02); g.lineTo(x + w * 0.78, len); g.quadraticCurveTo(x + w * 0.5, len + 0.02, x + w * 0.22, len); g.closePath();
    }
    g.fill();
    const spine = g.createLinearGradient(0, -0.07, 0, 0.05);
    spine.addColorStop(0, '#ff8c75'); spine.addColorStop(1, '#ee6552');
    g.fillStyle = spine; g.beginPath(); g.moveTo(-COMB_LEN / 2 + 0.05, -0.07);
    g.arcTo(COMB_LEN / 2, -0.07, COMB_LEN / 2, 0.05, 0.05); g.arcTo(COMB_LEN / 2, 0.05, -COMB_LEN / 2, 0.05, 0.05);
    g.arcTo(-COMB_LEN / 2, 0.05, -COMB_LEN / 2, -0.07, 0.05); g.arcTo(-COMB_LEN / 2, -0.07, COMB_LEN / 2, -0.07, 0.05); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)';
    g.beginPath(); g.ellipse(-0.05, -0.04, COMB_LEN * 0.36, 0.013, 0, 0, TAU); g.fill();
  }

  /** Sleeve, cuff and hand (drawn over the comb's spine). */
  function drawArm(g, S, q) {
    const { cx, cy, rot, U, nx, ny } = q;
    const [sx, sy] = q.shoulder;
    const L1 = ARM[0] * U, L2 = ARM[1] * U;
    const wx = cx + nx * 0.46 * U, wy = cy + ny * 0.46 * U;
    let dx = wx - sx, dy = wy - sy;
    const d = Math.hypot(dx, dy);
    const dd = clamp(d, Math.abs(L1 - L2) + 1, L1 + L2 - 1);
    const a = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    dx /= d; dy /= d;
    const bx = sx + dx * a, by = sy + dy * a;
    let ex = bx + dy * h, ey = by - dx * h;
    const ex2 = bx - dy * h, ey2 = by + dx * h;
    if (ex2 < ex) { ex = ex2; ey = ey2; }
    g.setTransform(S, 0, 0, S, 0, 0);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const sleeve = g.createLinearGradient(Math.min(sx, wx), 0, Math.max(sx, wx) + 1, 0);
    sleeve.addColorStop(0, '#3d4660'); sleeve.addColorStop(1, '#2a3043');
    // upper arm and forearm (a darker rim first so the sleeve reads against the jacket)
    g.strokeStyle = 'rgba(8,10,18,.3)'; g.lineWidth = 0.56 * U;
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
    g.lineWidth = 0.48 * U; g.beginPath(); g.moveTo(ex, ey); g.lineTo(wx, wy); g.stroke();
    g.strokeStyle = sleeve; g.lineWidth = 0.5 * U;
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
    g.lineWidth = 0.42 * U; g.beginPath(); g.moveTo(ex, ey); g.lineTo(wx, wy); g.stroke();
    // cuff, then the palm and fingers wrapped round the comb
    const fa = Math.atan2(wy - ey, wx - ex);
    g.setTransform(S * U * Math.cos(fa), S * U * Math.sin(fa), -S * U * Math.sin(fa), S * U * Math.cos(fa), S * wx, S * wy);
    g.fillStyle = '#f6f8fc'; g.beginPath(); g.moveTo(-0.12, -0.25); g.lineTo(0.08, -0.24); g.lineTo(0.08, 0.24); g.lineTo(-0.12, 0.25); g.closePath(); g.fill();
    g.fillStyle = 'rgba(150,165,195,.4)'; g.fillRect(-0.12, 0.1, 0.2, 0.15);
    g.fillStyle = '#c9ced9'; g.beginPath(); g.arc(-0.01, -0.12, 0.026, 0, TAU); g.fill();
    g.setTransform(S * U * Math.cos(rot), S * U * Math.sin(rot), -S * U * Math.sin(rot), S * U * Math.cos(rot), S * cx, S * cy);
    // palm sits on the outer side of the comb (-y), reaching back toward the wrist
    const palm = g.createLinearGradient(0, -0.5, 0, 0);
    palm.addColorStop(0, SKIN.shade); palm.addColorStop(1, SKIN.base);
    g.fillStyle = palm;
    g.beginPath(); g.moveTo(-0.24, -0.06); g.quadraticCurveTo(-0.31, -0.3, -0.16, -0.5); g.lineTo(0.16, -0.5); g.quadraticCurveTo(0.31, -0.3, 0.24, -0.06); g.closePath(); g.fill();
    // fingers across the spine
    for (let i = 0; i < 4; i++) {
      const fx = -0.19 + i * 0.127;
      g.fillStyle = SKIN.base; g.beginPath(); g.moveTo(fx - 0.05, -0.2); g.lineTo(fx + 0.05, -0.2); g.lineTo(fx + 0.05, 0.015); g.arc(fx, 0.015, 0.05, 0, PI); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(190,120,92,.55)'; g.lineWidth = 0.014;
      g.beginPath(); g.moveTo(fx - 0.05, -0.2); g.lineTo(fx - 0.05, 0.015); g.stroke();
    }
    // thumb on top
    g.fillStyle = SKIN.light; g.beginPath(); g.ellipse(-0.3, -0.16, 0.055, 0.12, -0.5, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(190,120,92,.55)'; g.lineWidth = 0.014; g.stroke();
  }

  /** Strands pulled out by the comb (head space, drawn with the head matrix). */
  function drawBits(g, time) {
    if (!anim) return;
    const uu = u(time);
    if (uu < 0 || uu > END + 0.5) return;
    g.lineCap = 'round'; g.strokeStyle = '#151824';
    for (const b of anim.bits) {
      const tau = (uu - b.u) * COMB_SECONDS;
      if (tau < 0 || tau > 1.5) continue;
      const x = b.x + b.vx * tau, y = b.y + b.vy * tau + 1.3 * tau * tau, r = b.rot + b.spin * tau;
      g.globalAlpha = 1 - smoothstep(0.9, 1.5, tau);
      g.lineWidth = 0.022;
      g.save(); g.translate(x, y); g.rotate(r);
      g.beginPath(); g.moveTo(-b.len, 0); g.quadraticCurveTo(-b.len * 0.1, -b.len * 0.28, b.len * 0.4, -b.len * 0.02); g.quadraticCurveTo(b.len * 0.75, b.len * 0.12, b.len, -b.len * 0.12); g.stroke();
      g.restore();
    }
    g.globalAlpha = 1;
  }

  return { start, active, neat, mood, pose, drawComb, drawArm, drawBits, get hair() { return anim ? anim.hair : 1; } };
}
