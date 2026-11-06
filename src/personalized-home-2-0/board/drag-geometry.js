// The pointer and grid rect are both viewport coordinates. Keeping the original
// grab offset preserves the point held on the card through scrolling/reflow.
export function boardDragPosition({ clientX, clientY, gridLeft, gridTop, grabX, grabY, pitchX, pitchY, columns, width }) {
  const left = clientX - gridLeft - grabX;
  const top = clientY - gridTop - grabY;
  return {
    left,
    top,
    column: Math.max(0, Math.min(columns - width, Math.round(left / pitchX))),
    row: Math.max(0, Math.round(top / pitchY)),
  };
}

// A tall card still belongs to one visual row when all items start at y = 0.
// Center the visible bodies, excluding the trailing inter-item gap.
export function boardAlignmentOffset(items, boardWidth, pitch, gap) {
  if (!items.length || items.some(item => item.y !== 0)) return 0;
  let firstColumn = Infinity;
  let lastColumn = -Infinity;
  for (const item of items) {
    firstColumn = Math.min(firstColumn, item.x);
    lastColumn = Math.max(lastColumn, item.x + item.w);
  }
  const occupiedWidth = (lastColumn - firstColumn) * pitch - gap;
  const offset = (boardWidth - occupiedWidth) / 2 - firstColumn * pitch;
  return Math.abs(offset) < 1e-9 ? 0 : offset;
}

// Resizing keeps its starting alignment offset and top-left anchor. Bound its
// width by the visible right edge as well as the remaining logical columns.
export function boardResizeMaxWidth({ boardWidth, pitch, gap, columns, column, offset = 0 }) {
  const visibleColumns = Math.floor((boardWidth - offset - column * pitch + gap) / pitch + 1e-9);
  return Math.max(1, Math.min(columns - column, visibleColumns));
}
