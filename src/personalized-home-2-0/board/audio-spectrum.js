// Keep the same 32 × 15 dots, but batch equal paint into four SVG paths.
const dot = (x, y, r) => `M${x - r},${y}a${r},${r} 0 1 0 ${r * 2},0a${r},${r} 0 1 0 ${-r * 2},0`;
const columns = Array.from({ length: 32 }, (_, x) => Array.from({ length: 8 }, (_, height) => {
  const paths = { dim: [], baseline: [], lit: [], peak: [] };
  for (let y = 0; y < 15; y++) {
    const lit = height > 0 && Math.abs(y - 7) < height;
    const key = lit ? Math.abs(y - 7) === 6 ? 'peak' : 'lit' : y === 7 ? 'baseline' : 'dim';
    paths[key].push(dot(5 + x * 10, 5 + y * 10, lit ? 2.6 : 1.8));
  }
  return Object.fromEntries(Object.entries(paths).map(([key, values]) => [key, values.join('')]));
}));

export function spectrumPaths(bands = [], clipping = false) {
  const paths = { dim: [], baseline: [], lit: [], peak: [] };
  columns.forEach((column, x) => {
    const height = Math.ceil(Math.max(0, Math.min(1, Number(bands[x]) || 0)) * 7);
    const entry = column[height];
    paths.dim.push(entry.dim);
    paths.baseline.push(entry.baseline);
    paths.lit.push(entry.lit);
    paths[clipping ? 'peak' : 'lit'].push(entry.peak);
  });
  return Object.fromEntries(Object.entries(paths).map(([key, values]) => [key, values.join('')]));
}
