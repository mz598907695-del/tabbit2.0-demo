import test from 'node:test';
import assert from 'node:assert/strict';
import { appearanceProgress, appearanceColorMix, appearanceFillMix, readSpaceAppearance } from '../../src/personalized-home-2-0/themes/space-appearance-values.js';

const storage = values => ({ getItem:key => values[key] ?? null });

test('gallery appearance belongs to the destination space, while color spaces use their saved global appearance', () => {
  const saved = storage({
    'tabbit-glass-theme:1':'wallpaper-example', 'tabbit-glass-theme-appearance:1':'dark',
    'tabbit-glass-theme:2':'light', 'tabbit-glass-theme-appearance:2':'dark',
    'tabbit-color-window-appearance-v1':'light',
  });
  assert.equal(readSpaceAppearance(saved, '1'), 'dark');
  assert.equal(readSpaceAppearance(saved, '2'), 'light');
});

test('system color mode and absent gallery preferences have deterministic fallbacks', () => {
  assert.equal(readSpaceAppearance(storage({}), '0', true), 'dark');
  assert.equal(readSpaceAppearance(storage({}), '0', false), 'light');
  assert.equal(readSpaceAppearance(storage({'tabbit-glass-theme:0':'wallpaper-example'}), '0', true), 'dark');
});

test('gesture progress stays finite and bounded', () => {
  assert.equal(appearanceProgress(-1), 0);
  assert.equal(appearanceProgress(1.3), 1);
  assert.equal(appearanceProgress(NaN), 0);
  assert.equal(appearanceProgress(.35), .35);
});

test('solid and gradient surface fills share two continuous color stops', () => {
  const mixed = appearanceFillMix('rgba(255, 255, 255, .8)', 'linear-gradient(#33333366, #3333334d)');
  assert.ok(mixed.includes('rgba(255, 255, 255, .8), #33333366'));
  assert.ok(mixed.includes('rgba(255, 255, 255, .8), #3333334d'));
  assert.ok(mixed.endsWith('100%)'));
  assert.equal(appearanceColorMix('#fff', '#fff'), '#fff');
});

test('the window veil retains its authored transparent stop while moving to the dark gradient', () => {
  const mixed = appearanceFillMix('linear-gradient(180deg, rgba(245, 245, 245, .85), #f5f5f500 99%)', 'linear-gradient(rgba(34, 34, 34, .6), rgba(25, 25, 25, .2))');
  assert.ok(mixed.includes('calc(99% + (1% * var(--space-appearance-progress, 0)))'));
  assert.ok(mixed.includes('#f5f5f500, rgba(25, 25, 25, .2)'));
});
