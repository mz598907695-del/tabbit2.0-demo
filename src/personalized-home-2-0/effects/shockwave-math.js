import { SHOCKWAVE_SETTINGS } from './shockwave-settings.js';

export const SHOCKWAVE_DURATION = SHOCKWAVE_SETTINGS.duration;
export const SHOCKWAVE_LENS_PIXELS = SHOCKWAVE_SETTINGS.lens;
export const SHOCKWAVE_BEVEL_PIXELS = SHOCKWAVE_SETTINGS.bevel;

export function getShockwaveFrame(progress, width, height, origin, reduced = false, easing = 'smooth') {
  const t = Math.max(0, Math.min(1, progress));
  const farthest = Math.max(...[[0,0],[width,0],[0,height],[width,height]]
    .map(([x,y]) => Math.hypot(x - origin.x, y - origin.y)));
  // Playback begins after the native snapshot is ready. The smooth curve keeps
  // the wave near its origin initially and crosses the center halfway through.
  const travel = easing==='linear'?t:easing==='fast'?1-(1-t)**3:t*t*(3-2*t);
  return {
    radius:reduced ? farthest * .45 : 20 + (farthest + 80) * travel,
    strength:reduced ? Math.sin(Math.PI * t) * .5 : Math.min(1, t / .03) * (1 - t ** 2.2),
  };
}

export function getShockwavePixelRatio(width, height, ratio = 1) {
  return Math.min(2, Math.max(.5, ratio), Math.sqrt(4_000_000 / Math.max(1, width * height)));
}
