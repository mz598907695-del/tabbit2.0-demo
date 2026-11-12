import { isWallpaperTheme } from "./wallpapers.js";
import { isBundledWallpaperTheme } from "./officialWallpapers.js";

const isArtworkWallpaperTheme = theme => isWallpaperTheme(theme) || isBundledWallpaperTheme(theme);

export const LEGACY_LIQUID_GLASS_THEME = "liquid-glass";

export const officialBackgrounds = {
  light: "#ffffff", cream: "#f5f1e9", mint: "#edf5f0", dark: "#191a1c",
};

export function getThemeBackground(theme, appearance = "light") {
  if (isArtworkWallpaperTheme(theme)) return officialBackgrounds[appearance === "dark" ? "dark" : "light"];
  return Object.hasOwn(officialBackgrounds, theme) ? officialBackgrounds[theme] : officialBackgrounds.light;
}

export function getThemeAppearance(theme) {
  const channels = getThemeBackground(theme).slice(1).match(/.{2}/g).map((hex) => {
    const value = parseInt(hex, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance < 0.18 ? "dark" : "light";
}

export function getThemeSelectionAppearance(theme, currentAppearance) {
  // Both personal and bundled artwork keep the user's chosen UI appearance.
  if (isArtworkWallpaperTheme(theme)) return ["system", "light", "dark"].includes(currentAppearance) ? currentAppearance : "light";
  return getThemeAppearance(theme);
}

export function matchThemeToAppearance(theme, appearance, systemDark) {
  const resolved = appearance === "system" ? (systemDark ? "dark" : "light") : appearance;
  if (theme === LEGACY_LIQUID_GLASS_THEME) return resolved;
  if (isArtworkWallpaperTheme(theme)) return theme;
  return getThemeAppearance(theme) === resolved ? theme : resolved;
}

export function resolveThemePreferences(saved = {}, systemDark = false) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) saved = {};
  if (saved.theme === LEGACY_LIQUID_GLASS_THEME) {
    const appearance = ["system", "light", "dark"].includes(saved.appearance) ? saved.appearance : "light";
    saved = { ...saved, theme: matchThemeToAppearance(saved.theme, appearance, systemDark), appearance, appearanceVersion: 1 };
  }
  const systemAppearance = systemDark ? "dark" : "light";
  const hasTheme = Object.hasOwn(officialBackgrounds, saved.theme) || isArtworkWallpaperTheme(saved.theme);
  // New visitors start in 白昼. A saved theme or explicit system preference is
  // still authoritative, so changing the default never overwrites a choice.
  let appearance = ["system", "light", "dark"].includes(saved.appearance)
    ? saved.appearance : hasTheme ? getThemeAppearance(saved.theme) : "light";
  let theme = hasTheme ? saved.theme : appearance === "system" ? systemAppearance : appearance;

  // Old preferences allowed conflicting backgrounds and UI colors. Preserve the
  // chosen artwork when migrating, then use one consistent rule on later loads.
  if (saved.appearanceVersion !== 1 && hasTheme && !isArtworkWallpaperTheme(theme)) {
    const themeAppearance = getThemeAppearance(theme);
    if (appearance !== "system" || themeAppearance !== systemAppearance) appearance = themeAppearance;
  }
  theme = matchThemeToAppearance(theme, appearance, systemDark);
  return { theme, appearance, appearanceVersion: 1 };
}
