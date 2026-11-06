// Click the night sky and the stars around the pointer join into a constellation.
// Star positions are recomputed here with the same hash and grid as the sunrise shader
// (single precision, like the GPU), so the lines land on the stars that are drawn.
const f32 = Math.fround;
const fract = x => x - Math.floor(x);

function hash21(x, y) {
  const a = f32(fract(f32(x * 0.1031))), b = f32(fract(f32(y * 0.1031)));
  const dot = f32(f32(a * f32(b + 33.33)) + f32(b * f32(a + 33.33))) + f32(a * f32(a + 33.33));
  const x3 = f32(a + dot), y3 = f32(b + dot), z3 = f32(a + dot);
  return fract(f32(f32(x3 + y3) * z3));
}

// cell size (css px), seed, density, weight — the visible layers of the shader's stars()
const LAYERS = [[34, 1, 0.09, 0.9], [60, 2, 0.12, 1.2], [130, 3, 0.16, 1.5]];

function starsNear(cx, cy, radius, canvasHeight) {
  // The shader works in y-up css pixels.
  const yUp = canvasHeight - cy;
  const found = [];
  for (const [cell, seed, density, weight] of LAYERS) {
    const shift = seed * 17.31;
    const gx0 = Math.floor((cx - radius) / cell + shift), gx1 = Math.floor((cx + radius) / cell + shift);
    const gy0 = Math.floor((yUp - radius) / cell + shift), gy1 = Math.floor((yUp + radius) / cell + shift);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        const h = hash21(gx + seed * 3.7, gy + seed * 3.7);
        if (h > density) continue;
        const px = (gx + hash21(gx + 11.3, gy + 11.3) * 0.72 + 0.14 - shift) * cell;
        const pyUp = (gy + hash21(gx + 5.9, gy + 5.9) * 0.72 + 0.14 - shift) * cell;
        const mag = hash21(gx + 2.2, gy + 2.2);
        const x = px, y = canvasHeight - pyUp;
        const dist = Math.hypot(x - cx, y - cy);
        if (dist <= radius) found.push({ x, y, dist, score: mag * weight + 0.6 * weight - dist / radius * 0.8, mag });
      }
    }
  }
  return found;
}

const NAMES = ['猎户座', '天琴座', '天鹅座', '仙后座', '北斗七星', '天蝎座', '狮子座', '飞马座', '双子座', '南十字座', '天鹰座', '御夫座'];
const LIFE = 9.5, FADE = 2;

export function createConstellationLayer(overlay) {
  const g = overlay.getContext('2d');
  let width = 1, height = 1, scale = 1;
  let active = [];
  let nameIndex = Math.floor(Math.random() * NAMES.length);

  function resize(w, h, dpr = 1) {
    width = w; height = h; scale = Math.min(2, dpr);
    overlay.width = Math.max(1, Math.round(w * scale)); overlay.height = Math.max(1, Math.round(h * scale));
  }

  /** Returns true when a constellation was started. */
  function click(x, y, now, horizonY) {
    if (y > horizonY - 12) return false;
    const pool = starsNear(x, y, 190, height).filter(star => star.y < horizonY - 14);
    pool.sort((a, b) => b.score - a.score);
    const nodes = [];
    for (const star of pool) {
      if (nodes.every(node => Math.hypot(node.x - star.x, node.y - star.y) > 30)) nodes.push(star);
      if (nodes.length >= 7) break;
    }
    if (nodes.length < 3) return false;
    // Chain them nearest-first starting beside the click, so the figure reads as one line.
    nodes.sort((a, b) => a.dist - b.dist);
    const chain = [nodes.shift()];
    while (nodes.length) {
      const tail = chain[chain.length - 1];
      let best = 0;
      nodes.forEach((node, index) => { if (Math.hypot(node.x - tail.x, node.y - tail.y) < Math.hypot(nodes[best].x - tail.x, nodes[best].y - tail.y)) best = index; });
      chain.push(nodes.splice(best, 1)[0]);
    }
    let length = 0;
    const lengths = chain.map((node, index) => (index ? (length += Math.hypot(node.x - chain[index - 1].x, node.y - chain[index - 1].y)) : 0));
    const cx = chain.reduce((sum, node) => sum + node.x, 0) / chain.length;
    const cy = Math.max(...chain.map(node => node.y));
    active.push({ t0: now, x, y, chain, lengths, total: length, name: NAMES[nameIndex++ % NAMES.length], label: [cx, cy + 22] });
    if (active.length > 3) active.shift();
    return true;
  }

  function paint(now) {
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.clearRect(0, 0, width, height);
    active = active.filter(item => (now - item.t0) / 1000 < LIFE + FADE);
    for (const item of active) {
      const age = Math.max(0, now - item.t0); // ms
      const seconds = age / 1000;
      const fade = seconds < LIFE ? 1 : Math.max(0, 1 - (seconds - LIFE) / FADE);
      const draw = Math.min(1, age / 1300) * item.total;
      g.save(); g.globalAlpha = fade; g.lineCap = 'round';

      // a soft ring where the pointer landed
      const ring = Math.min(1, age / 700);
      if (ring < 1) {
        g.strokeStyle = `rgba(190,215,255,${(1 - ring) * 0.5})`; g.lineWidth = 1.2;
        g.beginPath(); g.arc(item.x, item.y, 6 + ring * 38, 0, Math.PI * 2); g.stroke();
      }

      g.shadowColor = 'rgba(140,180,255,.9)'; g.shadowBlur = 8;
      g.strokeStyle = 'rgba(170,200,255,.6)'; g.lineWidth = 1.1;
      g.beginPath();
      item.chain.forEach((node, index) => {
        if (index === 0) { g.moveTo(node.x, node.y); return; }
        const prev = item.chain[index - 1];
        const start = item.lengths[index - 1], end = item.lengths[index];
        if (draw <= start) return;
        const k = Math.min(1, (draw - start) / Math.max(1, end - start));
        g.moveTo(prev.x, prev.y); g.lineTo(prev.x + (node.x - prev.x) * k, prev.y + (node.y - prev.y) * k);
      });
      g.stroke();

      item.chain.forEach((node, index) => {
        const reached = draw >= item.lengths[index] - 0.5;
        if (!reached) return;
        const pulse = 0.75 + 0.25 * Math.sin(seconds * 3 + index * 1.7);
        const r = (3.4 + node.mag * 2.6) * pulse;
        const halo = g.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 3.4);
        halo.addColorStop(0, 'rgba(235,244,255,.95)'); halo.addColorStop(0.35, 'rgba(160,195,255,.38)'); halo.addColorStop(1, 'rgba(120,160,255,0)');
        g.shadowBlur = 0; g.fillStyle = halo; g.beginPath(); g.arc(node.x, node.y, r * 3.4, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(235,244,255,.8)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(node.x - r * 2.2, node.y); g.lineTo(node.x + r * 2.2, node.y); g.moveTo(node.x, node.y - r * 2.2); g.lineTo(node.x, node.y + r * 2.2); g.stroke();
      });

      const labelAlpha = Math.max(0, Math.min(1, (age - 1100) / 600));
      if (labelAlpha > 0) {
        g.shadowBlur = 6; g.fillStyle = `rgba(205,222,255,${0.8 * labelAlpha})`;
        g.font = '500 12px "PingFang SC", "Helvetica Neue", sans-serif'; g.textAlign = 'center';
        g.fillText(item.name, item.label[0], item.label[1]);
      }
      g.restore();
    }
  }

  return { resize, click, paint, get active() { return active.length > 0; } };
}
