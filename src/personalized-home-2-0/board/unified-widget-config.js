import { parseDay } from './extra-widget-data.js';

// Retain user-authored widget state across reloads, while bounding stored data.
// Individual widgets validate domain values when reading their configuration.
export function sanitizeWidgetConfig(value) {
  let budget = 100000;
  const clean = (entry, depth = 0) => {
    if (depth > 8 || budget <= 0) return undefined;
    if (entry === null || typeof entry === 'boolean') return entry;
    if (typeof entry === 'number') return Number.isFinite(entry) ? entry : undefined;
    if (typeof entry === 'string') {
      const result = entry.slice(0, Math.min(10000, budget));
      budget -= result.length;
      return result;
    }
    if (Array.isArray(entry)) return entry.slice(0, 200).map(item => clean(item, depth + 1)).filter(item => item !== undefined);
    if (entry && typeof entry === 'object') {
      return Object.fromEntries(Object.entries(entry).slice(0, 100).flatMap(([key, item]) => {
        if (['__proto__', 'prototype', 'constructor'].includes(key) || key.length > 100) return [];
        const result = clean(item, depth + 1);
        return result === undefined ? [] : [[key, result]];
      }));
    }
    return undefined;
  };
  return value && typeof value === 'object' && !Array.isArray(value) ? clean(value) : {};
}

// A habit's calendar history is longer than a generic list. Preserve the newest
// ten years of distinct valid dates without changing any other array's limit.
export function sanitizeHabitWidgetConfig(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const { dates, ...rest } = source;
  const result = sanitizeWidgetConfig(rest);
  result.dates = Array.isArray(dates)
    ? [...new Set(dates.filter(date => typeof date === 'string' && parseDay(date)))].sort().slice(-3660)
    : [];
  return result;
}

// Imported cards use a separate storage contract. Never truncate an accepted
// entry: a 64 KB note must survive reload exactly as it was written.
export function sanitizeAICardStorage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  try {
    const encoded = JSON.stringify(value);
    if (new TextEncoder().encode(encoded).length > 131072) return {};
    const restored = JSON.parse(encoded);
    return Object.fromEntries(Object.entries(restored).filter(([key, entry]) =>
      !['__proto__', 'prototype', 'constructor'].includes(key)
      && key.length > 0 && new TextEncoder().encode(key).length <= 128
      && !key.startsWith('__tabbit/') && entry && typeof entry === 'object'
      && entry.key === key && Object.hasOwn(entry, 'value')
      && new TextEncoder().encode(JSON.stringify(entry.value)).length <= 65536));
  } catch { return {}; }
}
