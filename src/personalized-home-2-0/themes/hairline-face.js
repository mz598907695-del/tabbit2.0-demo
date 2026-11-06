// 发际线 — the programmer himself: body, head and face, drawn as clean flat vectors every frame
// so that brows, eyes, mouth, tears and posture can follow one continuous mood value.
// Everything is in head units (1 = half a face height), origin at the centre of the face.
import { clamp, lerp, smoothstep } from './gl-utils.js';

const PI = Math.PI, TAU = PI * 2;
const INK = '#16181e';
export const SKIN = { light: '#fde5d0', base: '#f6d0ae', shade: '#e8b491', deep: '#d4966f' };

function rrect(g, x, y, w, h, r) {
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Piecewise-linear lookup: keys are [m, ...values] in ascending m. */
function keyed(keys, m) {
  if (m <= keys[0][0]) return keys[0].slice(1);
  for (let i = 1; i < keys.length; i++) {
    if (m <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i], t = (m - a[0]) / (b[0] - a[0]);
      return a.slice(1).map((v, j) => v + (b[j + 1] - v) * t);
    }
  }
  return keys[keys.length - 1].slice(1);
}

// mouth by mood: [half width, corner y, upper edge sag, lower edge sag, corner roundness]
const MOUTH = [
  [-1, 0.22, 0.67, -0.11, 0.07, 0.95],
  [-0.62, 0.18, 0.665, -0.065, -0.05, 0.7],
  [-0.2, 0.16, 0.635, -0.02, -0.02, 0.66],
  [0, 0.16, 0.6, 0.012, 0.012, 0.66],
  [0.28, 0.23, 0.585, 0.07, 0.07, 0.66],
  [0.62, 0.24, 0.565, 0.08, 0.17, 0.72],
  [1, 0.29, 0.545, 0.07, 0.3, 0.78],
];

const facePath = g => {
  g.beginPath();
  g.moveTo(0, -1);
  g.bezierCurveTo(0.56, -1, 0.86, -0.62, 0.86, -0.16);
  g.bezierCurveTo(0.86, 0.34, 0.6, 0.8, 0.24, 0.97);
  g.quadraticCurveTo(0, 1.05, -0.24, 0.97);
  g.bezierCurveTo(-0.6, 0.8, -0.86, 0.34, -0.86, -0.16);
  g.bezierCurveTo(-0.86, -0.62, -0.56, -1, 0, -1);
  g.closePath();
};

