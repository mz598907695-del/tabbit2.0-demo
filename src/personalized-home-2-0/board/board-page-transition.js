export const BOARD_PAGE_GAP = 48;
export function boardPageTravel(viewportWidth) {
  return Math.max(1, Number(viewportWidth) || 1) + BOARD_PAGE_GAP;
}
export function boardPageFade(distance, travel) {
  const progress = Math.max(0, Math.min(1, distance / Math.max(1, travel)));
  return { incoming: Math.min(1, progress / .55), outgoing: Math.max(0, 1 - progress / .85) };
}
