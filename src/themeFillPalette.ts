import { spaceColors } from './spaceColors';
import fillDefaults from './theme-fill-defaults.json';

export type FillMode = 'light' | 'dark';
export type FillValue = { color:string; opacity:number };
export type FillPalette = Record<string, Record<FillMode, FillValue>>;
export const THEME_FILL_PALETTE_KEY = 'tabbit-theme-fill-palette-v1';
export const THEME_FILL_PALETTE_EVENT = 'tabbit-theme-fill-palette-changed';
export const THEME_FILL_PREVIEW_EVENT = 'tabbit-theme-fill-preview';
export const isFillColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export const DEFAULT_FILL_PALETTE: FillPalette = fillDefaults;

// Displayed slider percentages map to the authored 20–80% alpha range.
export const sliderToFillOpacity = (value:number) => 20 + Math.max(0, Math.min(100, value)) * 0.6;
export const fillOpacityToSlider = (value:number) => Math.max(0, Math.min(100, (value - 20) / 0.6));

export function readFillPalette(storage: Pick<Storage, 'getItem'> = localStorage): FillPalette {
  let saved: Record<string, Partial<Record<FillMode, string | Partial<FillValue>>>> = {};
  try { saved = JSON.parse(storage.getItem(THEME_FILL_PALETTE_KEY) || '{}') || {}; } catch { /* Use defaults. */ }
  return Object.fromEntries(spaceColors.map(preset => {
    const entry = (mode:FillMode):FillValue => {
      const value = saved[preset.name]?.[mode];
      const color = typeof value === 'string' ? value : value?.color;
      const opacity = typeof value === 'object' && value ? value.opacity : undefined;
      return {
        color:isFillColor(color) ? color.toLowerCase() : DEFAULT_FILL_PALETTE[preset.name][mode].color,
        opacity:typeof opacity === 'number' && Number.isFinite(opacity) ? Math.max(0, Math.min(100, opacity)) : DEFAULT_FILL_PALETTE[preset.name][mode].opacity,
      };
    };
    return [preset.name, { light:entry('light'), dark:entry('dark') }];
  }));
}

// Theme identity stays canonical; only the independent window fill changes.
export function resolveFillColor(color: string, mode: FillMode, palette: FillPalette): string {
  const preset = spaceColors.find(item => item.tintColor === color.toLowerCase());
  return preset ? palette[preset.name][mode].color : color;
}

export function resolveFillOpacity(color:string, mode:FillMode, palette:FillPalette, fallback:number):number {
  const preset = spaceColors.find(item => item.tintColor === color.toLowerCase());
  return preset ? palette[preset.name][mode].opacity : fallback;
}

export function updateFillOpacity(color:string, mode:FillMode, opacity:number) {
  const preset = spaceColors.find(item => item.tintColor === color.toLowerCase());
  if (!preset) return;
  const palette = readFillPalette();
  palette[preset.name][mode].opacity = Math.max(0, Math.min(100, opacity));
  localStorage.setItem(THEME_FILL_PALETTE_KEY, JSON.stringify(palette));
  window.dispatchEvent(new Event(THEME_FILL_PALETTE_EVENT));
}