// ------------------------------------------------------------------ body
export const BODY_Y = -0.2; // the shoulders sit this much higher than the paths below say
export function drawBody(g, st) {
  const sl = st.slump;
  g.save(); g.translate(0, BODY_Y);
  // neck
  const neck = g.createLinearGradient(0, 0.8, 0, 1.6);
  neck.addColorStop(0, SKIN.shade); neck.addColorStop(1, '#dba27f');
  g.fillStyle = neck;
  g.beginPath(); g.moveTo(-0.33, 0.7); g.lineTo(-0.4, 1.55 + sl * 0.4); g.lineTo(0.4, 1.55 + sl * 0.4); g.lineTo(0.33, 0.7); g.closePath(); g.fill();

  // blazer
  g.beginPath();
  g.moveTo(-0.62, 1.4);
  g.bezierCurveTo(-1.2, 1.52, -1.85, 1.68, -2.2, 2.02 + sl);
  g.bezierCurveTo(-2.62, 2.4 + sl, -2.76, 3.2 + sl, -2.82, 5);
  g.lineTo(-2.9, 9); g.lineTo(2.9, 9); g.lineTo(2.82, 5);
  g.bezierCurveTo(2.76, 3.2 + sl, 2.62, 2.4 + sl, 2.2, 2.02 + sl);
  g.bezierCurveTo(1.85, 1.68, 1.2, 1.52, 0.62, 1.4);
  g.closePath();
  const cloth = g.createLinearGradient(-2.8, 0, 2.8, 0);
  cloth.addColorStop(0, '#363f55'); cloth.addColorStop(0.5, '#262c3d'); cloth.addColorStop(1, '#1c212d');
  g.fillStyle = cloth; g.fill();
  g.save(); g.clip();
  const sheen = g.createLinearGradient(0, 1.4, 0, 2.6);
  sheen.addColorStop(0, 'rgba(255,255,255,.1)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen; g.fillRect(-3, 1.3, 6, 1.4);
  g.restore();

  // shirt in the V of the jacket
  const shirt = g.createLinearGradient(0, 1.4, 0, 3.8);
  shirt.addColorStop(0, '#dfe6f0'); shirt.addColorStop(0.3, '#f8fafd'); shirt.addColorStop(1, '#eef2f8');
  g.fillStyle = shirt;
  g.beginPath(); g.moveTo(-0.66, 1.38); g.lineTo(0.66, 1.38); g.lineTo(0.02, 3.9); g.lineTo(-0.02, 3.9); g.closePath(); g.fill();
  // lapel edges
  g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 0.035; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-0.7, 1.4); g.lineTo(-0.04, 3.88); g.moveTo(0.7, 1.4); g.lineTo(0.04, 3.88); g.stroke();
  // collar flaps
  for (const s of [-1, 1]) {
    g.fillStyle = '#fbfcfe';
    g.beginPath(); g.moveTo(s * 0.7, 1.3); g.lineTo(s * 0.1, 1.58); g.lineTo(s * 0.5, 2.12); g.closePath(); g.fill();
    g.fillStyle = 'rgba(150,165,190,.35)';
    g.beginPath(); g.moveTo(s * 0.1, 1.58); g.lineTo(s * 0.5, 2.12); g.lineTo(s * 0.36, 1.84); g.closePath(); g.fill();
  }
  // tie
  const tie = g.createLinearGradient(-0.3, 0, 0.3, 0);
  tie.addColorStop(0, '#223c6c'); tie.addColorStop(0.45, '#33579a'); tie.addColorStop(1, '#1f366a');
  g.fillStyle = tie;
  g.beginPath(); g.moveTo(-0.14, 1.9); g.lineTo(0.14, 1.9); g.lineTo(0.28, 3.45); g.lineTo(0, 3.85); g.lineTo(-0.28, 3.45); g.closePath(); g.fill();
  g.fillStyle = '#2b4b8a';
  g.beginPath(); g.moveTo(-0.14, 1.66); g.lineTo(0.14, 1.66); g.lineTo(0.17, 1.9); g.quadraticCurveTo(0, 1.98, -0.17, 1.9); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 0.025;
  g.beginPath(); g.moveTo(-0.05, 2.1); g.lineTo(-0.1, 3.4); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 0.03;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-0.26 + i * 0.01, 2.3 + i * 0.28); g.lineTo(0.26, 2.0 + i * 0.28 + 0.1); g.stroke(); }
  // shadow of the chin on the neck and collar
  const under = g.createLinearGradient(0, 1.0, 0, 1.5);
  under.addColorStop(0, 'rgba(150,80,55,.4)'); under.addColorStop(1, 'rgba(150,80,55,0)');
  g.fillStyle = under; g.fillRect(-0.42, 0.95, 0.84, 0.6);
  g.restore();
}

/** A soft sheen over the crown, drawn on top of the hair. */
export function drawGloss(g, lost) {
  const a = 0.3 * Math.pow(1 - lost, 1.5);
  if (a < 0.01) return;
  g.save();
  g.translate(-0.28, -1.0); g.rotate(-0.38); g.scale(1, 0.34);
  const sheen = g.createRadialGradient(0, 0, 0, 0, 0, 0.62);
  sheen.addColorStop(0, `rgba(190,212,250,${a})`); sheen.addColorStop(0.6, `rgba(170,195,240,${a * 0.4})`); sheen.addColorStop(1, 'rgba(170,195,240,0)');
  g.fillStyle = sheen; g.beginPath(); g.arc(0, 0, 0.62, 0, TAU); g.fill();
  g.restore();
}

/** The soft dark mass of hair behind the skull; shrinks and fades as the hair goes. */
export function drawMass(g, lost) {
  const a = clamp(1.2 * Math.pow(1 - lost, 1.3));
  if (a < 0.01) return;
  g.save();
  g.translate(0, -0.1); g.scale(1 - 0.1 * lost, 1 - 0.1 * lost); g.translate(0, 0.1);
  g.globalAlpha = a;
  g.beginPath();
  g.moveTo(-0.97, 0.14);
  g.bezierCurveTo(-1.14, -0.55, -0.86, -1.2, 0, -1.22);
  g.bezierCurveTo(0.86, -1.2, 1.14, -0.55, 0.97, 0.14);
  g.closePath();
  g.fillStyle = '#0d0f16'; g.fill();
  g.clip();
  const shine = g.createRadialGradient(-0.35, -0.95, 0, -0.35, -0.95, 0.9);
  shine.addColorStop(0, 'rgba(120,150,210,.28)'); shine.addColorStop(1, 'rgba(120,150,210,0)');
  g.fillStyle = shine; g.fillRect(-1.3, -1.4, 2.6, 1.7);
  g.restore();
}

