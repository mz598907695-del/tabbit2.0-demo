// Original, bounded capsule displacement map; no external textures or runtime
// network requests. The flat center stays neutral; only a narrow rim refracts.
export function createCapsuleLens(width, height) {
  const safe = (value, max) => Number.isFinite(value) ? Math.max(1, Math.min(max, Math.round(value))) : 1;
  const w = safe(width, 1024);
  const h = safe(height, 128);
  const radius = Math.min(w, h) / 2;
  const band = Math.max(1, Math.min(5, radius * .45));
  const displacement = new Uint8ClampedArray(w * h * 4);
  const rim = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + .5;
      const py = y + .5;
      const dx = px - Math.max(radius, Math.min(w - radius, px));
      const dy = py - Math.max(radius, Math.min(h - radius, py));
      const distance = Math.hypot(dx, dy);
      const depth = radius - distance;
      const bend = depth >= 0 && depth < band ? Math.sin(Math.PI * depth / band) : 0;
      const nx = distance ? dx / distance : 0;
      const ny = distance ? dy / distance : 0;
      const i = (y * w + x) * 4;
      displacement.set([128 + nx * bend * 90, 128 + ny * bend * 90, 128, 255], i);
      const light = .25 + .35 * Math.max(0, -.6 * nx - .8 * ny);
      const alpha = depth >= 0 ? Math.exp(-depth / .85) * light : 0;
      rim.set([255, 255, 255, 255 * alpha], i);
    }
  }
  return { width: w, height: h, scale: Math.min(10, h * .315), displacement, rim };
}

export function attachCapsuleLens(element, host = window) {
  const doc = element.ownerDocument;
  const ns = 'http://www.w3.org/2000/svg';
  const transparency = host.matchMedia('(prefers-reduced-transparency: reduce)');
  const supported = host.CSS?.supports('backdrop-filter', 'blur(1px) url("#lens") saturate(1.35)');
  if (!supported) return () => {};
  const make = (tag, attributes) => {
    const node = doc.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  };
  const svg = make('svg', { 'aria-hidden': 'true', width: 0, height: 0, focusable: 'false' });
  svg.style.cssText = 'position:absolute;pointer-events:none;overflow:hidden';
  const filter = make('filter', { id: 'tabbit-glass-capsule-lens', filterUnits: 'userSpaceOnUse', x: 0, y: 0, 'color-interpolation-filters': 'sRGB' });
  const lens = make('feImage', { result: 'lens', preserveAspectRatio: 'none' });
  const displacement = make('feDisplacementMap', { in: 'SourceGraphic', in2: 'lens', xChannelSelector: 'R', yChannelSelector: 'G' });
  filter.append(lens, displacement);
  svg.append(filter);
  doc.body.append(svg);
  let frame = null;
  let lastSize = '';
  let disposed = false;
  const clear = () => {
    element.style.removeProperty('--glass-lens');
    element.style.removeProperty('--glass-rim-image');
    lastSize = '';
  };
  const imageURL = (data, width, height) => {
    const canvas = doc.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const image = context.createImageData(width, height);
    image.data.set(data);
    context.putImageData(image, 0, 0);
    return canvas.toDataURL();
  };
  const paint = () => {
    frame = null;
    if (disposed || doc.hidden || transparency.matches) return;
    const { width, height } = element.getBoundingClientRect();
    if (!width || !height) return;
    const key = `${Math.round(width)}:${Math.round(height)}`;
    if (key === lastSize) return;
    const map = createCapsuleLens(width, height);
    const mapURL = imageURL(map.displacement, map.width, map.height);
    const rimURL = imageURL(map.rim, map.width, map.height);
    if (!mapURL || !rimURL) return;
    for (const node of [filter, lens]) {
      node.setAttribute('width', String(width)); node.setAttribute('height', String(height));
    }
    lens.setAttribute('href', mapURL);
    displacement.setAttribute('scale', String(map.scale));
    element.style.setProperty('--glass-lens', 'url("#tabbit-glass-capsule-lens")');
    element.style.setProperty('--glass-rim-image', `url("${rimURL}")`);
    lastSize = key;
  };
  const schedule = () => {
    if (frame !== null) host.cancelAnimationFrame(frame);
    frame = null;
    if (transparency.matches) clear();
    if (!disposed && !doc.hidden && !transparency.matches) frame = host.requestAnimationFrame(paint);
  };
  const observer = new host.ResizeObserver(schedule);
  observer.observe(element);
  doc.addEventListener('visibilitychange', schedule);
  transparency.addEventListener('change', schedule);
  schedule();
  return () => {
    disposed = true;
    if (frame !== null) host.cancelAnimationFrame(frame);
    observer.disconnect();
    doc.removeEventListener('visibilitychange', schedule);
    transparency.removeEventListener('change', schedule);
    clear();
    svg.remove();
  };
}
