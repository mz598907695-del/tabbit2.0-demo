import { clamp, lerp } from './gl-utils.js';
import { D2R } from './airplane-kit.js';
import { mulberry32 } from './canvas-kit.js';

// The starboard wing seen from a window over its rear half. The wing is modelled in metres in the
// aircraft frame (X outward from the window, Y up, Z aft = image right) and projected with the same
// pinhole as the world shader, so rivet rows, panel lines, flaps and spoilers all keep true perspective.
const X0 = 1.7, SPAN = 15.5, SWEEP = Math.tan(24 * D2R), Z0 = -6.4, C_ROOT = 5.8, C_TIP = 1.5, Y0 = -2.9, DIHEDRAL = .07;
const S_MIN = .02;
const SPOILERS = [[.12, .225], [.23, .335], [.34, .445], [.45, .55], [.555, .65], [.68, .765], [.77, .86]];
const FLAP_SPAN = [.12, .57], AILERON = [.66, .97];
const SPOILER_C = [.6, .79], FLAP_C = .79;

// faint exhaust and oil streaks running chordwise, fixed on the skin
const rand = mulberry32(88);
const STREAKS = Array.from({ length: 54 }, () => ({ s: .06 + rand() * .9, c0: .3 + rand() * .45, c1: .75 + rand() * .25, drift: (rand() - .5) * .02, group: Math.floor(rand() * 3) }));

let PX = 0, PY = 0, CX = 0, CY = 0, FOC = 1, FLEX = 0;
function proj(s, c, dz = 0, dy = 0, dx = 0) {
  const sm = s * SPAN, depth = X0 + sm + dx;
  const Z = Z0 + sm * SWEEP + c * (C_ROOT + (C_TIP - C_ROOT) * s) + dz;
  const Y = Y0 + DIHEDRAL * sm + FLEX * s * s + dy;
  PX = CX + FOC * Z / depth; PY = CY - FOC * Y / depth;
}
const scale = s => FOC / (X0 + s * SPAN);   // px per metre at span fraction s
function at(s, c, dz, dy) { proj(s, c, dz, dy); return [PX, PY]; }
const rgbaOf = (c, a) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

function quad(g, sa, sb, c0, c1, dz1 = 0, dy1 = 0, n = 1) {
  g.beginPath();
  proj(sa, c0); g.moveTo(PX, PY);
  for (let i = 1; i <= n; i++) { proj(lerp(sa, sb, i / n), c0); g.lineTo(PX, PY); }
  for (let i = n; i >= 0; i--) { proj(lerp(sa, sb, i / n), c1, dz1, dy1); g.lineTo(PX, PY); }
  g.closePath();
}
function line(g, sa, sb, c0, c1) {
  proj(sa, c0); g.moveTo(PX, PY); proj(sb, c1); g.lineTo(PX, PY);
}

function rivets(g, c, sa, sb, px = 8) {
  let s = sa, count = 0;
  while (s < sb && count++ < 260) {
    proj(s, c);
    const x = PX, y = PY;
    proj(s + .003, c);
    const speed = Math.hypot(PX - x, PY - y) / .003;
    const r = clamp(scale(s) * .02, .45, 1.7);
    if (x > CX - 800 && x < CX + 800 && y > CY - 800 && y < CY + 800) g.rect(x - r, y - r * .8, r * 2, r * 1.6);
    s += clamp(px / Math.max(speed, 1), .002, .06);
  }
}

/**
 * v: { cx, cy, F, flex, flap, spoiler, time, albedo(k) → css colour, glow: [r,g,b] panel light }
 * Draws into the (already clipped) glass area.
 */
