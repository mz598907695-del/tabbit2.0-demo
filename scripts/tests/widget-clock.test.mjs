import test from 'node:test';
import assert from 'node:assert/strict';
import { createWidgetClock } from '../../src/personalized-home-2-0/board/widget-clock.js';

function fixture() {
  let activity, releases = 0, next = 0, time = 1000;
  const timers = new Map();
  const subscribe = createWidgetClock({
    now: () => new Date(time),
    schedule: (callback, interval) => { const id = ++next; timers.set(id, { callback, interval }); return id; },
    cancel: id => timers.delete(id),
    subscribeActivity: callback => { activity = callback; callback(true); return () => releases++; },
  });
  return { subscribe, timers, activity: value => activity(value), setTime: value => { time = value; }, releases: () => releases };
}

test('widgets share one timer per cadence and release it after the last listener', () => {
  const f = fixture(), a = [], b = [];
  const first = f.subscribe(date => a.push(date), 1000);
  const second = f.subscribe(date => b.push(date), 1000);
  const third = f.subscribe(() => {}, 60000);
  assert.deepEqual([...f.timers.values()].map(timer => timer.interval), [1000, 60000]);
  f.setTime(2000);
  [...f.timers.values()][0].callback();
  assert.equal(a.at(-1), b.at(-1));
  first(); assert.equal(f.timers.size, 2);
  second(); assert.equal(f.timers.size, 1);
  third(); assert.equal(f.timers.size, 0); assert.equal(f.releases(), 1);
});

test('inactive windows schedule no widget work and refresh immediately on return', () => {
  const f = fixture(), samples = [];
  const release = f.subscribe(date => samples.push(+date));
  f.activity(false);
  assert.equal(f.timers.size, 0);
  f.setTime(60000);
  assert.deepEqual(samples, [1000]);
  f.activity(true);
  assert.deepEqual(samples, [1000, 60000]);
  assert.equal(f.timers.size, 1);
  release(); assert.equal(f.timers.size, 0);
});