// ------------------------------------------------------------------ face parts
function brow(g, side, inner, outer, arch, thick) {
  const x0 = side * 0.13, x1 = side * 0.62, mx = (x0 + x1) / 2, my = (inner + outer) / 2 - arch;
  g.beginPath();
  g.moveTo(x0, inner - thick * 0.55);
  g.quadraticCurveTo(mx, my - thick * 0.9 - 0.012, x1, outer - thick * 0.2);
  g.lineTo(x1, outer + thick * 0.25);
  g.quadraticCurveTo(mx, my + thick * 0.8, x0, inner + thick * 0.55);
  g.closePath();
  g.fillStyle = INK; g.fill();
  g.lineJoin = 'round'; g.lineWidth = 0.014; g.strokeStyle = INK; g.stroke();
}

function eye(g, cx, cy, side, o) {
  const ew = 0.135;
  g.save();
  g.translate(cx, cy); g.rotate(side * o.tilt);
  if (o.open > 0.03 && o.cres < 0.97) {
    const hT = 0.112 * o.open * (1 - o.cres * 0.7), hB = 0.09 * o.open * (1 - o.cres * 0.9);
    g.save();
    g.beginPath();
    g.moveTo(-ew, 0.01); g.bezierCurveTo(-ew * 0.55, -hT * 1.33, ew * 0.55, -hT * 1.33, ew, 0.01);
    g.bezierCurveTo(ew * 0.6, hB * 1.33, -ew * 0.6, hB * 1.33, -ew, 0.01); g.closePath();
    g.globalAlpha = 1 - smoothstep(0.55, 1, o.cres);
    g.fillStyle = '#fdfdff'; g.fill();
    g.clip();
    // iris, pupil, light
    const ix = o.lookX * 0.045, iy = o.lookY * 0.032 - 0.004;
    const iris = g.createRadialGradient(ix, iy, 0.005, ix, iy, o.iris);
    iris.addColorStop(0, '#4a342c'); iris.addColorStop(0.55, '#2a1c19'); iris.addColorStop(1, '#14100f');
    g.fillStyle = iris; g.beginPath(); g.arc(ix, iy, o.iris, 0, TAU); g.fill();
    g.fillStyle = '#0a0809'; g.beginPath(); g.arc(ix, iy, o.iris * 0.55, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.96)';
    g.beginPath(); g.arc(ix + o.iris * 0.34, iy - o.iris * 0.38, o.iris * (0.3 + 0.12 * o.wet), 0, TAU); g.fill();
    g.beginPath(); g.arc(ix - o.iris * 0.38, iy + o.iris * 0.36, o.iris * (0.15 + 0.07 * o.wet), 0, TAU); g.fill();
    if (o.wet > 0.2) {
      g.fillStyle = `rgba(255,255,255,${0.9 * o.wet})`;
      g.beginPath(); g.arc(ix + o.iris * 0.62, iy + o.iris * 0.15, o.iris * 0.1, 0, TAU); g.fill();
      g.beginPath(); g.arc(ix - o.iris * 0.1, iy + o.iris * 0.6, o.iris * 0.09, 0, TAU); g.fill();
      // water sitting on the lower lid
      const lake = g.createLinearGradient(0, hB * 0.45, 0, hB * 1.2);
      lake.addColorStop(0, 'rgba(170,215,255,0)'); lake.addColorStop(1, `rgba(160,210,255,${0.6 * o.wet})`);
      g.fillStyle = lake; g.fillRect(-ew, hB * 0.45, ew * 2, hB);
    }
    // upper lid shadow
    const lid = g.createLinearGradient(0, -hT, 0, 0.03);
    lid.addColorStop(0, 'rgba(20,15,20,.35)'); lid.addColorStop(1, 'rgba(20,15,20,0)');
    g.fillStyle = lid; g.fillRect(-ew, -hT * 1.2, ew * 2, hT * 1.2 + 0.03);
    g.restore();
    // lash line
    g.globalAlpha = 1 - smoothstep(0.55, 1, o.cres);
    g.strokeStyle = INK; g.lineWidth = 0.034; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-ew * 1.02, 0.01); g.bezierCurveTo(-ew * 0.55, -hT * 1.33, ew * 0.55, -hT * 1.33, ew * 1.02, 0.01);
    g.stroke();
    g.globalAlpha = 1;
  }
  if (o.cres > 0.3) {
    g.globalAlpha = smoothstep(0.3, 0.8, o.cres);
    g.strokeStyle = INK; g.lineWidth = 0.05; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-ew * 1.05, 0.045); g.quadraticCurveTo(0, -0.2, ew * 1.05, 0.045); g.stroke();
    g.globalAlpha = 1;
  }
  g.restore();
}

