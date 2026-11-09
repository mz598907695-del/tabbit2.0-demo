import { LEGACY_LIQUID_GLASS_THEME, resolveThemePreferences } from './themes/appearance.js';
import { resolveThemeSource } from '../themeSelection';

const accentColors = ['#ff7900', '#3478f6', '#8b5cf6', '#e85c8a', '#16a085', '#e05252'];

export function resolvePreferences(saved = {}, systemDark = false) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  // Promote the saved comparison value once; legacy keys are not persisted again.
  const glassOpacity = Number.isFinite(saved.catpawGlassOpacity)
    ? saved.catpawGlassOpacity : saved.liquidGlassOpacity;
  return {
    ...resolveThemePreferences(saved, systemDark),
    themeSource:resolveThemeSource(saved.theme || 'light', saved.themeSource),
    liquidGlass: typeof saved.liquidGlass === 'boolean' ? saved.liquidGlass : saved.theme === LEGACY_LIQUID_GLASS_THEME,
    wallpaperBlur: saved.wallpaperBlur === true,
    largeTabRadius: saved.largeTabRadius !== false,
    liquidGlassOpacity: Number.isFinite(glassOpacity)
      ? Math.min(100, Math.max(0, Math.round(glassOpacity)))
      : 50,
    accent: accentColors.includes(saved.accent) ? saved.accent : accentColors[0],
    shortcutShape: saved.shortcutShape === 'square' ? 'square' : 'circle',
    shortcutSize: ['large', 'medium', 'small'].includes(saved.shortcutSize)
      ? saved.shortcutSize
      : saved.shortcutFill === 'full' ? 'large' : saved.shortcutFill === 'center' ? 'small' : 'medium',
    pageWidth: ['wide', 'full'].includes(saved.pageWidth) ? 'wide' : 'standard',
    shortcuts: saved.shortcuts !== false,
    shortcutLabels: saved.shortcutLabels === true,
    // Reveal the corner activity card once for existing demo preferences too.
    promotionDefaultVersion: 1,
    promotion: saved.promotionDefaultVersion === 1 ? saved.promotion !== false : true,
    promotionStyle: saved.promotionDefaultVersion === 1 && saved.promotionStyle === 'inline' ? 'inline' : 'card',
  };
}
