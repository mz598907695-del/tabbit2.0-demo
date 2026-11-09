export type ThemeSource = 'color' | 'gallery';
export const COLOR_WINDOW_APPEARANCE_KEY = 'tabbit-color-window-appearance-v1';

export function resolveThemeSource(theme: string, source?: string | null): ThemeSource {
  if (source === 'color' || source === 'gallery') return source;
  return ['light', 'dark', 'cream', 'mint'].includes(theme) ? 'color' : 'gallery';
}