function mouth(g, m) {
  const { w, yc, up, lo, k, skewL, skewR } = m;
  const cu = yc + up / 0.75, cl = yc + lo / 0.75;
  const path = () => {
    g.beginPath();
    g.moveTo(-w, yc + skewL);
    g.bezierCurveTo(-w * k, cu, w * k, cu, w, yc + skewR);
    g.bezierCurveTo(w * k, cl, -w * k, cl, -w, yc + skewL);
    g.closePath();
  };
  const gap = lo - up;
  if (gap > 0.025) {
    path();
    g.fillStyle = '#5c1a25'; g.fill();
    g.save(); path(); g.clip();
    if (m.teeth > 0.02) {
      g.globalAlpha = m.teeth; g.fillStyle = '#ffffff';
      g.fillRect(-w, yc + up - 0.12, w * 2, 0.12 + Math.min(gap * 0.5, 0.11)); g.globalAlpha = 1;
    }
    g.fillStyle = '#ec7a86';
    g.beginPath(); g.ellipse(0, yc + lo * 0.78 + 0.02, w * 0.55, Math.max(0.01, gap * 0.4), 0, 0, TAU); g.fill();
    g.restore();
    path();
  } else {
    g.beginPath(); g.moveTo(-w, yc + skewL); g.bezierCurveTo(-w * k, cu, w * k, cu, w, yc + skewR);
  }
  g.strokeStyle = '#8b3a34'; g.lineWidth = 0.034; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
  if (gap <= 0.025 && m.dimple > 0.02) {
    g.lineWidth = 0.02; g.globalAlpha = m.dimple;
    g.beginPath(); g.arc(-w - 0.01, yc + skewL - 0.005, 0.03, -0.9, 0.9); g.stroke();
    g.beginPath(); g.arc(w + 0.01, yc + skewR - 0.005, 0.03, PI - 0.9, PI + 0.9); g.stroke();
    g.globalAlpha = 1;
  }
}

function tears(g, st) {
  const { cry, time } = st;
  if (cry < 0.04) return;
  const streams = [[-1, 0, -0.42, 0.28, -0.52, 0.6, -0.47, 0.99], [-1, 1, -0.3, 0.28, -0.34, 0.62, -0.31, 1.03], [1, 0, 0.42, 0.28, 0.52, 0.6, 0.47, 0.99], [1, 1, 0.3, 0.28, 0.34, 0.62, 0.31, 1.03]];
  g.lineCap = 'round';
  streams.forEach(([side, idx, x0, y0, x1, y1, x2, y2], n) => {
    const reach = clamp(cry * 1.3 - idx * 0.6);
    if (reach <= 0.01) return;
    const at = u => {
      const v = 1 - u;
      return [v * v * x0 + 2 * v * u * x1 + u * u * x2, v * v * y0 + 2 * v * u * y1 + u * u * y2];
    };
    g.beginPath(); g.moveTo(x0, y0);
    for (let i = 1; i <= 16; i++) { const [x, y] = at(reach * i / 16); g.lineTo(x, y); }
    g.strokeStyle = 'rgba(140,200,245,.42)'; g.lineWidth = 0.04; g.stroke();
    g.strokeStyle = 'rgba(235,248,255,.8)'; g.lineWidth = 0.012;
    g.beginPath(); g.moveTo(x0 - side * 0.012, y0);
    for (let i = 1; i <= 16; i++) { const [x, y] = at(reach * i / 16); g.lineTo(x - side * 0.012, y); }
    g.stroke();
    // a drop runs down the track and falls off the chin
    const u = ((time * 0.5 + n * 0.37 + idx * 0.21) % 1) * 1.45;
    let bx, by;
    if (u <= reach) [bx, by] = at(u);
    else if (reach > 0.95 && u > 1) { [bx] = at(1); by = y2 + (u - 1) * (u - 1) * 3.2; } else return;
    const a = u > 1 ? 1 - (u - 1) / 0.45 : 1;
    g.globalAlpha = clamp(a);
    g.fillStyle = 'rgba(150,208,250,.92)';
    g.beginPath(); g.moveTo(bx, by - 0.07); g.quadraticCurveTo(bx + 0.055, by + 0.01, bx, by + 0.045); g.quadraticCurveTo(bx - 0.055, by + 0.01, bx, by - 0.07); g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(bx - 0.015, by + 0.008, 0.01, 0, TAU); g.fill();
    g.globalAlpha = 1;
  });
}

