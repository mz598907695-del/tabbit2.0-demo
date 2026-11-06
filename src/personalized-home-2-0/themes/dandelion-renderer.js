import { clamp, smoothstep } from './gl-utils.js';
import { mulberry32 } from './canvas-kit.js';

// 蒲公英 — a dandelion whose seeds are Chinese characters. Scrolling is wind: seeds
// come loose one after another and drift off up and to the left, spinning, until only
// the bare head and its stem are left; scrolling back blows them home again.
const TEXT = '把想念吹向远方，把温柔留在身旁。愿你一路都有风，也有光，愿所有等待都慢慢有回响。日子很长，不必着急，山海有归期，云也有去处。遇见的每个人，都像一颗小小的种子，落进心里，等一个春天。愿你被世界温柔以待，也能温柔地抱住自己。风会记得你的名字，云会替你收藏心事，天空会在某个清晨，把整片的蓝都送给你。慢慢走，慢慢看，慢慢把自己活成一束值得被带走的光。';
const FONT = '"LXGW WenKai Lite", "Kaiti SC", "STKaiti", "KaiTi", "Songti SC", serif';
const WIND = -2.25; // radians: up and to the left

export function createDandelionRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D unavailable');
  // 210 seeds: the verse repeats once it runs out
  const chars = Array.from({ length: 210 }, (_, i) => [...TEXT][i % [...TEXT].length]);
  const rand = mulberry32(520);
  let W = 1, H = 1, scale = 1, disposed = false, sprites = [], sheetKey = '';

  // ---- Seeds in head space (radius 1): where they sit, when they let go, how they fly ----
  const placed = [];
  const seeds = chars.map(ch => {
    // rejection sampling keeps neighbouring characters from piling onto each other
    let a = 0, r = 0, tries = 0;
    do {
      a = rand() * 6.2832; r = 0.3 + 0.72 * Math.pow(rand(), 0.7);
      tries++;
    } while (tries < 40 && placed.some(q => Math.hypot(q.x - Math.cos(a) * r, q.y - Math.sin(a) * r) < 0.098));
    placed.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    return {
      ch, a, r, z: rand(), size: 0.8 + rand() * 0.45, rot: a + (rand() - 0.5) * 0.35,
      far: 0, t0: 0, dur: 0.26 + rand() * 0.16, spread: (rand() - 0.5) * 1.3, spin: (rand() - 0.5) * 7,
      amp: 18 + rand() * 46, k: 1 + rand() * 2.2, ph: rand() * 6.28, f1: 6 + rand() * 7, rise: 0.25 + rand() * 0.5,
    };
  });
  // The wind comes from the lower right: seeds facing it go first, with plenty of noise.
  seeds.map((s, i) => ({ i, score: -Math.cos(s.a - (WIND + Math.PI)) * 0.55 + (rand() - 0.5) * 1.1 + (1 - s.r) * 0.25 }))
    .sort((a, b) => a.score - b.score)
    .forEach(({ i }, rank) => { seeds[i].t0 = 0.04 + 0.66 * Math.pow(rank / (seeds.length - 1), 0.92); });
  const spokes = Array.from({ length: 150 }, () => ({ a: rand() * 6.28318, r: 0.5 + rand() * 0.3, w: 0.4 + rand() * 0.5 }));
  const motes = Array.from({ length: 26 }, () => ({ x: rand(), y: rand(), s: 0.4 + rand() * 0.9, ph: rand() * 6.28 }));
  const streaks = Array.from({ length: 12 }, () => ({ x: rand(), y: rand(), l: 0.1 + rand() * 0.22, ph: rand() }));

  const noise = (() => {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 128;
    const g = tile.getContext('2d');
    const image = g.createImageData(128, 128);
    for (let i = 0; i < image.data.length; i += 4) { const v = rand() > 0.5 ? 255 : 0; image.data[i] = image.data[i + 1] = image.data[i + 2] = v; image.data[i + 3] = 255; }
    g.putImageData(image, 0, 0);
    return tile;
  })();
  const noisePattern = ctx.createPattern(noise, 'repeat');

  // ---- One sprite per seed: a few bristles fanning out behind a character ----
  function buildSprites(R) {
    const key = `${Math.round(R)}|${scale}`;
    if (key === sheetKey) return;
    sheetKey = key;
    sprites = seeds.map(seed => {
      const fs = R * 0.112 * seed.size;
      const side = Math.ceil(fs * 3.4 * scale), c = document.createElement('canvas');
      c.width = c.height = side;
      const g = c.getContext('2d');
      g.scale(scale, scale);
      g.translate(side / scale / 2, side / scale / 2);
      // bristles open outward (towards -y), like the parachute of a real seed
      const bristles = 9, reach = fs * 0.85;
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = Math.max(0.5, fs * 0.028); g.lineCap = 'round';
      for (let b = 0; b < bristles; b++) {
        const ang = -PI2 + (b / (bristles - 1) - 0.5) * 2.1;
        const len = reach * (0.8 + 0.2 * Math.cos((b / (bristles - 1) - 0.5) * 3.1));
        g.beginPath(); g.moveTo(0, -fs * 0.1); g.lineTo(Math.cos(ang) * len, -fs * 0.1 + Math.sin(ang) * len); g.stroke();
      }
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = Math.max(0.6, fs * 0.04);
      g.beginPath(); g.moveTo(0, -fs * 0.1); g.lineTo(0, fs * 0.9); g.stroke();
      g.beginPath(); g.arc(0, fs * 1.02, fs * 0.1, 0, 6.2832); g.stroke();
      // the character itself, its head towards the outside
      g.fillStyle = 'rgba(255,255,255,1)';
      g.font = `400 ${fs}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(255,255,255,.5)'; g.shadowBlur = fs * 0.12;
      g.fillText(seed.ch, 0, fs * 0.1);
      return c;
    });
  }
  const PI2 = Math.PI / 2;

  const fontsReady = (typeof document !== 'undefined' && document.fonts)
    ? document.fonts.load('32px "LXGW WenKai Lite"', TEXT).then(() => { sheetKey = ''; }).catch(() => {})
    : Promise.resolve();

  function resize(w, h, dpr = 1) {
    W = w; H = h;
    scale = Math.min(2, dpr, Math.sqrt(3000000 / (w * h)));
    canvas.width = Math.max(1, Math.round(w * scale)); canvas.height = Math.max(1, Math.round(h * scale));
    sheetKey = '';
  }

  let lastP = null, lastTime = null, wind = 0;

  function render({ p, time, layout }) {
    if (disposed) return;
    const g = ctx;
    g.setTransform(scale, 0, 0, scale, 0, 0);

    const avoid = layout?.avoidHalf ?? 350;
    const R = Math.min(H * 0.3, W * 0.21);
    const hx = clamp(W / 2 + avoid + R * 0.8, W * 0.58, W - R - 28), hy = H * 0.58;
    buildSprites(R);

    // scroll speed becomes the strength of the breeze
    const dt = lastTime == null ? 0 : clamp(time - lastTime, 0, 0.1);
    const speed = lastP == null || dt <= 0 ? 0 : Math.abs(p - lastP) / dt;
    wind += (clamp(speed * 4, 0, 1) - wind) * (dt ? 1 - Math.exp(-dt / 0.35) : 0);
    lastP = p; lastTime = time;

    // ---- sky ----
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#3f7bbd'); sky.addColorStop(0.5, '#6ea3d0'); sky.addColorStop(1, '#a3c8e2');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const bloom = g.createRadialGradient(hx, hy, 0, hx, hy, R * 2.3);
    bloom.addColorStop(0, 'rgba(255,255,255,.2)'); bloom.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = bloom; g.fillRect(0, 0, W, H);
    // faint high clouds
    for (const [fx, fy, s] of [[0.2, 0.18, 1], [0.55, 0.1, 0.7], [0.08, 0.5, 0.8]]) {
      const cx = ((fx * W + time * 3 * s) % (W + 400)) - 200, cy = fy * H;
      const cloud = g.createRadialGradient(cx, cy, 0, cx, cy, 260 * s);
      cloud.addColorStop(0, 'rgba(255,255,255,.1)'); cloud.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = cloud; g.beginPath(); g.ellipse(cx, cy, 300 * s, 70 * s, 0, 0, 6.2832); g.fill();
    }

    // wind streaks while scrolling
    if (wind > 0.02) {
      g.lineCap = 'round';
      for (const s of streaks) {
        const x = ((s.x * W * 1.4 + p * W * 4 + time * 60) % (W * 1.4)) - W * 0.2, y = s.y * H, l = s.l * W;
        g.strokeStyle = `rgba(255,255,255,${0.16 * wind})`; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x - l * 0.4, y - 8 - s.ph * 12, x - l * 0.7, y + 10, x - l, y - 4); g.stroke();
      }
    }
    // drifting motes
    for (const m of motes) {
      const mx = (m.x * W - time * 6 * m.s - p * 200 * m.s + W * 3) % W, my = (m.y * H + Math.sin(time * 0.4 + m.ph) * 8 + H) % H;
      g.fillStyle = `rgba(255,255,255,${0.12 + 0.12 * Math.sin(time + m.ph)})`; g.beginPath(); g.arc(mx, my, 1.1 * m.s, 0, 6.2832); g.fill();
    }

    // ---- stem and head, swaying in the breeze ----
    const sway = Math.sin(time * 0.7) * 0.012 + Math.sin(time * 1.9 + 1) * 0.004 + wind * 0.02 * Math.sin(time * 5);
    const baseX = hx + R * 0.1, baseY = H + 30;
    g.save();
    g.translate(baseX, baseY); g.rotate(sway); g.translate(-baseX, -baseY);
    const stem = new Path2D();
    stem.moveTo(baseX, baseY); stem.quadraticCurveTo(hx - R * 0.35, hy + (H - hy) * 0.55, hx, hy + 4);
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 7; g.lineCap = 'round'; g.stroke(stem);
    g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 2.4; g.stroke(stem);

    // radial fibres that stay on the head when the seeds are gone
    g.lineCap = 'round';
    for (const s of spokes) {
      g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = s.w;
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + Math.cos(s.a) * R * s.r, hy + Math.sin(s.a) * R * s.r); g.stroke();
    }

    // filaments of seeds that are still attached
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 0.8;
    g.beginPath();
    const placed = seeds.map(s => {
      const lift = clamp((p - s.t0) / s.dur, 0, 1);
      return { s, lift };
    });
    for (const { s, lift } of placed) {
      if (lift > 0) continue;
      const tremble = smoothstep(s.t0 - 0.08, s.t0, p) * 2.2 + wind * 0.8;
      const jx = Math.sin(time * s.f1 + s.ph) * tremble, jy = Math.cos(time * s.f1 * 0.9 + s.ph) * tremble;
      g.moveTo(hx, hy); g.lineTo(hx + Math.cos(s.a) * R * s.r + jx, hy + Math.sin(s.a) * R * s.r + jy);
    }
    g.stroke();
    g.restore();

    // ---- seeds: attached ones sway on the head, freed ones fly ----
    const order = placed.slice().sort((a, b) => a.s.z - b.s.z);
    const diag = Math.hypot(W, H) * 1.2;
    g.save();
    g.translate(baseX, baseY); g.rotate(sway); g.translate(-baseX, -baseY);
    for (const { s, lift } of order) {
      const art = sprites[seeds.indexOf(s)];
      if (!art) continue;
      let x = hx + Math.cos(s.a) * R * s.r, y = hy + Math.sin(s.a) * R * s.r, rot = s.rot + PI2, alpha = 0.55 + 0.45 * s.z, size = 0.86 + 0.26 * s.z;
      if (lift <= 0) {
        const tremble = smoothstep(s.t0 - 0.08, s.t0, p) * 2.2 + wind * 0.8;
        x += Math.sin(time * s.f1 + s.ph) * tremble + Math.sin(time * 0.8 + s.ph) * 0.8;
        y += Math.cos(time * s.f1 * 0.9 + s.ph) * tremble;
        rot += Math.sin(time * 1.3 + s.ph) * 0.025 * (1 + tremble);
      } else {
        const e = Math.pow(lift, 1.35), dir = WIND + s.spread;
        x += Math.cos(dir) * diag * e + Math.sin(lift * s.k * 6.2832 + s.ph) * s.amp * Math.sqrt(e);
        y += Math.sin(dir) * diag * e - e * s.rise * H * 0.35 + Math.cos(lift * s.k * 4 + s.ph) * s.amp * 0.5 * Math.sqrt(e);
        rot += lift * s.spin + Math.sin(time * 2 + s.ph) * 0.12;
        alpha *= 1 - smoothstep(0.58, 1, lift);
        size *= 1 - 0.25 * lift;
      }
      if (alpha < 0.01) continue;
      g.globalAlpha = alpha;
      g.save(); g.translate(x, y); g.rotate(rot); g.scale(size, size);
      g.drawImage(art, -art.width / scale / 2, -art.height / scale / 2, art.width / scale, art.height / scale);
      g.restore();
    }
    g.restore();
    g.globalAlpha = 1;

    // the glowing heart of the head
    g.save();
    g.translate(baseX, baseY); g.rotate(sway); g.translate(-baseX, -baseY);
    const heart = g.createRadialGradient(hx, hy, 0, hx, hy, R * 0.26);
    heart.addColorStop(0, 'rgba(255,252,225,.98)'); heart.addColorStop(0.18, 'rgba(255,248,210,.75)'); heart.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = heart; g.beginPath(); g.arc(hx, hy, R * 0.26, 0, 6.2832); g.fill();
    g.fillStyle = '#fffbe6'; g.beginPath(); g.arc(hx, hy, Math.max(2, R * 0.016), 0, 6.2832); g.fill();
    g.restore();

    // soft vignette and grain
    const vignette = g.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.4, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
    vignette.addColorStop(0, 'rgba(20,50,110,0)'); vignette.addColorStop(1, 'rgba(20,50,110,.2)');
    g.fillStyle = vignette; g.fillRect(0, 0, W, H);
    g.save(); g.globalAlpha = 0.012; g.fillStyle = noisePattern; g.fillRect(0, 0, W, H); g.restore();
  }

  return {
    resize, render,
    /** Resolves once the calligraphy font is available, so thumbnails are not drawn in a fallback face. */
    ready: fontsReady,
    dispose() { disposed = true; },
  };
}
