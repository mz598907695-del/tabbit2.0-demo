// Integrating the gust envelope keeps speed continuous and always clockwise.
// Three steady turns plus five gust turns close the loop at exactly eight turns.
export function windBrandAngle(progress) {
  const phase = Math.max(0, Math.min(1, progress));
  const gust = Math.max(0, Math.min(1, (phase - .28) / .48));
  const accumulated = gust - Math.sin(2 * Math.PI * gust) / (2 * Math.PI);
  return 360 * (3 * phase + 5 * accumulated);
}

export const WIND_BRAND_KEYFRAMES = Array.from({ length:81 }, (_, index) => ({
  offset:index / 80, transform:`rotate(${windBrandAngle(index / 80)}deg)`,
}));