function star(g, x, y, r) {
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r, y);
  g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
}

function heart(g, x, y, r) {
  g.beginPath();
  g.moveTo(x, y + r * 0.9);
  g.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.7, y - r * 1.2, x, y - r * 0.4);
  g.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.5, y - r * 0.1, x, y + r * 0.9);
  g.fill();
}

// ------------------------------------------------------------------ head
export function drawHead(g, st) {
  const { sad, joy, shock, time } = st;

  // ears
  for (const s of [-1, 1]) {
    g.fillStyle = SKIN.shade;
    g.beginPath(); g.ellipse(s * 0.865, 0.15, 0.13, 0.22, s * 0.12, 0, TAU); g.fill();
    g.fillStyle = 'rgba(205,125,95,.55)';
    g.beginPath(); g.ellipse(s * 0.87, 0.17, 0.06, 0.12, s * 0.12, 0, TAU); g.fill();
  }

  // face
  facePath(g);
  const skin = g.createRadialGradient(-0.25, -0.35, 0.05, 0, 0.1, 1.4);
  skin.addColorStop(0, SKIN.light); skin.addColorStop(0.5, SKIN.base); skin.addColorStop(1, '#e5b08c');
  g.fillStyle = skin; g.fill();

  g.save(); facePath(g); g.clip();
  // jaw shade
  const jaw = g.createLinearGradient(0, 0.45, 0, 1.05);
  jaw.addColorStop(0, 'rgba(190,115,80,0)'); jaw.addColorStop(1, 'rgba(190,115,80,.2)');
  g.fillStyle = jaw; g.fillRect(-1, 0.45, 2, 0.7);
  // shadow cast by the hair on the forehead
  const cast = st.hairShadow;
  if (cast > 0.02) {
    const sh = g.createLinearGradient(0, -0.62, 0, -0.08);
    sh.addColorStop(0, `rgba(120,70,60,${0.34 * cast})`); sh.addColorStop(1, 'rgba(120,70,60,0)');
    g.fillStyle = sh; g.fillRect(-1, -0.66, 2, 0.6);
  }
  // cheeks: rosy when happy, drained when sad
  const blush = clamp(0.2 + 0.5 * joy + 0.3 * st.enjoy - 0.2 * sad - 0.1 * shock);
  if (blush > 0.02) {
    for (const s of [-1, 1]) {
      const b = g.createRadialGradient(s * 0.5, 0.45, 0, s * 0.5, 0.45, 0.22);
      b.addColorStop(0, `rgba(247,125,125,${0.5 * blush})`); b.addColorStop(1, 'rgba(247,125,125,0)');
      g.fillStyle = b; g.beginPath(); g.ellipse(s * 0.5, 0.45, 0.22, 0.14, 0, 0, TAU); g.fill();
    }
  }
  const pale = sad * 0.28 + shock * 0.12;
  if (pale > 0.01) { g.fillStyle = `rgba(228,236,255,${pale})`; g.fillRect(-1, -1, 2, 2.2); }
  if (sad > 0.35) {
    g.fillStyle = `rgba(120,130,190,${0.16 * (sad - 0.35)})`;
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 0.38, 0.33, 0.24, 0.05, 0, 0, TAU); g.fill(); }
  }
  // bald dome: a soft gloss and a couple of glints
  const shine = st.shine;
  if (shine > 0.02) {
    const gloss = g.createRadialGradient(-0.3, -0.76, 0, -0.3, -0.76, 0.4);
    gloss.addColorStop(0, `rgba(255,255,255,${0.85 * shine})`); gloss.addColorStop(0.45, `rgba(255,248,238,${0.4 * shine})`); gloss.addColorStop(1, 'rgba(255,248,238,0)');
    g.fillStyle = gloss; g.beginPath(); g.ellipse(-0.3, -0.76, 0.46, 0.25, -0.5, 0, TAU); g.fill();
    g.strokeStyle = `rgba(255,255,255,${0.5 * shine})`; g.lineWidth = 0.03; g.lineCap = 'round';
    g.beginPath(); g.arc(0, -0.05, 0.88, -2.25, -1.55); g.stroke();
    const tw = 0.5 + 0.5 * Math.sin(time * 2.3);
    g.fillStyle = `rgba(255,255,255,${shine * (0.65 + 0.35 * tw)})`;
    star(g, -0.42, -0.84, 0.08 + 0.06 * tw);
    star(g, 0.3, -0.9, 0.05 + 0.03 * (1 - tw));
  }
  g.restore();

  // nose
  g.strokeStyle = 'rgba(190,115,88,.6)'; g.lineWidth = 0.028; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-0.06, 0.37); g.quadraticCurveTo(0, 0.42, 0.06, 0.37); g.stroke();
  g.fillStyle = 'rgba(205,140,110,.3)';
  g.beginPath(); g.ellipse(0.075, 0.26, 0.032, 0.1, 0.12, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)';
  g.beginPath(); g.ellipse(-0.012, 0.325, 0.032, 0.02, 0, 0, TAU); g.fill();

  // eyes behind the lenses
  const ex = 0.37, ey = 0.06;
  const eo = {
    open: st.eyeOpen, cres: st.cres, tilt: 0.2 * sad, lookX: st.lookX, lookY: st.lookY, wet: st.wet,
    iris: 0.088 * (1 - 0.14 * sad - 0.38 * shock) + 0.008 * st.wet,
  };
  eye(g, -ex, ey, -1, eo);
  eye(g, ex, ey, 1, eo);

  // glasses
  const lensX = 0.37, hw = 0.285, hh = 0.2;
  for (const s of [-1, 1]) {
    g.beginPath(); rrect(g, s * lensX - hw, ey - hh, hw * 2, hh * 2, 0.085);
    g.fillStyle = 'rgba(170,205,245,.1)'; g.fill();
    g.save(); g.clip();
    g.fillStyle = 'rgba(255,255,255,.16)';
    g.beginPath(); g.moveTo(s * lensX - 0.24, ey + 0.2); g.lineTo(s * lensX - 0.04, ey - 0.2); g.lineTo(s * lensX + 0.05, ey - 0.2); g.lineTo(s * lensX - 0.15, ey + 0.2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.09)';
    g.beginPath(); g.moveTo(s * lensX - 0.03, ey + 0.2); g.lineTo(s * lensX + 0.17, ey - 0.2); g.lineTo(s * lensX + 0.2, ey - 0.2); g.lineTo(s * lensX + 0.0, ey + 0.2); g.fill();
    if (st.glint >= 0) {
      const gx = lerp(-0.4, 0.4, st.glint);
      const band = g.createLinearGradient(s * lensX + gx - 0.1, 0, s * lensX + gx + 0.1, 0);
      band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(0.5, `rgba(255,255,255,${0.8 * Math.sin(PI * st.glint)})`); band.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = band; g.fillRect(s * lensX - hw, ey - hh, hw * 2, hh * 2);
    }
    g.restore();
    g.beginPath(); rrect(g, s * lensX - hw, ey - hh, hw * 2, hh * 2, 0.085);
    g.strokeStyle = INK; g.lineWidth = 0.05; g.lineJoin = 'round'; g.stroke();
    g.beginPath(); g.moveTo(s * lensX - hw + 0.05, ey - hh); g.lineTo(s * lensX + hw - 0.05, ey - hh);
    g.lineWidth = 0.075; g.lineCap = 'round'; g.stroke();
    g.lineWidth = 0.04;
    g.beginPath(); g.moveTo(s * (lensX + hw), ey - hh + 0.06); g.lineTo(s * 0.86, ey - hh + 0.1); g.stroke();
  }
  g.lineWidth = 0.045; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-0.085, ey - 0.07); g.quadraticCurveTo(0, ey - 0.13, 0.085, ey - 0.07); g.stroke();
  if (st.glint > 0.35 && st.glint < 0.8) {
    g.fillStyle = `rgba(255,255,255,${Math.sin(PI * st.glint)})`;
    star(g, lensX + hw - 0.07, ey - hh + 0.06, 0.07 * Math.sin(PI * st.glint) + 0.02);
  }

  // brows
  const t = 0.03 + 0.008 * st.browThick;
  brow(g, -1, st.browIn, st.browOut, st.browArch, t);
  brow(g, 1, st.browIn, st.browOut, st.browArch, t);

  // mouth
  mouth(g, st.mouth);

  tears(g, st);

  // a drop of cold sweat
  if (st.sweat > 0.03) {
    const sx = 0.66, sy = -0.36 + (1 - st.sweat) * -0.05 + Math.sin(time * 2.2) * 0.012;
    g.globalAlpha = clamp(st.sweat * 1.4);
    g.fillStyle = 'rgba(160,212,250,.95)';
    g.beginPath(); g.moveTo(sx, sy - 0.12); g.quadraticCurveTo(sx + 0.085, sy + 0.04, sx, sy + 0.08); g.quadraticCurveTo(sx - 0.085, sy + 0.04, sx, sy - 0.12); g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(sx - 0.026, sy + 0.025, 0.013, 0.025, 0.3, 0, TAU); g.fill();
    g.globalAlpha = 1;
  }

  // the hairline's dark underlay (fades as the hair thins out)
  if (st.cap > 0.01) {
    g.beginPath();
    g.moveTo(-0.9, 0.02);
    g.bezierCurveTo(-0.96, -0.62, -0.6, -1.045, 0, -1.045);
    g.bezierCurveTo(0.6, -1.045, 0.96, -0.62, 0.9, 0.02);
    g.lineTo(0.84, -0.04);
    g.quadraticCurveTo(0.78, -0.4, 0.5, -0.52);
    g.quadraticCurveTo(0.25, -0.6, 0, -0.58);
    g.quadraticCurveTo(-0.25, -0.6, -0.5, -0.52);
    g.quadraticCurveTo(-0.78, -0.4, -0.84, -0.04);
    g.closePath();
    g.globalAlpha = st.cap; g.fillStyle = '#0e1017'; g.fill(); g.globalAlpha = 1;
  }
}

