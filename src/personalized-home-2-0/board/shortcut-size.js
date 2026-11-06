import { MAX_WIDGET_WIDTH, MAX_WIDGET_HEIGHT } from './widget-size.js';

export const SHORTCUT_SIZE_PRESETS = Object.freeze([
  Object.freeze({ id: 'small', label: '小', w: 1, h: 1 }),
  Object.freeze({ id: 'medium', label: '中', w: 2, h: 1 }),
  Object.freeze({ id: 'large', label: '大', w: 3, h: 1 }),
]);

export function isShortcutSize(size) {
  return Number.isInteger(size?.w) && size.w >= 1 && size.w <= 3 && size.h === 1;
}

/** Accept the former freely resized dimensions only for safe migration. */
export function isLegacyShortcutSize(size) {
  return Number.isInteger(size?.w) && Number.isInteger(size?.h)
    && size.w >= 1 && size.w <= MAX_WIDGET_WIDTH
    && size.h >= 1 && size.h <= MAX_WIDGET_HEIGHT;
}

/** Keep width intent when migrating; canonical presets never depend on viewport. */
export function normalizeShortcutSize(size, { fallback = { w: 1, h: 1 } } = {}) {
  const source = isLegacyShortcutSize(size) ? size
    : isLegacyShortcutSize(fallback) ? fallback : { w: 1, h: 1 };
  return { w: Math.min(3, source.w), h: 1 };
}
