import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { officialWallpapers, communityWallpapers, bundledWallpaperIds, getBundledWallpaper } from '../../src/personalized-home-2-0/themes/officialWallpapers.js';
import { resolveThemePreferences } from '../../src/personalized-home-2-0/themes/appearance.js';

test('every bundled wallpaper is visible in a gallery and has media plus a preview', () => {
  const gallery = [...officialWallpapers, ...communityWallpapers];
  assert.equal(new Set(gallery.map(item => item.id)).size, gallery.length);
  assert.deepEqual(new Set(gallery.map(item => item.id)), bundledWallpaperIds);
  for (const item of gallery) {
    assert.equal(getBundledWallpaper(item.id), item);
    for (const url of [item.url, item.preview]) {
      assert.ok(existsSync(new URL(`../../public${url.split('?')[0]}`, import.meta.url)), url);
    }
  }
});

test('removed effect themes fall back to the saved appearance', () => {
  for (const theme of ['ocean-fishing', 'mono-07', 'scroll-suzhou', 'example-wallpaper-blue-meadow']) {
    assert.equal(getBundledWallpaper(theme), undefined);
    assert.equal(resolveThemePreferences({ theme, appearance: 'dark', appearanceVersion: 1 }).theme, 'dark');
  }
});

test('gallery choices and personal uploads survive theme validation', () => {
  for (const theme of [...bundledWallpaperIds, 'wallpaper-11111111-2222-3333-4444-555555555555']) {
    assert.equal(resolveThemePreferences({ theme, appearance: 'system' }, true).theme, theme);
  }
});
