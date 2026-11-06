import { clamp, lerp, smoothstep } from './gl-utils.js';

// Season maths for the Suzhou garden wallpaper. Scroll progress p walks one full year,
// starting at the spring equinox (p = 0 = 春分) and arriving at it again at p = 1, so
// every curve here is periodic: its value at 0 equals its value at 1.
export const TAU = Math.PI * 2;

export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const rgba = (c, a = 1) => `rgba(${c[0] < 0 ? 0 : c[0] > 255 ? 255 : c[0] | 0},${c[1] < 0 ? 0 : c[1] > 255 ? 255 : c[1] | 0},${c[2] < 0 ? 0 : c[2] > 255 ? 255 : c[2] | 0},${a < 0 ? 0 : a > 1 ? 1 : +a.toFixed(3)})`;
export const shade = (c, k) => k <= 1 ? [c[0] * k, c[1] * k, c[2] * k] : mix3(c, [255, 250, 226], Math.min(1, k - 1));

/** Smooth piecewise curve through [x, value] points (smoothstep between neighbours). */
export function curve(p, pts) {
  if (p <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (p <= pts[i][0]) {
      const [x0, v0] = pts[i - 1], [x1, v1] = pts[i];
      const t = (p - x0) / (x1 - x0);
      return v0 + (v1 - v0) * t * t * (3 - 2 * t);
    }
  }
  return pts[pts.length - 1][1];
}

/** Periodic interpolation through values given at i/n of the year (numbers or [r,g,b]). */
export function cyc(p, keys) {
  const n = keys.length, x = ((p % 1) + 1) % 1 * n, i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f);
  const a = keys[i % n], b = keys[(i + 1) % n];
  return typeof a === 'number' ? lerp(a, b, s) : mix3(a, b, s);
}

/** Weights of spring / summer / autumn / winter (sum to 1), each peaking at its own key. */
export function seasonWeights(p) {
  const w = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) {
    const d = Math.abs((((p - k / 4 + 0.5) % 1) + 1) % 1 - 0.5);
    const t = clamp(1 - d * 4);
    w[k] = t * t * (3 - 2 * t);
  }
  return w;
}

// ---- Solar terms ------------------------------------------------------------------
export const TERMS = ['立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
  '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒'];
/** First of the three pentads (候) of each term. */
export const PENTADS = ['东风解冻', '獭祭鱼', '桃始华', '玄鸟至', '桐始华', '萍始生', '蝼蝈鸣', '苦菜秀', '螳螂生', '鹿角解', '温风至', '腐草为萤',
  '凉风至', '鹰乃祭鸟', '鸿雁来', '雷始收声', '鸿雁来宾', '豺乃祭兽', '水始冰', '虹藏不见', '鹖鴠不鸣', '蚯蚓结', '雁北乡', '鸡始乳'];
export const MONTHS = ['孟春', '孟春', '仲春', '仲春', '季春', '季春', '孟夏', '孟夏', '仲夏', '仲夏', '季夏', '季夏',
  '孟秋', '孟秋', '仲秋', '仲秋', '季秋', '季秋', '孟冬', '孟冬', '仲冬', '仲冬', '季冬', '季冬'];
export const SEASON_CHARS = ['春', '夏', '秋', '冬'];
export const TERM_CHARS = [...new Set([...TERMS.join(''), ...PENTADS.join(''), ...MONTHS.join(''), '时节春夏秋冬·'])].join('');
/** Index into TERMS for scroll step k (0..24): starts at 春分 and returns to it. */
export const termIndex = k => (3 + k) % 24;

/** Solar terms to show at p with their opacity; fades are short and sit on the boundaries. */
export function termWeights(p) {
  const x = clamp(p, 0, 1) * 24, out = [];
  // the fade ends exactly on the boundary, so at p = k/24 the new term stands alone
  const edge = k => k <= 0 ? [-2, -1] : [k - 0.24, k];
  for (let k = Math.max(0, Math.floor(x) - 1); k <= Math.min(24, Math.floor(x) + 1); k++) {
    const [a0, a1] = edge(k), [b0, b1] = k >= 24 ? [99, 100] : edge(k + 1);
    const w = smoothstep(a0, a1, x) * (1 - smoothstep(b0, b1, x));
    if (w > 0.003) out.push({ k, index: termIndex(k), w });
  }
  return out;
}

// ---- Seasonal state ------------------------------------------------------------------
const SKY_TOP = [[116, 170, 214], [92, 164, 218], [122, 168, 206], [128, 142, 160]];
const SKY_MID = [[178, 210, 232], [152, 202, 234], [232, 210, 182], [176, 186, 198]];
const SKY_HOR = [[244, 230, 230], [222, 238, 242], [248, 196, 152], [214, 218, 224]];
const MOUNT_FAR = [[124, 158, 178], [110, 160, 184], [164, 142, 144], [142, 156, 172]];
const MOUNT_NEAR = [[84, 124, 134], [62, 116, 116], [130, 98, 88], [102, 118, 134]];
const WATER_TOP = [[140, 194, 188], [106, 176, 158], [226, 198, 152], [148, 168, 184]];
const WATER_BOT = [[70, 134, 128], [28, 100, 88], [98, 116, 98], [84, 108, 130]];
const GRADE = [[255, 248, 249], [255, 255, 247], [255, 240, 218], [226, 234, 246]];
const LIGHT = [[255, 220, 212], [255, 236, 176], [255, 198, 128], [206, 224, 255]];
const MIST = [[242, 238, 240], [232, 245, 244], [248, 226, 196], [214, 220, 228]];
const SUN = [[255, 238, 226], [255, 252, 236], [255, 186, 112], [248, 250, 252]];
const GRASS = [[132, 176, 98], [74, 134, 76], [176, 156, 86], [150, 150, 130]];

