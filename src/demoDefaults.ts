import snapshot from './demo-defaults.json';
import glassBaseline from './glass-space-baseline.json';
import { spaceColors } from './spaceColors';

type DemoStorage = Pick<Storage, 'getItem' | 'setItem'>;
export const baseGlassSettings = { color:spaceColors[0].tintColor, tint:spaceColors[0].tint, clear:false, veil:0, highlight:0, edge:15 };
export const GLASS_THEME_EVENT = 'tabbit-glass-theme-selected';
export const GLASS_SPACE_THEME_EVENT = 'tabbit-glass-space-theme';
export function themedGlassSettings(color:string, tint = spaceColors.find(item => item.tintColor === color.toLowerCase())?.tint ?? 50) {
  return { ...baseGlassSettings, color:/^#[0-9a-f]{6}$/i.test(color) ? color : baseGlassSettings.color, tint:Number.isFinite(tint) ? Math.max(0,Math.min(100,tint)) : 50 };
}
const defaults:Record<string,string> = snapshot.storage;
const marker = 'tabbit-demo-defaults-version';

export function defaultSpaceGlass(spaceId:string) {
  if (spaceId === '0') return { ...baseGlassSettings };
  if (spaceId === '3') return themedGlassSettings(spaceColors[7].tintColor, spaceColors[7].tint);
  const spaces:Record<string,typeof baseGlassSettings> = glassBaseline.spaces;
  return themedGlassSettings(spaces[spaceId]?.color || baseGlassSettings.color);
}

export function initializeDemoDefaults(storage:DemoStorage, migrateLegacy = false) {
  try {
    const installed = storage.getItem(marker);
    const legacyBlank = migrateLegacy && !installed && Array.from({length:5}, (_,i) => {
      const saved = storage.getItem(`tabbit-glass-space:${i}`);
      if (!saved) return true;
      try { const value = JSON.parse(saved); return Object.entries(baseGlassSettings).every(([key, expected]) => value[key] === expected); }
      catch { return false; }
    }).every(Boolean);
    if (legacyBlank) {
      const previous = Object.fromEntries(Object.keys(defaults).map(key => [key,storage.getItem(key)]));
      storage.setItem(`tabbit-demo-defaults-backup:${snapshot.version}`, JSON.stringify(previous));
    }
    for (const [key,value] of Object.entries(defaults)) {
      if (legacyBlank || storage.getItem(key) === null) storage.setItem(key,value);
    }
    storage.setItem(marker,snapshot.version);
    const firstSpacePresetVersion = 'tabbit-first-space-preset-version';
    if (storage.getItem(firstSpacePresetVersion) !== '1') {
      storage.setItem('tabbit-glass-space:0', JSON.stringify(baseGlassSettings));
      storage.setItem('tabbit-glass-tint:0', String(baseGlassSettings.tint));
      storage.setItem('tabbit-glass-enabled:0', 'true');
      storage.setItem(firstSpacePresetVersion, '1');
    }
    const fourthSpacePresetVersion = 'tabbit-fourth-space-preset-version';
    if (storage.getItem(fourthSpacePresetVersion) !== '1') {
      const settings = defaultSpaceGlass('3');
      storage.setItem('tabbit-glass-space:3', JSON.stringify(settings));
      storage.setItem('tabbit-glass-tint:3', String(settings.tint));
      storage.setItem('tabbit-glass-enabled:3', 'true');
      storage.setItem(fourthSpacePresetVersion, '1');
    }
  } catch { /* Storage restrictions must not prevent the demo from opening. */ }
}
