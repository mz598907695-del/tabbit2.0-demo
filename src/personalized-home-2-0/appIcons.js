export const APP_ICON_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 9];

export function normalizeAppIcon(value) {
  return APP_ICON_OPTIONS.includes(value) ? value : 0;
}