export function seasonState(p) {
  const sw = seasonWeights(p);
  const snow = curve(p, [[0, 0], [0.58, 0], [0.72, 1], [0.83, 1], [0.93, 0], [1, 0]]);
  return {
    p, sw, snow,
    ice: curve(p, [[0, 0], [0.62, 0], [0.7, 1], [0.84, 1], [0.92, 0], [1, 0]]),
    snowfall: curve(p, [[0, 0], [0.58, 0], [0.64, 0.8], [0.7, 1], [0.78, 0.8], [0.86, 0.3], [0.93, 0], [1, 0]]),
    // blossoms on the big tree: full at the equinox, gone by early summer, back before p = 1
    bloom: curve(p, [[0, 1], [0.035, 1], [0.13, 0], [0.86, 0], [0.965, 1], [1, 1]]),
    // leaf level: tender at p = 0, full through summer, shed from the autumn equinox on
    leaf: curve(p, [[0, 0.5], [0.12, 1], [0.44, 1], [0.665, 0], [0.9, 0], [1, 0.5]]),
    // position along the leaf colour ramp (pale green .. deep green .. gold .. crimson)
    col: curve(p, [[0, 0.04], [0.1, 0.14], [0.2, 0.3], [0.3, 0.4], [0.38, 0.44], [0.46, 0.7], [0.52, 0.8], [0.6, 0.93], [0.68, 1], [0.8, 1], [0.9, 0], [1, 0.04]]),
    plum: curve(p, [[0, 0], [0.54, 0], [0.64, 0.4], [0.72, 0.95], [0.82, 1], [0.9, 0.55], [0.96, 0], [1, 0]]),
    lotus: curve(p, [[0, 0.2], [0.08, 0.42], [0.16, 0.86], [0.24, 1], [0.38, 1], [0.46, 0.84], [0.54, 0.6], [0.62, 0.36], [0.7, 0], [0.88, 0], [0.94, 0.1], [1, 0.2]]),
    wither: curve(p, [[0, 0], [0.34, 0], [0.5, 0.8], [0.6, 1], [0.88, 1], [0.9, 0], [1, 0]]),
    lotusFlower: curve(p, [[0.1, 0], [0.18, 0.7], [0.25, 1], [0.33, 0.85], [0.4, 0], [1, 0]]),
    deadLotus: curve(p, [[0.4, 0], [0.52, 1], [0.66, 1], [0.72, 0.25], [0.78, 0], [1, 0]]),
    petalsOnWater: curve(p, [[0, 0.35], [0.06, 0.9], [0.14, 1], [0.22, 0.4], [0.3, 0], [0.9, 0], [0.97, 0.2], [1, 0.35]]),
    leavesOnWater: curve(p, [[0.44, 0], [0.54, 0.7], [0.62, 1], [0.68, 0.6], [0.74, 0], [1, 0]]),
    petalDrift: curve(p, [[0, 0.8], [0.05, 1], [0.14, 0.35], [0.2, 0], [0.9, 0], [0.96, 0.45], [1, 0.8]]),
    leafDrift: curve(p, [[0.4, 0], [0.5, 0.8], [0.58, 1], [0.66, 0.4], [0.72, 0], [1, 0]]),
    mist: cyc(p, [0.46, 0.16, 0.26, 0.5]),
    cloud: cyc(p, [0.5, 0.82, 0.38, 0.9]),
    warm: curve(p, [[0.3, 0], [0.42, 0.5], [0.5, 1], [0.6, 0.7], [0.7, 0], [1, 0]]),
    sunVis: cyc(p, [0.5, 1, 1, 0.42]),
    sunR: cyc(p, [30, 22, 36, 26]),
    sunX: cyc(p, [640, 700, 580, 740]),
    sunY: cyc(p, [240, 150, 396, 232]),
    skyTop: cyc(p, SKY_TOP), skyMid: cyc(p, SKY_MID), skyHor: cyc(p, SKY_HOR),
    mountFar: cyc(p, MOUNT_FAR), mountNear: cyc(p, MOUNT_NEAR),
    waterTop: cyc(p, WATER_TOP), waterBot: cyc(p, WATER_BOT),
    grade: cyc(p, GRADE), light: cyc(p, LIGHT), mistColor: cyc(p, MIST), sunColor: cyc(p, SUN), grass: cyc(p, GRASS),
    beam: cyc(p, [0.5, 1, 0.8, 0.45]),
    // 0..1 camera sway: the whole view breathes once over the year (periodic)
    sway: Math.sin(p * TAU),
  };
}
