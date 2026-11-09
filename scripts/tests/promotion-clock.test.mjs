import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPromotionClock } from '../../src/personalized-home-2-0/promotion-clock.js';

function setup({ count = 3, progress = false } = {}) {
  let time = 0, id = 0, frameRequests = 0;
  const timers = new Map(), frames = new Map(), slides = [], paints = [];
  const clock = createPromotionClock({
    count, now: () => time, onIndexChange: index => slides.push(index),
    onProgress: progress ? (index, fraction) => paints.push([index, fraction]) : undefined,
    setTimer: (callback, delay) => { const key = ++id; timers.set(key, { callback, at: time + delay }); return key; },
    clearTimer: key => timers.delete(key),
    requestFrame: callback => { frameRequests++; const key = ++id; frames.set(key, callback); return key; },
    cancelFrame: key => frames.delete(key),
  });
  function advance(duration) {
    const end = time + duration;
    while (true) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      time = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
    }
    time = end;
    const batch = [...frames.values()]; frames.clear(); batch.forEach(callback => callback(time));
  }
  return { clock, advance, timers, frames, slides, paints, frameRequests: () => frameRequests };
}

test('inline carousel sleeps for five seconds and never requests a progress frame', () => {
  const env = setup(); env.clock.start();
  env.advance(4999); assert.deepEqual(env.slides, []);
  env.advance(1); assert.deepEqual(env.slides, [1]);
  env.advance(10000); assert.deepEqual(env.slides, [1, 2, 0]);
  assert.equal(env.frameRequests(), 0);
  env.clock.dispose(); assert.equal(env.timers.size, 0);
});

test('nested hover and focus pauses retain the unspent slide time', () => {
  const env = setup(); env.clock.start(); env.advance(1800);
  env.clock.setPaused('hover', true); env.advance(10000);
  env.clock.setPaused('focus', true); env.clock.setPaused('hover', false);
  env.advance(10000); assert.deepEqual(env.slides, []);
  env.clock.setPaused('focus', false); env.advance(3199);
  assert.deepEqual(env.slides, []); env.advance(1); assert.deepEqual(env.slides, [1]);
});

test('manual selection resets the deadline, including while paused', () => {
  const env = setup(); env.clock.start(); env.advance(4000);
  env.clock.select(2); env.advance(4999); assert.deepEqual(env.slides, [2]);
  env.clock.setPaused('document', true); env.clock.select(1); env.advance(5000);
  assert.deepEqual(env.slides, [2, 1]); env.clock.setPaused('document', false);
  env.advance(5000); assert.deepEqual(env.slides, [2, 1, 2]);
});

test('progress carousel retains frame-based progress and stops on dispose', () => {
  const env = setup({ progress: true }); env.clock.start(); env.advance(2500);
  assert.deepEqual(env.paints.at(-1), [0, .5]);
  env.clock.setPaused('external', true); assert.equal(env.frames.size, 0);
  env.advance(1000); env.clock.setPaused('external', false); env.advance(2500);
  assert.deepEqual(env.slides, [1]); assert.deepEqual(env.paints.at(-1), [1, 0]);
  env.clock.dispose(); env.advance(10000); assert.deepEqual(env.slides, [1]);
});

test('one slide needs no inline timer; repeated start does not duplicate work', () => {
  const single = setup({ count: 1 }); single.clock.start(); assert.equal(single.timers.size, 0);
  const env = setup(); env.clock.start(); env.clock.start(); assert.equal(env.timers.size, 1);
  env.clock.dispose(); env.clock.start(); env.clock.select(2); assert.equal(env.timers.size, 0);
});
