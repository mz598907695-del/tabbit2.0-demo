import test from 'node:test';
import assert from 'node:assert/strict';
import { windBrandAngle } from '../../src/personalized-home-2-0/themes/wind-brand-motion.js';

test('wind logo turns clockwise continuously and closes at a whole number of turns', () => {
  assert.equal(windBrandAngle(0), 0);
  assert.equal(windBrandAngle(1), 2880);
  for (let i=1; i<=1000; i++) assert.ok(windBrandAngle(i/1000) > windBrandAngle((i-1)/1000));
  assert.ok(Math.abs((windBrandAngle(.0001)-windBrandAngle(0)) - (windBrandAngle(1)-windBrandAngle(.9999))) < 1e-8);
});

test('the middle gust spins much faster than the quiet beginning and end', () => {
  const speed = phase => (windBrandAngle(phase+.001)-windBrandAngle(phase-.001))/.002;
  assert.ok(speed(.52) > speed(.1)*7);
  assert.ok(speed(.52) > speed(.9)*7);
  assert.ok(speed(.4) < speed(.52));
  assert.ok(speed(.64) < speed(.52));
});
