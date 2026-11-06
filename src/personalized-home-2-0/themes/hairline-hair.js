// 发际线 — the programmer's hair. A few hundred clumps (curved blades, drawn once as sprites)
// sit on the scalp in three depth layers. Scroll progress decides which clump has come loose:
// every clump owns a release time, so the loss is a pure function of p and scrolling back
// brings each one home along the very same path. Units are "head units" (half a face height).
import { clamp, lerp, smoothstep } from './gl-utils.js';
import { mulberry32 } from './canvas-kit.js';

const PI = Math.PI, TAU = PI * 2;
const FLY_DIR = -2.7; // radians, y down: up and a little to the left
const wrap = a => a - TAU * Math.round(a / TAU);
const lerpAngle = (a, b, t) => a + wrap(b - a) * t;

// blade shapes: [width / length, tip curl / length, tip half-width / blade half-width]
const SHAPES = [[0.46, -0.2, 0.3], [0.52, 0.1, 0.4], [0.4, 0.26, 0.22], [0.58, -0.05, 0.45], [0.46, -0.3, 0.26], [0.5, 0.18, 0.35]];
// root / middle / tip colours per depth layer (behind the head, crown, fringe)
const TONES = [
  ['#06080d', '#10131c', '#1c212e'],
  ['#0a0c13', '#171b26', '#2b3244'],
  ['#0d0f17', '#1c2130', '#394258'],
];

const TMP = { x: 0, y: 0 };
/** Position of a clump `l` (0..1) of the way through its flight; the root is at (ox, oy). */
function flyAt(c, l, ox, oy, cd, sd, dist, U, time, out) {
  const e = Math.pow(l, 1.4), wob = Math.sin(l * c.k * TAU + c.ph) * c.amp * U * Math.sqrt(e) + Math.sin(time * 1.7 + c.ph) * 0.03 * U * l;
  out.x = ox + cd * dist * e - sd * wob;
  out.y = oy + sd * dist * e + cd * wob - e * c.rise * U * 1.2;
}

