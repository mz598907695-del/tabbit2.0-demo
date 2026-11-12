import test from 'node:test';
import assert from 'node:assert/strict';
import { spectrumPaths } from '../../src/personalized-home-2-0/board/audio-spectrum.js';
const count = path => (path.match(/M/g) || []).length;

test('idle spectrum retains the 480 dots with a distinct 32-dot baseline', () => {
  const paths = spectrumPaths([]);
  assert.equal(count(paths.dim), 448);
  assert.equal(count(paths.baseline), 32);
  assert.equal(paths.lit, '');
  assert.equal(paths.peak, '');
});

test('full spectrum preserves lit dot count and only colors the outer lit pair on clipping', () => {
  const normal = spectrumPaths(Array(32).fill(1));
  const clipped = spectrumPaths(Array(32).fill(1), true);
  assert.equal(count(normal.lit), 416);
  assert.equal(count(normal.dim), 64);
  assert.equal(normal.baseline, '');
  assert.equal(count(clipped.lit), 352);
  assert.equal(count(clipped.peak), 64);
  assert.equal(clipped.dim, normal.dim);
});

test('bounded and missing bands always produce exactly 480 circles in no more than four paths', () => {
  for (const bands of [[-1, Infinity, NaN, undefined, .001, .5], Array(32).fill(.4)]) {
    const paths = spectrumPaths(bands, true);
    assert.equal(Object.values(paths).reduce((sum, path) => sum + count(path), 0), 480);
    assert.ok(Object.values(paths).filter(Boolean).length <= 4);
  }
});
