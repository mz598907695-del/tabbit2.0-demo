import test from 'node:test';
import assert from 'node:assert/strict';
import { composerScrollFrame } from '../../src/personalized-home-2-0/composer-scroll.js';

const geometry = { origin:300, feedHeight:1200, wrapperHeight:120, canvasInset:0, formOffset:0, height:120, taskInset:46 };

test('expanded sticky task composer leaves room for its controls and frame rim', () => {
  const frame = composerScrollFrame(geometry, 400, 0, 1);
  assert.equal(frame.formTop - geometry.taskInset, 16);
  assert.equal(frame.glassEdge, frame.formTop + 120);
});

test('folding releases the task inset and restores the compact sticky anchor', () => {
  assert.equal(composerScrollFrame(geometry, 400, .5, 1).formTop, 39);
  assert.equal(composerScrollFrame(geometry, 400, 1, 1).formTop, 16);
  const { taskInset, ...chat } = geometry;
  assert.equal(composerScrollFrame(chat, 400, 0, 1).formTop, 16);
});