/** Mood → every facial parameter. `s` is the sim state, `out` receives the numbers `drawHead` reads. */
export function poseFace(s, out) {
  const { mood, shock, enjoy, careful, wry, blink, sigh, time } = s;
  const joy = clamp(mood), sad = clamp(-mood);
  const mm = lerp(lerp(mood, 0.5, enjoy), -0.3, careful);
  out.joy = clamp(Math.max(joy, enjoy * 0.9)); out.sad = clamp(sad * (1 - enjoy) + careful * 0.35); out.shock = shock;
  out.enjoy = enjoy; out.faceMood = mm; out.mood = mood;
  out.cry = smoothstep(0.3, 0.75, out.sad);
  out.cres = smoothstep(0.34, 0.82, out.joy);
  out.wet = clamp(out.sad * 1.5 - 0.15 + careful * 0.3);
  out.eyeOpen = (1 - 0.14 * out.sad + 0.5 * shock - 0.12 * careful) * (1 - blink * 0.96);
  out.lookX = s.lookX; out.lookY = s.lookY;
  out.browIn = -0.255 - 0.15 * out.sad - 0.045 * out.joy - 0.13 * shock - 0.06 * careful;
  out.browOut = -0.285 + 0.1 * out.sad - 0.05 * out.joy - 0.1 * shock + 0.02 * careful;
  out.browArch = 0.01 + 0.05 * out.joy + 0.02 * shock;
  out.browThick = 1 - 0.5 * out.sad;
  out.sweat = clamp((out.sad - 0.4) * 1.6 + careful * 0.5);
  out.glint = s.glint;

  const [w, yc, up, lo, k] = keyed(MOUTH, clamp(mm, -1, 1));
  const mo = out.mouth || (out.mouth = {});
  const so = smoothstep(0.08, 0.7, shock);
  const quiver = out.cry * 0.014 * Math.sin(time * 15);
  mo.w = lerp(w * (1 - 0.18 * careful) * (1 + 0.1 * sigh), 0.085, so);
  mo.yc = lerp(yc, 0.64, so);
  mo.up = lerp(up - 0.02 * careful, -0.11, so);
  mo.lo = lerp(lo + quiver + 0.06 * sigh, 0.13, so);
  mo.k = lerp(k, 1.25, so);
  const wr = wry * (1 - so);
  mo.skewL = 0.035 * wr; mo.skewR = -0.05 * wr;
  mo.lo -= 0.09 * wr; mo.up -= 0.0 * wr;
  mo.teeth = smoothstep(0.35, 0.9, mm) * (1 - so);
  mo.dimple = smoothstep(0.1, 0.4, mm) * 0.8 * (1 - smoothstep(0.7, 1, mm));
}

