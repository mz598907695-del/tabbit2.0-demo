// Small helpers shared by the Canvas 2D wallpapers.
export const css = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
export const mod = (a, n) => ((a % n) + n) % n;
export const mulberry32 = seed => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

/** A soft cloud sprite; `tint` ([r,g,b] 0-1, optional) colours it, e.g. warm dawn light. */
export function cloudSprite(rand, width, height, tint, compact = false) {
  const sprite = document.createElement('canvas');
  sprite.width = width; sprite.height = height;
  const g = sprite.getContext('2d');
  const puffs = 9 + Math.floor(rand() * 4);
  for (let i = 0; i < puffs; i++) {
    const x = width * (.14 + .72 * (i / (puffs - 1))) + (rand() - .5) * 14;
    // compact clouds keep every puff inside the sprite so they can be scaled up without a flat top
    const r = height * (compact ? .2 + .17 * Math.sin(Math.PI * i / (puffs - 1)) : .3 + .3 * Math.sin(Math.PI * i / (puffs - 1))) * (.75 + rand() * .5);
    const y = compact ? height * .62 - r * .3 + (rand() - .5) * 4 : height * .66 - r * .45 + (rand() - .5) * 6;
    const gradient = g.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, 'rgba(255,255,255,.92)'); gradient.addColorStop(.55, 'rgba(255,255,255,.55)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gradient; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  if (tint) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = css(tint, .42); g.fillRect(0, 0, width, height);
  }
  return sprite;
}
