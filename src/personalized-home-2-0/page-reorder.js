const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function pageDropIndex(center, firstCenter, pitch, count) {
  if (count < 2 || !Number.isFinite(pitch) || pitch <= 0) return 0;
  return clamp(Math.round((center - firstCenter) / pitch), 0, count - 1);
}

export function pagePreviewOffset(index, from, to, pitch) {
  if (from < to && index > from && index <= to) return -pitch;
  if (from > to && index >= to && index < from) return pitch;
  return 0;
}

/** Keep the held dot visible while its scrollable content moves underneath it. */
export function pageDragPosition({ pointerDelta, scrollLeft, startScroll, origin, firstCenter, pitch, count, viewportWidth, halfWidth = 6 }) {
  const lastCenter = firstCenter + pitch * (count - 1);
  const min = Math.max(firstCenter, scrollLeft + halfWidth + 2);
  const max = Math.min(lastCenter, scrollLeft + viewportWidth - halfWidth - 2);
  const center = clamp(origin + pointerDelta + scrollLeft - startScroll, min, Math.max(min, max));
  return { offset: center - origin, targetIndex: pageDropIndex(center, firstCenter, pitch, count) };
}

/** Pixels per second; zero at an exhausted edge prevents an idle frame loop. */
export function pageEdgeVelocity(pointerX, left, right, scrollLeft, maxScroll) {
  if (maxScroll <= 0 || right <= left) return 0;
  const edge = Math.min(24, (right - left) / 3);
  if (pointerX < left + edge && scrollLeft > 0) return -240 * clamp((left + edge - pointerX) / edge, 0, 1);
  if (pointerX > right - edge && scrollLeft < maxScroll) return 240 * clamp((pointerX - right + edge) / edge, 0, 1);
  return 0;
}

export function isPageGestureClick(blockedPointerId, pointerId, detail) {
  return blockedPointerId != null && detail > 0 && (pointerId == null || pointerId === blockedPointerId);
}