export function drawWing(g, v) {
  CX = v.cx; CY = v.cy; FOC = v.F; FLEX = v.flex;
  const { flap, spoiler } = v;
  const sp = spoiler * 52 * D2R;
  const lit = (k, a = 1) => v.paint(k, a);

  // ---- skin ----
  const body = g.createLinearGradient(...at(.6, 0), ...at(.6, 1));
  body.addColorStop(0, lit(1.06)); body.addColorStop(.45, lit(1)); body.addColorStop(1, lit(.86));
  g.fillStyle = body;
  quad(g, S_MIN, 1, 0, 1, 0, 0, 12); g.fill();
  // satin sheen sliding along the leading half, and distance haze towards the tip
  if (v.sheen > .02) {
    const sheen = g.createLinearGradient(...at(.5, 0), ...at(.5, .5));
    sheen.addColorStop(0, rgbaOf(v.sheenColor, .5 * v.sheen)); sheen.addColorStop(1, rgbaOf(v.sheenColor, 0));
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = sheen; quad(g, S_MIN, 1, 0, .5, 0, 0, 10); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
  const haze = g.createLinearGradient(...at(.3, .5), ...at(1, .5));
  haze.addColorStop(0, rgbaOf(v.hazeColor, 0)); haze.addColorStop(1, rgbaOf(v.hazeColor, .22));
  g.fillStyle = haze; quad(g, S_MIN, 1, 0, 1, 0, 0, 12); g.fill();

  // slats along the leading edge, tinted slightly differently from the main box
  const slat = v.slat;
  if (slat > .02) {
    g.fillStyle = 'rgba(8,10,16,.55)';
    quad(g, S_MIN, 1, .085 - .012, .115, 0, 0, 10); g.fill();
    g.fillStyle = lit(1.1);
    quad(g, S_MIN, 1, -.035 * slat, .085 - .012, -.1 * slat, -.04 * slat, 10); g.fill();
  }
  g.fillStyle = lit(.97, .65);
  quad(g, S_MIN, 1, 0, .1, 0, 0, 10); g.fill();

  // non-slip walkway
  g.fillStyle = lit(.2, .55);
  quad(g, .035, .3, .32, .4, 0, 0, 4); g.fill();

  // spoilers
  for (let i = 0; i < SPOILERS.length; i++) {
    const [sa, sb] = SPOILERS[i];
    const chord = lerp(C_ROOT, C_TIP, (sa + sb) / 2);
    const len = (SPOILER_C[1] - SPOILER_C[0]) * chord;
    if (sp > .03) {
      // dark gap behind the raised plate
      g.fillStyle = 'rgba(6,8,12,.82)';
      quad(g, sa, sb, SPOILER_C[1] - .03, SPOILER_C[1] + .02, 0, 0); g.fill();
      g.fillStyle = lit(1.12);
      quad(g, sa, sb, SPOILER_C[0], SPOILER_C[1], -len * (1 - Math.cos(sp)), len * Math.sin(sp), 1); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1;
      g.beginPath(); proj(sa, SPOILER_C[1], -len * (1 - Math.cos(sp)), len * Math.sin(sp)); g.moveTo(PX, PY);
      proj(sb, SPOILER_C[1], -len * (1 - Math.cos(sp)), len * Math.sin(sp)); g.lineTo(PX, PY); g.stroke();
    } else if (i % 2 === 0) {
      g.fillStyle = lit(.985, .5);
      quad(g, sa, sb, SPOILER_C[0], SPOILER_C[1]); g.fill();
    }
  }

  // inboard flap: slides aft and droops, leaving a dark slot behind the spoilers
  const chordF = lerp(C_ROOT, C_TIP, (FLAP_SPAN[0] + FLAP_SPAN[1]) / 2);
  const dzF = chordF * .24 * flap, dyF = -chordF * .12 * flap;
  if (flap > .02) {
    g.fillStyle = 'rgba(6,8,12,.8)';
    quad(g, FLAP_SPAN[0], FLAP_SPAN[1], FLAP_C - .01, FLAP_C + .05, 0, 0); g.fill();
  }
  const flapGrad = g.createLinearGradient(...at(.35, FLAP_C), ...at(.35, 1, dzF, dyF));
  flapGrad.addColorStop(0, lit(.96)); flapGrad.addColorStop(1, lit(.8));
  g.fillStyle = flapGrad;
  quad(g, FLAP_SPAN[0], FLAP_SPAN[1], FLAP_C + .05 * flap, 1, dzF, dyF, 4); g.fill();
  // aileron and flaperon
  g.fillStyle = lit(.94, .8);
  quad(g, AILERON[0], AILERON[1], FLAP_C, 1, 0, 0, 3); g.fill();
  quad(g, .575, .655, FLAP_C, 1, dzF * .5, dyF * .5, 1); g.fill();

  // streaks
  g.lineWidth = 1.2;
  for (let grp = 0; grp < 3; grp++) {
    g.strokeStyle = `rgba(34,38,48,${.035 + grp * .025})`;
    g.beginPath();
    for (const k of STREAKS) if (k.group === grp) { proj(k.s, k.c0); g.moveTo(PX, PY); proj(k.s + k.drift, k.c1); g.lineTo(PX, PY); }
    g.stroke();
  }

  // panel seams
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(30,36,48,.55)';
  g.lineWidth = 1;
  g.beginPath();
  for (const c of [.1, .38, SPOILER_C[0]]) { proj(S_MIN, c); g.moveTo(PX, PY); for (let i = 1; i <= 10; i++) { proj(lerp(S_MIN, 1, i / 10), c); g.lineTo(PX, PY); } }
  for (const [sa, sb] of SPOILERS) { line(g, sa, sa, SPOILER_C[0], SPOILER_C[1]); line(g, sb, sb, SPOILER_C[0], SPOILER_C[1]); }
  for (const s of [.5, .72, .88]) line(g, s, s, .1, SPOILER_C[0]);
  for (const s of [AILERON[0], AILERON[1], FLAP_SPAN[0], FLAP_SPAN[1]]) line(g, s, s, FLAP_C, 1);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1;
  g.beginPath();
  for (const c of [.1, .38]) { proj(S_MIN, c + .006); g.moveTo(PX, PY); for (let i = 1; i <= 10; i++) { proj(lerp(S_MIN, 1, i / 10), c + .006); g.lineTo(PX, PY); } }
  g.stroke();
  g.strokeStyle = 'rgba(8,10,16,.7)'; g.lineWidth = 1.3;
  g.beginPath();
  proj(S_MIN, SPOILER_C[1]); g.moveTo(PX, PY); for (let i = 1; i <= 10; i++) { proj(lerp(S_MIN, 1, i / 10), SPOILER_C[1]); g.lineTo(PX, PY); }
  g.stroke();

  // rivets
  g.fillStyle = 'rgba(30,36,50,.38)';
  g.beginPath();
  rivets(g, .108, S_MIN, 1); rivets(g, .372, S_MIN, 1); rivets(g, SPOILER_C[0] - .014, S_MIN, 1); rivets(g, .93, S_MIN, 1);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.3)';
  g.beginPath();
  rivets(g, .114, S_MIN, 1); rivets(g, .378, S_MIN, 1);
  g.fill();

  // bright rim on the leading edge
  g.strokeStyle = lit(1.25, .9); g.lineWidth = 1.6;
  g.beginPath(); proj(S_MIN, 0); g.moveTo(PX, PY); for (let i = 1; i <= 12; i++) { proj(lerp(S_MIN, 1, i / 12), 0); g.lineTo(PX, PY); } g.stroke();

  // ---- winglet: a swept blade standing on the tip, canted outwards. [Z aft of the tip leading edge, height, outward] ----
  const pt = (z, y, x) => { proj(1, 0, z, y, x); return [PX, PY]; };
  const root = pt(.08, 0, 0), ctrl = pt(.02, 1.15, .12), top = pt(.95, 1.85, .34), tip2 = pt(1.18, 1.78, .34), ctrl2 = pt(1.42, .95, .18), root2 = pt(1.36, 0, 0);
  g.beginPath();
  g.moveTo(root[0], root[1]); g.quadraticCurveTo(ctrl[0], ctrl[1], top[0], top[1]);
  g.lineTo(tip2[0], tip2[1]); g.quadraticCurveTo(ctrl2[0], ctrl2[1], root2[0], root2[1]);
  g.closePath();
  const wl = g.createLinearGradient(root[0], root[1], top[0], top[1]);
  wl.addColorStop(0, lit(.92)); wl.addColorStop(1, lit(1.2));
  g.fillStyle = wl; g.fill();
  g.strokeStyle = 'rgba(30,36,48,.5)'; g.lineWidth = 1; g.stroke();
  g.strokeStyle = lit(1.3, .8); g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(root[0], root[1]); g.quadraticCurveTo(ctrl[0], ctrl[1], top[0], top[1]); g.stroke();
  return { nav: top, strobe: tip2, px: scale(1) };
}

/** Traces the skin outline of the wing drawn last (for clipping light washes to it). */
export function wingPath(g) {
  g.beginPath();
  proj(S_MIN, 0); g.moveTo(PX, PY);
  for (let i = 1; i <= 12; i++) { proj(lerp(S_MIN, 1, i / 12), 0); g.lineTo(PX, PY); }
  for (let i = 12; i >= 0; i--) { proj(lerp(S_MIN, 1, i / 12), 1); g.lineTo(PX, PY); }
  g.closePath();
}
