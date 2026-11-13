import test from 'node:test';
import assert from 'node:assert/strict';
import { getWorkdayCountdown, normalizeWorkdayConfig, splitCountdown } from '../../src/personalized-home-2-0/board/utility-widget-data.js';

const at = (day, hour, minute = 0, second = 0) => new Date(2026, 10, day, hour, minute, second);

test('workday countdown follows wall time before, during and after the shift', () => {
  const config = { startTime: '09:30', workHours: 8 };
  assert.equal(getWorkdayCountdown(at(13, 9), config).status, 'upcoming');
  assert.equal(getWorkdayCountdown(at(13, 9, 30), config).remainingSeconds, 8 * 3600);
  const working = getWorkdayCountdown(at(13, 12, 15, 30), config);
  assert.equal(working.status, 'working');
  assert.equal(working.remainingSeconds, 5 * 3600 + 14 * 60 + 30);
  assert.deepEqual(splitCountdown(working.remainingSeconds), ['05', '14', '30']);
  const finished = getWorkdayCountdown(at(13, 17, 30), config);
  assert.equal(finished.status, 'finished');
  assert.equal(finished.remainingSeconds, 0);
  assert.equal(getWorkdayCountdown(at(13, 23), config).remainingSeconds, 0);
});

test('an overnight shift keeps the previous start until its next scheduled start', () => {
  const config = { startTime: '22:30', workHours: 8.5 };
  const during = getWorkdayCountdown(at(14, 1), config);
  assert.equal(during.start.getDate(), 13);
  assert.equal(during.end.getDate(), 14);
  assert.equal(during.end.getHours(), 7);
  assert.equal(during.remainingSeconds, 6 * 3600);
  assert.equal(during.status, 'working');
  assert.equal(getWorkdayCountdown(at(14, 7), config).status, 'finished');
  assert.equal(getWorkdayCountdown(at(14, 22, 29), config).status, 'finished');
  const next = getWorkdayCountdown(at(14, 22, 30), config);
  assert.equal(next.start.getDate(), 14);
  assert.equal(next.remainingSeconds, 8.5 * 3600);
});

test('workday settings bound invalid durations and keep the display finite', () => {
  assert.deepEqual(normalizeWorkdayConfig({ startTime: '25:00', workHours: Infinity }), { startTime: '11:00', workHours: 8 });
  assert.equal(normalizeWorkdayConfig({ workHours: -5 }).workHours, 1);
  assert.equal(normalizeWorkdayConfig({ workHours: 100 }).workHours, 16);
  assert.equal(normalizeWorkdayConfig({ workHours: 8.4 }).workHours, 8.5);
  assert.deepEqual(splitCountdown(-1), ['00', '00', '00']);
  assert.deepEqual(splitCountdown(Infinity), ['00', '00', '00']);
});
