import { clamp, lerp, smoothstep } from './gl-utils.js';
import { cloudSprite, mod, mulberry32 } from './canvas-kit.js';
import { createHair } from './hairline-hair.js';
import { createComb } from './hairline-comb.js';
import { BODY_Y, drawBody, drawFx, drawGloss, drawHead, drawMass, poseFace } from './hairline-face.js';

// 发际线 — a bespectacled programmer with a thick head of hair. Scrolling down is a gust of
// wind from the right: the hair leaves clump by clump (up and to the left) and he grows sadder
// with every one, until only a Mediterranean fringe is left. Scrolling back up blows it all home
// and he is delighted. Clicking the wallpaper makes him comb whatever is left (hairline-comb.js).
// Hair count is a pure function of p; the mood is one smoothed scalar (-1 sad … +1 happy)
// that follows the scroll direction and drives every part of the face (hairline-face.js).
const PI = Math.PI;
const GLYPHS = ['{ }', ';', '=>', '</>', '( )', '[ ]', '0 1', 'fn', '&&', '#', '//', '++'];
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export function createHairlineRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D unavailable');
  const rand = mulberry32(31);
  const hair = createHair();
  const comb = createComb(hair.clumps);
  let W = 1, H = 1, S = 1, disposed = false;
  let U = 100, hx = 0, hy = 0, bgKey = '', bg = null;

  const clouds = [0, 1, 2].map(() => cloudSprite(rand, 420, 150, null, true));
  const motes = Array.from({ length: 14 }, (_, i) => ({
    ch: GLYPHS[i % GLYPHS.length], x: rand(), y: 0.08 + rand() * 0.8, size: 15 + rand() * 15, speed: 6 + rand() * 12, ph: rand() * 6.28, par: 0.4 + rand() * 0.9,
  }));
  const streaks = Array.from({ length: 11 }, () => ({ x: rand(), y: 0.12 + rand() * 0.7, l: 0.12 + rand() * 0.2, s: 0.6 + rand() * 0.8, ph: rand() * 6.28 }));
  const face = { mouth: {} };
  const sim = { last: null, lastP: null, p: 0, time: 6, heading: 0, mood: 0.25, wind: 0, tail: 1, shock: 0, lastLost: 0, look: 0, wry: 0 };

  function resize(w, h, dpr = 1) {
    W = w; H = h;
    S = Math.min(2, dpr, Math.sqrt(3000000 / (w * h)));
    canvas.width = Math.max(1, Math.round(w * S)); canvas.height = Math.max(1, Math.round(h * S));
    bgKey = '';
  }

  /** The person sits right of the widgets; thumbnails (no widgets) get a bigger, more central portrait. */
  function layoutFor(avoid) {
    const thumb = avoid < 60;
    U = Math.min(H * (thumb ? 0.225 : 0.2), W * 0.24);
    hx = thumb ? W * 0.62 : clamp(Math.max(W * 0.7, W / 2 + avoid + U * 0.55), W * 0.6, W - U * 1.3);
    hy = H * (thumb ? 0.5 : 0.47);
  }

  function buildBackground() {
    bg = document.createElement('canvas');
    bg.width = canvas.width; bg.height = canvas.height;
    const g = bg.getContext('2d');
    g.scale(S, S);
    const sky = g.createLinearGradient(0, 0, W * 0.5, H);
    sky.addColorStop(0, '#b3d4f2'); sky.addColorStop(0.55, '#d3e7f8'); sky.addColorStop(1, '#ecf5fc');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const haze = g.createRadialGradient(W * 0.15, 0, 0, W * 0.15, 0, W * 0.6);
    haze.addColorStop(0, 'rgba(150,196,240,.45)'); haze.addColorStop(1, 'rgba(150,196,240,0)');
    g.fillStyle = haze; g.fillRect(0, 0, W, H);
    // the big white disc behind his head, soft at the rim
    const cy = hy + U * 0.25, R = U * 2.2;
    const glow = g.createRadialGradient(hx, cy, R * 0.85, hx, cy, R * 1.5);
    glow.addColorStop(0, 'rgba(255,255,255,.55)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    const disc = g.createRadialGradient(hx, cy - U * 0.2, R * 0.15, hx, cy, R);
    disc.addColorStop(0, '#ffffff'); disc.addColorStop(0.8, '#fbfdff'); disc.addColorStop(1, '#eef6fd');
    g.fillStyle = disc; g.beginPath(); g.arc(hx, cy, R, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = Math.max(2, U * 0.025);
    g.beginPath(); g.arc(hx, cy, R * 1.01, 0, Math.PI * 2); g.stroke();
  }

  function render({ p, time, layout, still }) {
    if (disposed) return;
    p = clamp(p);
    const g = ctx;
    layoutFor(layout?.avoidHalf ?? 350);
    if (`${W}|${H}|${S}|${Math.round(U)}|${Math.round(hx)}|${Math.round(hy)}` !== bgKey) {
      bgKey = `${W}|${H}|${S}|${Math.round(U)}|${Math.round(hx)}|${Math.round(hy)}`;
      buildBackground();
    }
    hair.prepare(U, S);

    // ---------------------------------------------------------------- simulation
    const dt = sim.last == null ? 0 : clamp(time - sim.last, 0, 0.1);
    const dp = sim.lastP == null ? 0 : p - sim.lastP;
    if (Math.abs(dp) > 2e-5) sim.heading = dp > 0 ? 1 : -1;
    const lost = hair.lostAt(p), hairLeft = hair.keepAt(p);
    const ease = tau => (dt ? 1 - Math.exp(-dt / tau) : 0);
    // sad in proportion to the hair gone; scrolling up makes him happy and he stays that way when it stops
    const sadTarget = 0.25 - 1.25 * clamp(lost / 0.9);
    const heading = still ? 1 : sim.heading;
    const target = heading < 0 ? 1 : heading > 0 || p > 0.015 ? sadTarget : 0.25;
    // thumbnails, the very first frame, and reduced motion (the clock is frozen while p jumps) show the settled state at once
    if (still || sim.last == null || (dt === 0 && dp !== 0)) {
      sim.mood = target; sim.shock = 0; sim.look = lost > 0.02 ? 1 : 0; sim.wry = lost > 0.92 ? 1 : 0; sim.tail = heading || 1;
      sim.wind = still ? 0.9 * smoothstep(0.03, 0.2, p) * (1 - smoothstep(0.9, 1, p)) : 0;
    } else {
      const speed = dt > 0 ? Math.abs(dp) / dt : 0;
      sim.wind += (clamp(speed * 1.6) - sim.wind) * ease(0.22);
      sim.tail += (heading - sim.tail) * ease(0.12);
      sim.mood += (target - sim.mood) * ease(target > sim.mood ? 0.28 : 0.36);
      sim.shock *= Math.exp(-dt / 0.5);
      if (dt && lost > sim.lastLost && heading >= 0) sim.shock += (lost - sim.lastLost) * 3.4 * lerp(1.5, 0.4, smoothstep(0.08, 0.6, lost));
      sim.shock = Math.min(1, sim.shock);
      sim.look += ((heading > 0 && lost > 0.02 ? 1 : 0) - sim.look) * ease(0.4);
      sim.wry += ((heading > 0 && lost > 0.92 ? 1 : 0) - sim.wry) * ease(0.5);
    }
    sim.lastLost = lost; sim.lastP = p; sim.last = time; sim.p = p; sim.time = time;

    const cm = comb.mood(time);
    const mood = sim.mood;
    const joy = clamp(mood), sad = clamp(-mood);
    const breath = Math.sin(time * 1.6);

    // blink every few seconds (sometimes twice), and an occasional glint across the lenses
    const bt = mod(time + 0.7, 3.9), bi = Math.floor((time + 0.7) / 3.9);
    const blink = bt < 0.14 ? Math.sin(Math.PI * bt / 0.14) : bi % 3 === 1 && bt > 0.3 && bt < 0.44 ? Math.sin(Math.PI * (bt - 0.3) / 0.14) : 0;
    const gl = mod(time * 0.17 + 0.25, 1), glint = gl < 0.1 ? gl / 0.1 : -1;

    // looks up-left at the departing hair; during a comb looks toward the comb
    const flightLook = sim.look * (1 - 0.6 * smoothstep(0.85, 1, lost));
    const lookX = lerp(Math.sin(time * 0.5) * 0.15, -0.65, flightLook) * (1 - cm.k) + cm.k * -0.8;
    const lookY = lerp(0.05, -0.6, flightLook) * (1 - cm.k) + cm.k * (cm.enjoy > cm.careful ? 0 : -0.5);
    poseFace({
      mood, shock: sim.shock * (1 - cm.k * 0.8), enjoy: cm.enjoy, careful: cm.careful, wry: Math.max(sim.wry, cm.wry) * (1 - cm.enjoy),
      blink: blink * (1 - cm.enjoy * 0.0), sigh: cm.sigh, time, lookX, lookY, glint,
    }, face);
    face.time = time; face.sighT = cm.sighT; face.sigh = cm.sigh; face.sighTone = 1 - cm.plenty;
    face.sweat = Math.max(face.sweat, 0);
    face.hairShadow = hairLeft > 0.4 ? 1 : hairLeft / 0.4;
    face.cap = Math.pow(1 - lost, 1.5);
    face.shine = smoothstep(0.4, 0.95, lost) * (1 - 0.5 * cm.k);
    face.cloud = smoothstep(0.55, 0.9, face.sad) * (1 - cm.k * 0.7);
    face.slump = 0.2 * face.sad - 0.1 * face.joy - 0.03 * face.shock;

    // posture: chin down and tilted when sad, chin up and bobbing when happy
    const roll = -0.055 * sad + joy * 0.04 * Math.sin(time * 2.4) + Math.sin(time * 0.9) * 0.008 + face.cry * 0.004 * Math.sin(time * 17) - cm.k * 0.05;
    const dy = 0.08 * sad - 0.04 * joy + breath * 0.01 + 0.02 * face.shock;
    const dx = -0.02 * sad * 0 + cm.k * -0.03;
    const cs = Math.cos(roll), sn = Math.sin(roll), pvy = 1.45;
    const M = { a: U * cs, b: U * sn, c: -U * sn, d: U * cs, e: hx + U * (dx - (-sn * pvy)), f: hy + U * (dy + pvy - cs * pvy) };

    // ---------------------------------------------------------------- background
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(bg, 0, 0);
    g.setTransform(S, 0, 0, S, 0, 0);
    const windSigned = sim.wind * (sim.tail >= 0 ? -1 : 1) * Math.min(1, Math.abs(sim.tail) * 1.5);
    paintSky(g, p, time, windSigned);

    // ---------------------------------------------------------------- the person
    const sway = 1 + joy * 0.6;
    const leanAng = windSigned < 0 ? PI + 0.22 : -0.22;
    const diag = Math.hypot(W, H);
    const t = time;
    hair.update({
      p, time, M, roll, U, wind: Math.abs(windSigned), windAng: leanAng, tail: sim.tail, sway, diag, hx,
      neat: comb.active(time) || comb.mood(time).k > 0 ? i => comb.neat(i, t) : null,
    });
    g.setTransform(S * M.a, S * M.b, S * M.c, S * M.d, S * M.e, S * M.f);
    drawMass(g, lost);
    hair.drawBack(g, S);

    const breathY = breath * 0.012;
    g.setTransform(S * U, 0, 0, S * U, S * hx, S * (hy + U * breathY));
    drawBody(g, face);

    g.setTransform(S * M.a, S * M.b, S * M.c, S * M.d, S * M.e, S * M.f);
    drawHead(g, face);
    hair.drawFront(g, S);
    g.setTransform(S * M.a, S * M.b, S * M.c, S * M.d, S * M.e, S * M.f);
    drawGloss(g, lost);

    // comb + hand
    const q = comb.pose(time, { M, U, hx, hy, H, roll, shoulder: [hx - 1.85 * U, hy + U * (1.95 + BODY_Y + face.slump + breathY)] });
    if (q) {
      comb.drawComb(g, S, q);
      comb.drawArm(g, S, q);
    }
    g.setTransform(S * M.a, S * M.b, S * M.c, S * M.d, S * M.e, S * M.f);
    comb.drawBits(g, time);
    drawFx(g, face);
    hair.drawFlying(g, S);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
  }

  /** Drifting clouds, floating code, and wind lines whose strength follows the scroll speed. */
  function paintSky(g, p, time, wind) {
    for (const [i, cl] of clouds.entries()) {
      const w = (W * (0.3 + i * 0.07)), h = w * 150 / 420;
      const x = mod(W * (0.15 + i * 0.37) - time * (4 + i * 2) - p * W * 0.35 * (1 + i * 0.4), W + w) - w * 0.6;
      g.globalAlpha = 0.5; g.drawImage(cl, x, H * (0.1 + i * 0.27), w, h);
    }
    g.globalAlpha = 1;
    g.font = `500 16px ${MONO}`; g.textBaseline = 'middle';
    for (const m of motes) {
      const x = mod(m.x * (W + 160) - time * m.speed - p * W * 0.4 * m.par + (windSign(wind) * sim.wind * W * 0.15), W + 160) - 80;
      const y = m.y * H + Math.sin(time * 0.7 + m.ph) * 9;
      g.font = `500 ${m.size}px ${MONO}`;
      g.fillStyle = `rgba(88,134,190,${0.2 + 0.1 * Math.sin(time * 0.9 + m.ph)})`;
      g.fillText(m.ch, x, y);
    }
    const a = Math.abs(wind);
    if (a > 0.03) {
      g.lineCap = 'round';
      const dir = wind < 0 ? -1 : 1;
      for (const s of streaks) {
        const span = W * 1.3, l = s.l * W;
        const x = mod(s.x * span - dir * (time * 220 * s.s + p * W * 3), span) - W * 0.15, y = s.y * H + Math.sin(time * 1.3 + s.ph) * 6;
        g.strokeStyle = `rgba(255,255,255,${0.75 * a})`; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(x, y);
        g.bezierCurveTo(x + dir * l * 0.35, y - 10, x + dir * l * 0.65, y + 12, x + dir * l, y - 2);
        g.bezierCurveTo(x + dir * l * 1.08, y - 8, x + dir * l * 1.12, y - 22, x + dir * l * 1.0, y - 24);
        g.stroke();
        g.strokeStyle = `rgba(150,190,230,${0.35 * a})`; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x + dir * l * 0.1, y + 7); g.bezierCurveTo(x + dir * l * 0.4, y + 2, x + dir * l * 0.6, y + 16, x + dir * l * 0.85, y + 8); g.stroke();
      }
    }
  }
  const windSign = w => (w < 0 ? -1 : 1);

  return {
    resize, render,
    /** Click the wallpaper: he combs what is left of his hair. */
    pointer() { comb.start(sim.time, hair.keepAt(sim.p)); },
    ready: Promise.resolve(),
    dispose() { disposed = true; },
  };
}