function buildClumps() {
  const rand = mulberry32(8731);
  const R = (a, b) => a + (b - a) * rand();
  const list = [];
  const add = (layer, x, y, ang, len, wid, keep, extra = {}) => {
    list.push({
      layer, x, y, ang, len, wid, keep,
      shape: Math.floor(rand() * SHAPES.length), flip: rand() < 0.5 ? -1 : 1,
      tone: layer === 0 ? 0 : (rand() < 0.62 ? layer : (layer === 1 ? 2 : 1)),
      ph: rand() * TAU, f: R(0.9, 1.9), stiff: R(0.45, 1),
      t0: 9, dur: 1, spread: R(-0.5, 0.5), spin: R(-9, 9), amp: R(0.25, 1), k: R(1, 2.4), rise: R(0, 0.9),
      vel: rand() < 0.5 ? 0 : PI, lateTrem: 0, flow: 0, early: false, ...extra,
    });
  };

  // 1. behind the head: a ring that gives the silhouette its volume (lower sides never leave)
  const BACK = 84;
  for (let i = 0; i < BACK; i++) {
    const phi = lerp(2.75, 6.72, (i + R(0.05, 0.95)) / BACK); // lower left, over the crown, lower right
    const s = Math.sin(phi), c = Math.cos(phi);
    const droop = 0.5 * smoothstep(-0.35, 0.55, s);
    const ang = phi + R(-0.22, 0.22) + (c < 0 ? -droop : droop);
    add(0, 0.8 * c, 0.93 * s - 0.02, ang, s < -0.6 ? R(0.34, 0.5) : R(0.26, 0.4), R(0.85, 1.2), s > -0.3 && rand() < 0.5);
  }

  // 2. the crown: roots scattered over the cap, tips pointing up and out
  const hairline = x => -0.5 + 0.38 * (x / 0.86) ** 2;
  const crown = [];
  while (crown.length < 124) {
    const x = R(-0.86, 0.86), y = R(-1.0, -0.1);
    if ((x / 0.88) ** 2 + y * y > 1 || y > hairline(x) - 0.03) continue;
    const ang = Math.atan2(y - 0.25, x) + R(-0.2, 0.2) + 0.3;
    const len = R(0.32, 0.44) + 0.1 * smoothstep(-0.5, -1, y);
    crown.push({ x, y, ang, len, keep: Math.abs(x) > 0.66 && y > -0.62 && rand() < 0.3 });
  }
  crown.sort((a, b) => b.y - a.y).forEach(c => add(1, c.x, c.y, c.ang, c.len, R(0.85, 1.2), c.keep));

  // 3. fringe over the forehead and sideburns over the temples
  for (const [rowY, count, rowLen] of [[-0.93, 16, 0.38], [-0.8, 15, 0.36]]) {
    for (let i = 0; i < count; i++) {
      const x = lerp(-0.8, 0.8, (i + R(0.05, 0.95)) / count);
      add(2, x, rowY + 0.07 * (x / 0.8) ** 2 + R(-0.05, 0.05), PI / 2 - x * 0.62 + 0.12 + R(-0.2, 0.2), rowLen * R(0.75, 1.25), R(0.85, 1.25), false);
    }
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const y = lerp(-0.74, -0.02, (i + R(0.05, 0.95)) / 9);
      add(2, side * (0.7 + 0.15 * rand() + 0.03 * (y + 0.7)), y, PI / 2 + side * -0.2 + R(-0.38, 0.38), R(0.26, 0.46), R(0.95, 1.4), y > -0.5 && rand() < 0.6);
    }
  }

  // 4. cheeky cowlicks on top, the first to go
  for (const [x, ang, len, shape] of [[-0.1, -1.85, 0.52, 1], [0.1, -1.5, 0.58, 5], [0.3, -1.2, 0.48, 1]]) {
    add(1, x, -0.96, ang, len, 0.95, false, { shape, early: true, tone: 2 });
  }

  // release order: crown first, then outwards, wind from the right takes the right side a little earlier
  const loose = list.filter(c => !c.keep);
  loose.forEach(c => { c.score = c.early ? -9 : -0.85 * c.y + R(-0.5, 0.5) + 0.12 * c.x + (c.layer === 0 ? 0.1 : 0); });
  loose.sort((a, b) => a.score - b.score).forEach((c, rank) => {
    const r = rank / (loose.length - 1);
    c.t0 = 0.03 + 0.7 * (r + 0.035 * Math.sin(r * TAU * 4.5));
    c.dur = c.early ? R(0.14, 0.18) : R(0.15, 0.24);
  });
  // the survivors are a little thinner than the rest, and a few of them keep fidgeting at the very end
  list.filter(c => c.keep).forEach(c => { c.lateTrem = rand() < 0.2 ? 1 : 0.2; c.len *= 0.92; c.wid *= 0.85; });

  // the direction a comb would lay each clump in: down and around the head, parted at the crown
  for (const c of list) {
    const dx = c.x, dy = c.y + 0.1, phi = Math.atan2(dy, dx);
    c.flow = dx < 0 ? Math.atan2(-Math.cos(phi), Math.sin(phi)) : Math.atan2(Math.cos(phi), -Math.sin(phi));
  }
  return list;
}

