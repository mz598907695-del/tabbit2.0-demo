export const appearanceProgress = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

export function readSpaceAppearance(storage, spaceId, systemDark = false) {
  const theme = storage.getItem(`tabbit-glass-theme:${spaceId}`) || 'light';
  const source = storage.getItem(`tabbit-glass-theme-source:${spaceId}`);
  const gallery = source ? source === 'gallery' : !['light', 'dark', 'cream', 'mint'].includes(theme);
  const saved = gallery ? storage.getItem(`tabbit-glass-theme-appearance:${spaceId}`)
    : storage.getItem('tabbit-color-window-appearance-v1') || 'system';
  return saved === 'dark' || saved === 'light' ? saved : systemDark ? 'dark' : 'light';
}

export function appearanceColorMix(from, to) {
  return from === to ? from : `color-mix(in srgb, ${from}, ${to} calc(var(--space-appearance-progress, 0) * 100%))`;
}

function splitStops(value) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    else if (value[i] === ')') depth--;
    else if (value[i] === ',' && !depth) { parts.push(value.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(value.slice(start).trim());
  return parts;
}

function gradientEnds(value) {
  const match = value.trim().match(/^linear-gradient\((.*)\)$/s);
  if (!match) return [{color:value, position:0}, {color:value, position:100}];
  const stops = splitStops(match[1]).filter(stop => !/^(?:to\s|[-.\d]+(?:deg|turn|rad))/.test(stop));
  return [stops[0], stops[stops.length - 1]].map((stop, index) => {
    const end = stop.match(/\s+([\d.]+)%$/);
    return { color:end ? stop.slice(0, end.index).trim() : stop, position:end ? Number(end[1]) : index * 100 };
  });
}

// The current materials use solid fills or two-stop vertical gradients.
// Normalizing a solid to equal stops avoids a discrete background-image switch.
export function appearanceFillMix(from, to) {
  if (from === to) return from;
  const start = gradientEnds(from), end = gradientEnds(to);
  return `linear-gradient(180deg, ${start.map((stop, index) => {
    const target = end[index];
    const position = stop.position === target.position ? `${stop.position}%`
      : `calc(${stop.position}% + (${target.position - stop.position}% * var(--space-appearance-progress, 0)))`;
    return `${appearanceColorMix(stop.color, target.color)} ${position}`;
  }).join(', ')})`;
}
