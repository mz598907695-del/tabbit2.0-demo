import { isWidgetSize, normalizeWidgetSize } from '../widget-size.js';

// A grid cell is about 50 px. Text-heavy cards need at least three columns;
// numeric cards work at two. A one-row summary needs room for its main action.
const textKinds = new Set(['news', 'quote', 'joke', 'note', 'timetable', 'quick-links']);

export function spectrumMinimumSize(kind, height = 2) {
  if (kind === 'image') return { w: 1, h: 1 };
  return { w: height <= 1 ? 4 : textKinds.has(kind) ? 3 : 2, h: 1 };
}

export function normalizeSpectrumSize(kind, requested, options = {}) {
  if (kind === 'image') return normalizeWidgetSize(requested, options);
  const fallback = isWidgetSize(options.fallback) ? options.fallback : { w: 2, h: 2 };
  const width = Number.isFinite(requested?.w) ? requested.w : fallback.w;
  const height = Number.isFinite(requested?.h) ? requested.h : fallback.h;
  // Apply the content minimum before the general two-cell rule. Otherwise a
  // 1×1 request becomes 1×2 or 2×1 depending on the resize axis, losing the
  // requested strip layout when dragging or adding a card.
  const minimum = spectrumMinimumSize(kind, Math.max(1, Math.round(height)));
  // Respect the available board width, even on an unusually narrow host.
  return normalizeWidgetSize({ w: Math.max(width, minimum.w), h: height }, options);
}

export function spectrumLibrarySizes(kind, choices) {
  const seen = new Set();
  return choices.map(choice => ({ ...choice, ...normalizeSpectrumSize(kind, choice) }))
    .filter(size => {
      const key = `${size.w}-${size.h}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