// ------------------------------------------------------------------ effects around the head
export function drawFx(g, st) {
  const { time } = st;
  // rain cloud over a sad head
  if (st.cloud > 0.02) {
    const a = st.cloud, cx = 0.45 + Math.sin(time * 0.6) * 0.06, cy = -2.0 + Math.sin(time * 0.9) * 0.025;
    g.save(); g.globalAlpha = a;
    const puff = (x, y, r, c0, c1) => {
      const q = g.createRadialGradient(x, y - r * 0.3, 0, x, y, r);
      q.addColorStop(0, c0); q.addColorStop(1, c1);
      g.fillStyle = q; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    };
    puff(cx - 0.34, cy + 0.06, 0.2, '#d3dbe6', '#a9b5c6'); puff(cx + 0.34, cy + 0.06, 0.2, '#cfd8e3', '#a4b0c2');
    puff(cx - 0.12, cy - 0.08, 0.28, '#dfe6ee', '#b2bdcc'); puff(cx + 0.15, cy - 0.02, 0.25, '#dae2ec', '#aeb9ca');
    g.fillStyle = '#b8c3d2'; g.beginPath(); g.ellipse(cx, cy + 0.17, 0.5, 0.1, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(115,155,210,.8)'; g.lineWidth = 0.028; g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const u = (time * 1.15 + i * 0.37) % 1, x = cx - 0.34 + i * 0.17 - u * 0.05, y0 = cy + 0.26, y1 = -1.12 + (i % 2) * 0.02;
      const y = lerp(y0, y1, u);
      if (u < 0.92) { g.beginPath(); g.moveTo(x, y); g.lineTo(x - 0.02, y + 0.09); g.stroke(); }
      else { g.globalAlpha = a * (1 - (u - 0.92) / 0.08); g.beginPath(); g.ellipse(x, y1, 0.05 + (u - 0.92) * 0.6, 0.015, 0, 0, TAU); g.stroke(); g.globalAlpha = a; }
    }
    g.restore();
  }
  // sparkles and hearts around a happy head
  if (st.mood > 0.45) {
    const a = smoothstep(0.45, 0.95, st.mood);
    const items = [[-1.55, -1.0, 0, 0.1], [1.5, -1.25, 1, 0.12], [-1.0, -1.75, 1, 0.09], [1.85, -0.4, 0, 0.08], [0.45, -1.95, 0, 0.11], [-1.9, -0.25, 1, 0.07]];
    items.forEach(([x, y, kind, r], i) => {
      const ph = time * 2.1 + i * 1.7, pulse = 0.6 + 0.4 * Math.sin(ph);
      g.globalAlpha = a * (0.45 + 0.55 * pulse);
      const yy = y - 0.05 * Math.sin(time * 1.3 + i);
      if (kind === 0) { g.fillStyle = '#ffd25c'; star(g, x, yy, r * (0.7 + 0.5 * pulse) * 1.6); g.fillStyle = '#fff2b8'; star(g, x, yy, r * 0.6); }
      else { g.fillStyle = '#ff8fab'; heart(g, x, yy, r * (0.75 + 0.35 * pulse) * 1.2); }
    });
    g.globalAlpha = 1;
  }
  // a sigh of relief (or resignation): soft puffs drifting away from the mouth
  if (st.sigh > 0.03) {
    const u = st.sighT;
    for (let i = 0; i < 3; i++) {
      const v = clamp(u * 1.3 - i * 0.16);
      if (v <= 0) continue;
      const x = 0.12 + v * 0.62 + i * 0.1, y = 0.74 + v * 0.22 - i * 0.03, r = 0.07 + v * 0.1 + i * 0.03, a = (1 - v) * (0.55 + 0.25 * st.sighTone);
      g.fillStyle = `rgba(205,220,240,${a})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = `rgba(255,255,255,${a * 0.9})`; g.beginPath(); g.arc(x - r * 0.2, y - r * 0.2, r * 0.7, 0, TAU); g.fill();
    }
  }
}
