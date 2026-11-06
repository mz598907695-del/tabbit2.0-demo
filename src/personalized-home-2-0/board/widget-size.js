// Match the layout engine's supported coordinate range without limiting cards
// to a catalog of aspect ratios. Stored sizes are independent of viewport width.
export const MAX_WIDGET_WIDTH = 64;
export const MAX_WIDGET_HEIGHT = 128;

const widthLimit = value => Number.isFinite(value)
  ? Math.max(1, Math.min(MAX_WIDGET_WIDTH, Math.floor(value))) : MAX_WIDGET_WIDTH;

export function isWidgetSize(size, { maxWidth = MAX_WIDGET_WIDTH } = {}) {
  return Number.isInteger(size?.w) && Number.isInteger(size?.h)
    && size.w >= 1 && size.w <= widthLimit(maxWidth)
    && size.h >= 1 && size.h <= MAX_WIDGET_HEIGHT && size.w * size.h >= 2;
}

/** Round UI input to grid units; a widget must occupy at least two cells. */
export function normalizeWidgetSize(size, { maxWidth = MAX_WIDGET_WIDTH, axis, fallback = { w: 2, h: 2 } } = {}) {
  const limit = widthLimit(maxWidth);
  const previous = isWidgetSize(fallback) ? fallback : { w: 2, h: 2 };
  const rawW = Number.isFinite(size?.w) ? size.w : previous.w;
  const rawH = Number.isFinite(size?.h) ? size.h : previous.h;
  let w = Math.min(limit, Math.max(1, Math.round(rawW)));
  let h = Math.min(MAX_WIDGET_HEIGHT, Math.max(1, Math.round(rawH)));
  if (w === 1 && h === 1) {
    const horizontal = axis === 'h' || (axis !== 'w'
      && (rawW > rawH || (rawW === rawH && previous.w > previous.h)));
    if (horizontal && limit >= 2) w = 2;
    else h = 2;
  }
  return { w, h };
}
