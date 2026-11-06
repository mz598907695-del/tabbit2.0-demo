// Use viewport coordinates because the submenu lives in the browser's top layer.
export function positionContextSubmenu({ parentRect, anchorRect, submenuRect, viewportWidth, viewportHeight, gap = 4, inset = 8 }) {
  const width = Math.min(submenuRect.width, Math.max(0, viewportWidth - inset * 2));
  const height = Math.min(submenuRect.height, Math.max(0, viewportHeight - inset * 2));
  const right = parentRect.right + gap;
  const left = parentRect.left - gap - width;
  const rightFits = right + width <= viewportWidth - inset;
  const leftFits = left >= inset;
  const side = rightFits || (!leftFits && viewportWidth - parentRect.right >= parentRect.left) ? 'right' : 'left';
  return {
    left: Math.max(inset, Math.min(side === 'right' ? right : left, viewportWidth - width - inset)),
    top: Math.max(inset, Math.min(anchorRect.top - 4, viewportHeight - height - inset)),
    side,
  };
}