/** Blade sprites in three tones (+ a sheen overlay for combed hair); roots at the bottom centre. */
function buildSprites(Ls) {
  const HW = Ls * 0.55, Wc = Math.ceil(HW * 2), pad = 2, Hc = Ls + pad * 2;
  const info = { Ls, HW, W: Wc, H: Hc, rootY: Ls + pad, tones: [], sheen: [] };
  const canvasFor = () => {
    const c = document.createElement('canvas');
    c.width = Wc; c.height = Hc;
    const g = c.getContext('2d');
    g.translate(HW, Ls + pad);
    return [c, g];
  };
  const blade = (g, hb, tx, tipW) => {
    const tw = hb * tipW;
    g.beginPath();
    g.moveTo(-hb * 0.5, 0);
    g.bezierCurveTo(-hb * 1.3 + tx * 0.1, -Ls * 0.22, -hb * 1.15 + tx * 0.5, -Ls * 0.7, tx - tw, -Ls * 0.965);
    g.quadraticCurveTo(tx, -Ls * 1.035, tx + tw, -Ls * 0.965);
    g.bezierCurveTo(hb * 1.1 + tx * 0.5, -Ls * 0.66, hb * 1.3 + tx * 0.1, -Ls * 0.2, hb * 0.5, 0);
    g.closePath();
  };
  for (let t = 0; t < TONES.length; t++) {
    info.tones.push(SHAPES.map(([bw, curl, tipW]) => {
      const [c, g] = canvasFor();
      const hb = bw * Ls / 2, tx = curl * Ls * 0.55;
      blade(g, hb, tx, tipW);
      const body = g.createLinearGradient(0, 0, 0, -Ls);
      body.addColorStop(0, TONES[t][0]); body.addColorStop(0.45, TONES[t][1]); body.addColorStop(1, TONES[t][2]);
      g.fillStyle = body; g.fill();
      g.save(); g.clip();
      const side = g.createLinearGradient(-hb * 1.3, 0, hb * 1.3, 0);
      side.addColorStop(0, 'rgba(0,0,0,.45)'); side.addColorStop(0.36, 'rgba(0,0,0,0)'); side.addColorStop(0.7, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,.32)');
      g.fillStyle = side; g.fillRect(-HW, -Ls - 2, HW * 2, Ls + 4);
      const a = [0.08, 0.16, 0.26][t];
      const streak = g.createLinearGradient(0, -Ls * 0.1, 0, -Ls * 0.92);
      streak.addColorStop(0, 'rgba(165,190,235,0)'); streak.addColorStop(0.4, `rgba(175,200,245,${a})`); streak.addColorStop(1, 'rgba(165,190,235,0)');
      g.strokeStyle = streak; g.lineWidth = Math.max(1, hb * 0.45); g.lineCap = 'round';
      g.beginPath(); g.moveTo(-hb * 0.22, -Ls * 0.1); g.quadraticCurveTo(-hb * 0.15 + tx * 0.3, -Ls * 0.5, tx * 0.82 - hb * 0.1, -Ls * 0.9); g.stroke();
      g.restore();
      return c;
    }));
  }
  // loose locks for hair in flight: a slim wavy body that splays into strands at the tip
  info.wisps = SHAPES.map(([bw, curl], si) => {
    const [c, g] = canvasFor();
    const r = mulberry32(si * 77 + 5), dir = curl < 0 ? -1 : 1;
    const body = g.createLinearGradient(0, 0, 0, -Ls);
    body.addColorStop(0, '#080a10'); body.addColorStop(0.55, '#171b27'); body.addColorStop(1, '#3a4358');
    g.fillStyle = body; g.strokeStyle = body; g.lineCap = 'round';
    const hb = bw * Ls * 0.2, tx = dir * Ls * (0.16 + Math.abs(curl) * 0.3);
    g.beginPath();
    g.moveTo(-hb * 0.5, 0);
    g.bezierCurveTo(-hb * 1.3 - tx * 0.5, -Ls * 0.3, -hb + tx, -Ls * 0.5, tx * 0.6, -Ls * 0.72);
    g.bezierCurveTo(tx * 0.9 + hb, -Ls * 0.5, hb * 1.3 - tx * 0.5, -Ls * 0.3, hb * 0.5, 0);
    g.closePath(); g.fill();
    for (let i = 0; i < 7; i++) {
      const k = (i - 3) / 3, len = Ls * (0.7 + r() * 0.3);
      const tipX = tx * 0.6 + k * bw * Ls * 0.55 + dir * Ls * 0.06 * r(), w1 = (r() * 2 - 1) * Ls * 0.12;
      g.lineWidth = Math.max(1, Ls * (0.014 + r() * 0.014));
      g.beginPath(); g.moveTo(k * hb * 0.3, 0);
      g.bezierCurveTo(tx * 0.5 + w1, -len * 0.3, tipX * 0.7 - w1, -len * 0.62, tipX, -len);
      g.stroke();
    }
    return c;
  });
  info.sheen = SHAPES.map(([bw, curl, tipW]) => {
    const [c, g] = canvasFor();
    const hb = bw * Ls / 2, tx = curl * Ls * 0.55;
    blade(g, hb, tx, tipW); g.clip();
    const band = g.createLinearGradient(-hb * 1.1, 0, hb * 1.1, 0);
    band.addColorStop(0, 'rgba(210,228,255,0)'); band.addColorStop(0.34, 'rgba(215,232,255,.9)'); band.addColorStop(0.62, 'rgba(190,212,250,.25)'); band.addColorStop(1, 'rgba(190,212,250,0)');
    g.fillStyle = band; g.fillRect(-HW, -Ls - 2, HW * 2, Ls + 4);
    const fade = g.createLinearGradient(0, 0, 0, -Ls);
    fade.addColorStop(0, 'rgba(0,0,0,.9)'); fade.addColorStop(0.3, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = fade; g.fillRect(-HW, -Ls - 2, HW * 2, Ls + 4);
    return c;
  });
  return info;
}

export function createHair() {
  const clumps = buildClumps();
  const N = clumps.length;
  const loose = clumps.filter(c => !c.keep).length;
  const state = clumps.map(() => ({ x: 0, y: 0, a: 0, len: 0, wf: 1, wisp: 0, alpha: 1, shine: 0, bucket: -1, x1: 0, y1: 0, x2: 0, y2: 0, trail: 0 }));
  let sprites = null, spriteKey = '';
  const lists = [[], [], []];

  // how much of the loose hair has already left (clumps count as gone a third of the way into their flight)
  const TABLE = 257;
  const goneTable = new Float32Array(TABLE);
  for (let i = 0; i < TABLE; i++) {
    const p = i / (TABLE - 1);
    let n = 0;
    for (const c of clumps) if (!c.keep && p >= c.t0 + c.dur * 0.35) n++;
    goneTable[i] = n / loose;
  }
  const lostAt = p => { const x = clamp(p) * (TABLE - 1), i = Math.min(TABLE - 2, Math.floor(x)); return lerp(goneTable[i], goneTable[i + 1], x - i); };

  function prepare(U, scale) {
    const key = `${Math.round(U)}|${scale}`;
    if (key === spriteKey) return;
    spriteKey = key;
    sprites = buildSprites(Math.max(24, Math.round(0.78 * U * scale)));
  }

  /** Where every clump is for this frame; `env.neat(i)` lets a comb straighten them. */
  function update(env) {
    const { p, time, M, roll, U, wind, windAng, tail, sway, diag, hx, neat } = env;
    lists[0].length = lists[1].length = lists[2].length = 0;
    const lean = Math.abs(wind) > 0.01;
    for (let i = 0; i < N; i++) {
      const c = clumps[i], st = state[i];
      const lift = c.keep ? 0 : clamp((p - c.t0) / c.dur);
      let ang = c.ang, len = c.len, rx = c.x, ry = c.y;
      const trem = lift > 0 ? 0 : c.keep ? c.lateTrem * smoothstep(0.86, 1, p) : smoothstep(c.t0 - 0.07, c.t0, p);
      ang += Math.sin(time * c.f + c.ph) * (0.015 + 0.03 * c.len) * sway;
      if (lean) ang += wrap(windAng - ang) * Math.abs(wind) * c.stiff * 0.5 * (1 + 1.4 * trem);
      if (trem > 0) {
        ang += Math.sin(time * (20 + c.ph * 3) + c.ph * 7) * 0.15 * trem;
        rx += Math.cos(ang) * 0.035 * trem; ry += Math.sin(ang) * 0.035 * trem;
        len *= 1 + 0.08 * trem;
      }
      const n = lift > 0 || !neat ? 0 : neat(i);
      st.shine = n > 0 ? n : 0;
      if (n) ang = lerpAngle(ang, c.flow, clamp(n, -0.3, 1) * 0.85);
      const wx = M.a * rx + M.c * ry + M.e, wy = M.b * rx + M.d * ry + M.f;
      st.x = wx; st.y = wy; st.a = ang + roll; st.len = len * U; st.wf = c.wid; st.wisp = 0; st.alpha = 1; st.trail = 0;
      if (lift <= 0) { st.bucket = c.layer === 0 ? 0 : 1; lists[st.bucket].push(i); continue; }

      // ---- in flight: carried up and to the left, rolling over and over, fading out ----
      const dir = FLY_DIR + c.spread, cd = Math.cos(dir), sd = Math.sin(dir);
      const dist = Math.min(diag * 1.2, (hx + 140) / Math.max(0.4, Math.abs(cd)));
      flyAt(c, lift, wx, wy, cd, sd, dist, U, time, st);
      flyAt(c, clamp(lift - 0.02 * tail), wx, wy, cd, sd, dist, U, time, TMP);
      const back = TMP;
      const vel = Math.atan2(st.y - back.y, st.x - back.x) + c.vel;
      const k = smoothstep(0, 0.3, lift);
      st.a = lerpAngle(ang + roll, vel + Math.sin(lift * 9 + c.ph) * 0.9, k) + lift * c.spin * 0.35;
      st.len = len * U * (1 - 0.22 * lift); st.wf = c.wid * lerp(1, 0.4, smoothstep(0, 0.16, lift));
      st.alpha = 1 - smoothstep(0.55, 1, lift); st.wisp = smoothstep(0.02, 0.16, lift);
      st.bucket = c.layer === 0 && lift < 0.14 ? 0 : 2;
      lists[st.bucket].push(i);
      flyAt(c, clamp(lift - 0.05 * tail), wx, wy, cd, sd, dist, U, time, TMP);
      st.x1 = TMP.x; st.y1 = TMP.y;
      flyAt(c, clamp(lift - 0.11 * tail), wx, wy, cd, sd, dist, U, time, TMP);
      st.x2 = TMP.x; st.y2 = TMP.y;
      st.trail = Math.min(1, 0.3 + Math.abs(wind) * 0.9) * (c.stiff > 0.7 ? 1 : 0.7);
    }
  }

  function put(g, S, c, st, flipSheen) {
    const sp = sprites, rot = st.a + PI / 2, cs = Math.cos(rot), sn = Math.sin(rot);
    const ss = st.len / sp.Ls, wf = st.wf;
    g.setTransform(S * cs * c.flip, S * sn * c.flip, -S * sn, S * cs, S * st.x, S * st.y);
    const img = flipSheen === 2 ? sp.wisps[c.shape] : flipSheen ? sp.sheen[c.shape] : sp.tones[c.tone][c.shape];
    g.drawImage(img, -sp.HW * ss * wf, -sp.rootY * ss, sp.W * ss * wf, sp.H * ss);
  }

  function drawList(g, S, list) {
    for (const i of list) {
      const st = state[i], c = clumps[i];
      if (st.alpha < 0.02) continue;
      if (st.wisp > 0.02) { g.globalAlpha = st.alpha * st.wisp; put(g, S, c, st, 2); }
      g.globalAlpha = st.alpha * (1 - st.wisp);
      if (g.globalAlpha > 0.02) put(g, S, c, st, false);
      if (st.shine > 0.04) { g.globalAlpha = st.alpha * clamp(st.shine) * 0.85; put(g, S, c, st, true); }
    }
    g.globalAlpha = 1;
  }

  return {
    clumps, lostAt, prepare, update,
    /** Share of all clumps still on the head. */
    keepAt: p => 1 - lostAt(p) * loose / N,
    /** The clumps behind the head. */
    drawBack(g, S) { drawList(g, S, lists[0]); },
    /** Crown and fringe, in front of the face. */
    drawFront(g, S) { drawList(g, S, lists[1]); },
    /** Clumps that have left the head, over everything: each trails a few loose strands. */
    drawFlying(g, S) {
      g.lineCap = 'round'; g.strokeStyle = '#171b28'; g.setTransform(S, 0, 0, S, 0, 0);
      for (const i of lists[2]) {
        const st = state[i];
        if (st.alpha < 0.02 || st.trail < 0.05) continue;
        const c = clumps[i], w = Math.max(0.9, st.len * 0.022);
        const dx = st.x2 - st.x, dy = st.y2 - st.y, dl = Math.hypot(dx, dy) || 1, px = -dy / dl, py = dx / dl, spread = st.len * 0.2;
        g.globalAlpha = st.alpha * 0.55 * st.trail; g.lineWidth = w;
        g.beginPath();
        for (let k = -1; k <= 1; k++) {
          const o = k * spread, wig = Math.sin(c.ph + k) * spread * 0.5;
          g.moveTo(st.x + px * o * 0.3, st.y + py * o * 0.3);
          g.quadraticCurveTo(st.x1 + px * (o * 0.8 + wig), st.y1 + py * (o * 0.8 + wig), st.x2 + px * o * 1.6, st.y2 + py * o * 1.6 + k * w * 3);
        }
        g.stroke();
      }
      g.setTransform(S, 0, 0, S, 0, 0);
      drawList(g, S, lists[2]);
    },
  };
}
