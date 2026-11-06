export const SIDEBAR_WIDTH_DEFAULT = 256;
export const SIDEBAR_WIDTH_MIN = 224;
export const SIDEBAR_WIDTH_MAX = 400;
export const SIDEBAR_WIDTH_KEY = 'personalized-home-2-0-ai-sidebar-width';

export function sidebarWidthLimit(availableWidth) {
  return Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, availableWidth - 360));
}
export function clampSidebarWidth(width, availableWidth) {
  const value = Number.isFinite(width) ? width : SIDEBAR_WIDTH_DEFAULT;
  return Math.round(Math.max(SIDEBAR_WIDTH_MIN, Math.min(sidebarWidthLimit(availableWidth), value)));
}
